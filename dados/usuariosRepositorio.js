const { consultar, executar } = require('./banco');

function buscarPorEmail(email) {
  return consultar('SELECT * FROM usuarios WHERE email = ?', [email])[0];
}

function criar(nome, email, senhaHash, papel = 'cliente') {
  const { ultimoId } = executar(
    'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES (?, ?, ?, ?)',
    [nome, email, senhaHash, papel]
  );
  return { id: ultimoId, nome, email, papel };
}

module.exports = { buscarPorEmail, criar };