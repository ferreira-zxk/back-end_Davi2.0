const repo = require('../dados/produtosRepositorio');

const CAMPOS_TEXTO = ['marca', 'armazenamento', 'cor', 'imagem'];

// Texto vazio ou só com espaços vira null (campo "não informado").
function limpar(valor) {
  if (typeof valor !== 'string') return null;
  const texto = valor.trim();
  return texto === '' ? null : texto;
}

// Monta os dados finais. Se o campo não veio no corpo da requisição,
// mantém o valor que já existia (é o que faz o PUT { preco } do teste.js continuar valendo).
function lerCampos(body, base = {}) {
  const dados = {
    nome: body.nome ?? base.nome,
    preco: body.preco ?? base.preco
  };

  for (const campo of CAMPOS_TEXTO) {
    dados[campo] = campo in body ? limpar(body[campo]) : (base[campo] ?? null);
  }

  return dados;
}

// A imagem vai parar num <img src="...">, então só aceitamos
// endereço http(s) ou caminho do próprio site.
function imagemValida(imagem) {
  return imagem === null || /^(https?:\/\/|\/)/.test(imagem);
}

function listar(req, res) {
  res.json(repo.listar());
}

function buscarPorId(req, res) {
  const produto = repo.buscarPorId(Number(req.params.id));

  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  res.json(produto);
}

function criar(req, res) {
  const dados = lerCampos(req.body ?? {});

  if (!dados.nome || !dados.preco || dados.preco <= 0) {
    return res.status(400).json({ erro: 'Informe um nome e um preço maior que zero' });
  }

  if (!imagemValida(dados.imagem)) {
    return res.status(400).json({ erro: 'A imagem precisa ser um endereço que começa com http:// ou https://' });
  }

  res.status(201).json(repo.criar(dados));
}

function atualizar(req, res) {
  const id = Number(req.params.id);
  const produto = repo.buscarPorId(id);

  if (!produto) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  const dados = lerCampos(req.body ?? {}, produto);

  if (!dados.nome || !dados.preco || dados.preco <= 0) {
    return res.status(400).json({ erro: 'Informe um nome e um preço maior que zero' });
  }

  if (!imagemValida(dados.imagem)) {
    return res.status(400).json({ erro: 'A imagem precisa ser um endereço que começa com http:// ou https://' });
  }

  res.json(repo.atualizar(id, dados));
}

function remover(req, res) {
  const removido = repo.remover(Number(req.params.id));

  if (!removido) {
    return res.status(404).json({ erro: 'Produto não encontrado' });
  }

  res.status(204).send();
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };