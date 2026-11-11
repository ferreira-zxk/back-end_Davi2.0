const crypto = require('crypto');
const { soDigitos } = require('./validacoes');

// Todo dinheiro aqui é em CENTAVOS (inteiros). Com número decimal (0.1 + 0.2)
// a conta pode dar 0.30000000000000004, e em pagamento isso vira diferença de centavo.

// Estes dois valores também existem no public/script.js (para mostrar as parcelas na tela).
// Se mudar aqui, mude lá.
const MAX_PARCELAS = 10;
const PARCELA_MINIMA = 5000; // R$ 50,00
const EXPIRA_PIX_MIN = Number(process.env.PIX_EXPIRA_MIN) || 30; // PIX_EXPIRA_MIN existe só para testes

function maxParcelas(valorCentavos) {
  return Math.max(1, Math.min(MAX_PARCELAS, Math.floor(valorCentavos / PARCELA_MINIMA)));
}

// Divide o valor em n parcelas sem perder centavo: a sobra da divisão vai para a 1ª parcela.
// Ex.: 1000,00 em 3x = 333,34 + 333,33 + 333,33
function calcularParcelas(valorCentavos, n) {
  const base = Math.floor(valorCentavos / n);
  const sobra = valorCentavos - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + sobra : base));
}

function bandeira(numero) {
  if (/^4/.test(numero)) return 'Visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(numero)) return 'Mastercard';
  if (/^3[47]/.test(numero)) return 'American Express';
  return 'Cartão';
}

// Algoritmo de Luhn: detecta número de cartão digitado errado.
function luhnValido(numero) {
  let soma = 0;
  let dobrar = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = Number(numero[i]);
    if (dobrar) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    soma += digito;
    dobrar = !dobrar;
  }
  return soma % 10 === 0;
}

// Confere os dados do cartão. Devolve { erro } ou { numero, final, bandeira }.
// O número completo e o CVV NUNCA são gravados: só a bandeira e os 4 últimos dígitos.
function validarCartao(cartao, agora = new Date()) {
  if (!cartao || typeof cartao !== 'object') return { erro: 'Informe os dados do cartão' };

  const numero = soDigitos(cartao.numero);
  if (numero.length < 13 || numero.length > 19 || !luhnValido(numero)) {
    return { erro: 'Número do cartão inválido' };
  }

  if (typeof cartao.nome !== 'string' || cartao.nome.trim().length < 3) {
    return { erro: 'Informe o nome impresso no cartão' };
  }

  const validade = /^(\d{2})\/(\d{2})$/.exec(String(cartao.validade ?? '').trim());
  if (!validade) return { erro: 'Validade inválida. Use o formato MM/AA' };
  const mes = Number(validade[1]);
  const ano = 2000 + Number(validade[2]);
  if (mes < 1 || mes > 12) return { erro: 'Validade inválida. Use o formato MM/AA' };
  // O cartão vale até o último dia do mês de validade: compara com o dia 1 do mês seguinte.
  if (new Date(ano, mes, 1) <= agora) return { erro: 'Cartão vencido' };

  const tamanhoCvv = bandeira(numero) === 'American Express' ? 4 : 3;
  if (soDigitos(cartao.cvv).length !== tamanhoCvv) {
    return { erro: `CVV inválido. Ele tem ${tamanhoCvv} dígitos` };
  }

  return { numero, final: numero.slice(-4), bandeira: bandeira(numero) };
}

// SIMULAÇÃO. Aqui entraria a chamada ao gateway de pagamento de verdade
// (Mercado Pago, Stripe, Pagar.me...). Para testar o erro, cartões terminados em 0000 são recusados.
function autorizarCartao(numero) {
  if (numero.endsWith('0000')) {
    return { aprovado: false, motivo: 'Cartão recusado pelo banco emissor' };
  }
  return { aprovado: true };
}

// SIMULAÇÃO. Não é um Pix de verdade (não tem QR Code nem chave).
function gerarCodigoPix(pedidoId) {
  return `PULSO-SIMULACAO-${pedidoId}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

// O status do pedido sempre é calculado a partir do status dos pagamentos.
function calcularStatusPedido(pagamentos) {
  if (pagamentos.some(p => p.status === 'recusado')) return 'recusado';
  if (pagamentos.some(p => p.status === 'expirado')) return 'expirado';
  if (pagamentos.every(p => p.status === 'aprovado')) return 'pago';
  return 'aguardando_pagamento';
}

module.exports = {
  MAX_PARCELAS,
  PARCELA_MINIMA,
  EXPIRA_PIX_MIN,
  maxParcelas,
  calcularParcelas,
  validarCartao,
  autorizarCartao,
  gerarCodigoPix,
  calcularStatusPedido
};