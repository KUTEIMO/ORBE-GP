import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const times = {
  78: '1644', 82: '1648', 83: '1649', 84: '1650', 85: '1651', 86: '1652', 87: '1653', 88: '1654',
  89: '1655', 90: '1656', 91: '1658', 92: '1658', 93: '1659', 94: '1700', 95: '1701', 96: '1702',
  97: '1703', 98: '1705', 99: '1706', 100: '1706', 101: '1708', 102: '1709', 103: '1710', 104: '1711',
  105: '1712', 106: '1713', 107: '1714', 108: '1714', 109: '1715', 110: '1716', 111: '1716',
  112: '1717', 113: '1717', 115: '1721'
};

const file = (n) => `R0010${String(n).padStart(3, '0')}_20250328${times[n]}_YP00145909.JPG`;

const nav = (id, title, shortLabel, targetNum, yaw, pitch) => ({
  id,
  type: 'nav',
  title,
  shortLabel,
  targetFile: file(targetNum),
  yaw,
  pitch,
  icon: '➜',
  altText: `Navegar a ${title}`,
  description: `Continúa el recorrido hacia: ${title}.`
});

const info = (id, title, yaw, pitch, description, icon = 'ⓘ') => ({
  id,
  type: 'info',
  title,
  yaw,
  pitch,
  icon,
  altText: title,
  description
});

const scenes = {};

function scene(num, meta, hotspots) {
  scenes[file(num)] = {
    id: meta.id,
    title: meta.title,
    shortTitle: meta.shortTitle || meta.title,
    altText: meta.altText,
    longDescription: meta.longDescription,
    initialView: meta.initialView || { yaw: 0, pitch: 0, fov: 1.35 },
    keyboardShortcuts: [
      'Flechas: girar la vista',
      'Clic en flechas azules: avanzar a la siguiente zona',
      'Doble clic hacia un destino: salto rápido'
    ],
    links: (meta.links || []).map((l) => ({
      label: l.label,
      targetFile: file(l.to),
      yaw: l.yaw,
      pitch: l.pitch ?? -0.08
    })),
    hotspots
  };
}

scene(82, {
  id: 'pre-biblioteca-puertas',
  title: 'Pre-biblioteca — Puertas y rampa',
  shortTitle: 'Puertas biblioteca',
  altText: 'Zona frente a las puertas de la biblioteca con rampa y mostrador.',
  longDescription: 'Estás frente a las puertas de la Biblioteca Anita Bolívar de Consuegra. Hay rampa corta, plantas y el letrero BIBLIOTECA.',
  links: [{ label: 'Entrar al lobby', to: 83, yaw: -0.4 }]
}, [
  nav('82-entrar', 'Entrar al lobby', 'Entrar', 83, -0.55, -0.05),
  nav('82-control', 'Control de ingreso', 'Registro', 78, 1.4, -0.05),
  info('82-rampa', 'Rampa de acceso', -1.1, -0.25, 'Rampa corta hacia el acceso de la biblioteca; facilita el ingreso con movilidad reducida.', '♿')
]);

scene(78, {
  id: 'control-ingreso-biblioteca',
  title: 'Control de ingreso — Biblioteca Anita Consuegra',
  shortTitle: 'Control de ingreso',
  altText: 'Mostrador de control de ingreso a la biblioteca Anita Consuegra.',
  longDescription: 'Mostrador acristalado de control de ingreso a la biblioteca. Desde aquí se orienta el acceso al lobby.',
  links: [{ label: 'Hacia puertas biblioteca', to: 82, yaw: 0.2 }]
}, [
  nav('78-puertas', 'Hacia puertas de la biblioteca', 'Puertas', 82, 0.35, -0.05),
  info('78-mostrador', 'Control de ingreso', -0.9, -0.05, 'Personal de control de ingreso y registro de visitantes a la Biblioteca Anita Consuegra.', '📚')
]);

scene(83, {
  id: 'biblioteca-lobby',
  title: 'Biblioteca — Lobby de ingreso',
  shortTitle: 'Lobby',
  altText: 'Lobby con arco de ingreso, mostrador, mesas y acceso a computadores.',
  longDescription: 'Umbral del lobby: arco con franja tricolor al frente, mostrador y mesas a la izquierda, sala de computadores a la derecha.',
  initialView: { yaw: 0.15, pitch: 0, fov: 1.3 },
  links: [{ label: 'Profundizar lobby', to: 84, yaw: 0.2 }]
}, [
  nav('83-adelante', 'Profundizar al lobby / mural', 'Adelante', 84, 0.2, -0.05),
  nav('83-estudio', 'Zona de mesas de estudio', 'Mesas', 86, -1.35, -0.05),
  nav('83-pcs', 'Sala de computadores', 'PCs', 85, 1.25, -0.05),
  nav('83-salida', 'Salir a pre-biblioteca', 'Salir', 82, 3.05, -0.05),
  info('83-mostrador', 'Mostrador de atención', -0.85, -0.08, 'Mostrador de atención y préstamos junto al acceso.', '📚'),
  info('83-letrero', 'Identificación de la biblioteca', 1.55, 0.15, 'Área del letrero y señalética de la Biblioteca Anita Bolívar de Consuegra.', '🏷')
]);

scene(84, {
  id: 'biblioteca-lobby-mural',
  title: 'Biblioteca — Lobby mural y PCs',
  shortTitle: 'Lobby mural',
  altText: 'Lobby con mural colorido, computadores y mesas bajo la mezanine.',
  longDescription: 'Vista del lobby: mural en el arco, fila de PCs a la derecha, mesas a la izquierda y escalera a mezanine al fondo.',
  links: [{ label: 'Otro ángulo del lobby', to: 85, yaw: 0.1 }]
}, [
  nav('84-atras', 'Volver al umbral', 'Atrás', 83, 3.1, -0.05),
  nav('84-pcs', 'Acercar a computadores', 'PCs', 85, 1.1, -0.05),
  nav('84-mesas', 'Pasillo de lectura', 'Mesas', 86, -1.0, -0.05),
  nav('84-escaleras', 'Hacia escaleras mezanine', 'Escaleras', 100, -2.1, 0.05),
  info('84-mural', 'Mural del acceso', 0.05, 0.12, 'Mural ilustrado alrededor del acceso principal del lobby.', '🎨')
]);

scene(85, {
  id: 'biblioteca-lobby-pcs',
  title: 'Biblioteca — Lobby ángulo PCs',
  shortTitle: 'Lobby PCs',
  altText: 'Ángulo del lobby enfocado en computadores y letrero de la biblioteca.',
  longDescription: 'Computadores bajo el letrero de la biblioteca; mural y mesas visibles hacia el centro-izquierda.',
  links: [{ label: 'Al pasillo central', to: 86, yaw: -0.4 }]
}, [
  nav('85-atras', 'Volver lobby mural', 'Atrás', 84, 3.0, -0.05),
  nav('85-pasillo', 'Pasillo central', 'Pasillo', 86, -0.55, -0.05),
  nav('85-cubiculos', 'Hacia cubículos', 'Cubículos', 87, 0.35, -0.05),
  info('85-pcs', 'Estaciones de cómputo', 0.95, -0.08, 'Fila de computadores de uso académico en el lobby.', '💻'),
  info('85-nombre', 'Letrero Anita Bolívar de Consuegra', 1.05, 0.25, 'Nombre oficial de la biblioteca en el muro.', '🏷')
]);

scene(86, {
  id: 'biblioteca-pasillo-central',
  title: 'Biblioteca — Pasillo central de lectura',
  shortTitle: 'Pasillo central',
  altText: 'Pasillo con mesas curvas, estantería baja y vista al mural del fondo.',
  longDescription: 'Eje central: mesas de estudio, estantería baja y fondo hacia el mural/acceso.',
  links: [{ label: 'Hacia cubículos', to: 87, yaw: 0.4 }]
}, [
  nav('86-lobby', 'Volver al lobby', 'Lobby', 85, 2.9, -0.05),
  nav('86-cubiculos', 'Cubículos arqueados', 'Cubículos', 87, 0.55, -0.05),
  nav('86-mesas', 'Mesas curvas', 'Mesas', 90, -0.7, -0.05),
  nav('86-general', 'Colección GENERAL', 'GENERAL', 93, 1.2, -0.05),
  info('86-estantes', 'Estantería baja', 0.1, -0.2, 'Estantería perimetral baja que organiza el pasillo de lectura.', '📖')
]);

scene(87, {
  id: 'biblioteca-cubiculos-arco',
  title: 'Biblioteca — Cubículos arqueados',
  shortTitle: 'Cubículos',
  altText: 'Cuatro cubículos arqueados bajo la mezanine, con PCs a un lado y mesas al otro.',
  longDescription: 'Frente a los cubículos de estudio semi-privados; a la izquierda PCs, a la derecha mesas comunales.',
  initialView: { yaw: 0.1, pitch: 0, fov: 1.3 },
  links: [{ label: 'Entrar a fila de cubículos', to: 88, yaw: 0.05 }]
}, [
  nav('87-dentro', 'Entrar a la fila de cubículos', 'Entrar', 88, 0.08, -0.05),
  nav('87-pcs', 'Zona de computadores', 'PCs', 85, -1.4, -0.05),
  nav('87-mesas', 'Mesas de estudio', 'Mesas', 91, 1.3, -0.05),
  nav('87-atras', 'Volver pasillo', 'Atrás', 86, 3.05, -0.05),
  info('87-pods', 'Cubículos de estudio', 0.15, -0.05, 'Cabinas arqueadas para estudio individual o en pareja, con iluminación propia.', '🪑')
]);

scene(88, {
  id: 'biblioteca-cubiculos-fila',
  title: 'Biblioteca — Fila de cubículos',
  shortTitle: 'Fila cubículos',
  altText: 'Vista cercana de cubículos con asientos verdes y azules.',
  longDescription: 'Pasillo frente a los cubículos; al fondo se abre hacia la estantería.',
  links: [{ label: 'Interior de un cubículo', to: 89, yaw: 0.2 }]
}, [
  nav('88-interior', 'Entrar a un cubículo', 'Interior', 89, 0.35, -0.1),
  nav('88-estantes', 'Hacia estantería', 'Estantes', 93, 1.0, -0.05),
  nav('88-atras', 'Volver vista general', 'Atrás', 87, 3.0, -0.05),
  info('88-booth', 'Cubículo grupal', -0.2, -0.05, 'Cubículo con banca tapizada y mesa de madera para trabajo concentrado.', '👥')
]);

scene(89, {
  id: 'biblioteca-cubiculo-interior',
  title: 'Biblioteca — Interior de cubículo',
  shortTitle: 'Dentro del cubículo',
  altText: 'Interior de un cubículo de madera con vista a la sala de estantería.',
  longDescription: 'Estás dentro de un cubículo: mesa triangular, silla azul y vista hacia la sala con estantes.',
  initialView: { yaw: 0.4, pitch: -0.05, fov: 1.4 },
  links: [{ label: 'Salir del cubículo', to: 88, yaw: -1.2 }]
}, [
  nav('89-salir', 'Salir a la fila de cubículos', 'Salir', 88, -1.4, -0.05),
  nav('89-sala', 'Mirar sala de lectura', 'Sala', 90, 0.5, -0.05),
  info('89-mesa', 'Puesto de estudio', 0.2, -0.25, 'Mesa individual dentro del cubículo, con iluminación puntual.', '💡')
]);

scene(90, {
  id: 'biblioteca-mesas-curvas',
  title: 'Biblioteca — Mesas curvas y PCs',
  shortTitle: 'Mesas curvas',
  altText: 'Mesas curvas de estudio con vista a PCs y mezanine.',
  longDescription: 'Área abierta de mesas curvas; al fondo computadores y letrero; mezanine arriba.',
  links: [{ label: 'Hacia hub de mesas', to: 92, yaw: 0.3 }]
}, [
  nav('90-hub', 'Hub de mesas y salones', 'Hub', 92, 0.45, -0.05),
  nav('90-cubiculos', 'Volver a cubículos', 'Cubículos', 87, -1.6, -0.05),
  nav('90-pcs', 'Zona de PCs', 'PCs', 85, 1.5, -0.05),
  info('90-mesas', 'Mesas colaborativas', -0.2, -0.15, 'Mesas curvas con sillas verdes para trabajo en grupo.', '🪑')
]);

scene(91, {
  id: 'biblioteca-lectura-escalera',
  title: 'Biblioteca — Lectura y acceso a escalera',
  shortTitle: 'Lectura / escalera',
  altText: 'Mesas, estantería, computadores y escalera a la mezanine.',
  longDescription: 'Nodo entre zona de lectura, PCs y la escalera hacia el nivel superior.',
  links: [{ label: 'Hacia escaleras', to: 100, yaw: 1.2 }]
}, [
  nav('91-escaleras', 'Escaleras a mezanine', 'Subir', 100, 1.35, 0.05),
  nav('91-general', 'Colección GENERAL', 'GENERAL', 93, -0.4, -0.05),
  nav('91-atras', 'Volver mesas', 'Atrás', 90, 3.0, -0.05),
  info('91-catalogo', 'Punto de consulta', 1.7, -0.05, 'Consola/kiosco de apoyo cerca de la circulación vertical.', '🖥')
]);

scene(92, {
  id: 'biblioteca-hub-salones',
  title: 'Biblioteca — Hub mesas y salones de vidrio',
  shortTitle: 'Hub salones',
  altText: 'Mesas curvas frente a salones de estudio con paredes de vidrio.',
  longDescription: 'Centro de la planta baja: mesas alrededor y salones acristalados al medio.',
  links: [{ label: 'Colección GENERAL', to: 93, yaw: 0.2 }]
}, [
  nav('92-general', 'Colección GENERAL', 'GENERAL', 93, 0.25, -0.05),
  nav('92-salones', 'Salones de proyecto', 'Salones', 97, 1.0, -0.05),
  nav('92-atras', 'Volver mesas curvas', 'Atrás', 90, 3.05, -0.05),
  info('92-vidrio', 'Salones de estudio', 0.6, -0.05, 'Salas cerradas con vidrio para trabajo en grupo o tutorías.', '🚪')
]);

scene(93, {
  id: 'biblioteca-general',
  title: 'Biblioteca — Colección GENERAL',
  shortTitle: 'GENERAL',
  altText: 'Estantería GENERAL, salones de vidrio y mesas de estudio.',
  longDescription: 'Frente a la colección GENERAL; salones literarios a un lado y mesas abiertas al otro.',
  links: [{ label: 'Pasillo de estantería', to: 94, yaw: 0.1 }]
}, [
  nav('93-estantes', 'Pasillo entre estantes', 'Estantes', 94, 0.15, -0.05),
  nav('93-salones', 'Salones de proyecto', 'Salones', 98, 1.2, -0.05),
  nav('93-hub', 'Volver al hub', 'Hub', 92, 3.0, -0.05),
  info('93-general', 'Sección GENERAL', 0.05, 0.2, 'Estantería señalizada como colección GENERAL.', '📖'),
  info('93-marquez', 'Salón con referencia literaria', 1.4, 0.05, 'Salón de vidrio con gráficos y referencias literarias.', '🖼')
]);

scene(94, {
  id: 'biblioteca-pasillo-estantes',
  title: 'Biblioteca — Pasillo de estantería',
  shortTitle: 'Pasillo estantes',
  altText: 'Pasillo entre estantería blanca alta y mesas verdes.',
  longDescription: 'Aisle de estantería de planta baja; conexión hacia mesas de estudio entre libros.',
  links: [{ label: 'Mesa entre estantes', to: 95, yaw: 0.3 }]
}, [
  nav('94-mesa', 'Mesa de estudio entre estantes', 'Mesa', 95, 0.4, -0.05),
  nav('94-atras', 'Volver a GENERAL', 'GENERAL', 93, 3.05, -0.05),
  nav('94-salones', 'Hacia salones', 'Salones', 96, 1.5, -0.05),
  info('94-coleccion', 'Colección en estantería', -0.8, -0.1, 'Estantería de consulta abierta en planta baja.', '📚')
]);

scene(95, {
  id: 'biblioteca-mesa-estantes',
  title: 'Biblioteca — Mesa entre estantes',
  shortTitle: 'Mesa / estantes',
  altText: 'Mesa curva con tomacorrientes rodeada de estantería.',
  longDescription: 'Puesto de estudio embebido entre estantes, con tomas eléctricas en la mesa.',
  links: [{ label: 'Mesas en U', to: 96, yaw: 0.5 }]
}, [
  nav('95-u', 'Mesas en U y salones', 'Mesas U', 96, 0.6, -0.05),
  nav('95-atras', 'Volver pasillo', 'Atrás', 94, 3.0, -0.05),
  info('95-tomas', 'Mesa con energía', 0.1, -0.3, 'Mesa de estudio con módulos de tomacorrientes para portátiles.', '🔌')
]);

scene(96, {
  id: 'biblioteca-mesas-u',
  title: 'Biblioteca — Mesas en U y salones',
  shortTitle: 'Mesas en U',
  altText: 'Mesa en U frente a salones de vidrio y murales.',
  longDescription: 'Área de mesas en U mirando a salones acristalados y murales laterales.',
  links: [{ label: 'Salones y escalera', to: 97, yaw: 0.8 }]
}, [
  nav('96-salones', 'Salones y escalera', 'Salones', 97, 0.9, -0.05),
  nav('96-atras', 'Volver mesa estantes', 'Atrás', 95, 3.05, -0.05),
  info('96-mural', 'Mural artístico', 1.6, 0.1, 'Mural colorido en el perímetro de la zona de salones.', '🎨')
]);

scene(97, {
  id: 'biblioteca-salones-escalera',
  title: 'Biblioteca — Salones de proyecto y escalera',
  shortTitle: 'Salones / escalera',
  altText: 'Salones de vidrio junto a la escalera hacia la mezanine.',
  longDescription: 'Nudo clave: salones de proyecto, mural y escalera al nivel superior.',
  links: [{ label: 'Subir escaleras', to: 100, yaw: 1.1 }]
}, [
  nav('97-subir', 'Subir a mezanine', 'Subir', 100, 1.15, 0.05),
  nav('97-salon2', 'Salones de proyecto 2', 'Salones', 98, -0.3, -0.05),
  nav('97-atras', 'Volver mesas U', 'Atrás', 96, 3.0, -0.05),
  info('97-escalera', 'Circulación vertical', 1.2, 0.15, 'Escalera con baranda de vidrio/metal hacia la mezanine.', '🔼')
]);

scene(98, {
  id: 'biblioteca-salones-2',
  title: 'Biblioteca — Salones de proyecto 2',
  shortTitle: 'Salones 2',
  altText: 'Dos salones de vidrio con citas literarias y mesas laterales.',
  longDescription: 'Frente a salones acristalados con tipografía literaria; mesas abiertas a ambos lados.',
  links: [{ label: 'Salones Allende', to: 99, yaw: 0.2 }]
}, [
  nav('98-allende', 'Salones Allende / Eva Luna', 'Allende', 99, 0.25, -0.05),
  nav('98-escalera', 'Hacia escaleras', 'Escaleras', 100, 1.4, -0.05),
  nav('98-atras', 'Volver', 'Atrás', 97, 3.0, -0.05),
  info('98-citas', 'Salón con citas literarias', 0.05, 0.05, 'Salas decoradas con citas literarias para ambientar el estudio.', '✍️')
]);

scene(99, {
  id: 'biblioteca-salones-allende',
  title: 'Biblioteca — Salones Allende / Eva Luna',
  shortTitle: 'Allende / Eva Luna',
  altText: 'Salones temáticos Isabel Allende y Eva Luna con mesas electrificadas.',
  longDescription: 'Cubículos/salones temáticos literarios; mesas con tomas a izquierda y derecha.',
  links: [{ label: 'Hacia escaleras', to: 100, yaw: 1.5 }]
}, [
  nav('99-escaleras', 'Escaleras a mezanine', 'Subir', 100, 1.55, 0.05),
  nav('99-atras', 'Volver salones 2', 'Atrás', 98, 3.05, -0.05),
  info('99-allende', 'Salón Isabel Allende', 0.1, 0.05, 'Salón con retrato y referencia a Isabel Allende.', '📘'),
  info('99-evaluna', 'Salón Eva Luna', -0.55, 0.05, 'Salón temático Eva Luna, con decoración floral y cita.', '📕')
]);

scene(100, {
  id: 'biblioteca-escaleras-p1',
  title: 'Biblioteca — Escaleras a mezanine',
  shortTitle: 'Escaleras',
  altText: 'Escalera central con mural de paisaje y acceso a mezanine.',
  longDescription: 'Pie de escalera: mural de río/montaña a la derecha, zona de estudio a la izquierda, subida al centro.',
  initialView: { yaw: 0.35, pitch: 0.05, fov: 1.3 },
  links: [{ label: 'Subir al descanso', to: 101, yaw: 0.4 }]
}, [
  nav('100-subir', 'Subir al descanso de escaleras', 'Subir', 101, 0.45, 0.12),
  nav('100-estudio', 'Zona de estudio planta baja', 'Estudio', 91, -1.5, -0.05),
  nav('100-salones', 'Volver a salones', 'Salones', 97, 3.0, -0.05),
  info('100-mural', 'Mural de paisaje', 1.3, 0.1, 'Mural de montaña, río y vegetación junto a la escalera.', '🏔'),
  info('100-revistas', 'Expositor de publicaciones', -0.35, -0.15, 'Expositor/rack de revistas o novedades al pie de la escalera.', '📰')
]);

scene(115, {
  id: 'biblioteca-lobby-letrero',
  title: 'Biblioteca — Computadores y letrero principal',
  shortTitle: 'Letrero / PCs',
  altText: 'Vista al letrero principal y estaciones de cómputo del lobby.',
  longDescription: 'Otra toma del lobby centrada en el letrero y las estaciones de cómputo.',
  links: [{ label: 'Volver lobby ingreso', to: 83, yaw: -0.5 }]
}, [
  nav('115-lobby', 'Volver al lobby de ingreso', 'Lobby', 83, -0.6, -0.05),
  nav('115-mesas', 'Hacia mesas de estudio', 'Mesas', 86, -1.4, -0.05),
  nav('115-mezanine', 'Mirar mezanine / escalera', 'Mezanine', 100, 1.8, 0.1),
  info('115-nombre', 'BIBLIOTECA ANITA BOLÍVAR DE CONSUEGRA', 0.2, 0.2, 'Letrero principal de la biblioteca sobre la zona de computadores.', '🏷')
]);

scene(101, {
  id: 'biblioteca-descanso-escaleras',
  title: 'Biblioteca mezanine — Descanso de escaleras',
  shortTitle: 'Descanso',
  altText: 'Descanso intermedio: se puede bajar a planta baja o subir a mezanine.',
  longDescription: 'Punto de transición vertical con mural de montaña; abajo el lobby, arriba pods y estantería.',
  links: [{ label: 'Subir a mezanine', to: 103, yaw: 0.6 }]
}, [
  nav('101-subir', 'Subir a lounge / pods', 'Subir', 103, 0.7, 0.1),
  nav('101-bajar', 'Bajar a planta baja', 'Bajar', 100, -0.9, -0.2),
  nav('101-alt', 'Otro ángulo del descanso', 'Ángulo', 102, 0.2, 0.05),
  info('101-mural', 'Mural de montaña', -1.2, 0.05, 'Mural de páramo/montaña nevada en el descanso de escaleras.', '🏔')
]);

scene(102, {
  id: 'biblioteca-descanso-b',
  title: 'Biblioteca mezanine — Descanso (ángulo cercano)',
  shortTitle: 'Descanso B',
  altText: 'Segundo ángulo del descanso de escaleras.',
  longDescription: 'Misma circulación vertical desde un punto muy cercano; refuerza la sensación de avance continuo.',
  links: [{ label: 'A lounge', to: 103, yaw: 0.5 }]
}, [
  nav('102-subir', 'Entrar a mezanine', 'Mezanine', 103, 0.55, 0.08),
  nav('102-bajar', 'Bajar', 'Bajar', 100, -1.0, -0.2),
  nav('102-atras', 'Ángulo anterior', 'Atrás', 101, 3.0, -0.05)
]);

scene(103, {
  id: 'biblioteca-mezanine-lounge',
  title: 'Biblioteca mezanine — Lounge y pods',
  shortTitle: 'Lounge',
  altText: 'Lounge con sofás verdes, pods individuales y pasillo de estantería.',
  longDescription: 'Llegada a mezanine: lounge, pods acústicos y aisle de estantería verde a la derecha.',
  links: [{ label: 'Pasillo GENERAL', to: 104, yaw: 1.0 }]
}, [
  nav('103-estantes', 'Pasillo estantería GENERAL', 'GENERAL', 104, 1.1, -0.05),
  nav('103-grupo', 'Zona trabajo en grupo', 'Grupo', 107, 0.2, -0.05),
  nav('103-bajar', 'Bajar por escaleras', 'Bajar', 101, -1.5, -0.15),
  info('103-pods', 'Pods individuales', 0.35, -0.05, 'Cabinas altas verdes para estudio individual en mezanine.', '🎧')
]);

scene(104, {
  id: 'biblioteca-mezanine-general',
  title: 'Biblioteca mezanine — Estantería GENERAL',
  shortTitle: 'Estantes GENERAL',
  altText: 'Pasillo denso de estantería verde con letrero GENERAL.',
  longDescription: 'Entre estantes de la mezanine; se observan textos académicos.',
  links: [{ label: 'Siguiente aisle', to: 105, yaw: 0.1 }]
}, [
  nav('104-adelante', 'Continuar por el aisle', 'Adelante', 105, 0.05, -0.05),
  nav('104-lounge', 'Volver al lounge', 'Lounge', 103, 3.05, -0.05),
  info('104-general', 'Sección GENERAL (mezanine)', 0.3, 0.25, 'Letrero GENERAL sobre la colección del nivel superior.', '📖')
]);

scene(105, {
  id: 'biblioteca-mezanine-aisle-2',
  title: 'Biblioteca mezanine — Pasillo de estantes 2',
  shortTitle: 'Aisle 2',
  altText: 'Aisle estrecho entre estantería verde; mesas al fondo.',
  longDescription: 'Segundo tramo del aisle; al fondo se abre a zona de mesas.',
  links: [{ label: 'Hacia estudio', to: 106, yaw: 0.4 }]
}, [
  nav('105-estudio', 'Salir a zona de estudio', 'Estudio', 106, 0.5, -0.05),
  nav('105-atras', 'Aisle anterior', 'Atrás', 104, 3.05, -0.05),
  info('105-seccion', 'Sección de estantería', -0.3, -0.05, 'Etiquetas de sección en el borde de los estantes.', '🏷')
]);

scene(106, {
  id: 'biblioteca-mezanine-estantes-estudio',
  title: 'Biblioteca mezanine — Estantes y estudio',
  shortTitle: 'Estantes / estudio',
  altText: 'Boca del aisle con mesas de estudio y pods al fondo.',
  longDescription: 'Transición entre colección y zona de mesas/pods en mezanine.',
  links: [{ label: 'Trabajo en grupo', to: 107, yaw: -0.5 }]
}, [
  nav('106-grupo', 'Zona de trabajo en grupo', 'Grupo', 107, -0.55, -0.05),
  nav('106-aisle', 'Volver al aisle', 'Aisle', 105, 1.4, -0.05),
  info('106-economia', 'Colección temática', 0.8, -0.05, 'Estantes temáticos del nivel superior.', '📗')
]);

scene(107, {
  id: 'biblioteca-mezanine-grupo-a',
  title: 'Biblioteca mezanine — Trabajo en grupo A',
  shortTitle: 'Grupo A',
  altText: 'Pasillo con pods, mesas redondas y taburetes de colores.',
  longDescription: 'Zona colaborativa: pods a un lado, mesas circulares al centro, estantería y escalera al fondo.',
  links: [{ label: 'Grupo B', to: 108, yaw: 0.2 }]
}, [
  nav('107-b', 'Continuar zona grupo B', 'Grupo B', 108, 0.25, -0.05),
  nav('107-escalera', 'Hacia escalera', 'Escalera', 101, 1.6, -0.05),
  nav('107-atras', 'Volver estantes', 'Atrás', 106, 3.0, -0.05),
  info('107-mesas', 'Mesas colaborativas', 0.1, -0.2, 'Mesas redondas con taburetes naranja/verde para trabajo ágil.', '🟠')
]);

scene(108, {
  id: 'biblioteca-mezanine-grupo-b',
  title: 'Biblioteca mezanine — Trabajo en grupo B',
  shortTitle: 'Grupo B',
  altText: 'Mezanine abierta con booths verdes y vista al piso inferior.',
  longDescription: 'Planta abierta de mezanine: booths, mesas circulares y barandal hacia abajo.',
  links: [{ label: 'Cubículos amoblados', to: 109, yaw: -0.3 }]
}, [
  nav('108-cubiculos', 'Cubículos amoblados', 'Cubículos', 109, -0.35, -0.05),
  nav('108-hemeroteca', 'Hacia HEMEROTECA', 'Hemeroteca', 110, 0.9, -0.05),
  nav('108-atras', 'Grupo A', 'Atrás', 107, 3.05, -0.05),
  info('108-vista', 'Vista a planta baja', -1.2, -0.2, 'Barandal de mezanine con vista al lobby y mesas del nivel inferior.', '👁')
]);

scene(109, {
  id: 'biblioteca-mezanine-cubiculos',
  title: 'Biblioteca mezanine — Cubículos amoblados',
  shortTitle: 'Cubículos P2',
  altText: 'Pods verdes y mesas redondas junto a estantería.',
  longDescription: 'Detalle de cubículos/pods amoblados del nivel superior.',
  links: [{ label: 'Hemeroteca', to: 110, yaw: 0.6 }]
}, [
  nav('109-hemeroteca', 'Señal HEMEROTECA', 'Hemeroteca', 110, 0.7, -0.05),
  nav('109-atras', 'Volver grupo B', 'Atrás', 108, 3.0, -0.05),
  info('109-pod', 'Pod de estudio', -0.8, -0.05, 'Cubículo acolchado verde para concentración en mezanine.', '🪑')
]);

scene(110, {
  id: 'biblioteca-hemeroteca',
  title: 'Biblioteca mezanine — HEMEROTECA',
  shortTitle: 'Hemeroteca',
  altText: 'Pasillo con señal colgante HEMEROTECA y mesas de trabajo.',
  longDescription: 'Acceso señalado a hemeroteca; mesas y barandal hacia el vacío central.',
  links: [{ label: 'Balcón vista piso 1', to: 111, yaw: 0.3 }]
}, [
  nav('110-balcon', 'Balcón con vista a piso 1', 'Balcón', 111, 0.35, -0.05),
  nav('110-atras', 'Volver cubículos', 'Atrás', 109, 3.05, -0.05),
  info('110-senal', 'Hemeroteca', 0.15, 0.35, 'Señalización HEMEROTECA: periódicos, revistas y publicaciones periódicas.', '📰')
]);

scene(111, {
  id: 'biblioteca-balcon-1',
  title: 'Biblioteca mezanine — Balcón vista a piso 1',
  shortTitle: 'Balcón',
  altText: 'Mesas en balcón con vista al lobby y mural del piso inferior.',
  longDescription: 'Balcón de mezanine: mesas, estantería y vista clara al lobby.',
  links: [{ label: 'Otro ángulo del balcón', to: 112, yaw: 0.2 }]
}, [
  nav('111-angulo', 'Continuar por el balcón', 'Seguir', 112, 0.25, -0.05),
  nav('111-psicologia', 'Estantería Psicología', 'Psicología', 113, 1.2, -0.05),
  nav('111-atras', 'Volver hemeroteca', 'Atrás', 110, 3.0, -0.05),
  info('111-abajo', 'Lobby en planta baja', 0.1, -0.45, 'Vista al lobby: mesas, globos de luz y letrero de la biblioteca.', '⬇')
]);

scene(112, {
  id: 'biblioteca-balcon-2',
  title: 'Biblioteca mezanine — Balcón con librería',
  shortTitle: 'Balcón 2',
  altText: 'Segundo ángulo del balcón con mesas y estantería.',
  longDescription: 'Avance continuo sobre el balcón; mantiene la vista al nivel inferior.',
  links: [{ label: 'Psicología', to: 113, yaw: 0.4 }]
}, [
  nav('112-psico', 'Estantería Psicología', 'Psicología', 113, 0.5, -0.05),
  nav('112-atras', 'Ángulo anterior', 'Atrás', 111, 3.05, -0.05),
  nav('112-bajar-vista', 'Enfocar lobby abajo', 'Lobby', 115, 0.1, -0.5)
]);

scene(113, {
  id: 'biblioteca-psicologia',
  title: 'Biblioteca mezanine — Estantería Psicología',
  shortTitle: 'Psicología',
  altText: 'Estantes etiquetados PSICOLOGÍA en mezanine con vista abajo.',
  longDescription: 'Colección de Psicología en mezanine; cierre del recorrido del nivel superior.',
  links: [{ label: 'Volver al lounge', to: 103, yaw: -1.5 }]
}, [
  nav('113-lounge', 'Volver al lounge mezanine', 'Lounge', 103, -1.6, -0.05),
  nav('113-balcon', 'Volver al balcón', 'Balcón', 112, 3.0, -0.05),
  nav('113-bajar', 'Bajar a escaleras', 'Bajar', 101, 1.8, -0.1),
  info('113-psico', 'Colección Psicología', -0.4, -0.05, 'Estantería señalizada PSICOLOGÍA en el nivel superior.', '🧠')
]);

const out = path.join(root, 'media', 'unisimoncucuta', 'experienciavirtual', 'biblioteca-scenes.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(scenes, null, 2), 'utf8');
const missing = Object.keys(scenes).filter((f) =>
  !fs.existsSync(path.join(root, 'media', 'unisimoncucuta', 'experienciavirtual', 'panoramas', f))
);
console.log(`Wrote ${Object.keys(scenes).length} scenes -> ${out}`);
console.log('missing files:', missing);
