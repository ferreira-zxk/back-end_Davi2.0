const { soDigitos } = require('./validacoes');

// VALORES DE EXEMPLO: a loja "fica" em Mato Grosso. Ajuste a tabela para a sua realidade
// (ou troque por uma consulta aos Correios/transportadora).
const FRETE_GRATIS_A_PARTIR = 300000; // R$ 3.000,00 em centavos

// [valor em centavos, prazo em dias úteis]
const MESMO_ESTADO = [1990, 3];
const CENTRO_OESTE = [2990, 4];
const SUDESTE = [3990, 5];
const SUL_NORDESTE = [4990, 7];
const NORTE = [5990, 9];

const TABELA = {
  MT: MESMO_ESTADO,
  GO: CENTRO_OESTE, DF: CENTRO_OESTE, MS: CENTRO_OESTE,
  SP: SUDESTE, RJ: SUDESTE, MG: SUDESTE, ES: SUDESTE, TO: SUDESTE, RO: SUDESTE,
  PR: SUL_NORDESTE, SC: SUL_NORDESTE, RS: SUL_NORDESTE,
  BA: SUL_NORDESTE, SE: SUL_NORDESTE, AL: SUL_NORDESTE, PE: SUL_NORDESTE, PB: SUL_NORDESTE,
  RN: SUL_NORDESTE, CE: SUL_NORDESTE, PI: SUL_NORDESTE, MA: SUL_NORDESTE,
  AC: NORTE, AM: NORTE, AP: NORTE, PA: NORTE, RR: NORTE
};

// Faixas de CEP (5 primeiros dígitos) de cada estado.
const FAIXAS_CEP = [
  [1000, 19999, 'SP'], [20000, 28999, 'RJ'], [29000, 29999, 'ES'], [30000, 39999, 'MG'],
  [40000, 48999, 'BA'], [49000, 49999, 'SE'], [50000, 56999, 'PE'], [57000, 57999, 'AL'],
  [58000, 58999, 'PB'], [59000, 59999, 'RN'], [60000, 63999, 'CE'], [64000, 64999, 'PI'],
  [65000, 65999, 'MA'], [66000, 68899, 'PA'], [68900, 68999, 'AP'], [69000, 69299, 'AM'],
  [69300, 69399, 'RR'], [69400, 69899, 'AM'], [69900, 69999, 'AC'], [70000, 72799, 'DF'],
  [72800, 72999, 'GO'], [73000, 73699, 'DF'], [73700, 76799, 'GO'], [76800, 76999, 'RO'],
  [77000, 77999, 'TO'], [78000, 78899, 'MT'], [78900, 78999, 'RO'], [79000, 79999, 'MS'],
  [80000, 87999, 'PR'], [88000, 89999, 'SC'], [90000, 99999, 'RS']
];

function ufDoCep(cep) {
  const digitos = soDigitos(cep);
  if (digitos.length !== 8) return null;

  const prefixo = Number(digitos.slice(0, 5));
  const faixa = FAIXAS_CEP.find(([minimo, maximo]) => prefixo >= minimo && prefixo <= maximo);
  return faixa ? faixa[2] : null;
}

// Devolve { uf, valor_centavos, prazo_dias, gratis } ou { erro }.
function calcularFrete(cep, subtotalCentavos) {
  const uf = ufDoCep(cep);
  if (!uf) return { erro: 'CEP inválido' };

  const [valor, prazo] = TABELA[uf];
  const gratis = subtotalCentavos >= FRETE_GRATIS_A_PARTIR;

  return { uf, valor_centavos: gratis ? 0 : valor, prazo_dias: prazo, gratis };
}

module.exports = { FRETE_GRATIS_A_PARTIR, ufDoCep, calcularFrete };