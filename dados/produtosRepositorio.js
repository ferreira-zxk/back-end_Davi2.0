const { consultar, executar } = require('./banco');

function listar() {
  return consultar('SELECT * FROM produtos');
}

function buscarPorId(id) {
  return consultar('SELECT * FROM produtos WHERE id = ?', [id])[0];
}

// O sql.js dá erro se algum valor do bind for undefined,
// por isso tudo que não veio vira null.
function valores(dados) {
  return [
    dados.nome,
    dados.preco,
    dados.marca ?? null,
    dados.armazenamento ?? null,
    dados.cor ?? null,
    dados.imagem ?? null
  ];
}

function criar(dados) {
  const { ultimoId } = executar(
    'INSERT INTO produtos (nome, preco, marca, armazenamento, cor, imagem) VALUES (?, ?, ?, ?, ?, ?)',
    valores(dados)
  );
  return buscarPorId(ultimoId);
}

function atualizar(id, dados) {
  executar(
    'UPDATE produtos SET nome = ?, preco = ?, marca = ?, armazenamento = ?, cor = ?, imagem = ? WHERE id = ?',
    [...valores(dados), id]
  );
  return buscarPorId(id);
}

function remover(id) {
  const { alteradas } = executar('DELETE FROM produtos WHERE id = ?', [id]);
  return alteradas > 0;
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };