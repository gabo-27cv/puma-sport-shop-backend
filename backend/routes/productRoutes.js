const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate } = require('../middleware/authMiddleware');

// ==========================
// 🔓 RUTAS PÚBLICAS
// ==========================
// Listar
router.get('/', productController.getAllProducts);
// Producto por slug (público)
router.get('/slug/:slug', productController.getProductBySlug);

// Filtros especiales
router.get('/destacados', productController.getFeaturedProducts);
router.get('/nuevos', productController.getNewProducts);
router.get('/buscar', productController.searchProducts);

// ⚠️ SIEMPRE antes de /:slug
router.get('/:slug/relacionados', productController.getRelatedProducts);

// Producto individual (SIEMPRE AL FINAL de los GET)
router.get('/id/:id', productController.getProductById);
// ==========================
// 🔒 RUTAS PROTEGIDAS (ADMIN)
// ==========================
router.post('/', authenticate, productController.createProduct);
router.put('/:id', authenticate, productController.updateProduct);
router.delete('/:id', authenticate, productController.deleteProduct);

module.exports = router;