const path = require('path');

require('dotenv').config({
  path: path.join(__dirname, '.env')
});

if (!process.env.JWT_SEGREDO) {
  throw new Error('JWT_SEGREDO não foi carregado. Confira o arquivo .env.');
}

if (!process.env.ADMIN_EMAIL) {
  console.warn('Aviso: ADMIN_EMAIL não está no .env, então ninguém conseguirá gerenciar os produtos.');
}

const express = require('express');
const banco = require('./dados/banco');
const produtosRoutes = require('./routes/produtosRoutes');
const authRoutes = require('./routes/authRoutes');
const clientesRoutes = require('./routes/clientesRoutes');
const pedidosRoutes = require('./routes/pedidosRoutes');

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/produtos', produtosRoutes);
app.use('/auth', authRoutes);
app.use('/clientes', clientesRoutes);
app.use('/pedidos', pedidosRoutes);

banco.iniciar()
  .then(() => {
    app.listen(3000, () => {
      console.log('Servidor rodando em http://localhost:3000');
    });
  })
  .catch(erro => {
    console.error('Erro ao abrir o banco de dados:', erro);
  });