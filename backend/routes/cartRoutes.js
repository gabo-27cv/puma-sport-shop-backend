const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { optionalAuth } = require('../middleware/authMiddleware');

// 🔥 middleware híbrido (OBLIGATORIO)
router.use(optionalAuth);

router.get('/', cartController.getCart);
router.post('/add', cartController.addToCart);
router.put('/item/:item_id', cartController.updateCartItem);
router.delete('/item/:item_id', cartController.removeCartItem);
router.delete('/clear', cartController.clearCart);

module.exports = router;
