const express = require('express');
const controller = require('../controllers/produtosController');
const autenticar = require('../middlewares/autenticar');
const soAdmin = require('../middlewares/soAdmin');

const router = express.Router();

router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.post('/', autenticar, soAdmin, controller.criar);
router.put('/:id', autenticar, soAdmin, controller.atualizar);
router.delete('/:id', autenticar, soAdmin, controller.remover);

module.exports = router;