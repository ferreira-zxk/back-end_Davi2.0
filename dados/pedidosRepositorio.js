const { consultar, executar } = require('./banco');

function criar(usuarioId, valores) {
  const { ultimoId } = executar(
    `INSERT INTO pedidos (usuario_id, subtotal_centavos, desconto_centavos, frete_centavos, total_centavos, cupom_codigo, status, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      usuarioId,
      valores.subtotal,
      valores.desconto,
      valores.frete,
      valores.total,
      valores.cupom ?? null,
      'aguardando_pagamento',
      new Date().toISOString()
    ]
  );
  return ultimoId;
}

function adicionarItem(pedidoId, item) {
  executar(
    'INSERT INTO pedido_itens (pedido_id, produto_id, nome, preco_centavos, quantidade) VALUES (?, ?, ?, ?, ?)',
    [pedidoId, item.produto_id, item.nome, item.preco_centavos, item.quantidade]
  );
}

function adicionarPagamento(pedidoId, p) {
  const { ultimoId } = executar(
    `INSERT INTO pagamentos (pedido_id, metodo, valor_centavos, parcelas, status, bandeira, final_cartao, codigo_pix, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [pedidoId, p.metodo, p.valor_centavos, p.parcelas, p.status, p.bandeira ?? null, p.final_cartao ?? null, p.codigo_pix ?? null, p.motivo ?? null]
  );
  return ultimoId;
}

function listarEventos(pedidoId) {
  return consultar('SELECT evento, criado_em FROM pedido_eventos WHERE pedido_id = ? ORDER BY id', [pedidoId]);
}

// Cada evento é registrado uma vez só (o "pago", por exemplo, não repete a cada verificação).
function registrarEvento(pedidoId, evento) {
  if (listarEventos(pedidoId).some(e => e.evento === evento)) return;
  executar(
    'INSERT INTO pedido_eventos (pedido_id, evento, criado_em) VALUES (?, ?, ?)',
    [pedidoId, evento, new Date().toISOString()]
  );
}

function buscarPorId(id) {
  const pedido = consultar('SELECT * FROM pedidos WHERE id = ?', [id])[0];
  if (!pedido) return undefined;

  pedido.itens = consultar(
    'SELECT produto_id, nome, preco_centavos, quantidade FROM pedido_itens WHERE pedido_id = ? ORDER BY id',
    [id]
  );
  pedido.pagamentos = consultar('SELECT * FROM pagamentos WHERE pedido_id = ? ORDER BY id', [id]);
  pedido.eventos = listarEventos(id);
  return pedido;
}

function listarPorUsuario(usuarioId) {
  return consultar(
    'SELECT id, total_centavos, status, envio, criado_em FROM pedidos WHERE usuario_id = ? ORDER BY id DESC',
    [usuarioId]
  );
}

// Lista do painel do admin, com filtros opcionais.
function listarTodos({ status, envio } = {}) {
  const filtros = [];
  const parametros = [];
  if (status) { filtros.push('p.status = ?'); parametros.push(status); }
  if (envio) { filtros.push('p.envio = ?'); parametros.push(envio); }
  const onde = filtros.length > 0 ? `WHERE ${filtros.join(' AND ')}` : '';

  return consultar(
    `SELECT p.id, p.total_centavos, p.status, p.envio, p.criado_em,
            COALESCE(c.nome_completo, u.nome) AS cliente
     FROM pedidos p
     LEFT JOIN usuarios u ON u.id = p.usuario_id
     LEFT JOIN clientes c ON c.usuario_id = p.usuario_id
     ${onde}
     ORDER BY p.id DESC LIMIT 200`,
    parametros
  );
}

function idsAguardandoPagamento() {
  return consultar("SELECT id FROM pedidos WHERE status = 'aguardando_pagamento'").map(p => p.id);
}

function atualizarStatus(id, status) {
  executar('UPDATE pedidos SET status = ? WHERE id = ?', [status, id]);
}

function definirEnvio(id, etapa) {
  executar('UPDATE pedidos SET envio = ? WHERE id = ?', [etapa, id]);
}

function atualizarPagamento(id, status, motivo) {
  executar('UPDATE pagamentos SET status = ?, motivo = ? WHERE id = ?', [status, motivo ?? null, id]);
}

// ---------- Relatórios ----------

function pagosDesde(isoDesde) {
  return consultar(
    "SELECT id, total_centavos, criado_em FROM pedidos WHERE status = 'pago' AND criado_em >= ?",
    [isoDesde]
  );
}

function maisVendidosDesde(isoDesde, limite = 5) {
  return consultar(
    `SELECT i.nome AS nome, SUM(i.quantidade) AS quantidade, SUM(i.preco_centavos * i.quantidade) AS total_centavos
     FROM pedido_itens i
     JOIN pedidos p ON p.id = i.pedido_id
     WHERE p.status = 'pago' AND p.criado_em >= ?
     GROUP BY i.produto_id, i.nome
     ORDER BY quantidade DESC, total_centavos DESC
     LIMIT ?`,
    [isoDesde, limite]
  );
}

function contarPendencias() {
  const [linha] = consultar(
    `SELECT
       SUM(CASE WHEN status = 'aguardando_pagamento' THEN 1 ELSE 0 END) AS aguardando_pagamento,
       SUM(CASE WHEN status = 'pago' AND envio IN ('aguardando', 'separado') THEN 1 ELSE 0 END) AS a_enviar
     FROM pedidos`
  );
  return { aguardando_pagamento: linha.aguardando_pagamento ?? 0, a_enviar: linha.a_enviar ?? 0 };
}

module.exports = {
  criar,
  adicionarItem,
  adicionarPagamento,
  registrarEvento,
  buscarPorId,
  listarPorUsuario,
  listarTodos,
  idsAguardandoPagamento,
  atualizarStatus,
  definirEnvio,
  atualizarPagamento,
  pagosDesde,
  maisVendidosDesde,
  contarPendencias
};