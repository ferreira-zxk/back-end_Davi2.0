const express = require('express');
const controller = require('../controllers/clientesController');
const autenticar = require('../middlewares/autenticar');

const router = express.Router();

router.get('/eu', autenticar, controller.obter);
router.put('/eu', autenticar, controller.salvar);

module.exports = router;