// Carrinho e checkout. Usa funções e variáveis do script.js (sessao, produtos, el, mostrar...).

const CHAVE_CARRINHO = 'carrinho';
const LIMITE_POR_PRODUTO = 20;
const INTERVALO_VERIFICACAO = 8000; // confere o Pix a cada 8 segundos

const botaoCarrinho = document.getElementById('botao-carrinho');
const contadorCarrinho = document.getElementById('contador-carrinho');
const botaoPedidos = document.getElementById('botao-pedidos');
const dialogoCarrinho = document.getElementById('dialogo-carrinho');
const carrinhoLista = document.getElementById('carrinho-lista');
const carrinhoRodape = document.getElementById('carrinho-rodape');
const carrinhoTotal = document.getElementById('carrinho-total');
const carrinhoParcela = document.getElementById('carrinho-parcela');
const dialogoCheckout = document.getElementById('dialogo-checkout');
const checkoutTitulo = document.getElementById('checkout-titulo');
const etapas = document.getElementById('etapas');
const checkoutCorpo = document.getElementById('checkout-corpo');

let carrinho = lerCarrinho();
let verificacao = null; // timer que confere o pagamento
let assinaturaPedido = '';

const $ = id => document.getElementById(id);

// ---------- Carrinho ----------

function lerCarrinho() {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_CARRINHO));
    if (!Array.isArray(lista)) return [];
    return lista.filter(i => Number.isInteger(i.id) && Number.isInteger(i.quantidade) && i.quantidade > 0);
  } catch {
    return [];
  }
}

function salvarCarrinho() {
  try {
    localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(carrinho));
  } catch {
    // sem localStorage o carrinho só dura até fechar a página
  }
  atualizarContador();
}

function atualizarContador() {
  const quantidade = carrinho.reduce((soma, item) => soma + item.quantidade, 0);
  contadorCarrinho.textContent = quantidade;
  contadorCarrinho.hidden = quantidade === 0;
}

function adicionarAoCarrinho(id) {
  const item = carrinho.find(i => i.id === id);
  if (item) item.quantidade = Math.min(item.quantidade + 1, LIMITE_POR_PRODUTO);
  else carrinho.push({ id, quantidade: 1 });
  salvarCarrinho();
}

function mudarQuantidade(id, diferenca) {
  const item = carrinho.find(i => i.id === id);
  if (!item) return;
  item.quantidade = Math.max(1, Math.min(item.quantidade + diferenca, LIMITE_POR_PRODUTO));
  salvarCarrinho();
  renderizarCarrinho();
}

function removerDoCarrinho(id) {
  carrinho = carrinho.filter(i => i.id !== id);
  salvarCarrinho();
  renderizarCarrinho();
}

// Junta o que está no carrinho (id + quantidade) com os dados atuais do produto.
function itensDoCarrinho() {
  return carrinho
    .map(item => ({ ...item, produto: produtos.find(p => p.id === item.id) }))
    .filter(item => item.produto);
}

function totalCentavos() {
  return itensDoCarrinho().reduce((soma, i) => soma + emCentavos(i.produto.preco) * i.quantidade, 0);
}

function renderizarCarrinho() {
  // Produto que o admin apagou da loja sai do carrinho.
  if (estadoLista === 'ok') {
    const antes = carrinho.length;
    carrinho = carrinho.filter(item => produtos.some(p => p.id === item.id));
    if (carrinho.length !== antes) salvarCarrinho();
  }

  const itens = itensDoCarrinho();
  carrinhoLista.textContent = '';
  carrinhoRodape.hidden = itens.length === 0;

  if (itens.length === 0) {
    let vazio = 'Seu carrinho está vazio.';
    if (carrinho.length > 0 && estadoLista === 'carregando') vazio = 'Carregando o carrinho...';
    if (carrinho.length > 0 && estadoLista === 'erro') vazio = 'Não foi possível carregar os produtos do carrinho.';
    carrinhoLista.append(el('li', 'aviso-carrinho', vazio));
    return;
  }

  itens.forEach(({ produto, quantidade }) => {
    const linha = el('li', 'carrinho-item');

    const info = el('div', 'carrinho-info');
    info.append(el('p', 'carrinho-nome', produto.nome));
    const specs = [produto.marca, produto.armazenamento, produto.cor].filter(Boolean).join(', ');
    if (specs) info.append(el('p', 'tile-specs', specs));
    info.append(el('p', 'tile-parcela', `${formatarPreco(produto.preco)} cada`));

    const menos = el('button', 'botao-qtd', '−');
    menos.type = 'button';
    menos.setAttribute('aria-label', `Diminuir a quantidade de ${produto.nome}`);
    menos.disabled = quantidade <= 1;
    menos.addEventListener('click', () => mudarQuantidade(produto.id, -1));

    const mais = el('button', 'botao-qtd', '+');
    mais.type = 'button';
    mais.setAttribute('aria-label', `Aumentar a quantidade de ${produto.nome}`);
    mais.disabled = quantidade >= LIMITE_POR_PRODUTO;
    mais.addEventListener('click', () => mudarQuantidade(produto.id, 1));

    const qtd = el('span', 'qtd', String(quantidade));
    qtd.setAttribute('aria-live', 'polite');

    const remover = el('button', 'botao-texto perigo', 'Remover');
    remover.type = 'button';
    remover.addEventListener('click', () => removerDoCarrinho(produto.id));

    const controles = el('div', 'carrinho-controles');
    controles.append(menos, qtd, mais, remover);

    const subtotal = el('strong', 'carrinho-subtotal', formatarCentavos(emCentavos(produto.preco) * quantidade));

    linha.append(info, subtotal, controles);
    carrinhoLista.append(linha);
  });

  const total = totalCentavos();
  carrinhoTotal.textContent = formatarCentavos(total);
  const parcelas = maxParcelas(total);
  carrinhoParcela.textContent = parcelas > 1
    ? `ou até ${parcelas}x de ${formatarCentavos(Math.floor(total / parcelas))} sem juros no cartão`
    : '';
}

function abrirCarrinho() {
  renderizarCarrinho();
  if (!dialogoCarrinho.open) dialogoCarrinho.showModal();
}

function fecharCarrinho() {
  if (dialogoCarrinho.open) dialogoCarrinho.close();
}

// ---------- Chamadas ao servidor ----------

// Já manda o token. Se o login venceu (401), desloga e devolve null.
async function chamar(url, opcoes = {}) {
  const resposta = await fetch(url, { ...opcoes, headers: cabecalhos() });
  const corpo = await resposta.json().catch(() => ({}));

  if (resposta.status === 401) {
    sair(corpo.erro, 'erro');
    return null;
  }

  return { ok: resposta.ok, status: resposta.status, corpo };
}

const ERRO_CONEXAO = 'Não foi possível falar com o servidor. Tente de novo.';

// ---------- Janela do checkout ----------

function abrirJanela() {
  if (!dialogoCheckout.open) dialogoCheckout.showModal();
}

function fecharCheckout() {
  pararVerificacao();
  if (dialogoCheckout.open) dialogoCheckout.close();
}

function pararVerificacao() {
  clearInterval(verificacao);
  verificacao = null;
}

function marcarEtapa(nome) {
  const mostrarEtapas = nome !== 'pedidos';
  etapas.hidden = !mostrarEtapas;
  checkoutTitulo.textContent = mostrarEtapas ? 'Finalizar compra' : 'Meus pedidos';

  etapas.querySelectorAll('li').forEach(item => {
    if (item.dataset.etapa === nome) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}

// Chamado pelo script.js quando a pessoa sai da conta.
function aoSair() {
  fecharCarrinho();
  fecharCheckout();
}

async function iniciarCheckout() {
  if (itensDoCarrinho().length === 0) return;
  fecharCarrinho();

  if (!estaLogado()) {
    acaoAposLogin = iniciarCheckout;
    abrirLogin('Entre ou crie uma conta para finalizar a compra.', 'info');
    return;
  }

  abrirJanela();
  mostrarEtapaDados();
}

// ---------- Etapa 1: dados do cliente ----------

const soDigitos = texto => texto.replace(/\D/g, '');

function mascaraCpf(texto) {
  return soDigitos(texto).slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function mascaraTelefone(texto) {
  const digitos = soDigitos(texto).slice(0, 11);
  const base = digitos.replace(/(\d{2})(\d)/, '($1) $2');
  return digitos.length <= 10
    ? base.replace(/(\d{4})(\d)/, '$1-$2')
    : base.replace(/(\d{5})(\d)/, '$1-$2');
}

function mascaraCep(texto) {
  return soDigitos(texto).slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

function campo(id, rotulo, atributos = '', classe = '') {
  return `<div class="campo ${classe}"><label for="${id}">${rotulo}</label><input id="${id}" ${atributos}></div>`;
}

const CAMPOS_CLIENTE = [
  'nome_completo', 'cpf', 'telefone', 'cep', 'endereco', 'numero', 'bairro', 'cidade', 'estado'
];

async function mostrarEtapaDados() {
  pararVerificacao();
  marcarEtapa('dados');
  checkoutCorpo.textContent = 'Carregando seus dados...';

  let cliente = null;
  try {
    const resposta = await chamar('/clientes/eu');
    if (!resposta) return;
    if (resposta.ok) cliente = resposta.corpo;
  } catch {
    // sem dados salvos ou sem conexão: o formulário abre vazio
  }

  checkoutCorpo.innerHTML = `
    <form id="form-cliente" class="grade-form" novalidate>
      ${campo('cli-nome_completo', 'Nome completo', 'type="text" autocomplete="name"', 'campo-cheio')}
      ${campo('cli-cpf', 'CPF', 'type="text" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00"', 'campo-largo')}
      ${campo('cli-telefone', 'Telefone com DDD', 'type="tel" autocomplete="tel" placeholder="(00) 00000-0000"', 'campo-largo')}
      ${campo('cli-cep', 'CEP', 'type="text" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000"')}
      ${campo('cli-endereco', 'Endereço', 'type="text" autocomplete="address-line1"', 'campo-largo')}
      ${campo('cli-numero', 'Número', 'type="text" autocomplete="off"')}
      ${campo('cli-bairro', 'Bairro', 'type="text" autocomplete="address-level3"', 'campo-largo')}
      ${campo('cli-cidade', 'Cidade', 'type="text" autocomplete="address-level2"')}
      ${campo('cli-estado', 'UF', 'type="text" maxlength="2" autocomplete="address-level1" placeholder="MT"')}
      <p id="cli-mensagem" class="campo-cheio" role="status"></p>
      <div class="botoes campo-cheio">
        <button type="submit" class="botao-primario">Continuar para o pagamento</button>
      </div>
    </form>`;

  if (cliente) {
    CAMPOS_CLIENTE.forEach(nome => { $(`cli-${nome}`).value = cliente[nome] ?? ''; });
    $('cli-cpf').value = mascaraCpf(cliente.cpf);
    $('cli-telefone').value = mascaraTelefone(cliente.telefone);
    $('cli-cep').value = mascaraCep(cliente.cep);
  }

  $('cli-cpf').addEventListener('input', e => { e.target.value = mascaraCpf(e.target.value); });
  $('cli-telefone').addEventListener('input', e => { e.target.value = mascaraTelefone(e.target.value); });
  $('cli-cep').addEventListener('input', e => {
    e.target.value = mascaraCep(e.target.value);
    if (soDigitos(e.target.value).length === 8) buscarCep(soDigitos(e.target.value));
  });
  $('form-cliente').addEventListener('submit', salvarCliente);
  $('cli-nome_completo').focus();
}

// Preenche o endereço pelo CEP (serviço público ViaCEP). Se falhar, a pessoa digita.
async function buscarCep(cep) {
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    const dados = await resposta.json();
    if (dados.erro) return;

    const preencher = (id, valor) => { if (valor && !$(id).value) $(id).value = valor; };
    preencher('cli-endereco', dados.logradouro);
    preencher('cli-bairro', dados.bairro);
    preencher('cli-cidade', dados.localidade);
    preencher('cli-estado', dados.uf);
    $('cli-numero').focus();
  } catch {
    // sem internet ou serviço fora do ar: segue o preenchimento manual
  }
}

async function salvarCliente(evento) {
  evento.preventDefault();
  const mensagemCliente = $('cli-mensagem');

  const dados = {};
  CAMPOS_CLIENTE.forEach(nome => { dados[nome] = $(`cli-${nome}`).value.trim(); });

  try {
    const resposta = await chamar('/clientes/eu', { method: 'PUT', body: JSON.stringify(dados) });
    if (!resposta) return;

    if (!resposta.ok) {
      mostrar(mensagemCliente, resposta.corpo.erro, 'erro');
      return;
    }

    mostrarEtapaPagamento();
  } catch {
    mostrar(mensagemCliente, ERRO_CONEXAO, 'erro');
  }
}

// ---------- Etapa 2: pagamento (uma ou duas formas) ----------

const METODOS = [
  ['cartao_credito', 'Cartão de crédito'],
  ['cartao_debito', 'Cartão de débito'],
  ['pix', 'Pix']
];
const NOME_METODO = Object.fromEntries(METODOS);

// "1.299,90", "1299,90" e "1299.90" viram 129990. Texto inválido vira null.
function lerCentavos(texto) {
  let limpo = texto.replace(/[R$\s]/g, '');
  if (limpo.includes(',')) limpo = limpo.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}

function numeroParaCampo(centavos) {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function blocoPagamento(i) {
  const opcoes = METODOS.map(([valor, nome]) => `<option value="${valor}">${nome}</option>`).join('');
  return `
    <fieldset class="bloco-pg" id="bloco-${i}">
      <legend>Forma de pagamento ${i + 1}</legend>
      <div class="grade-form">
        <div class="campo campo-largo">
          <label for="metodo-${i}">Forma</label>
          <select id="metodo-${i}">${opcoes}</select>
        </div>
        ${campo(`valor-${i}`, 'Valor (R$)', 'type="text" inputmode="decimal" autocomplete="off"', 'campo-largo')}
        <div class="campo campo-cheio" id="area-parcelas-${i}">
          <label for="parcelas-${i}">Parcelas</label>
          <select id="parcelas-${i}"></select>
        </div>
        <div class="grade-form campo-cheio" id="area-cartao-${i}">
          ${campo(`cartao-numero-${i}`, 'Número do cartão', 'type="text" inputmode="numeric" autocomplete="cc-number" placeholder="0000 0000 0000 0000"', 'campo-largo')}
          ${campo(`cartao-nome-${i}`, 'Nome impresso no cartão', 'type="text" autocomplete="cc-name"', 'campo-largo')}
          ${campo(`cartao-validade-${i}`, 'Validade', 'type="text" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/AA" maxlength="5"', 'campo-largo')}
          ${campo(`cartao-cvv-${i}`, 'CVV', 'type="text" inputmode="numeric" autocomplete="cc-csc" maxlength="4"', 'campo-largo')}
        </div>
        <p class="aviso-pix campo-cheio" id="area-pix-${i}">
          O código Pix aparece na confirmação e vale por 30 minutos.
        </p>
      </div>
    </fieldset>`;
}

// Devolve os valores (em centavos) de cada forma de pagamento, ou null se o valor da 1ª for inválido.
function valoresDosBlocos() {
  const total = totalCentavos();
  if (!$('pg-dividir').checked) return [total];

  const primeiro = lerCentavos($('valor-0').value);
  if (primeiro === null || primeiro <= 0 || primeiro >= total) return null;
  return [primeiro, total - primeiro];
}

function preencherParcelas(i, valor) {
  const seletor = $(`parcelas-${i}`);
  const anterior = Number(seletor.value) || 1;
  const maximo = maxParcelas(valor);

  seletor.textContent = '';
  for (let n = 1; n <= maximo; n++) {
    const parcelas = calcularParcelas(valor, n);
    const base = parcelas[parcelas.length - 1];
    let texto = n === 1
      ? `1x de ${formatarCentavos(valor)} à vista`
      : `${n}x de ${formatarCentavos(base)} sem juros`;
    if (parcelas[0] !== base) texto += ` (1ª parcela de ${formatarCentavos(parcelas[0])})`;
    seletor.append(new Option(texto, String(n)));
  }
  seletor.value = String(Math.min(anterior, maximo));
}

function atualizarPagamento() {
  const total = totalCentavos();
  const dividir = $('pg-dividir').checked;
  const quantidade = dividir ? 2 : 1;
  $('bloco-1').hidden = !dividir;

  // As duas formas precisam ser diferentes: a que já foi escolhida fica bloqueada no outro seletor.
  const primeira = $('metodo-0');
  const segunda = $('metodo-1');
  if (dividir) {
    if (segunda.value === primeira.value) {
      segunda.value = METODOS.find(([valor]) => valor !== primeira.value)[0];
    }
    [...segunda.options].forEach(o => { o.disabled = o.value === primeira.value; });
    [...primeira.options].forEach(o => { o.disabled = o.value === segunda.value; });
  } else {
    [...primeira.options].forEach(o => { o.disabled = false; });
  }

  const valores = valoresDosBlocos();
  $('valor-0').readOnly = !dividir;
  $('valor-1').readOnly = true;
  if (!dividir) $('valor-0').value = numeroParaCampo(total);
  if (dividir) $('valor-1').value = valores ? numeroParaCampo(valores[1]) : '';

  const partes = [];
  for (let i = 0; i < quantidade; i++) {
    const metodo = $(`metodo-${i}`).value;
    const valor = valores ? valores[i] : null;

    $(`area-parcelas-${i}`).hidden = metodo !== 'cartao_credito';
    $(`area-cartao-${i}`).hidden = metodo === 'pix';
    $(`area-pix-${i}`).hidden = metodo !== 'pix';

    if (valor === null) continue;
    if (metodo === 'cartao_credito') preencherParcelas(i, valor);

    let parte = `${NOME_METODO[metodo]}: ${formatarCentavos(valor)}`;
    if (metodo === 'cartao_credito' && Number($(`parcelas-${i}`).value) > 1) {
      parte += ` em ${$(`parcelas-${i}`).value}x`;
    }
    partes.push(parte);
  }

  $('pg-resumo').textContent = valores
    ? partes.join(' + ')
    : `Informe na primeira forma um valor maior que zero e menor que ${formatarCentavos(total)}.`;
  $('pg-resumo').className = valores ? 'resumo-pg' : 'resumo-pg resumo-erro';
  $('pg-pagar').disabled = !valores;
}

function mostrarEtapaPagamento() {
  pararVerificacao();
  marcarEtapa('pagamento');
  const total = totalCentavos();

  if (total === 0) {
    checkoutCorpo.textContent = 'Seu carrinho está vazio.';
    return;
  }

  checkoutCorpo.innerHTML = `
    <form id="form-pagamento" novalidate>
      <div class="linha-total linha-total-grande"><span>Total do pedido</span><strong>${formatarCentavos(total)}</strong></div>
      <label class="opcao-dividir">
        <input type="checkbox" id="pg-dividir"> Pagar com duas formas de pagamento
      </label>
      ${blocoPagamento(0)}
      ${blocoPagamento(1)}
      <p id="pg-resumo" class="resumo-pg"></p>
      <p id="pg-mensagem" role="status"></p>
      <div class="botoes">
        <button type="submit" id="pg-pagar" class="botao-primario">Pagar ${formatarCentavos(total)}</button>
        <button type="button" id="pg-voltar" class="botao-secundario">Voltar aos meus dados</button>
      </div>
    </form>`;

  $('metodo-0').value = 'cartao_credito';
  $('metodo-1').value = 'pix';
  $('bloco-1').hidden = true;
  atualizarPagamento();

  $('pg-dividir').addEventListener('change', () => {
    // Ao dividir, começa em partes iguais; o cliente ajusta o valor da 1ª forma.
    $('valor-0').value = numeroParaCampo($('pg-dividir').checked ? Math.floor(total / 2) : total);
    atualizarPagamento();
  });

  [0, 1].forEach(i => {
    $(`metodo-${i}`).addEventListener('change', atualizarPagamento);
    $(`parcelas-${i}`).addEventListener('change', atualizarPagamento);
    $(`cartao-numero-${i}`).addEventListener('input', e => {
      e.target.value = soDigitos(e.target.value).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ');
    });
    $(`cartao-validade-${i}`).addEventListener('input', e => {
      e.target.value = soDigitos(e.target.value).slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
    });
    $(`cartao-cvv-${i}`).addEventListener('input', e => { e.target.value = soDigitos(e.target.value); });
  });
  $('valor-0').addEventListener('input', atualizarPagamento);

  $('pg-voltar').addEventListener('click', mostrarEtapaDados);
  $('form-pagamento').addEventListener('submit', enviarPedido);
}

async function enviarPedido(evento) {
  evento.preventDefault();
  const mensagemPagamento = $('pg-mensagem');
  const valores = valoresDosBlocos();
  if (!valores) return;

  const pagamentos = valores.map((valor, i) => {
    const metodo = $(`metodo-${i}`).value;
    const pagamento = { metodo, valor_centavos: valor };

    if (metodo === 'cartao_credito') pagamento.parcelas = Number($(`parcelas-${i}`).value);
    if (metodo !== 'pix') {
      pagamento.cartao = {
        numero: $(`cartao-numero-${i}`).value,
        nome: $(`cartao-nome-${i}`).value.trim(),
        validade: $(`cartao-validade-${i}`).value,
        cvv: $(`cartao-cvv-${i}`).value
      };
    }
    return pagamento;
  });

  // O servidor recalcula o total com os preços do banco; daqui vão só id e quantidade.
  const itens = carrinho.map(item => ({ produto_id: item.id, quantidade: item.quantidade }));

  $('pg-pagar').disabled = true;
  mostrar(mensagemPagamento, 'Processando o pagamento...', 'info');

  try {
    const resposta = await chamar('/pedidos', { method: 'POST', body: JSON.stringify({ itens, pagamentos }) });
    if (!resposta) return;

    if (resposta.corpo.id) {
      // 201 (criado) ou 402 (recusado). Só esvazia o carrinho se o pedido não foi recusado.
      if (resposta.status === 201) {
        carrinho = [];
        salvarCarrinho();
      }
      mostrarResultado(resposta.corpo);
      return;
    }

    mostrar(mensagemPagamento, resposta.corpo.erro || 'Não foi possível finalizar o pedido.', 'erro');
    $('pg-pagar').disabled = false;
  } catch {
    mostrar(mensagemPagamento, ERRO_CONEXAO, 'erro');
    $('pg-pagar').disabled = false;
  }
}

// ---------- Etapa 3: confirmação e verificação do pagamento ----------

const TITULO_STATUS = {
  pago: 'Pagamento aprovado',
  aguardando_pagamento: 'Aguardando o pagamento',
  recusado: 'Pagamento recusado',
  expirado: 'Pedido expirado'
};

const TEXTO_STATUS = {
  pago: 'Recebemos o seu pagamento. Obrigado pela compra!',
  aguardando_pagamento: 'Pague o Pix abaixo para concluir o pedido. Conferimos o pagamento sozinhos a cada poucos segundos.',
  recusado: 'O pedido não foi concluído. Se alguma parte já tinha sido aprovada, ela foi estornada e nada foi cobrado.',
  expirado: 'O tempo para pagar o Pix acabou e o pedido foi cancelado. Monte o carrinho de novo para tentar outra vez.'
};

const ROTULO_PAGAMENTO = {
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  recusado: 'Recusado',
  estornado: 'Estornado',
  cancelado: 'Cancelado',
  expirado: 'Expirado'
};

function descreverPagamento(p) {
  const valor = formatarCentavos(p.valor_centavos);

  if (p.metodo === 'pix') return `Pix, ${valor}`;

  let texto = `${NOME_METODO[p.metodo]} ${p.bandeira} final ${p.final_cartao}, ${valor}`;
  if (p.metodo === 'cartao_credito' && p.parcelas > 1) {
    texto += ` em ${p.parcelas}x de ${formatarCentavos(p.valor_parcela_centavos)}`;
    if (p.primeira_parcela_centavos !== p.valor_parcela_centavos) {
      texto += ` (1ª parcela de ${formatarCentavos(p.primeira_parcela_centavos)})`;
    }
  }
  return texto;
}

function assinatura(pedido) {
  return `${pedido.status}|${pedido.pagamentos.map(p => p.status).join(',')}`;
}

function mostrarResultado(pedido) {
  pararVerificacao();
  marcarEtapa('resultado');
  assinaturaPedido = assinatura(pedido);

  const secao = el('div', 'resultado');
  secao.append(el('h3', `resultado-titulo status-${pedido.status}`, TITULO_STATUS[pedido.status]));
  secao.append(el('p', '', TEXTO_STATUS[pedido.status]));
  secao.append(el('p', 'resultado-pedido', `Pedido nº ${pedido.id}, total de ${formatarCentavos(pedido.total_centavos)}`));

  const itens = el('ul', 'resultado-lista');
  pedido.itens.forEach(item => {
    const linha = el('li');
    linha.append(
      el('span', '', `${item.quantidade}x ${item.nome}`),
      el('span', '', formatarCentavos(item.preco_centavos * item.quantidade))
    );
    itens.append(linha);
  });
  secao.append(itens);

  const pagamentos = el('ul', 'resultado-lista pagamentos');
  pedido.pagamentos.forEach(p => {
    const linha = el('li', 'pagamento-linha');
    const texto = el('div');
    texto.append(el('span', '', descreverPagamento(p)));
    if (p.motivo) texto.append(el('p', 'tile-parcela', p.motivo));

    if (p.metodo === 'pix' && p.status === 'pendente') {
      const caixa = el('div', 'caixa-pix');
      caixa.append(el('p', 'tile-parcela', 'Código Pix (simulação, não é um Pix real)'));
      caixa.append(el('code', '', p.codigo_pix));
      const copiar = el('button', 'botao-secundario', 'Copiar código');
      copiar.type = 'button';
      copiar.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(p.codigo_pix);
          copiar.textContent = 'Código copiado';
        } catch {
          copiar.textContent = 'Selecione e copie o código';
        }
      });
      caixa.append(copiar);
      texto.append(caixa);
    }

    linha.append(texto, el('span', `selo selo-${p.status}`, ROTULO_PAGAMENTO[p.status]));
    pagamentos.append(linha);
  });
  secao.append(pagamentos);

  const aviso = el('p', '', '');
  aviso.id = 'res-mensagem';
  aviso.setAttribute('role', 'status');
  secao.append(aviso);

  const botoes = el('div', 'botoes');

  if (pedido.status === 'aguardando_pagamento') {
    const verificar = el('button', 'botao-primario', 'Verificar pagamento');
    verificar.type = 'button';
    verificar.addEventListener('click', () => verificarPedido(pedido.id, false));
    botoes.append(verificar);

    const pixPendente = pedido.pagamentos.find(p => p.metodo === 'pix' && p.status === 'pendente');
    if (pedido.modo_teste && pixPendente) {
      const simular = el('button', 'botao-secundario', 'Simular o pagamento do Pix (modo de teste)');
      simular.type = 'button';
      simular.addEventListener('click', () => simularPix(pedido.id, pixPendente.id));
      botoes.append(simular);
    }

    verificacao = setInterval(() => verificarPedido(pedido.id, true), INTERVALO_VERIFICACAO);
  }

  if (pedido.status === 'recusado') {
    const tentar = el('button', 'botao-primario', 'Tentar outra forma de pagamento');
    tentar.type = 'button';
    tentar.addEventListener('click', mostrarEtapaPagamento);
    botoes.append(tentar);
  }

  const voltar = el('button', 'botao-secundario', 'Voltar à loja');
  voltar.type = 'button';
  voltar.addEventListener('click', fecharCheckout);
  botoes.append(voltar);

  secao.append(botoes);
  checkoutCorpo.textContent = '';
  checkoutCorpo.append(secao);
}

// "Verificar pagamento": pergunta ao servidor como o pedido está agora.
async function verificarPedido(id, silencioso) {
  try {
    const resposta = await chamar(`/pedidos/${id}`);
    if (!resposta || !resposta.ok) return;

    if (assinatura(resposta.corpo) === assinaturaPedido) {
      if (!silencioso) {
        mostrar($('res-mensagem'), 'Ainda não identificamos o pagamento. Tente de novo em instantes.', 'info');
      }
      return;
    }

    mostrarResultado(resposta.corpo);
  } catch {
    if (!silencioso) mostrar($('res-mensagem'), ERRO_CONEXAO, 'erro');
  }
}

async function simularPix(pedidoId, pagamentoId) {
  try {
    const resposta = await chamar(`/pedidos/${pedidoId}/pagamentos/${pagamentoId}/simular-pix`, { method: 'POST' });
    if (!resposta) return;

    if (!resposta.ok) {
      mostrar($('res-mensagem'), resposta.corpo.erro, 'erro');
      return;
    }

    mostrarResultado(resposta.corpo);
  } catch {
    mostrar($('res-mensagem'), ERRO_CONEXAO, 'erro');
  }
}

// ---------- Meus pedidos ----------

async function mostrarPedidos() {
  pararVerificacao();
  abrirJanela();
  marcarEtapa('pedidos');
  checkoutCorpo.textContent = 'Carregando seus pedidos...';

  try {
    const resposta = await chamar('/pedidos');
    if (!resposta) return;

    const lista = el('ul', 'resultado-lista pedidos-lista');
    if (resposta.corpo.length === 0) {
      checkoutCorpo.textContent = 'Você ainda não fez nenhum pedido.';
      return;
    }

    resposta.corpo.forEach(pedido => {
      const linha = el('li', 'pagamento-linha');
      const data = new Date(pedido.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      const texto = el('div');
      texto.append(el('strong', '', `Pedido nº ${pedido.id}`));
      texto.append(el('p', 'tile-parcela', `${data}, ${formatarCentavos(pedido.total_centavos)}`));

      const ver = el('button', 'botao-texto', 'Ver detalhes');
      ver.type = 'button';
      ver.addEventListener('click', () => abrirPedido(pedido.id));

      const direita = el('div', 'pedido-acoes');
      direita.append(el('span', `selo selo-${pedido.status}`, TITULO_STATUS[pedido.status]), ver);

      linha.append(texto, direita);
      lista.append(linha);
    });

    checkoutCorpo.textContent = '';
    checkoutCorpo.append(lista);
  } catch {
    checkoutCorpo.textContent = ERRO_CONEXAO;
  }
}

async function abrirPedido(id) {
  try {
    const resposta = await chamar(`/pedidos/${id}`);
    if (resposta && resposta.ok) mostrarResultado(resposta.corpo);
  } catch {
    checkoutCorpo.textContent = ERRO_CONEXAO;
  }
}

// ---------- Eventos ----------

botaoCarrinho.addEventListener('click', abrirCarrinho);
$('botao-fechar-carrinho').addEventListener('click', fecharCarrinho);
$('botao-finalizar').addEventListener('click', iniciarCheckout);
botaoPedidos.addEventListener('click', mostrarPedidos);
$('botao-fechar-checkout').addEventListener('click', fecharCheckout);

dialogoCarrinho.addEventListener('click', evento => {
  if (evento.target === dialogoCarrinho) fecharCarrinho();
});
dialogoCheckout.addEventListener('close', pararVerificacao);

atualizarContador();