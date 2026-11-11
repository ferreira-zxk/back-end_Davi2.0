const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, 'loja.db');
let db;

function salvarArquivo() {
  fs.writeFileSync(CAMINHO, Buffer.from(db.export()));
}

function consultar(sql, params = []) {
  const comando = db.prepare(sql);
  comando.bind(params);
  const linhas = [];
  while (comando.step()) {
    linhas.push(comando.getAsObject());
  }
  comando.free();
  return linhas;
}

function executar(sql, params = []) {
  db.run(sql, params);
  const alteradas = db.getRowsModified();
  const [{ id }] = consultar('SELECT last_insert_rowid() AS id');
  salvarArquivo();
  return { alteradas, ultimoId: id };
}

// Cria a coluna se ela ainda não existe. Devolve true quando acabou de criar.
// É assim que o banco antigo ganha os campos novos sem perder nenhum dado.
function adicionarColuna(tabela, coluna, definicao) {
  const existentes = consultar(`PRAGMA table_info(${tabela})`).map(c => c.name);
  if (existentes.includes(coluna)) return false;
  db.run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
  return true;
}

function criarTabelas() {
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      nome_completo TEXT NOT NULL,
      cpf TEXT NOT NULL,
      telefone TEXT NOT NULL,
      cep TEXT NOT NULL,
      endereco TEXT NOT NULL,
      numero TEXT NOT NULL,
      bairro TEXT NOT NULL,
      cidade TEXT NOT NULL,
      estado TEXT NOT NULL
    )
  `);

  // Dinheiro sempre em centavos (inteiro), para a conta nunca perder centavo.
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      total_centavos INTEGER NOT NULL,
      status TEXT NOT NULL,
      criado_em TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pedido_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      nome TEXT NOT NULL,
      preco_centavos INTEGER NOT NULL,
      quantidade INTEGER NOT NULL
    )
  `);

  // Do cartão guardamos só a bandeira e os 4 últimos dígitos. Número completo e CVV nunca.
  db.run(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      metodo TEXT NOT NULL,
      valor_centavos INTEGER NOT NULL,
      parcelas INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL,
      bandeira TEXT,
      final_cartao TEXT,
      codigo_pix TEXT,
      motivo TEXT
    )
  `);

  // Linha do tempo do pedido (criado, pago, separado, enviado, entregue...).
  db.run(`
    CREATE TABLE IF NOT EXISTS pedido_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      evento TEXT NOT NULL,
      criado_em TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL,
      valor INTEGER NOT NULL,
      validade TEXT,
      limite_usos INTEGER,
      usos INTEGER NOT NULL DEFAULT 0,
      ativo INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Do token de recuperar senha guardamos só o "hash": se alguém ler o banco, não consegue usar.
  db.run(`
    CREATE TABLE IF NOT EXISTS redefinicoes_senha (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expira_em TEXT NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function atualizarEstrutura() {
  for (const coluna of ['marca', 'armazenamento', 'cor', 'imagem', 'tela', 'camera', 'bateria', 'ram', 'descricao', 'fotos']) {
    adicionarColuna('produtos', coluna, 'TEXT');
  }

  // Produtos que já existiam começam com 10 unidades, para não aparecerem como "esgotado".
  if (adicionarColuna('produtos', 'estoque', 'INTEGER NOT NULL DEFAULT 0')) {
    db.run('UPDATE produtos SET estoque = 10');
  }

  adicionarColuna('usuarios', 'papel', "TEXT NOT NULL DEFAULT 'cliente'");

  // Se a conta do ADMIN_EMAIL já existia, promove ela a admin.
  const emailAdmin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (emailAdmin) {
    db.run("UPDATE usuarios SET papel = 'admin' WHERE lower(email) = ?", [emailAdmin]);
  }

  adicionarColuna('pedidos', 'desconto_centavos', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColuna('pedidos', 'frete_centavos', 'INTEGER NOT NULL DEFAULT 0');
  adicionarColuna('pedidos', 'cupom_codigo', 'TEXT');
  adicionarColuna('pedidos', 'envio', "TEXT NOT NULL DEFAULT 'aguardando'");
  if (adicionarColuna('pedidos', 'subtotal_centavos', 'INTEGER NOT NULL DEFAULT 0')) {
    db.run('UPDATE pedidos SET subtotal_centavos = total_centavos');
  }
}

function semearProdutos() {
  const [{ total }] = consultar('SELECT COUNT(*) AS total FROM produtos');
  if (total > 0) return;

  // Dados de exemplo (preços fictícios; confira as especificações antes de publicar a loja).
  const exemplos = [
    ['Galaxy S24', 'Samsung', '256 GB', 'Preto', 4299.9, '6,2" AMOLED 120 Hz', '50 MP', '4.000 mAh', '8 GB', 'Compacto e rápido, ótimo para quem quer câmera forte em um aparelho fácil de segurar.', 8],
    ['iPhone 15', 'Apple', '128 GB', 'Azul', 4799.9, '6,1" Super Retina XDR', '48 MP', 'Até 20 h de vídeo', '6 GB', 'Tela nítida, câmera principal de 48 MP e entrada USB-C.', 5],
    ['Redmi Note 13', 'Xiaomi', '256 GB', 'Verde', 1499.9, '6,67" AMOLED 120 Hz', '108 MP', '5.000 mAh', '8 GB', 'Bom custo-benefício, com tela grande e bateria para o dia todo.', 15],
    ['Moto G84', 'Motorola', '256 GB', 'Azul', 1299.9, '6,5" pOLED 120 Hz', '50 MP', '5.000 mAh', '8 GB', 'Tela pOLED fluida e bateria de longa duração.', 12],
    ['Galaxy A55', 'Samsung', '256 GB', 'Lilás', 2099.9, '6,6" Super AMOLED 120 Hz', '50 MP', '5.000 mAh', '8 GB', 'Linha intermediária com acabamento premium e tela excelente.', 6],
    ['Pixel 8', 'Google', '128 GB', 'Cinza', 3899.9, '6,2" OLED 120 Hz', '50 MP', '4.575 mAh', '8 GB', 'Câmera inteligente e Android puro, com atualizações por muitos anos.', 3]
  ];

  for (const [nome, marca, armazenamento, cor, preco, tela, camera, bateria, ram, descricao, estoque] of exemplos) {
    db.run(
      `INSERT INTO produtos (nome, marca, armazenamento, cor, preco, tela, camera, bateria, ram, descricao, fotos, estoque)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?)`,
      [nome, marca, armazenamento, cor, preco, tela, camera, bateria, ram, descricao, estoque]
    );
  }
}

async function iniciar() {
  const SQL = await initSqlJs();
  db = fs.existsSync(CAMINHO)
    ? new SQL.Database(fs.readFileSync(CAMINHO))
    : new SQL.Database();

  criarTabelas();
  atualizarEstrutura();
  semearProdutos();
  salvarArquivo();
}

module.exports = { iniciar, consultar, executar };