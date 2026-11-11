const repo = require('../dados/clientesRepositorio');
const { validarCliente } = require('../servicos/validacoes');

function obter(req, res) {
  const cliente = repo.buscarPorUsuario(req.usuario.id);

  if (!cliente) {
    return res.status(404).json({ erro: 'Os dados do cliente ainda não foram cadastrados' });
  }

  res.json(cliente);
}

function salvar(req, res) {
  const resultado = validarCliente(req.body ?? {});

  if (resultado.erro) {
    return res.status(400).json({ erro: resultado.erro });
  }

  res.json(repo.salvar(req.usuario.id, resultado.dados));
}

module.exports = { obter, salvar };