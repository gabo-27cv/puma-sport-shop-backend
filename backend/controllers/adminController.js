const { query, transaction } = require('../config/database');

// =============================================
// DASHBOARD ADMIN
// =============================================
exports.getStatistics = async (req, res) => {
  try {
    const stats = await query('SELECT * FROM vista_estadisticas_admin');

    // Órdenes recientes
    const recentOrders = await query(
      `SELECT numero_orden, cliente_nombre, total, estado, created_at
       FROM ordenes
       ORDER BY created_at DESC
       LIMIT 10`
    );

    // Productos más vendidos
    const topProducts = await query(
      `SELECT 
        p.nombre as producto,
        SUM(oi.cantidad) as total_vendido,
        SUM(oi.subtotal) as total_ventas
       FROM orden_items oi
       JOIN variantes v ON oi.variante_id = v.id
       JOIN productos p ON v.producto_id = p.id
       WHERE oi.created_at >= CURRENT_DATE - INTERVAL '30 days'
       GROUP BY p.nombre
       ORDER BY total_vendido DESC
       LIMIT 10`
    );

    // Productos bajo stock
    const lowStock = await query(
      `SELECT 
        p.nombre as producto,
        v.color,
        v.talla,
        v.stock,
        v.stock_minimo
       FROM variantes v
       JOIN productos p ON v.producto_id = p.id
       WHERE v.stock <= v.stock_minimo AND v.activo = true
       ORDER BY v.stock ASC
       LIMIT 10`
    );

    res.json({
      statistics: stats.rows[0],
      recentOrders: recentOrders.rows,
      topProducts: topProducts.rows,
      lowStock: lowStock.rows
    });
  } catch (error) {
    console.error('Error en getStatistics:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
};

// =============================================
// GESTIÓN DE PRODUCTOS
// =============================================

// Crear producto completo con variantes
exports.createProduct = async (req, res) => {
  try {
    const {
      nombre,
      slug,
      descripcion,
      categoria_id,
      destacado,
      nuevo,
      imagenes,
      variantes
    } = req.body;

    if (!nombre || !slug) {
      return res.status(400).json({ error: 'Nombre y slug son obligatorios' });
    }

    const product = await transaction(async (client) => {
      // Crear producto
      const productResult = await client.query(
        `INSERT INTO productos (
          nombre, slug, descripcion, categoria_id, destacado, nuevo
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [nombre, slug, descripcion || null, categoria_id || null, destacado || false, nuevo || false]
      );

      const product = productResult.rows[0];

      // Agregar imágenes
      if (imagenes && imagenes.length > 0) {
        for (let i = 0; i < imagenes.length; i++) {
          const img = imagenes[i];
          await client.query(
            `INSERT INTO imagenes_producto (
              producto_id, url, es_principal, orden, alt_text
            ) VALUES ($1, $2, $3, $4, $5)`,
            [product.id, img.url, i === 0, i + 1, img.alt_text || nombre]
          );
        }
      }

      // Agregar variantes
      if (variantes && variantes.length > 0) {
        for (const v of variantes) {
          await client.query(
            `INSERT INTO variantes (
              producto_id, sku, color, talla, stock, stock_minimo,
              precio_compra, precio_venta, precio_descuento
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              product.id, v.sku, v.color || null, v.talla || null,
              v.stock || 0, v.stock_minimo || 5,
              v.precio_compra, v.precio_venta, v.precio_descuento || null
            ]
          );
        }
      }

      return product;
    });

    res.status(201).json({
      message: 'Producto creado exitosamente',
      product
    });
  } catch (error) {
    console.error('Error en createProduct:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El slug ya existe' });
    }
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

// Actualizar producto
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      slug,
      descripcion,
      categoria_id,
      destacado,
      nuevo,
      activo
    } = req.body;

    const result = await query(
      `UPDATE productos SET
        nombre = COALESCE($1, nombre),
        slug = COALESCE($2, slug),
        descripcion = COALESCE($3, descripcion),
        categoria_id = COALESCE($4, categoria_id),
        destacado = COALESCE($5, destacado),
        nuevo = COALESCE($6, nuevo),
        activo = COALESCE($7, activo)
       WHERE id = $8
       RETURNING *`,
      [
        nombre,
        slug,
        descripcion,
        categoria_id,
        destacado,
        nuevo,
        activo,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      message: 'Producto actualizado correctamente',
      product: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Error real en updateProduct:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// Eliminar producto
exports.deleteProduct = async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await query(
      'UPDATE productos SET activo = false WHERE slug = $1 RETURNING id',
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    console.error('Error en deleteProduct:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};


// =============================================
// GESTIÓN DE VARIANTES
// =============================================

// Crear variante
exports.createVariant = async (req, res) => {
  try {
    const {
      producto_id,
      sku,
      color,
      talla,
      stock,
      stock_minimo,
      precio_compra,
      precio_venta,
      precio_descuento
    } = req.body;

    if (!producto_id || !sku || !precio_compra || !precio_venta) {
      return res.status(400).json({ 
        error: 'Campos requeridos: producto_id, sku, precio_compra, precio_venta' 
      });
    }

    const result = await query(
      `INSERT INTO variantes (
        producto_id, sku, color, talla, stock, stock_minimo,
        precio_compra, precio_venta, precio_descuento
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        producto_id, sku, color || null, talla || null,
        stock || 0, stock_minimo || 5,
        precio_compra, precio_venta, precio_descuento || null
      ]
    );

    res.status(201).json({
      message: 'Variante creada',
      variant: result.rows[0]
    });
  } catch (error) {
    console.error('Error en createVariant:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'El SKU ya existe' });
    }
    res.status(500).json({ error: 'Error al crear variante' });
  }
};

// Actualizar variante
exports.updateVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      color,
      talla,
      stock,
      stock_minimo,
      precio_compra,
      precio_venta,
      precio_descuento,
      activo
    } = req.body;

    const result = await query(
      `UPDATE variantes SET
        color = COALESCE($1, color),
        talla = COALESCE($2, talla),
        stock = COALESCE($3, stock),
        stock_minimo = COALESCE($4, stock_minimo),
        precio_compra = COALESCE($5, precio_compra),
        precio_venta = COALESCE($6, precio_venta),
        precio_descuento = $7,
        activo = COALESCE($8, activo)
       WHERE id = $9
       RETURNING *`,
      [color, talla, stock, stock_minimo, precio_compra, precio_venta, 
       precio_descuento, activo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Variante no encontrada' });
    }

    res.json({
      message: 'Variante actualizada',
      variant: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updateVariant:', error);
    res.status(500).json({ error: 'Error al actualizar variante' });
  }
};

// =============================================
// GESTIÓN DE ÓRDENES
// =============================================

// Listar todas las órdenes
exports.getAllOrders = async (req, res) => {
  try {
    const { estado, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let queryText = 'SELECT * FROM ordenes WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (estado) {
      queryText += ` AND estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) as total FROM ordenes WHERE 1=1';
    const countParams = [];
    if (estado) {
      countQuery += ' AND estado = $1';
      countParams.push(estado);
    }

    const countResult = await query(countQuery, countParams);

    res.json({
      ordenes: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error en getAllOrders:', error);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};

// Actualizar estado de orden
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, notas_admin } = req.body;

    const validEstados = ['pendiente', 'confirmada', 'procesando', 'enviada', 'entregada', 'cancelada'];
    
    if (!validEstados.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const result = await query(
      `UPDATE ordenes SET
        estado = $1,
        notas_admin = COALESCE($2, notas_admin)
       WHERE id = $3
       RETURNING *`,
      [estado, notas_admin, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    res.json({
      message: 'Estado actualizado',
      orden: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updateOrderStatus:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
};

// Obtener todos los productos con sus variantes
exports.getProductsWithVariants = async (req, res) => {
  try {
    const products = await query(
      `SELECT 
         p.id, p.nombre, p.slug, p.descripcion, p.categoria_id, p.destacado, p.nuevo, p.activo,
         json_agg(
           json_build_object(
             'id', v.id,
             'sku', v.sku,
             'color', v.color,
             'talla', v.talla,
             'stock', v.stock,
             'precio_venta', v.precio_venta
           )
         ) AS variantes
       FROM productos p
       LEFT JOIN variantes v ON v.producto_id = p.id AND v.activo = true
       GROUP BY p.id
       ORDER BY p.id DESC`
    );

    res.json(products.rows);
  } catch (error) {
    console.error('Error en getProductsWithVariants:', error);
    res.status(500).json({ error: 'Error al obtener productos con variantes' });
  }
};
