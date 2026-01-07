const jwt = require('jsonwebtoken');

// Middleware para verificar token JWT
exports.authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token no proporcionado' 
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      rol: decoded.rol,
      email: decoded.email
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(500).json({ error: 'Error al verificar token' });
  }
};

// Middleware para verificar rol de admin
exports.isAdmin = (req, res, next) => {
  if (req.user.rol !== 'admin') {
    return res.status(403).json({ 
      error: 'Acceso denegado. Se requiere rol de administrador' 
    });
  }
  next();
};

// Middleware para verificar rol de cliente
exports.isCliente = (req, res, next) => {
  if (req.user.rol !== 'cliente') {
    return res.status(403).json({ 
      error: 'Acceso denegado. Solo para clientes' 
    });
  }
  next();
};

// Middleware opcional de autenticación (no falla si no hay token)
// backend/middleware/authMiddleware.js
exports.optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth Header recibido:', authHeader); // <-- log
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET);

      req.user = {
        id: decoded.id,
        rol: decoded.rol,
        email: decoded.email
      };
    }
    console.log('req.user set:', req.user); // <-- log
    next();
  } catch (error) {
    console.log('optionalAuth error:', error);
    next();
  }
};
