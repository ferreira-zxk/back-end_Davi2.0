const express = require('express');
const controller = require('../controllers/pedidosController');
const autenticar = require('../middlewares/autenticar');

const router = express.Router();

router.use(autenticar);

router.post('/', controller.criar);
router.get('/', controller.listar);
router.get('/:id', controller.buscar);
router.post('/:id/pagamentos/:pagamentoId/simular-pix', controller.simularPix);

module.exports = router;