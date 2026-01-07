const { query, transaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

// Generar número de orden único
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${year}${month}-${random}`;
};

// Crear orden desde el carrito
exports.createOrder = async (req, res) => {
  try {
    const {
      cliente_nombre,
      cliente_email,
      cliente_telefono,
      direccion_envio,
      ciudad,
      provincia,
      codigo_postal,
      metodo_pago,
      notas_cliente
    } = req.body;

    const userId = req.user?.id;
    const sessionId = req.headers['x-session-id'];

    // Validaciones
    if (!cliente_nombre || !cliente_email || !direccion_envio || !ciudad || !provincia) {
      return res.status(400).json({ 
        error: 'Todos los campos obligatorios deben estar completos' 
      });
    }

    // Obtener carrito
    let cartResult;
    if (userId) {
      cartResult = await query('SELECT * FROM carrito WHERE usuario_id = $1', [userId]);
    } else if (sessionId) {
      cartResult = await query('SELECT * FROM carrito WHERE session_id = $1', [sessionId]);
    } else {
      return res.status(400).json({ error: 'No se encontró el carrito' });
    }

    if (cartResult.rows.length === 0) {
      return res.status(404).json({ error: 'Carrito no encontrado' });
    }

    const cart = cartResult.rows[0];

    // Obtener items del carrito
    const itemsResult = await query(
      `SELECT 
        ci.*,
        v.sku,
        v.color,
        v.talla,
        v.stock,
        v.precio_venta,
        v.precio_descuento,
        p.nombre as producto_nombre,
        p.id as producto_id
       FROM carrito_items ci
       JOIN variantes v ON ci.variante_id = v.id
       JOIN productos p ON v.producto_id = p.id
       WHERE ci.carrito_id = $1 AND v.activo = true AND p.activo = true`,
      [cart.id]
    );

    if (itemsResult.rows.length === 0) {
      return res.status(400).json({ error: 'El carrito está vacío' });
    }

    const items = itemsResult.rows;

    // Verificar stock de todos los items
    for (const item of items) {
      if (item.stock < item.cantidad) {
        return res.status(400).json({ 
          error: `Stock insuficiente para ${item.producto_nombre}`,
          producto: item.producto_nombre,
          stock_disponible: item.stock
        });
      }
    }

    // Calcular totales
    const subtotal = items.reduce((sum, item) => {
      const precio = item.precio_descuento || item.precio_venta;
      return sum + (precio * item.cantidad);
    }, 0);

    const costo_envio = subtotal >= 100000 ? 0 : 5000; // Envío gratis sobre $100k
    const total = subtotal + costo_envio;

    // Crear orden en una transacción
    const order = await transaction(async (client) => {
      // Crear orden
      const numero_orden = generateOrderNumber();
      
      const orderResult = await client.query(
        `INSERT INTO ordenes (
          numero_orden, usuario_id, 
          cliente_nombre, cliente_email, cliente_telefono,
          direccion_envio, ciudad, provincia, codigo_postal,
          subtotal, costo_envio, total,
          metodo_pago, notas_cliente
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          numero_orden, userId || null,
          cliente_nombre, cliente_email, cliente_telefono,
          direccion_envio, ciudad, provincia, codigo_postal || null,
          subtotal, costo_envio, total,
          metodo_pago || 'transferencia', notas_cliente || null
        ]
      );

      const order = orderResult.rows[0];

      // Crear items de la orden
      for (const item of items) {
        const precio = item.precio_descuento || item.precio_venta;
        const subtotal_item = precio * item.cantidad;
        const variante_info = `${item.color || ''} ${item.talla || ''}`.trim();

        await client.query(
          `INSERT INTO orden_items (
            orden_id, variante_id, 
            producto_nombre, variante_info, sku,
            cantidad, precio_unitario, subtotal
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            order.id, item.variante_id,
            item.producto_nombre, variante_info, item.sku,
            item.cantidad, precio, subtotal_item
          ]
        );
      }

      // Vaciar carrito
      await client.query('DELETE FROM carrito_items WHERE carrito_id = $1', [cart.id]);

      return order;
    });

    res.status(201).json({
      message: 'Orden creada exitosamente',
      orden: {
        id: order.id,
        numero_orden: order.numero_orden,
        total: order.total,
        estado: order.estado
      }
    });
  } catch (error) {
    console.error('Error en createOrder:', error);
    res.status(500).json({ error: 'Error al crear orden' });
  }
};

// Obtener orden por número
exports.getOrderByNumber = async (req, res) => {
  try {
    const { numero_orden } = req.params;

    const orderResult = await query(
      'SELECT * FROM ordenes WHERE numero_orden = $1',
      [numero_orden]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    const order = orderResult.rows[0];

    // Obtener items de la orden
    const itemsResult = await query(
      `SELECT * FROM orden_items WHERE orden_id = $1`,
      [order.id]
    );

    res.json({
      orden: {
        ...order,
        items: itemsResult.rows
      }
    });
  } catch (error) {
    console.error('Error en getOrderByNumber:', error);
    res.status(500).json({ error: 'Error al obtener orden' });
  }
};

// Obtener órdenes del usuario
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT 
        id, numero_orden, total, estado, estado_pago, created_at
       FROM ordenes
       WHERE usuario_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as total FROM ordenes WHERE usuario_id = $1',
      [userId]
    );

    res.json({
      ordenes: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error en getMyOrders:', error);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};