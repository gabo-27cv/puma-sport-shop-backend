require('dotenv').config();
const express = require('express');
const cors = require('cors');

// 🔥 RUTAS CORREGIDAS
const authRoutes = require('./backend/routes/authRoutes');
const categoryRoutes = require('./backend/routes/categoryRoutes');
const productRoutes = require('./backend/routes/productRoutes');
const cartRoutes = require('./backend/routes/cartRoutes');
const orderRoutes = require('./backend/routes/orderRoutes');
const adminRoutes = require('./backend/routes/adminRoutes');

const app = express();
const PORT = process.env.PORT || 3001; // ⚠️ CAMBIAR A 3001

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:3002',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://puma-sport-shop-frontend-b168.vercel.app' // <--- frontend Vercel
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`); // ⚠️ CORREGIR COMILLAS
  next();
});

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'PUMA Sport Shop API funcionando'
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Server
app.listen(PORT, () => {
  console.log(`🚀 API corriendo en http://localhost:${PORT}`); // ⚠️ CORREGIR COMILLAS
});
