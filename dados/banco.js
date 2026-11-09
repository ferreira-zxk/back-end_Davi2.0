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

// Colunas novas para a loja de celulares. Todas são opcionais (aceitam NULL),
// assim os produtos antigos e o teste.js continuam funcionando.
const COLUNAS_NOVAS = ['marca', 'armazenamento', 'cor', 'imagem'];

function atualizarEstrutura() {
  const existentes = consultar('PRAGMA table_info(produtos)').map(coluna => coluna.name);

  for (const coluna of COLUNAS_NOVAS) {
    if (!existentes.includes(coluna)) {
      db.run(`ALTER TABLE produtos ADD COLUMN ${coluna} TEXT`);
    }
  }

  // Papel do usuário: 'admin' ou 'cliente'. Quem já existia vira 'cliente'.
  const colunasUsuarios = consultar('PRAGMA table_info(usuarios)').map(coluna => coluna.name);
  if (!colunasUsuarios.includes('papel')) {
    db.run("ALTER TABLE usuarios ADD COLUMN papel TEXT NOT NULL DEFAULT 'cliente'");
  }

  // Se a conta do ADMIN_EMAIL já existia antes desta mudança, promove ela a admin.
  const emailAdmin = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (emailAdmin) {
    db.run("UPDATE usuarios SET papel = 'admin' WHERE lower(email) = ?", [emailAdmin]);
  }
}

async function iniciar() {
  const SQL = await initSqlJs();
  db = fs.existsSync(CAMINHO)
    ? new SQL.Database(fs.readFileSync(CAMINHO))
    : new SQL.Database();

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

  atualizarEstrutura();

  const [{ total }] = consultar('SELECT COUNT(*) AS total FROM produtos');
  if (total === 0) {
    // Dados de exemplo (preços fictícios, só para a vitrine não começar vazia)
    const exemplos = [
      ['Galaxy S24', 'Samsung', '256 GB', 'Preto', 4299.9],
      ['iPhone 15', 'Apple', '128 GB', 'Azul', 4799.9],
      ['Redmi Note 13', 'Xiaomi', '256 GB', 'Verde', 1499.9],
      ['Moto G84', 'Motorola', '256 GB', 'Azul', 1299.9],
      ['Galaxy A55', 'Samsung', '256 GB', 'Lilás', 2099.9],
      ['Pixel 8', 'Google', '128 GB', 'Cinza', 3899.9]
    ];

    for (const [nome, marca, armazenamento, cor, preco] of exemplos) {
      db.run(
        'INSERT INTO produtos (nome, marca, armazenamento, cor, preco) VALUES (?, ?, ?, ?, ?)',
        [nome, marca, armazenamento, cor, preco]
      );
    }
  }

  salvarArquivo();
}

module.exports = { iniciar, consultar, executar };