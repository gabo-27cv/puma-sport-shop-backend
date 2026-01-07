const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate } = require('../middleware/authMiddleware');

// Mis órdenes (requiere autenticación)
router.get('/mis-ordenes/historial', authenticate, orderController.getMyOrders);

// Crear orden (pública o autenticada)
router.post('/', orderController.createOrder);

// Ver orden por número (pública)
router.get('/:numero_orden', orderController.getOrderByNumber);

module.exports = router;
