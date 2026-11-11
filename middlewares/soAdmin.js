// Deve vir DEPOIS do middleware "autenticar", que é quem preenche req.usuario.
function soAdmin(req, res, next) {
  if (req.usuario?.papel !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administradores podem fazer isso' });
  }
  next();
}

module.exports = soAdmin;