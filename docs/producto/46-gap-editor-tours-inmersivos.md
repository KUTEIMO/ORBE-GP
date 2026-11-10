# 46 — Gap: editor/visor Orbe360 vs tours inmersivos profesionales

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-14  
**Tipo:** análisis + roadmap (**sin implementación**)  
**Referencia visual:** captura RealVision360 / Maratón Medellín (aéreo 360 con HUD, pins, rutas en suelo, texto perspectiva).  
**Fuentes código:** `convex/schema.ts`, `control-web/admin.js`, `src/hotspotManager.js`, `src/hotspotIcons.js`, `src/viewer.js`, `src/menu.js`, `css/components/hotspots.css`, docs 14 / 22 / 28 / CONTROL-WEB.

---

## Veredicto en una frase

Orbe360 es un **motor operable de grafo 360 + a11y + multi-org** con hotspots DOM `nav|info`; RealVision360 vende una **capa de diseño AR-like** (HUD por categoría, iconografía rica, overlays proyectados en suelo/fachada). El gap no es “falta Marzipano”: es **tipos de contenido, overlays y UX de capas** que el schema y el editor aún no modelan.

---

## 1. Qué muestra la referencia (inventario de features)

Inventario leído de la captura RealVision360 / Maratón Medellín:

| # | Feature visible | Descripción breve |
|---|-----------------|-------------------|
| 1 | Panorama aéreo equirect | Foto 360 de alta resolución (ciudad + montañas) |
| 2 | Título / marca del evento | “MARATÓN MEDELLÍN” centrado overlay |
| 3 | Chrome de sitio | Logo REALVISION360 + nav web (fuera del tour) |
| 4 | HUD lateral por categorías | Menú semitransparente izquierdo con iconos AÉREAS / MENU |
| 5 | Botones de acción tipados | INFO CARRERA · PUNTOS DE ENCUENTRO · TRANSPORTE Y VÍAS (color + icono custom) |
| 6 | Pins flotantes | Círculos naranja con icono de ubicación |
| 7 | Etiquetas flotantes tipadas | Chips color (“BAÑOS”, “GUARDARROPA”, “EXPO”) |
| 8 | Iconos specialty | Cruz médica / primeros auxilios |
| 9 | Hotspots de cambio de vista | Drones en el cielo → otras aéreas 360 |
| 10 | Texto proyectado en suelo | “META”, “PARQUE PIES DESCALZOS” siguiendo perspectiva del piso |
| 11 | Texto perspectiva en fachada | “EDIFICIO EPM” vertical alineado al edificio |
| 12 | Polylines de ruta | Trazos semitransparentes en calles (“CORRAL 10K #1”) |
| 13 | Captura de pantalla | Botón “CAPTURA” |
| 14 | Sensación de capas | Contenido se enciende/apaga por categoría (implícito en HUD) |
| 15 | Densidad de POI | Muchos hotspots tipados en una sola escena aérea |

**Lo que la captura no demuestra (pero el mercado suele pedir):** video/iframe embebido, zonas de sonido espacial, rutas guiadas paso a paso, GIS/AR real, malla fotogramétrica.

---

## 2. Qué tiene Orbe360 hoy (honesto)

### 2.1 Visor (Marzipano)

| Capacidad | Estado real |
|-----------|-------------|
| Escenas equirect + cambio con transición corta | **Sí** (`src/viewer.js`) |
| Vista frontal por escena (`initialView` yaw/pitch/fov) | **Sí** (schema + apply al entrar) |
| Hotspots anclados yaw/pitch vía `hotspotContainer().createHotspot` | **Sí** |
| Tipos de hotspot | **Solo `nav` \| `info`** (`schema.ts`) |
| Iconos | **2 SVG fijos** (chevron nav / “i” info) — `hotspotIcons.js` |
| Label siempre visible (chip) | **Sí** — estilo píldora, no pin animado |
| Preview hover en nav | **Sí** (crop CSS equirect, no 2º Marzipano) |
| Panel detalle info + narración/transcript | **Sí** (`hotspotPanel.js`) — texto/audio a11y, no video/iframe |
| Menú de escenas por zona | **Sí** (`menu.js`) — lista de escenas, **no** HUD de categorías de POI |
| Capa a11y (listas destinos/POI, teclado, live regions, TTS paths) | **Sí / fuerte** — diferenciador vs demos marketing |
| Branding por tour | **Sí** (`tourBrandings`) |
| Grafo publicado Convex | **Sí** |
| Animación de pins / pulse | **No** (solo hover/active CSS) |
| Capas on/off por categoría | **No** |
| Paths / polylines / texto world-space | **No** |
| Screenshot “CAPTURA” | **No** |
| Sound zones espaciales | **No** (audio es narración escena/hotspot, no zona por yaw) |
| Rutas guiadas (scripted tour) | **No** (solo grafo nav + orden de escenas) |

### 2.2 Control Web (editor)

| Capacidad | Estado real |
|-----------|-------------|
| Modos Ver / Editar escenas / Editar hotspots | **Sí** |
| Colocar `nav` / `info` en centro de vista | **Sí** |
| Arrastrar hotspots, listado editable, grafo SVG | **Sí** |
| Sync Convex + export JSON | **Sí** |
| Elegir icono / categoría / color / animación | **No** |
| Dibujar rutas / texto en suelo | **No** |
| Capas / HUD del visitante | **No** |
| Multimedia rica (video, iframe, galería) en POI | **No** |

### 2.3 Modelo de datos (hotspots)

Campos actuales relevantes:

```text
type: "nav" | "info"
title, yaw, pitch, direction?
targetSceneId / targetFileKey (nav)
description, srSummary, narration*, transcript*, caption*, timing*, weight?
```

**Ausente:** `category`, `iconKey`, `style`/`animation`, `media[]`, `geometry` (polyline/polygon), `layerId`, `embedUrl`, `soundRadius`, `routeId`.

### 2.4 Fortalezas vs la referencia

Orbe360 **no** pierde en: multi-org, publish checklist, a11y dual-canal, grafo editable, white-label, authz. La referencia gana en **presentación inmersiva y densidad visual de una escena evento**. Son productos con ejes distintos: Orbe = campus inclusivo operable; RealVision demo = showreel de overlays.

---

## 3. Tabla de gap

Leyenda esfuerzo: **S** ≤ ~1 sprint · **M** 1–2 · **L** 3–5 · **XL** multi-sprint / riesgo motor.

| Feature | Status Orbe360 | Esfuerzo | Depende de |
|---------|----------------|----------|------------|
| Pins animados (pulse/bounce CSS) | Ausente | **S** | CSS + flag opcional en hotspot |
| Presets de animación (idle / attention / medical) | Ausente | **S–M** | Schema `animationPreset` + CSS |
| Sets de iconos custom (baño, metro, pin, cruz…) | Solo 2 iconos | **M** | Catálogo SVG + `iconKey` + UI Control Web |
| Color / variante tipada (BAÑOS azul, etc.) | Accent = brand | **S–M** | `category` o `accentColor` por hotspot |
| HUD lateral por categorías | Menú escenas ≠ HUD | **M** | Modelo `layers`/`categories` + UI overlay |
| Toggle capas (mostrar/ocultar POI) | Ausente | **M** | Mismo modelo capas + filter render |
| Labels flotantes densos (chips tipados) | Chip genérico | **S–M** | Estilos por categoría (tras iconos) |
| Multi-media hotspot (imagen/galería) | Texto + audio | **M** | Assets + panel |
| Video / iframe en panel o hotspot | Ausente | **M–L** | CSP, assets, a11y (captions) |
| Screenshot / CAPTURA | Ausente | **M** | WebGL readback Marzipano + permisos |
| Sound zones (audio por cercanía angular) | Narración on-demand | **L** | Motor audio + `yaw/pitch/radius` + UX mute |
| Guided routes (secuencia narrada) | Grafo nav libre | **L** | `routes[]` + UI guía + a11y |
| Polylines / paths en “suelo” | Ausente | **L–XL** | Geometría + proyección (ver §5) |
| Texto perspectiva / world-space (“META”) | Ausente | **XL** | Paint equirect o motor 3D extra |
| Drone / portal visual a otra aérea | Es `nav` sin skin | **S–M** | Icono + estilo (reusa nav) |
| Capas GIS / AR true / mesh foto | Fuera | **—** | No chase (ver §7) |

### 3.1 Especial foco (pedido)

| Tema | Gap | Nota producto |
|------|-----|---------------|
| **Animated hotspots** | CSS fácil; schema mínimo | Alto ROI, bajo riesgo Marzipano |
| **Custom icon sets** | Catálogo + `iconKey` | Alto ROI; alinea con chips RealVision |
| **HUD / side menus por categoría** | Overlay HTML | No toca motor; requiere taxonomía |
| **Ground paths / polylines** | No nativo Marzipano | Factible aproximado; fiel = caro |
| **Perspective / world-space labels** | No nativo | Sin rewrite / paint: solo fakes frágiles |
| **Layers toggles** | No existe | Pareja natural del HUD |
| **Screenshot capture** | No existe | Útil marketing; no bloquea tour |
| **Multi-media (video/iframe)** | Panel hoy texto/audio | Extiende `info`; cuidar a11y |
| **Sound zones** | Distinto de narración a11y | No confundir con TTS/checklist |
| **Guided routes** | Distinto del grafo | Producto “visita guiada”, no solo links |

---

## 4. Constraints técnicos con Marzipano

### 4.1 Qué es un hotspot Marzipano aquí

```text
DOM element → hotspotContainer.createHotspot(el, { yaw, pitch })
```

- El nodo es **billboard en screen-space**: se posiciona en la esfera, pero el HTML **no se deforma** con el plano del suelo ni con fachadas.
- Escala aproximada con distancia angular; **no** hay transform 3D de perspectiva tipográfica.
- Ideal para: pins, chips, botones, iframes pequeños, CSS animation.

### 4.2 Factible **sin** reescribir el motor

| Técnica | Factible | Cómo |
|---------|----------|------|
| Animación CSS en pins | Sí | `@keyframes` en `.hotspot` |
| Iconos / colores por tipo | Sí | SVG/CSS en el DOM del hotspot |
| HUD / menú categorías | Sí | HTML overlay (como `sceneMenu` / a11y panel) |
| Filtrar hotspots por capa | Sí | No crear / `display:none` + estado UI |
| Panel con video / iframe | Sí | Extender `hotspotPanel` (no el pin) |
| “Path” como cadena de pins | Sí (pobre) | Muchos hotspots alineados |
| Polyline aproximada | Parcial | Proyectar yaw/pitch → screen coords cada frame; dibujar SVG/canvas 2D encima del stage; se rompe en FOV extremo / nadir |
| Screenshot | Parcial–Sí | `stage` WebGL `toDataURL` / compose con DOM overlays (DOM puede faltar en capture) |
| Texto “META” creíble en suelo | No de verdad | Solo bake en equirect o engine 3D |

### 4.3 Equirect paint vs DOM

| Enfoque | Pros | Contras |
|---------|------|---------|
| **DOM hotspots** (actual) | Editor simple, a11y, click, CSS | Sin perspectiva suelo/fachada |
| **Pintar en equirect** (bake) | Texto/rutas “pegados” a la foto | Re-bake al editar; pesado; malo para capas dinámicas |
| **Overlay WebGL / segundo renderer** | Paths + texto perspectiva | Rewrite parcial; dos stacks; QA móvil |
| **Cambiar a Three.js / A-Frame / custom** | Máximo control | **XL**; tirar Marzipano + rehacer a11y |

**Recomendación:** seguir Marzipano + DOM para P0–P2. Paths “de verdad” y texto world-space solo en P3+ con spike explícito (proyección 2D vs bake vs motor nuevo).

### 4.4 A11y (no negociable en Orbe)

Cualquier HUD/capas/animaciones debe:

- Exponer la misma información en **lista semántica** (capa SR ya existente).
- No depender solo del pin visual.
- Video → captions; iframe → título/`title` + alternativa textual.
- Animación → `prefers-reduced-motion`.

La referencia marketing **no** tiene (o no muestra) esta barra; Orbe no debe bajarla para “verse igual”.

---

## 5. Plan de producto por fases

### P0 — Pulir el editor/visor actual (sin features “showreel”)

**Objetivo:** que nav/info + grafo + vista frontal se sientan profesionales y estables.

- Consistencia visual chip nav/info (Control Web ↔ viewer).
- QA colocación / drag / save Convex (sin fantasmas de nav — doc 28).
- Documentar límites Marzipano para stakeholders (este doc).
- Reduced-motion + contraste en hotspots existentes.
- **No** polylines ni texto suelo todavía.

**Salida:** demos campus creíbles; base limpia para P1.

### P1 — Hotspots más ricos: tipos visuales + iconos + animación

**Objetivo:** acercarse a pins/etiquetas RealVision **dentro** del modelo DOM.

1. Extender schema: `category?`, `iconKey?`, `animationPreset?` (`none` \| `pulse` \| …), opcional `accentColor?`.
2. Catálogo de iconos (baño, pin, info, nav, medical, transporte, expo…) — SVG inline, sin librería pesada.
3. Control Web: selector icono + categoría al colocar/editar.
4. CSS presets de animación + respeto `prefers-reduced-motion`.
5. (Opcional slice) `info` con imagen adjunta en panel.

**Salida:** escena densa tipada (baño / guardarropa / medical) sin cambiar motor.

### P2 — Capas + HUD de visitante

**Objetivo:** botones tipo “INFO CARRERA / PUNTOS / TRANSPORTE”.

1. Modelo `tour.layers[]` o categorías globales del tour.
2. HUD lateral (o inferior en móvil) que togglea capas.
3. Filtrar render de hotspots + sincronizar listas a11y.
4. Branding del HUD vía `tourBrandings` (no chrome Orbe).

**Salida:** experiencia “por tema” en una sola escena aérea o campus.

### P3 — Paths y overlays avanzados

**Objetivo:** rutas tipo “CORRAL 10K” y labels grandes — **con spike**.

1. Spike A: polyline por proyección yaw/pitch → SVG overlay (edición: clic secuencial de vértices).
2. Spike B: bake de texto/ruta en equirect (pipeline offline).
3. Elegir uno; documentar límites FOV/móvil.
4. Screenshot compose (pano + overlays visibles).
5. No prometer “META” perfecto hasta validar spike.

**Salida:** 1–2 demos evento con ruta visible; o decisión explícita de no hacerlo en Marzipano.

### P4 — Visión “complete manager”

**Objetivo:** Orbe como gestor completo de experiencias inmersivas (no solo campus).

- Rutas guiadas (playlist de escenas + VO).
- Sound zones.
- Multimedia completa (video/iframe/galería) con checklist a11y.
- Plantillas de tour (evento deportivo, museo, campus, feria).
- Asset pipeline (tiles, CDN) — infraestructura ya en deuda doc 13/22.
- Posible evaluación de motor 3D si P3 no alcanza calidad comercial de paths/texto.

**Salida:** posicionamiento “manager de tours inmersivos inclusivos”, no clon de un showreel.

---

## 6. Qué NO perseguir aún vs alto ROI

### No chase (ahora)

| Idea | Por qué aparcarla |
|------|-------------------|
| AR GIS con GPS / true north mesh | Otro producto; schema y captura distintos |
| Fotogrametría / mesh 3D del campus | Coste captura + viewer; Marzipano no es el stack |
| Rewrite completo a Three.js “porque RealVision” | Quema el diferencial a11y/grafo sin ROI inmediato |
| Texto perspectiva pixel-perfect en DOM | Físicamente incompatible con billboards |
| Paridad pixel con RealVision360 | Ellos optimizan showreel; Orbe optimiza operable + inclusivo |

### Alto ROI (cuando digan “go”)

1. **Icon keys + categorías + pulse CSS** — percibido como “pro” en días, no meses.  
2. **HUD / toggles de capas** — desbloquea demos tipo evento sin paths.  
3. **Video/imagen en panel info** — valor contenido sin tocar proyección.  
4. **Screenshot** — utilidad comercial rápida.  
5. Spike corto de **polyline proyectada** solo si hay cliente evento (maratón, feria).

---

## 7. Criterios para “cerrar” el gap visual (honestidad)

Un tour Orbe se verá “más RealVision” cuando:

- [ ] ≥1 catálogo de iconos + categorías en editor y viewer  
- [ ] ≥1 preset de animación con reduced-motion  
- [ ] HUD o filtros de capa usables en móvil  
- [ ] Lista a11y refleja capas activas  
- [ ] (P3) Al menos un path demo **o** decisión documentada de bake/no-soporte  

**No** es criterio de cierre: igualdad con texto “META” en suelo.

---

## 8. Referencias internas

- Estudio motores / estrategia (complemento arquitectura): [47-estudio-motores-360-y-estrategia.md](./47-estudio-motores-360-y-estrategia.md)  
- Control Web: [../CONTROL-WEB.md](../CONTROL-WEB.md)  
- Estado producto: [22-estado-producto-consolidado.md](./22-estado-producto-consolidado.md)  
- Hotspots UX: [28-hotspots-roles-qa-cleanup.md](./28-hotspots-roles-qa-cleanup.md)  
- Vista frontal: [29-analisis-vista-frontal-escena.md](./29-analisis-vista-frontal-escena.md) / [30-vista-frontal-adelante.md](./30-vista-frontal-adelante.md)  
- A11y backlog: [14-backlog-accesibilidad-tours.md](./14-backlog-accesibilidad-tours.md)  
- Arquitectura: [../arquitectura/00-overview.md](../arquitectura/00-overview.md)
