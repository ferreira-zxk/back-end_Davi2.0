const pedidosRepo = require('../dados/pedidosRepositorio');
const produtosRepo = require('../dados/produtosRepositorio');
const clientesRepo = require('../dados/clientesRepositorio');
const pg = require('../servicos/pagamentos');

const METODOS = ['pix', 'cartao_credito', 'cartao_debito'];

// Enquanto não houver um gateway de verdade, o Pix pode ser "pago" por um botão de teste.
// Em produção, coloque PAGAMENTO_SIMULADO=false no .env.
function modoTeste() {
  return process.env.PAGAMENTO_SIMULADO !== 'false';
}

// O carrinho vem do navegador, mas os PREÇOS nunca: o servidor sempre usa o preço do banco.
function lerItens(bruto) {
  if (!Array.isArray(bruto) || bruto.length === 0) return { erro: 'O carrinho está vazio' };

  const quantidades = new Map();
  for (const item of bruto) {
    const id = Number(item?.produto_id);
    const quantidade = Number(item?.quantidade);
    if (!Number.isInteger(id) || !Number.isInteger(quantidade) || quantidade < 1) {
      return { erro: 'Item do carrinho inválido' };
    }
    quantidades.set(id, (quantidades.get(id) ?? 0) + quantidade);
  }

  const itens = [];
  for (const [id, quantidade] of quantidades) {
    const produto = produtosRepo.buscarPorId(id);
    if (!produto) return { erro: 'Um dos produtos do carrinho não está mais disponível' };
    if (quantidade > 20) return { erro: `Máximo de 20 unidades de "${produto.nome}" por pedido` };
    itens.push({
      produto_id: id,
      nome: produto.nome,
      preco_centavos: Math.round(produto.preco * 100),
      quantidade
    });
  }

  return { itens };
}

// Confere as formas de pagamento: 1 ou 2, diferentes entre si, somando exatamente o total.
function lerPagamentos(bruto, totalCentavos) {
  if (!Array.isArray(bruto) || bruto.length < 1 || bruto.length > 2) {
    return { erro: 'Escolha uma ou duas formas de pagamento' };
  }

  const metodos = bruto.map(p => p?.metodo);
  if (metodos.some(m => !METODOS.includes(m))) return { erro: 'Forma de pagamento inválida' };
  if (bruto.length === 2 && metodos[0] === metodos[1]) {
    return { erro: 'As duas formas de pagamento precisam ser diferentes' };
  }

  const lista = [];
  let soma = 0;

  for (const p of bruto) {
    const valor = p.valor_centavos;
    if (!Number.isInteger(valor) || valor <= 0) {
      return { erro: 'Informe um valor maior que zero em cada forma de pagamento' };
    }
    soma += valor;

    const item = { metodo: p.metodo, valor_centavos: valor, parcelas: 1 };

    if (p.metodo !== 'pix') {
      const cartao = pg.validarCartao(p.cartao);
      if (cartao.erro) return { erro: cartao.erro };
      Object.assign(item, { numero: cartao.numero, final_cartao: cartao.final, bandeira: cartao.bandeira });
    }

    if (p.metodo === 'cartao_credito') {
      const parcelas = Number(p.parcelas ?? 1);
      const maximo = pg.maxParcelas(valor);
      if (!Number.isInteger(parcelas) || parcelas < 1 || parcelas > maximo) {
        return { erro: `Para este valor o parcelamento vai até ${maximo}x` };
      }
      item.parcelas = parcelas;
    }

    lista.push(item);
  }

  if (soma !== totalCentavos) {
    return { erro: 'A soma das formas de pagamento precisa ser igual ao total do pedido' };
  }

  return { lista };
}

// Atualiza o que mudou com o tempo: Pix que venceu e status geral do pedido.
function sincronizar(id) {
  let pedido = pedidosRepo.buscarPorId(id);
  const limite = Date.now() - pg.EXPIRA_PIX_MIN * 60 * 1000;

  if (new Date(pedido.criado_em).getTime() < limite) {
    const venceu = pedido.pagamentos.filter(p => p.metodo === 'pix' && p.status === 'pendente');
    if (venceu.length > 0) {
      venceu.forEach(p => pedidosRepo.atualizarPagamento(p.id, 'expirado', 'O tempo para pagar o Pix acabou'));
      // O que já tinha sido aprovado no cartão volta para o cliente.
      pedido.pagamentos
        .filter(p => p.status === 'aprovado')
        .forEach(p => pedidosRepo.atualizarPagamento(p.id, 'estornado', 'Pedido expirou'));
      pedido = pedidosRepo.buscarPorId(id);
    }
  }

  const status = pg.calcularStatusPedido(pedido.pagamentos);
  if (status !== pedido.status) {
    pedidosRepo.atualizarStatus(id, status);
    pedido.status = status;
  }

  return pedido;
}

function apresentar(pedido) {
  return {
    ...pedido,
    modo_teste: modoTeste(),
    pagamentos: pedido.pagamentos.map(p => {
      if (p.metodo !== 'cartao_credito') return p;
      const parcelas = pg.calcularParcelas(p.valor_centavos, p.parcelas);
      return {
        ...p,
        primeira_parcela_centavos: parcelas[0],
        valor_parcela_centavos: parcelas[parcelas.length - 1]
      };
    })
  };
}

function criar(req, res) {
  const cliente = clientesRepo.buscarPorUsuario(req.usuario.id);
  if (!cliente) {
    return res.status(400).json({ erro: 'Cadastre seus dados antes de pagar' });
  }

  const corpo = req.body ?? {};

  const lidosItens = lerItens(corpo.itens);
  if (lidosItens.erro) return res.status(400).json({ erro: lidosItens.erro });

  const total = lidosItens.itens.reduce((soma, i) => soma + i.preco_centavos * i.quantidade, 0);

  const lidosPagamentos = lerPagamentos(corpo.pagamentos, total);
  if (lidosPagamentos.erro) return res.status(400).json({ erro: lidosPagamentos.erro });

  // Resultado de cada forma de pagamento (aqui é onde o gateway de verdade responderia).
  const lista = lidosPagamentos.lista.map(p => {
    if (p.metodo === 'pix') return { ...p, status: 'pendente', numero: undefined };

    const resposta = pg.autorizarCartao(p.numero);
    return {
      ...p,
      numero: undefined, // o número do cartão não passa daqui
      status: resposta.aprovado ? 'aprovado' : 'recusado',
      motivo: resposta.motivo
    };
  });

  // Se uma parte foi recusada, o pedido todo cai: o que estava aprovado é estornado e o Pix é cancelado.
  if (lista.some(p => p.status === 'recusado')) {
    lista.forEach(p => {
      if (p.status === 'aprovado') p.status = 'estornado';
      else if (p.status === 'pendente') p.status = 'cancelado';
    });
  }

 
const pedidoId = pedidosRepo.criar(req.usuario.id, {
  subtotal: total,
  desconto: 0,
  frete: 0,
  total: total,
  cupom: null
});

lidosItens.itens.forEach(item => {
  pedidosRepo.adicionarItem(pedidoId, item);
});

lista.forEach(p => {
  if (p.metodo === 'pix' && p.status === 'pendente') {
    p.codigo_pix = pg.gerarCodigoPix(pedidoId);
  }

  pedidosRepo.adicionarPagamento(pedidoId, p);
});


  const pedido = sincronizar(pedidoId);
  res.status(pedido.status === 'recusado' ? 402 : 201).json(apresentar(pedido));
}

function listar(req, res) {
  res.json(pedidosRepo.listarPorUsuario(req.usuario.id));
}

// Só o dono do pedido (ou um admin) enxerga. Para os outros, responde 404 como se não existisse.
function buscarDoUsuario(req, apenasDono = false) {
  const pedido = pedidosRepo.buscarPorId(Number(req.params.id));
  if (!pedido) return undefined;

  const dono = pedido.usuario_id === req.usuario.id;
  const admin = req.usuario.papel === 'admin' && !apenasDono;
  return dono || admin ? pedido : undefined;
}

// "Verificar pagamento": recalcula o status e devolve o pedido atualizado.
function buscar(req, res) {
  const pedido = buscarDoUsuario(req);

  if (!pedido) {
    return res.status(404).json({ erro: 'Pedido não encontrado' });
  }

  res.json(apresentar(sincronizar(pedido.id)));
}

// Só no modo de teste: finge que o banco avisou que o Pix foi pago.
function simularPix(req, res) {
  if (!modoTeste()) {
    return res.status(403).json({ erro: 'Esta confirmação só existe no modo de teste' });
  }

  if (!buscarDoUsuario(req, true)) {
    return res.status(404).json({ erro: 'Pedido não encontrado' });
  }

  const pedido = sincronizar(Number(req.params.id));
  const pagamento = pedido.pagamentos.find(
    p => p.id === Number(req.params.pagamentoId) && p.metodo === 'pix'
  );

  if (!pagamento) return res.status(404).json({ erro: 'Pagamento Pix não encontrado' });
  if (pagamento.status !== 'pendente') {
    return res.status(409).json({ erro: 'Este Pix não está mais aguardando pagamento' });
  }

  pedidosRepo.atualizarPagamento(pagamento.id, 'aprovado', null);
  res.json(apresentar(sincronizar(pedido.id)));
}

module.exports = { criar, listar, buscar, simularPix };
