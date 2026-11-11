function normalizarCodigo(codigo) {
  return typeof codigo === 'string' ? codigo.trim().toUpperCase() : '';
}

// Confere se o cupom pode ser usado agora. Devolve { erro } ou { desconto } (em centavos).
function validarCupom(cupom, subtotalCentavos, agora = new Date()) {
  if (!cupom || !cupom.ativo) return { erro: 'Cupom inválido ou desativado' };

  if (cupom.validade && new Date(`${cupom.validade}T23:59:59`) < agora) {
    return { erro: 'Este cupom está vencido' };
  }

  if (cupom.limite_usos !== null && cupom.usos >= cupom.limite_usos) {
    return { erro: 'Este cupom já foi usado o máximo de vezes' };
  }

  const desconto = cupom.tipo === 'percentual'
    ? Math.floor((subtotalCentavos * cupom.valor) / 100)
    : Math.min(cupom.valor, subtotalCentavos);

  return { desconto };
}

module.exports = { normalizarCodigo, validarCupom };