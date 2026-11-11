const API = '/produtos';

// Estes dois valores também existem no servidor (servicos/pagamentos.js). Se mudar um, mude o outro.
const MAX_PARCELAS = 10;
const PARCELA_MINIMA = 5000; // R$ 50,00, em centavos

// ---------- Elementos da página ----------

const campoBusca = document.getElementById('busca');
const filtros = document.getElementById('filtros');
const lista = document.getElementById('lista');
const contagem = document.getElementById('contagem');

const botaoAbrirLogin = document.getElementById('botao-abrir-login');
const areaUsuario = document.getElementById('area-usuario');
const saudacao = document.getElementById('saudacao');
const botaoSair = document.getElementById('botao-sair');

const dialogoLogin = document.getElementById('dialogo-login');
const formLogin = document.getElementById('form-login');
const tituloLogin = document.getElementById('titulo-login');
const blocoLoginNome = document.getElementById('campo-login-nome');
const campoLoginNome = document.getElementById('login-nome');
const campoLoginEmail = document.getElementById('login-email');
const campoLoginSenha = document.getElementById('login-senha');
const botaoEntrar = document.getElementById('botao-entrar');
const botaoAlternar = document.getElementById('botao-alternar');
const botaoFecharLogin = document.getElementById('botao-fechar-login');
const mensagemLogin = document.getElementById('mensagem-login');

const painel = document.getElementById('painel');
const formulario = document.getElementById('formulario');
const tituloForm = document.getElementById('titulo-form');
const campoNome = document.getElementById('nome');
const campoMarca = document.getElementById('marca');
const campoArmazenamento = document.getElementById('armazenamento');
const campoCor = document.getElementById('cor');
const campoPreco = document.getElementById('preco');
const campoImagem = document.getElementById('imagem');
const botaoSalvar = document.getElementById('botao-salvar');
const botaoCancelar = document.getElementById('botao-cancelar');
const mensagem = document.getElementById('mensagem');

// ---------- Estado ----------

let produtos = [];
let estadoLista = 'carregando'; // 'carregando' | 'ok' | 'erro'
let marcaAtiva = '';
let termoBusca = '';
let idEmEdicao = null;
let modoCadastro = false;
let sessao = lerSessao();
let acaoAposLogin = null; // o que fazer assim que a pessoa entrar (ex.: continuar a compra)

// ---------- Utilidades ----------

function el(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

function mostrar(elemento, texto, tipo) {
  elemento.textContent = texto;
  elemento.className = tipo;
}

function normalizar(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Dinheiro em centavos (inteiro): evita erro de arredondamento nas contas.
function emCentavos(valor) {
  return Math.round(valor * 100);
}

function formatarCentavos(centavos) {
  return formatarPreco(centavos / 100);
}

function maxParcelas(centavos) {
  return Math.max(1, Math.min(MAX_PARCELAS, Math.floor(centavos / PARCELA_MINIMA)));
}

// Mesma conta do servidor: a sobra de centavos vai para a 1ª parcela.
function calcularParcelas(centavos, n) {
  const base = Math.floor(centavos / n);
  const sobra = centavos - base * n;
  return Array.from({ length: n }, (_, i) => (i === 0 ? base + sobra : base));
}

// ---------- Desenho do aparelho (quando o produto não tem foto) ----------

const CORES = [
  ['preto', '#1d1f24'],
  ['grafite', '#3a3d44'],
  ['titanio', '#8a8478'],
  ['cinza', '#8b9099'],
  ['prata', '#cfd3d9'],
  ['branco', '#eceae4'],
  ['azul', '#2f5fa8'],
  ['verde', '#4c7a63'],
  ['roxo', '#6b5aa6'],
  ['lilas', '#b9a6d8'],
  ['rosa', '#e4a9b4'],
  ['vermelho', '#b8312f'],
  ['dourado', '#c9a56a'],
  ['amarelo', '#e0b84a']
];

function corDoAparelho(nomeDaCor) {
  const texto = normalizar(nomeDaCor || '');
  const achada = CORES.find(([chave]) => texto.includes(chave));
  return achada ? achada[1] : '#6f7782';
}

function lente(x, y, raio) {
  return `
    <circle cx="${x}" cy="${y}" r="${raio}" fill="#0d1015" stroke="#ffffff40" stroke-width="1.2"/>
    <circle cx="${x}" cy="${y}" r="${raio * 0.45}" fill="#252d3a"/>`;
}

// Traseira do celular. O número de câmeras varia com o id, para a vitrine não ficar repetida.
function desenharAparelho(produto) {
  const cor = corDoAparelho(produto.cor);
  const variante = produto.id % 3;
  let modulo;

  if (variante === 0) {
    modulo = `<rect x="20" y="18" width="34" height="50" rx="12" fill="#00000047"/>
      ${lente(37, 34, 9)}${lente(37, 54, 9)}
      <circle cx="64" cy="26" r="3" fill="#ffffff55"/>`;
  } else if (variante === 1) {
    modulo = `<rect x="20" y="18" width="46" height="46" rx="14" fill="#00000047"/>
      ${lente(34, 33, 7)}${lente(52, 33, 7)}${lente(43, 51, 7)}`;
  } else {
    modulo = `<rect x="20" y="18" width="34" height="34" rx="12" fill="#00000047"/>
      ${lente(37, 35, 10)}
      <circle cx="64" cy="26" r="3" fill="#ffffff55"/>`;
  }

  const molde = document.createElement('div');
  molde.innerHTML = `
    <svg viewBox="0 0 120 246" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="238" rx="42" ry="4" fill="#00000020"/>
      <rect x="110" y="72" width="3" height="26" rx="1.5" fill="${cor}"/>
      <rect x="10" y="8" width="100" height="224" rx="18" fill="${cor}"/>
      <rect x="10.5" y="8.5" width="99" height="223" rx="17.5" fill="none" stroke="#ffffff2e"/>
      ${modulo}
    </svg>`;
  return molde.firstElementChild;
}

// ---------- Sessão (login) ----------

function lerSessao() {
  try {
    return JSON.parse(localStorage.getItem('sessao'));
  } catch {
    return null;
  }
}

function estaLogado() {
  return sessao !== null;
}

function ehAdmin() {
  return estaLogado() && sessao.usuario.papel === 'admin';
}

function cabecalhos() {
  const cabecalho = { 'Content-Type': 'application/json' };
  if (sessao) cabecalho.Authorization = `Bearer ${sessao.token}`;
  return cabecalho;
}

function atualizarTela() {
  const logado = estaLogado();
  botaoAbrirLogin.hidden = logado;
  areaUsuario.hidden = !logado;
  painel.hidden = !ehAdmin();
  if (logado) {
    saudacao.textContent = `Olá, ${sessao.usuario.nome}${ehAdmin() ? ' (administrador)' : ''}`;
  }
  renderizarLista();
}

function abrirLogin(texto, tipo) {
  mostrar(mensagemLogin, texto || '', texto ? tipo : '');
  if (!dialogoLogin.open) dialogoLogin.showModal();
}

function sair(texto, tipo) {
  sessao = null;
  localStorage.removeItem('sessao');
  cancelarEdicao();
  mostrar(mensagem, '', '');
  if (typeof aoSair === 'function') aoSair();
  atualizarTela();
  if (texto) abrirLogin(texto, tipo);
}

function alternarModo() {
  modoCadastro = !modoCadastro;
  tituloLogin.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  botaoEntrar.textContent = modoCadastro ? 'Cadastrar' : 'Entrar';
  botaoAlternar.textContent = modoCadastro ? 'Já tenho conta' : 'Criar conta';
  campoLoginSenha.autocomplete = modoCadastro ? 'new-password' : 'current-password';
  blocoLoginNome.hidden = !modoCadastro;
  mostrar(mensagemLogin, '', '');
}

async function enviarLogin(evento) {
  evento.preventDefault();
  const email = campoLoginEmail.value.trim();
  const senha = campoLoginSenha.value;

  try {
    if (modoCadastro) {
      const respostaCadastro = await fetch('/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: campoLoginNome.value.trim(), email, senha })
      });
      const corpoCadastro = await respostaCadastro.json();
      if (!respostaCadastro.ok) {
        mostrar(mensagemLogin, corpoCadastro.erro, 'erro');
        return;
      }
    }

    const resposta = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const corpo = await resposta.json();

    if (!resposta.ok) {
      mostrar(mensagemLogin, corpo.erro, 'erro');
      return;
    }

    sessao = corpo;
    localStorage.setItem('sessao', JSON.stringify(sessao));
    formLogin.reset();
    if (modoCadastro) alternarModo();
    mostrar(mensagemLogin, '', '');
    dialogoLogin.close();
    atualizarTela();

    if (acaoAposLogin) {
      const acao = acaoAposLogin;
      acaoAposLogin = null;
      acao();
    }
  } catch {
    mostrar(mensagemLogin, 'Não foi possível falar com o servidor. Tente de novo.', 'erro');
  }
}

// ---------- Vitrine ----------

function produtosVisiveis() {
  const termo = normalizar(termoBusca);

  return produtos.filter(produto => {
    const daMarca = !marcaAtiva || produto.marca === marcaAtiva;
    const texto = normalizar(`${produto.nome} ${produto.marca ?? ''}`);
    return daMarca && (!termo || texto.includes(termo));
  });
}

function renderizarFiltros() {
  const marcas = [...new Set(produtos.map(produto => produto.marca).filter(Boolean))].sort();

  if (marcaAtiva && !marcas.includes(marcaAtiva)) marcaAtiva = '';

  filtros.hidden = marcas.length === 0;
  filtros.textContent = '';

  ['', ...marcas].forEach(marca => {
    const botao = el('button', '', marca || 'Todas');
    botao.type = 'button';
    botao.setAttribute('aria-pressed', String(marca === marcaAtiva));
    botao.addEventListener('click', () => {
      marcaAtiva = marca;
      renderizarFiltros();
      renderizarLista();
    });
    filtros.append(botao);
  });
}

function criarItem(produto) {
  const item = el('li', 'tile');

  const poco = el('div', 'poco');
  if (produto.imagem) {
    const foto = el('img');
    foto.src = produto.imagem;
    foto.alt = produto.nome;
    foto.loading = 'lazy';
    // Se o endereço da foto estiver quebrado, mostra o desenho no lugar.
    foto.addEventListener('error', () => poco.replaceChildren(desenharAparelho(produto)));
    poco.append(foto);
  } else {
    poco.append(desenharAparelho(produto));
  }

  const texto = el('div', 'tile-texto');
  if (produto.marca) texto.append(el('p', 'tile-marca', produto.marca));
  texto.append(el('h3', 'tile-nome', produto.nome));

  const specs = [produto.armazenamento, produto.cor].filter(Boolean).join(', ');
  if (specs) texto.append(el('p', 'tile-specs', specs));

  texto.append(el('p', 'tile-preco', formatarPreco(produto.preco)));
  const centavos = emCentavos(produto.preco);
  const parcelas = maxParcelas(centavos);
  if (parcelas > 1) {
    const valorParcela = formatarCentavos(Math.floor(centavos / parcelas));
    texto.append(el('p', 'tile-parcela', `ou ${parcelas}x de ${valorParcela} sem juros`));
  }

  const botaoComprar = el('button', 'botao-primario botao-comprar', 'Adicionar ao carrinho');
  botaoComprar.type = 'button';
  botaoComprar.addEventListener('click', () => {
    adicionarAoCarrinho(produto.id);
    botaoComprar.textContent = 'Adicionado ao carrinho';
    setTimeout(() => { botaoComprar.textContent = 'Adicionar ao carrinho'; }, 1500);
  });
  texto.append(botaoComprar);

  if (ehAdmin()) {
    const botaoEditar = el('button', 'botao-texto', 'Editar');
    botaoEditar.type = 'button';
    botaoEditar.addEventListener('click', () => iniciarEdicao(produto));

    const botaoApagar = el('button', 'botao-texto perigo', 'Apagar');
    botaoApagar.type = 'button';
    botaoApagar.addEventListener('click', () => apagarProduto(produto));

    const admin = el('div', 'tile-admin');
    admin.append(botaoEditar, botaoApagar);
    texto.append(admin);
  }

  item.append(poco, texto);
  return item;
}

function renderizarLista() {
  lista.textContent = '';

  if (estadoLista === 'carregando') {
    contagem.textContent = '';
    lista.append(el('li', 'aviso', 'Carregando celulares...'));
    return;
  }

  if (estadoLista === 'erro') {
    contagem.textContent = '';
    lista.append(el('li', 'aviso', 'Não foi possível carregar os celulares. Recarregue a página para tentar de novo.'));
    return;
  }

  const visiveis = produtosVisiveis();
  contagem.textContent = `${visiveis.length} ${visiveis.length === 1 ? 'modelo' : 'modelos'}`;

  if (visiveis.length === 0) {
    const aviso = produtos.length === 0
      ? 'Ainda não há celulares na vitrine.'
      : 'Nenhum celular encontrado. Tente outra marca ou outra busca.';
    lista.append(el('li', 'aviso', aviso));
    return;
  }

  visiveis.forEach(produto => lista.append(criarItem(produto)));
}

async function carregarProdutos() {
  try {
    const resposta = await fetch(API);
    produtos = await resposta.json();
    estadoLista = 'ok';
  } catch {
    estadoLista = 'erro';
  }

  renderizarFiltros();
  renderizarLista();
}

// ---------- Cadastro e edição (só com login) ----------

async function salvarProduto(evento) {
  evento.preventDefault();

  const dados = {
    nome: campoNome.value.trim(),
    marca: campoMarca.value.trim(),
    armazenamento: campoArmazenamento.value.trim(),
    cor: campoCor.value.trim(),
    preco: Number(campoPreco.value),
    imagem: campoImagem.value.trim()
  };
  const url = idEmEdicao ? `${API}/${idEmEdicao}` : API;
  const metodo = idEmEdicao ? 'PUT' : 'POST';

  try {
    const resposta = await fetch(url, {
      method: metodo,
      headers: cabecalhos(),
      body: JSON.stringify(dados)
    });
    const corpo = await resposta.json();

    if (resposta.status === 401) {
      sair(corpo.erro, 'erro');
      return;
    }

    if (!resposta.ok) {
      mostrar(mensagem, corpo.erro, 'erro');
      return;
    }

    mostrar(mensagem, idEmEdicao ? 'Celular atualizado.' : 'Celular cadastrado.', 'sucesso');
    cancelarEdicao();
    carregarProdutos();
  } catch {
    mostrar(mensagem, 'Não foi possível falar com o servidor. Tente de novo.', 'erro');
  }
}

function iniciarEdicao(produto) {
  idEmEdicao = produto.id;
  campoNome.value = produto.nome;
  campoMarca.value = produto.marca ?? '';
  campoArmazenamento.value = produto.armazenamento ?? '';
  campoCor.value = produto.cor ?? '';
  campoPreco.value = produto.preco;
  campoImagem.value = produto.imagem ?? '';
  tituloForm.textContent = `Editando: ${produto.nome}`;
  botaoSalvar.textContent = 'Salvar alterações';
  botaoCancelar.hidden = false;
  mostrar(mensagem, '', '');
  painel.scrollIntoView({ block: 'start' });
  campoNome.focus({ preventScroll: true });
}

function cancelarEdicao() {
  idEmEdicao = null;
  formulario.reset();
  tituloForm.textContent = 'Cadastrar celular';
  botaoSalvar.textContent = 'Cadastrar celular';
  botaoCancelar.hidden = true;
}

async function apagarProduto(produto) {
  if (!confirm(`Apagar "${produto.nome}"?`)) return;

  try {
    const resposta = await fetch(`${API}/${produto.id}`, {
      method: 'DELETE',
      headers: cabecalhos()
    });

    if (resposta.status === 401) {
      const corpo = await resposta.json();
      sair(corpo.erro, 'erro');
      return;
    }

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => ({}));
      mostrar(mensagem, corpo.erro || 'Não foi possível apagar o celular.', 'erro');
      return;
    }

    if (idEmEdicao === produto.id) cancelarEdicao();
    mostrar(mensagem, 'Celular apagado.', 'sucesso');
    carregarProdutos();
  } catch {
    mostrar(mensagem, 'Não foi possível falar com o servidor. Tente de novo.', 'erro');
  }
}

// ---------- Eventos ----------

campoBusca.addEventListener('input', () => {
  termoBusca = campoBusca.value;
  renderizarLista();
});

botaoAbrirLogin.addEventListener('click', () => abrirLogin());
botaoFecharLogin.addEventListener('click', () => dialogoLogin.close());
dialogoLogin.addEventListener('close', () => {
  if (!estaLogado()) acaoAposLogin = null;
});
dialogoLogin.addEventListener('click', evento => {
  if (evento.target === dialogoLogin) dialogoLogin.close();
});
formLogin.addEventListener('submit', enviarLogin);
botaoAlternar.addEventListener('click', alternarModo);
botaoSair.addEventListener('click', () => sair());

formulario.addEventListener('submit', salvarProduto);
botaoCancelar.addEventListener('click', () => {
  cancelarEdicao();
  mostrar(mensagem, '', '');
});

atualizarTela();
carregarProdutos();