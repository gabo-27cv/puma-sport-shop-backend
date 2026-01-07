const { query } = require('../config/database');



// Obtener todas las categorías (público)
exports.getAllCategories = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, 
              COUNT(p.id) as total_productos
       FROM categorias c
       LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = true
       WHERE c.activo = true
       GROUP BY c.id
       ORDER BY c.orden, c.nombre`
    );
    // Cambiado: devolver array directo en lugar de objeto
    res.json(result.rows);
  } catch (error) {
    console.error('Error en getAllCategories:', error);
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
};



// Obtener una categoría por ID
exports.getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*,
              COUNT(p.id) as total_productos
       FROM categorias c
       LEFT JOIN productos p ON c.id = p.categoria_id AND p.activo = true
       WHERE c.id = $1 AND c.activo = true
       GROUP BY c.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ category: result.rows[0] });
  } catch (error) {
    console.error('Error en getCategoryById:', error);
    res.status(500).json({ error: 'Error al obtener categoría' });
  }
};