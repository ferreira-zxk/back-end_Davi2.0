const jwt = require('jsonwebtoken');

function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization;

  if (!cabecalho || !cabecalho.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Faça login para continuar' });
  }

  const token = cabecalho.split(' ')[1];

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SEGREDO);
    next();
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente' });
  }
}

module.exports = autenticar;