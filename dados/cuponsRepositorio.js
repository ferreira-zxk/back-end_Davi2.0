const { consultar, executar } = require('./banco');

function listar() {
  return consultar('SELECT * FROM cupons ORDER BY id DESC');
}

function buscarPorId(id) {
  return consultar('SELECT * FROM cupons WHERE id = ?', [id])[0];
}

function buscarPorCodigo(codigo) {
  return consultar('SELECT * FROM cupons WHERE codigo = ?', [codigo])[0];
}

function criar(d) {
  const { ultimoId } = executar(
    'INSERT INTO cupons (codigo, tipo, valor, validade, limite_usos) VALUES (?, ?, ?, ?, ?)',
    [d.codigo, d.tipo, d.valor, d.validade ?? null, d.limite_usos ?? null]
  );
  return buscarPorId(ultimoId);
}

function definirAtivo(id, ativo) {
  executar('UPDATE cupons SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, id]);
  return buscarPorId(id);
}

function apagar(id) {
  return executar('DELETE FROM cupons WHERE id = ?', [id]).alteradas > 0;
}

function registrarUso(codigo) {
  executar('UPDATE cupons SET usos = usos + 1 WHERE codigo = ?', [codigo]);
}

function devolverUso(codigo) {
  executar('UPDATE cupons SET usos = MAX(usos - 1, 0) WHERE codigo = ?', [codigo]);
}

module.exports = { listar, buscarPorId, buscarPorCodigo, criar, definirAtivo, apagar, registrarUso, devolverUso };