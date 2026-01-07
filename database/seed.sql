-- =============================================
-- SEED DATA - PUMA SPORT SHOP (UTF-8 SAFE)
-- =============================================

BEGIN;

-- =====================
-- USUARIOS
-- =====================

INSERT INTO usuarios (nombre, email, password, telefono, rol, direccion, ciudad, provincia)
VALUES
('Admin Principal', 'admin@pumasportshop.com',
'$2a$10$CwTycUXWue0Thq9StjUM0uJ8K8wrB.RfJPQnHgQhPEZ7tELe3vFHe',
'0999123456', 'admin', 'Av. Principal 123', 'Portoviejo', 'Manabi'),

('Cliente Demo', 'cliente@ejemplo.com',
'$2a$10$CwTycUXWue0Thq9StjUM0uJ8K8wrB.RfJPQnHgQhPEZ7tELe3vFHe',
'0988765432', 'cliente', 'Calle Secundaria 456', 'Portoviejo', 'Manabi')
ON CONFLICT (email) DO NOTHING;


-- =====================
-- CATEGORIAS
-- =====================
INSERT INTO categorias (nombre, slug, descripcion, orden) VALUES
('Patines', 'patines', 'Patines para todos los niveles', 1),
('Cascos', 'cascos', 'Cascos de proteccion', 2),
('Protecciones', 'protecciones', 'Kits y protecciones', 3),
('Guantes', 'guantes', 'Guantes de patinaje', 4),
('Ruedas', 'ruedas', 'Ruedas de repuesto', 5),
('Balineras', 'balineras', 'Balineras de alta velocidad', 6),
('Accesorios', 'accesorios', 'Accesorios variados', 7);

-- =====================
-- PRODUCTOS
-- =====================
INSERT INTO productos (nombre, slug, descripcion, categoria_id, destacado, nuevo)
VALUES
('Black Magic Pro Plus', 'black-magic-pro-plus',
'Patines profesionales con ruedas de 90mm.',
(SELECT id FROM categorias WHERE slug='patines'), true, false),

('Casco B3-30', 'casco-b3-30',
'Casco profesional con ajuste por dial.',
(SELECT id FROM categorias WHERE slug='cascos'), true, false),

('Casco Nova', 'casco-nova',
'Casco ligero para principiantes.',
(SELECT id FROM categorias WHERE slug='cascos'), false, false),

('Kit Proteccion C2', 'kit-proteccion-c2',
'Kit completo de protecciones.',
(SELECT id FROM categorias WHERE slug='protecciones'), true, false);

-- =====================
-- IMAGENES
-- =====================
INSERT INTO imagenes_producto (producto_id, url, es_principal, orden, alt_text)
VALUES
((SELECT id FROM productos WHERE slug='black-magic-pro-plus'),
'https://images.unsplash.com/photo-1564466809058-bf4114d55352?w=800',
true, 1, 'Black Magic Pro Plus'),

((SELECT id FROM productos WHERE slug='casco-b3-30'),
'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800',
true, 1, 'Casco B3-30'),

((SELECT id FROM productos WHERE slug='casco-nova'),
'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
true, 1, 'Casco Nova'),

((SELECT id FROM productos WHERE slug='kit-proteccion-c2'),
'https://images.unsplash.com/photo-1596367407372-96cb88503db6?w=800',
true, 1, 'Kit Proteccion C2');

-- =====================
-- VARIANTES
-- =====================
INSERT INTO variantes
(producto_id, sku, color, talla, stock, stock_minimo, precio_compra, precio_venta)
VALUES
((SELECT id FROM productos WHERE slug='black-magic-pro-plus'),
'BMP-NEG-3538', 'Negro', '35-38', 6, 2, 365000, 440000),

((SELECT id FROM productos WHERE slug='casco-b3-30'),
'CB330-FUC-S', 'Fucsia', 'S', 4, 2, 180000, 230000),

((SELECT id FROM productos WHERE slug='casco-nova'),
'CNOVA-NEG-SM', 'Negro', 'S/M', 10, 3, 75000, 99000),

((SELECT id FROM productos WHERE slug='kit-proteccion-c2'),
'KITC2-NEG-M', 'Negro', 'M', 8, 3, 45000, 80000);

COMMIT;
