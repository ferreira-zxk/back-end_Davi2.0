// Testa clientes, carrinho/pedido, parcelas, pagamento dividido e verificação de pagamento.
// Rode com o servidor ligado:  node teste-pedidos.js
const { calcularParcelas, maxParcelas } = require('./servicos/pagamentos');

const BASE = 'http://localhost:3000';
const CARTAO_OK = '4111111111111111';          // Visa de teste (passa no Luhn)
const CARTAO_RECUSADO = '4000000000020000';   // passa no Luhn e termina em 0000, então o simulador recusa
let aprovados = 0;
let reprovados = 0;

async function pedir(metodo, caminho, dados, token) {
  const opcoes = { method: metodo, headers: { 'Content-Type': 'application/json' } };
  if (dados) opcoes.body = JSON.stringify(dados);
  if (token) opcoes.headers.Authorization = `Bearer ${token}`;
  const resposta = await fetch(BASE + caminho, opcoes);
  const texto = await resposta.text();
  let corpo = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  return { status: resposta.status, corpo };
}

function conferir(descricao, passou, detalhe) {
  if (passou) { aprovados++; console.log(`✅ ${descricao}`); }
  else { reprovados++; console.log(`❌ ${descricao}`); if (detalhe !== undefined) console.log('   Detalhe:', JSON.stringify(detalhe)); }
}

async function testar(descricao, esperado, metodo, caminho, dados, token) {
  const r = await pedir(metodo, caminho, dados, token);
  conferir(`${descricao} (esperado ${esperado}, veio ${r.status})`, r.status === esperado, r.corpo);
  return r.corpo;
}

const cartao = (numero = CARTAO_OK) => ({ numero, nome: 'DAVI FERREIRA', validade: '12/40', cvv: '123' });

async function novoUsuario(nome) {
  const email = `${nome}${Date.now()}${Math.floor(Math.random() * 1000)}@email.com`;
  await pedir('POST', '/auth/cadastro', { nome, email, senha: 'senha123' });
  const login = await pedir('POST', '/auth/login', { email, senha: 'senha123' });
  return login.corpo.token;
}

async function main() {
  console.log('Testando as contas de parcelas...\n');
  const p3 = calcularParcelas(100000, 3);
  conferir('1000,00 em 3x soma exatamente 1000,00', p3.reduce((a, b) => a + b, 0) === 100000, p3);
  conferir('A sobra de centavos vai para a 1ª parcela', p3[0] === 33334 && p3[1] === 33333, p3);
  conferir('Parcela mínima de R$ 50 limita o parcelamento', maxParcelas(12000) === 2 && maxParcelas(3000) === 1 && maxParcelas(900000) === 10);

  const token = await novoUsuario('Cliente');
  const outro = await novoUsuario('Outro');
  const produtos = (await pedir('GET', '/produtos')).corpo;
  const [a, b] = produtos;
  const itens = [{ produto_id: a.id, quantidade: 1 }, { produto_id: b.id, quantidade: 2 }];
  const total = Math.round(a.preco * 100) + 2 * Math.round(b.preco * 100);

  console.log('\nTestando os dados do cliente...\n');
  await testar('Ver dados sem cadastro', 404, 'GET', '/clientes/eu', null, token);
  const dadosCliente = { nome_completo: 'Davi Ferreira', cpf: '529.982.247-25', telefone: '(66) 99999-8888', cep: '78652-000', endereco: 'Rua A', numero: '10', bairro: 'Centro', cidade: 'Confresa', estado: 'mt' };
  await testar('CPF inválido', 400, 'PUT', '/clientes/eu', { ...dadosCliente, cpf: '111.111.111-11' }, token);
  await testar('Pedir sem cadastrar os dados', 400, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'pix', valor_centavos: total }] }, token);
  const salvo = await testar('Salvar dados do cliente', 200, 'PUT', '/clientes/eu', dadosCliente, token);
  conferir('CPF e estado foram padronizados', salvo.cpf === '52998224725' && salvo.estado === 'MT', salvo);
  await testar('Atualizar de novo (não duplica)', 200, 'PUT', '/clientes/eu', { ...dadosCliente, numero: '11' }, token);

  console.log('\nTestando as regras do pedido...\n');
  await testar('Pedir sem login', 401, 'POST', '/pedidos', { itens, pagamentos: [] });
  await testar('Carrinho vazio', 400, 'POST', '/pedidos', { itens: [], pagamentos: [{ metodo: 'pix', valor_centavos: total }] }, token);
  await testar('Produto que não existe', 400, 'POST', '/pedidos', { itens: [{ produto_id: 99999, quantidade: 1 }], pagamentos: [{ metodo: 'pix', valor_centavos: 100 }] }, token);
  await testar('Soma diferente do total', 400, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'pix', valor_centavos: total - 1 }] }, token);
  await testar('Duas formas iguais', 400, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'pix', valor_centavos: 100 }, { metodo: 'pix', valor_centavos: total - 100 }] }, token);
  await testar('Número de cartão inválido (Luhn)', 400, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'cartao_credito', valor_centavos: total, parcelas: 1, cartao: cartao('4111111111111112') }] }, token);
  await testar('Cartão vencido', 400, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'cartao_credito', valor_centavos: total, parcelas: 1, cartao: { ...cartao(), validade: '01/20' } }] }, token);
  await testar('Parcelas demais', 400, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'cartao_credito', valor_centavos: total, parcelas: 11, cartao: cartao() }] }, token);

  console.log('\nPagamento com uma forma só (cartão em 3x)...\n');
  const unico = await testar('Pedido pago no cartão', 201, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'cartao_credito', valor_centavos: total, parcelas: 3, cartao: cartao() }] }, token);
  conferir('Status do pedido é pago', unico.status === 'pago', unico.status);
  conferir('Total veio do banco, não do navegador', unico.total_centavos === total, unico.total_centavos);
  conferir('Só os 4 últimos dígitos ficaram guardados', unico.pagamentos[0].final_cartao === '1111' && !JSON.stringify(unico).includes(CARTAO_OK) && !JSON.stringify(unico).includes('123"'), unico.pagamentos[0]);
  conferir('Parcelas do pagamento somam o valor', unico.pagamentos[0].primeira_parcela_centavos + 2 * unico.pagamentos[0].valor_parcela_centavos === total, unico.pagamentos[0]);

  console.log('\nPagamento dividido: cartão + Pix...\n');
  const metade = Math.floor(total / 2);
  const dividido = await testar('Pedido com duas formas', 201, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'cartao_credito', valor_centavos: metade, parcelas: 2, cartao: cartao() }, { metodo: 'pix', valor_centavos: total - metade }] }, token);
  conferir('Fica aguardando o Pix', dividido.status === 'aguardando_pagamento', dividido.status);
  const pix = dividido.pagamentos.find(p => p.metodo === 'pix');
  conferir('Pix pendente com código', pix.status === 'pendente' && typeof pix.codigo_pix === 'string', pix);
  await testar('Outro usuário não vê o pedido', 404, 'GET', `/pedidos/${dividido.id}`, null, outro);
  const verificado = await testar('Verificar pagamento (ainda pendente)', 200, 'GET', `/pedidos/${dividido.id}`, null, token);
  conferir('Continua aguardando', verificado.status === 'aguardando_pagamento', verificado.status);
  await testar('Outro usuário não paga o Pix dos outros', 404, 'POST', `/pedidos/${dividido.id}/pagamentos/${pix.id}/simular-pix`, null, outro);
  const pago = await testar('Simular o pagamento do Pix', 200, 'POST', `/pedidos/${dividido.id}/pagamentos/${pix.id}/simular-pix`, null, token);
  conferir('Pedido virou pago', pago.status === 'pago', pago.status);
  await testar('Pagar o mesmo Pix duas vezes', 409, 'POST', `/pedidos/${dividido.id}/pagamentos/${pix.id}/simular-pix`, null, token);

  console.log('\nPagamento dividido com cartão recusado...\n');
  const recusado = await testar('Cartão recusado derruba o pedido', 402, 'POST', '/pedidos', { itens, pagamentos: [{ metodo: 'cartao_credito', valor_centavos: metade, parcelas: 1, cartao: cartao(CARTAO_RECUSADO) }, { metodo: 'pix', valor_centavos: total - metade }] }, token);
  conferir('Pedido recusado, Pix cancelado', recusado.status === 'recusado' && recusado.pagamentos.find(p => p.metodo === 'pix').status === 'cancelado', recusado.pagamentos);

  console.log('\nHistórico...\n');
  const lista = await testar('Listar meus pedidos', 200, 'GET', '/pedidos', null, token);
  conferir('Aparecem os 3 pedidos criados', lista.length === 3, lista.length);

  console.log(`\nResultado: ${aprovados} aprovado(s), ${reprovados} reprovado(s)`);
}

main().catch(erro => console.log('Motivo do erro:', erro.cause || erro.message));