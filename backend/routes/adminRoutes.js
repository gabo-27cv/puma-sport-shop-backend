const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación de admin
// Comenta estas líneas si estás en desarrollo/testing sin autenticación
router.use(authenticate);
router.use(isAdmin);

// Dashboard
router.get('/statistics', adminController.getStatistics);

// Productos
router.post('/products', adminController.createProduct);
router.put('/products/:id', adminController.updateProduct); // ✅ Corregido
router.delete('/products/:slug', adminController.deleteProduct);
router.get('/products', adminController.getProductsWithVariants);

// Variantes
router.post('/variants', adminController.createVariant);
router.put('/variants/:id', adminController.updateVariant);

// Órdenes
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:id/status', adminController.updateOrderStatus);

module.exports = router;