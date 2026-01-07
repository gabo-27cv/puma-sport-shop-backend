const { query } = require('../config/database');

// Obtener todos los productos
exports.getAllProducts = async (req, res) => {
  try {
    const result = await query(`
      SELECT
        id,
        nombre,
        slug,
        descripcion,
        categoria_id,
        destacado,
        nuevo,
        activo,
        created_at
      FROM productos
      WHERE activo = true
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('getAllProducts:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

// Productos destacados
exports.getFeaturedProducts = async (req, res) => {
  try {
    const result = await query(`
      SELECT id, nombre, slug
      FROM productos
      WHERE destacado = true AND activo = true
      LIMIT 8
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('getFeaturedProducts:', error);
    res.status(500).json({ error: 'Error al obtener destacados' });
  }
};

// Productos nuevos
exports.getNewProducts = async (req, res) => {
  try {
    const result = await query(`
      SELECT id, nombre, slug
      FROM productos
      WHERE activo = true
      ORDER BY created_at DESC
      LIMIT 8
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('getNewProducts:', error);
    res.status(500).json({ error: 'Error al obtener nuevos productos' });
  }
};

// Buscar productos
exports.searchProducts = async (req, res) => {
  const { q } = req.query;

  try {
    const result = await query(`
      SELECT id, nombre, slug
      FROM productos
      WHERE activo = true
      AND nombre ILIKE '%' || $1 || '%'
    `, [q]);

    res.json(result.rows);
  } catch (error) {
    console.error('searchProducts:', error);
    res.status(500).json({ error: 'Error al buscar productos' });
  }
};

// Producto por slug
// En productController.js, reemplaza getProductBySlug con esto:
exports.getProductBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const result = await query(`
      SELECT p.*,
             c.nombre as categoria_nombre,
             c.id as categoria_id,
             COALESCE(
               (SELECT json_agg(url ORDER BY orden)
                FROM imagenes_producto
                WHERE producto_id = p.id),
               '[]'::json
             ) as imagenes,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', v.id,
                 'sku', v.sku,
                 'color', v.color,
                 'talla', v.talla,
                 'stock', v.stock,
                 'precio_compra', v.precio_compra,
                 'precio_venta', v.precio_venta
               ) ORDER BY v.id)
                FROM variantes v
                WHERE v.producto_id = p.id),
               '[]'::json
             ) as variantes
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.slug = $1 AND p.activo = true
    `, [slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    
    console.log('✅ Producto encontrado:', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('getProductBySlug:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

// Productos relacionados
exports.getRelatedProducts = async (req, res) => {
  const { slug } = req.params;

  try {
    const product = await query(
      'SELECT categoria_id FROM productos WHERE slug = $1',
      [slug]
    );

    if (product.rows.length === 0) {
      return res.json([]);
    }

    const result = await query(`
      SELECT id, nombre, slug
      FROM productos
      WHERE categoria_id = $1
      AND slug != $2
      AND activo = true
      LIMIT 4
    `, [product.rows[0].categoria_id, slug]);

    res.json(result.rows);
  } catch (error) {
    console.error('getRelatedProducts:', error);
    res.status(500).json({ error: 'Error al obtener relacionados' });
  }
};
// =============================================
// CRUD DE PRODUCTOS (ADMIN)
// =============================================

// Crear producto
exports.createProduct = async (req, res) => {
  try {
    const { nombre, slug, descripcion, categoria_id, destacado, nuevo, imagenes, variantes } = req.body;

    // Validar datos obligatorios
    if (!nombre || !slug) {
      return res.status(400).json({ error: 'Nombre y slug son obligatorios' });
    }

    // Verificar si el slug ya existe
    const existing = await query('SELECT id FROM productos WHERE slug = $1', [slug]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'El slug ya existe' });
    }

    // Insertar producto
    const result = await query(
      `INSERT INTO productos (nombre, slug, descripcion, categoria_id, destacado, nuevo, activo)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [nombre, slug, descripcion || '', categoria_id || null, destacado || false, nuevo || false]
    );

    const producto = result.rows[0];

    // Si hay variantes, insertarlas
    if (variantes && Array.isArray(variantes) && variantes.length > 0) {
      for (const v of variantes) {
        await query(
          `INSERT INTO variantes (producto_id, sku, color, talla, stock, precio_compra, precio_venta)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [producto.id, v.sku, v.color, v.talla || v.size, v.stock || 0, v.precio_compra || v.purchasePrice || 0, v.precio_venta || v.salePrice || 0]
        );
      }
    }

    // Si hay imágenes, insertarlas
    if (imagenes && Array.isArray(imagenes) && imagenes.length > 0) {
      for (let i = 0; i < imagenes.length; i++) {
        await query(
          `INSERT INTO imagenes_producto (producto_id, url, orden)
           VALUES ($1, $2, $3)`,
          [producto.id, imagenes[i], i + 1]
        );
      }
    }

    res.status(201).json({
      message: 'Producto creado exitosamente',
      producto
    });
  } catch (error) {
    console.error('Error en createProduct:', error);
    res.status(500).json({ error: 'Error al crear producto', message: error.message });
  }
};

// Actualizar producto
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, slug, descripcion, categoria_id, destacado, nuevo } = req.body;

    const result = await query(
      `UPDATE productos 
       SET nombre = COALESCE($1, nombre), 
           slug = COALESCE($2, slug), 
           descripcion = COALESCE($3, descripcion), 
           categoria_id = COALESCE($4, categoria_id),
           destacado = COALESCE($5, destacado), 
           nuevo = COALESCE($6, nuevo),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [nombre, slug, descripcion, categoria_id, destacado, nuevo, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({
      message: 'Producto actualizado exitosamente',
      producto: result.rows[0]
    });
  } catch (error) {
    console.error('Error en updateProduct:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

// Eliminar producto (soft delete)
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Soft delete - marcar como inactivo
    const result = await query(
      `UPDATE productos SET activo = false, updated_at = NOW() WHERE id = $1 RETURNING id, nombre`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ 
      message: 'Producto eliminado exitosamente',
      producto: result.rows[0]
    });
  } catch (error) {
    console.error('Error en deleteProduct:', error);
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

// Agregar al final de productController.js

// Obtener producto por ID (para admin)
exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT p.*,
             c.nombre as categoria_nombre,
             COALESCE(
               (SELECT json_agg(url ORDER BY orden)
                FROM imagenes_producto
                WHERE producto_id = p.id),
               '[]'::json
             ) as imagenes,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', v.id,
                 'sku', v.sku,
                 'color', v.color,
                 'talla', v.talla,
                 'stock', v.stock,
                 'precio_compra', v.precio_compra,
                 'precio_venta', v.precio_venta
               ) ORDER BY v.id)
                FROM variantes v
                WHERE v.producto_id = p.id),
               '[]'::json
             ) as variantes
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('getProductById:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};


exports.getProductById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(`
      SELECT p.*,
             c.nombre as categoria_nombre,
             COALESCE(
               (SELECT json_agg(url ORDER BY orden)
                FROM imagenes_producto WHERE producto_id = p.id),
               '[]'::json
             ) as imagenes,
             COALESCE(
               (SELECT json_agg(json_build_object(
                 'id', v.id, 'sku', v.sku, 'color', v.color, 'talla', v.talla,
                 'stock', v.stock, 'precio_compra', v.precio_compra, 'precio_venta', v.precio_venta
               ) ORDER BY v.id)
                FROM variantes v WHERE v.producto_id = p.id),
               '[]'::json
             ) as variantes
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('getProductById:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};
