const { consultar, executar } = require('./banco');

function buscarPorUsuario(usuarioId) {
  return consultar('SELECT * FROM clientes WHERE usuario_id = ?', [usuarioId])[0];
}

// Cria os dados do cliente na primeira vez e atualiza nas próximas.
function salvar(usuarioId, d) {
  const valores = [d.nome_completo, d.cpf, d.telefone, d.cep, d.endereco, d.numero, d.bairro, d.cidade, d.estado];

  if (buscarPorUsuario(usuarioId)) {
    executar(
      `UPDATE clientes SET nome_completo = ?, cpf = ?, telefone = ?, cep = ?, endereco = ?,
       numero = ?, bairro = ?, cidade = ?, estado = ? WHERE usuario_id = ?`,
      [...valores, usuarioId]
    );
  } else {
    executar(
      `INSERT INTO clientes (nome_completo, cpf, telefone, cep, endereco, numero, bairro, cidade, estado, usuario_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...valores, usuarioId]
    );
  }

  return buscarPorUsuario(usuarioId);
}

module.exports = { buscarPorUsuario, salvar };