-- Base de datos: inventario_patinaje

-- =============================================
-- ELIMINAR TABLAS SI EXISTEN
-- =============================================
DROP TABLE IF EXISTS orden_items CASCADE;
DROP TABLE IF EXISTS ordenes CASCADE;
DROP TABLE IF EXISTS carrito_items CASCADE;
DROP TABLE IF EXISTS carrito CASCADE;
DROP TABLE IF EXISTS variantes CASCADE;
DROP TABLE IF EXISTS imagenes_producto CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- =============================================
-- TABLA DE USUARIOS
-- =============================================
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('admin', 'cliente')),

    direccion TEXT,
    ciudad VARCHAR(100),
    provincia VARCHAR(100),
    codigo_postal VARCHAR(10),

    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE CATEGORÍAS
-- =============================================
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    icono VARCHAR(50),
    imagen VARCHAR(255),
    orden INTEGER DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE PRODUCTOS
-- =============================================
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    descripcion TEXT,
    categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,

    meta_descripcion TEXT,
    keywords TEXT,

    destacado BOOLEAN DEFAULT false,
    nuevo BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE IMÁGENES DE PRODUCTOS
-- =============================================
CREATE TABLE imagenes_producto (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    es_principal BOOLEAN DEFAULT false,
    orden INTEGER DEFAULT 0,
    alt_text VARCHAR(200),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE VARIANTES
-- =============================================
CREATE TABLE variantes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,

    sku VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(50),
    talla VARCHAR(20),

    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    stock_minimo INTEGER DEFAULT 5,

    precio_compra DECIMAL(12,2) NOT NULL,
    precio_venta DECIMAL(12,2) NOT NULL,
    precio_descuento DECIMAL(12,2) CHECK (precio_descuento < precio_venta),

    activo BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE CARRITO
-- =============================================
CREATE TABLE carrito (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE ITEMS DEL CARRITO
-- =============================================
CREATE TABLE carrito_items (
    id SERIAL PRIMARY KEY,
    carrito_id INTEGER REFERENCES carrito(id) ON DELETE CASCADE,
    variante_id INTEGER REFERENCES variantes(id) ON DELETE CASCADE,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (carrito_id, variante_id)
);

-- =============================================
-- TABLA DE ÓRDENES
-- =============================================
CREATE TABLE ordenes (
    id SERIAL PRIMARY KEY,
    numero_orden VARCHAR(50) UNIQUE NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,

    cliente_nombre VARCHAR(100) NOT NULL,
    cliente_email VARCHAR(100) NOT NULL,
    cliente_telefono VARCHAR(20),

    direccion_envio TEXT NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    provincia VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(10),

    subtotal DECIMAL(12,2) NOT NULL,
    costo_envio DECIMAL(12,2) DEFAULT 0,
    descuento DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,

    estado VARCHAR(50) NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('pendiente','confirmada','procesando','enviada','entregada','cancelada')),

    metodo_pago VARCHAR(50),
    estado_pago VARCHAR(50) DEFAULT 'pendiente'
        CHECK (estado_pago IN ('pendiente','pagado','rechazado','reembolsado')),

    notas_cliente TEXT,
    notas_admin TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLA DE ITEMS DE ÓRDENES
-- =============================================
CREATE TABLE orden_items (
    id SERIAL PRIMARY KEY,
    orden_id INTEGER REFERENCES ordenes(id) ON DELETE CASCADE,
    variante_id INTEGER REFERENCES variantes(id) ON DELETE SET NULL,

    producto_nombre VARCHAR(200) NOT NULL,
    variante_info VARCHAR(100),
    sku VARCHAR(50) NOT NULL,

    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(12,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_slug ON productos(slug);
CREATE INDEX idx_productos_activo ON productos(activo);

CREATE INDEX idx_variantes_producto ON variantes(producto_id);
CREATE INDEX idx_variantes_sku ON variantes(sku);

CREATE INDEX idx_imagenes_producto ON imagenes_producto(producto_id);
CREATE INDEX idx_imagen_principal ON imagenes_producto(producto_id) WHERE es_principal = true;

CREATE INDEX idx_carrito_usuario ON carrito(usuario_id);
CREATE INDEX idx_carrito_session ON carrito(session_id);

CREATE INDEX idx_ordenes_usuario ON ordenes(usuario_id);
CREATE INDEX idx_ordenes_estado ON ordenes(estado);
CREATE INDEX idx_ordenes_numero ON ordenes(numero_orden);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON productos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_variantes_updated_at BEFORE UPDATE ON variantes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_carrito_updated_at BEFORE UPDATE ON carrito
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ordenes_updated_at BEFORE UPDATE ON ordenes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TRIGGER DE REDUCCIÓN DE STOCK (CORREGIDO)
-- =============================================
CREATE OR REPLACE FUNCTION reducir_stock_orden()
RETURNS TRIGGER AS $$
DECLARE
    stock_actual INTEGER;
BEGIN
    SELECT stock INTO stock_actual
    FROM variantes
    WHERE id = NEW.variante_id;

    IF stock_actual < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente para el producto';
    END IF;

    UPDATE variantes
    SET stock = stock - NEW.cantidad
    WHERE id = NEW.variante_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_reducir_stock
AFTER INSERT ON orden_items
FOR EACH ROW
EXECUTE FUNCTION reducir_stock_orden();

-- =============================================
-- VISTAS
-- =============================================
CREATE OR REPLACE VIEW vista_productos_completos AS
SELECT 
    p.id,
    p.nombre,
    p.slug,
    p.descripcion,
    p.destacado,
    p.nuevo,
    c.nombre AS categoria,
    c.id AS categoria_id,
    c.icono AS categoria_icono,

    (SELECT url FROM imagenes_producto
     WHERE producto_id = p.id AND es_principal = true
     LIMIT 1) AS imagen_principal,

    (SELECT COUNT(*) FROM imagenes_producto WHERE producto_id = p.id) AS total_imagenes,
    COUNT(DISTINCT v.id) AS total_variantes,
    COALESCE(SUM(v.stock),0) AS stock_total,

    MIN(COALESCE(v.precio_descuento, v.precio_venta)) AS precio_min,
    MAX(v.precio_venta) AS precio_max,
    BOOL_OR(v.precio_descuento IS NOT NULL) AS tiene_descuento,

    p.created_at,
    p.updated_at
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN variantes v ON p.id = v.producto_id AND v.activo = true
WHERE p.activo = true
GROUP BY p.id, c.id;

CREATE OR REPLACE VIEW vista_estadisticas_admin AS
SELECT 
    (SELECT COUNT(*) FROM productos WHERE activo = true) AS total_productos,
    (SELECT COUNT(*) FROM ordenes WHERE created_at >= CURRENT_DATE) AS ordenes_hoy,
    (SELECT COUNT(*) FROM ordenes WHERE estado = 'pendiente') AS ordenes_pendientes,
    (SELECT COALESCE(SUM(total),0) FROM ordenes 
        WHERE created_at >= CURRENT_DATE AND estado != 'cancelada') AS ventas_hoy,
    (SELECT COALESCE(SUM(total),0) FROM ordenes 
        WHERE created_at >= date_trunc('month', CURRENT_DATE)
        AND estado != 'cancelada') AS ventas_mes,
    (SELECT COUNT(*) FROM variantes WHERE stock <= stock_minimo AND activo = true) AS productos_bajo_stock,
    (SELECT COUNT(*) FROM usuarios WHERE rol = 'cliente') AS total_clientes;

-- =============================================
-- COMENTARIOS
-- =============================================
COMMENT ON TABLE usuarios IS 'Usuarios del sistema';
COMMENT ON TABLE productos IS 'Catálogo de productos';
COMMENT ON TABLE variantes IS 'Variantes con stock y precios';
COMMENT ON TABLE carrito IS 'Carritos de compra';
COMMENT ON TABLE ordenes IS 'Órdenes de compra';
COMMENT ON TABLE orden_items IS 'Items de cada orden';
