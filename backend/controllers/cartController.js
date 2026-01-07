const { query, transaction } = require('../config/database');

// Obtener o crear carrito del usuario
const getOrCreateCart = async (userId, sessionId = null) => {
  let cart;
  
  if (userId) {
    // Usuario autenticado
    const result = await query(
      'SELECT * FROM carrito WHERE usuario_id = $1',
      [userId]
    );
    
    if (result.rows.length > 0) {
      cart = result.rows[0];
    } else {
      const newCart = await query(
        'INSERT INTO carrito (usuario_id) VALUES ($1) RETURNING *',
        [userId]
      );
      cart = newCart.rows[0];
    }
  } else if (sessionId) {
    // Usuario invitado
    const result = await query(
      'SELECT * FROM carrito WHERE session_id = $1',
      [sessionId]
    );
    
    if (result.rows.length > 0) {
      cart = result.rows[0];
    } else {
      const newCart = await query(
        'INSERT INTO carrito (session_id) VALUES ($1) RETURNING *',
        [sessionId]
      );
      cart = newCart.rows[0];
    }
  } else {
    throw new Error('Se requiere userId o sessionId');
  }
  
  return cart;
};

// Obtener carrito con items
exports.getCart = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const sessionId = req.headers['x-session-id'] || null;

    if (!userId && !sessionId) {
      return res.status(400).json({ error: 'Debe enviar token o x-session-id' });
    }

    const cart = await getOrCreateCart(userId, sessionId);

    const itemsResult = await query(
      `SELECT 
        ci.*,
        v.sku,
        v.color,
        v.talla,
        v.stock,
        v.precio_venta,
        v.precio_descuento,
        p.nombre AS producto_nombre,
        (SELECT url FROM imagenes_producto 
         WHERE producto_id = p.id AND es_principal = true LIMIT 1) AS imagen
       FROM carrito_items ci
       JOIN variantes v ON ci.variante_id = v.id
       JOIN productos p ON v.producto_id = p.id
       WHERE ci.carrito_id = $1`,
      [cart.id]
    );

    const items = itemsResult.rows;

    const subtotal = items.reduce((s, i) => {
      const precio = i.precio_descuento || i.precio_venta;
      return s + precio * i.cantidad;
    }, 0);

    res.json({
      cart: {
        id: cart.id,
        items,
        subtotal,
        total_items: items.reduce((s, i) => s + i.cantidad, 0)
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener carrito' });
  }
};
// Agregar producto al carrito
exports.addToCart = async (req, res) => {
  try {
    const { variante_id, cantidad = 1 } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    
    if (!variante_id) {
      return res.status(400).json({ error: 'variante_id es requerido' });
    }
    
    // Verificar stock disponible
    const variantResult = await query(
      `SELECT v.*, p.nombre as producto_nombre
       FROM variantes v
       JOIN productos p ON v.producto_id = p.id
       WHERE v.id = $1 AND v.activo = true AND p.activo = true`,
      [variante_id]
    );
    
    if (variantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    const variant = variantResult.rows[0];
    
    if (variant.stock < cantidad) {
      return res.status(400).json({ 
        error: 'Stock insuficiente',
        stock_disponible: variant.stock
      });
    }
    
    const cart = await getOrCreateCart(userId, sessionId);
    
    // Verificar si el item ya está en el carrito
    const existingItem = await query(
      'SELECT * FROM carrito_items WHERE carrito_id = $1 AND variante_id = $2',
      [cart.id, variante_id]
    );
    
    if (existingItem.rows.length > 0) {
      // Actualizar cantidad
      const nuevaCantidad = existingItem.rows[0].cantidad + cantidad;
      
      if (variant.stock < nuevaCantidad) {
        return res.status(400).json({ 
          error: 'Stock insuficiente',
          stock_disponible: variant.stock
        });
      }
      
      await query(
        `UPDATE carrito_items 
         SET cantidad = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE carrito_id = $2 AND variante_id = $3`,
        [nuevaCantidad, cart.id, variante_id]
      );
    } else {
      // Agregar nuevo item
      const precio = variant.precio_descuento || variant.precio_venta;
      
      await query(
        `INSERT INTO carrito_items (carrito_id, variante_id, cantidad, precio_unitario)
         VALUES ($1, $2, $3, $4)`,
        [cart.id, variante_id, cantidad, precio]
      );
    }
    
    res.json({ 
      message: 'Producto agregado al carrito',
      producto: variant.producto_nombre
    });
  } catch (error) {
    console.error('Error en addToCart:', error);
    res.status(500).json({ error: 'Error al agregar al carrito' });
  }
};

// Actualizar cantidad de un item
exports.updateCartItem = async (req, res) => {
  try {
    const { item_id } = req.params;
    const { cantidad } = req.body;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    
    if (!cantidad || cantidad < 1) {
      return res.status(400).json({ error: 'Cantidad debe ser mayor a 0' });
    }
    
    const cart = await getOrCreateCart(userId, sessionId);
    
    // Verificar stock
    const itemResult = await query(
      `SELECT ci.*, v.stock
       FROM carrito_items ci
       JOIN variantes v ON ci.variante_id = v.id
       WHERE ci.id = $1 AND ci.carrito_id = $2`,
      [item_id, cart.id]
    );
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado en el carrito' });
    }
    
    const item = itemResult.rows[0];
    
    if (item.stock < cantidad) {
      return res.status(400).json({ 
        error: 'Stock insuficiente',
        stock_disponible: item.stock
      });
    }
    
    await query(
      'UPDATE carrito_items SET cantidad = $1 WHERE id = $2',
      [cantidad, item_id]
    );
    
    res.json({ message: 'Cantidad actualizada' });
  } catch (error) {
    console.error('Error en updateCartItem:', error);
    res.status(500).json({ error: 'Error al actualizar item' });
  }
};

// Eliminar item del carrito
exports.removeCartItem = async (req, res) => {
  try {
    const { item_id } = req.params;
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    
    const cart = await getOrCreateCart(userId, sessionId);
    
    const result = await query(
      'DELETE FROM carrito_items WHERE id = $1 AND carrito_id = $2 RETURNING *',
      [item_id, cart.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    
    res.json({ message: 'Producto eliminado del carrito' });
  } catch (error) {
    console.error('Error en removeCartItem:', error);
    res.status(500).json({ error: 'Error al eliminar item' });
  }
};

// Vaciar carrito
exports.clearCart = async (req, res) => {
  try {
    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];
    
    const cart = await getOrCreateCart(userId, sessionId);
    
    await query('DELETE FROM carrito_items WHERE carrito_id = $1', [cart.id]);
    
    res.json({ message: 'Carrito vaciado' });
  } catch (error) {
    console.error('Error en clearCart:', error);
    res.status(500).json({ error: 'Error al vaciar carrito' });
  }
};