const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuariosRepo = require('../dados/usuariosRepositorio');

// Quem se cadastra com o e-mail definido em ADMIN_EMAIL (arquivo .env) vira administrador.
// Todo mundo que se cadastra com outro e-mail vira cliente.
function definirPapel(email) {
  const emailAdmin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  return emailAdmin && email.trim().toLowerCase() === emailAdmin ? 'admin' : 'cliente';
}

function cadastrar(req, res) {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
  }

  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres' });
  }

  if (usuariosRepo.buscarPorEmail(email)) {
    return res.status(409).json({ erro: 'Este e-mail já está cadastrado' });
  }

  const senhaHash = bcrypt.hashSync(senha, 10);
  const usuario = usuariosRepo.criar(nome, email, senhaHash, definirPapel(email));

  res.status(201).json(usuario);
}

function login(req, res) {
  const { email, senha } = req.body;
  const usuario = usuariosRepo.buscarPorEmail(email ?? '');

  if (!usuario || !bcrypt.compareSync(senha ?? '', usuario.senha_hash)) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, papel: usuario.papel },
    process.env.JWT_SEGREDO,
    { expiresIn: '2h' }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel }
  });
}

module.exports = { cadastrar, login };