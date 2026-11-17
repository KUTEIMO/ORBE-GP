# 69 — Auditoría y Hoja de Ruta de Accesibilidad y Usabilidad Móvil / Táctil (Visor 360° y Portal Público)

**Fecha:** 2026-11-11  
**Alcance:** Visor público de recorridos virtuales 360° (`index.html`, `src/`, `css/`) y portal público de producto (`plataforma/index.html`, `plataforma/portal.css`, `plataforma/portal-ui.js`).  
**Exclusión explícita de alcance:** Los paneles administrativos autenticados (`plataforma/superadmin.html`, `plataforma/org-admin.html` y el estudio de autoría `control-web/index.html`) están diseñados como estaciones de trabajo de escritorio (*desktop-first*) por la precisión requerida en edición de coordenadas esféricas (`yaw`/`pitch`), carga masiva de activos y gestión tabular.

---

## 1. Contexto y Justificación

El recorrido virtual 360° y la página de aterrizaje (*landing page*) son puntos de entrada de consumo masivo desde teléfonos móviles y pantallas táctiles (estudiantes, aspirantes, visitantes en campus mediante códigos QR y usuarios con necesidades de accesibilidad). Aunque el motor cumple con los criterios de escritorio **WCAG 2.1 AA** (navegación por teclado, `aria-live`, alto contraste, reducción de movimiento, escala tipográfica y audioguía descriptiva en las 89 escenas), el uso real en pantallas pequeñas (`320px`–`430px`) y la interacción puramente táctil presentan brechas específicas que deben quedar documentadas y trazadas para su evolución continua.

---

## 2. Diagnóstico de Componentes en Dispositivos Móviles y Pantallas Táctiles

### 2.1 Visor 360° (`index.html` + `src/` + `css/`)

| Componente del Motor 360° | Estado Actual | Brecha Detectada en Móvil / Táctil | Recomendación Técnica (Hoja de Ruta) |
| :--- | :--- | :--- | :--- |
| **Barra superior (`#titleBar`) y botonera de acciones** | Contiene el botón de menú (`#sceneListToggle`), título de escena y 5 botones de acción (Compartir, Ayuda, Audioguía, Diagnóstico WCAG, Accesibilidad) con área mínima de `44×44 px`. | En pantallas `< 390px`, la coexistencia de 5 botones + botón de menú comprime el título de la escena a pocos caracteres con truncamiento agresivo (`text-overflow: ellipsis`). | Agrupar acciones secundarias (Compartir, Ayuda, Diagnóstico WCAG) en un menú inferior tipo *bottom-sheet* en viewports `<= 480px`, dejando visibles en barra solo Menú de Escenas, Audioguía y Accesibilidad. |
| **Hotspots esféricos de enlace e información (`.hotspot`)** | Píldoras con icono SVG y etiqueta textual visible o desplegable al pasar el cursor (`:hover` / `:focus-visible`). | En pantallas táctiles no existe el estado `:hover` previo al toque. Si dos hotspots están próximos en ángulo (`yaw`/`pitch`), el toque con el pulgar puede activar el adyacente al hacer *pinch-to-zoom* o arrastrar el lienzo. | 1) Aumentar el área táctil transparente (`::after` de `48×48 px`) sin agrandar visualmente la píldora.<br>2) En dispositivos táctiles (`(hover: none) and (pointer: coarse)`), mostrar etiqueta compacta permanente en hotspots de enlace primario o confirmación de primer toque en hotspots de información densa. |
| **Tarjetas de puntos de interés (`.info-hotspot-modal` / popover)** | Tarjeta flotante anclada a las coordenadas 3D del hotspot o centrada según el modo. | Cuando el usuario gira la cámara en móvil con una tarjeta abierta anclada al lienzo 3D, la tarjeta puede salirse parcialmente del borde lateral de una pantalla de `360px`. | En viewports `<= 640px`, renderizar las tarjetas de información de hotspots siempre como *bottom-sheet* fijo en el tercio inferior de la pantalla con botón de reproducción de audio integrado y cierre por gesto de deslizar hacia abajo (*swipe-down*). |
| **Barra inferior de conexiones rápidas (`#quickNav` / carrusel de chips)** | Tira horizontal de píldoras hacia escenas conectadas con flechas laterales (`<` / `>`). | En pantallas pequeñas con barras de navegación gestual de iOS/Android, la barra inferior queda muy cerca del borde inferior del sistema operativo y colisiona verticalmente cuando se abre la barra de reproducción de audioguía. | Incorporar `env(safe-area-inset-bottom)` en el contenedor inferior y apilar dinámicamente `#audioBar` sobre `#quickNav` mediante variables CSS de desplazamiento vertical (`--bottom-stack-offset`). |
| **Menú lateral de escenas (`#sceneList` — 89 escenas en 4 sedes)** | Panel lateral desplegable con buscador, filtro por sedes/bloques y lista vertical. | En móvil ocupa gran parte del ancho de pantalla; al tocar el campo de búsqueda (`<input type="search">`), el teclado virtual de Android/iOS reduce la altura visible a menos de `240px`, dejando visibles solo 2–3 escenas a la vez. | En móvil, fijar las píldoras de filtro de Sede en una fila con desplazamiento horizontal compacto (`overflow-x: auto`) y colapsar automáticamente la cabecera del panel mientras el teclado virtual esté activo (`visualViewport.height`). |
| **Panel de Accesibilidad (`#a11yPanel`) y Modal de Diagnóstico WCAG (`#wcagModal`)** | Diálogos modales con `role="dialog"`, trampa de foco (`focus trap`) y controles de alto contraste, texto grande y reducción de movimiento. | En orientación horizontal móvil (*landscape*, altura `< 420px`), el modal requiere desplazamiento interno extenso. Además, algunos atajos documentados en la ayuda (`W/A/S/D`, flechas, `M`, `H`) son exclusivos de teclado físico. | 1) Adaptar el modal de ayuda contextualmente: detectar `(pointer: coarse)` para priorizar la guía de gestos táctiles (arrastre con 1 dedo, pellizco de zoom con 2 dedos, doble toque) sobre los atajos de teclado.<br>2) Habilitar diseño en 2 columnas compactas cuando el móvil está en modo *landscape*. |
| **Lectores de pantalla móviles (TalkBack en Android / VoiceOver en iOS)** | El lienzo WebGL/Marzipano expone botones semánticos y regiones `aria-live="polite"`. | En exploración táctil directa (*explore by touch*), el usuario que desliza el dedo sobre el `<canvas>` 3D puede perder la referencia espacial de los hotspots que están fuera del campo de visión actual (`FOV`). | Mantener sincronizada una lista plana accesible (exclusiva para lectores de pantalla o visible en el modo "Lista accesible de la escena") que enumere todos los destinos y puntos de información de la escena activa sin depender de que estén dentro del ángulo actual de la cámara 3D. |

---

### 2.2 Portal Público / Landing Page (`plataforma/index.html` + `plataforma/portal.css`)

| Componente de la Landing | Estado Actual | Brecha Detectada en Móvil / Táctil | Recomendación Técnica (Hoja de Ruta) |
| :--- | :--- | :--- | :--- |
| **Cabecera de navegación (`.site-header`)** | Incluye logotipo, enlaces de ancla (`Plataforma`, `Soluciones`, `Accesibilidad`, `Casos`), selector de idioma (`ES/EN`), selector de tema y botón `Acceder`. | En pantallas `< 768px` los enlaces de navegación central se ocultan o comprimen para evitar desbordamiento horizontal, dejando al usuario móvil sin acceso directo rápido a las secciones sin hacer *scroll* manual. | Incorporar un botón de menú móvil (*drawer* accesible con `aria-expanded` y cierre con `Escape` o toque exterior) que agrupe los enlaces de sección junto con los controles de idioma y tema. |
| **Visor 360° interactivo incrustado en el Hero (`iframe` de vista previa)** | Ventana de demostración interactiva incrustada junto al titular principal. | En móvil (columna única), al hacer *scroll* vertical con el dedo sobre la página, si el usuario toca dentro del `iframe` del visor 360°, el gesto táctil es capturado por la cámara 3D en lugar de desplazar la página (*scroll trap*). | Añadir en viewports táctiles una capa de protección ligera (*"Toca para interactuar con el visor 360°"* + botón *"Salir del visor para seguir bajando"*) o requerir dos dedos para rotar en la vista incrustada, evitando atrapar el *scroll* vertical de la landing. |
| **Tarjetas de Sedes (Sedes 1 a 4 — Campus Cúcuta) y Bento Grid** | Cuadrícula responsiva con imágenes de portada, estado de disponibilidad y enlace directo al recorrido de cada sede. | En pantallas `< 375px`, las tarjetas con textos largos (especialmente al activar la escala tipográfica de accesibilidad o traducción al inglés) incrementan significativamente la longitud vertical del documento. | Ajustar el `padding` interno con `clamp(1rem, 4vw, 1.75rem)`, usar carrusel horizontal con `scroll-snap-type: x mandatory` para las tarjetas de sedes secundarias en móvil y garantizar objetivos táctiles de `min-height: 48px` en todos los CTA. |
| **Aviso de almacenamiento local (`.storage-notice`)** | Barra flotante inferior con botones `Aceptar`, `Solo esenciales` y enlace a política. | En pantallas móviles pequeñas, la barra flotante inferior ocupa hasta el 22% del alto útil de la ventana inicial antes de ser descartada. | Compactar la tipografía y disponer los botones en una fila de ancho completo (`grid-template-columns: 1fr 1fr`) con margen inferior seguro (`env(safe-area-inset-bottom)`). |

---

## 3. Priorización para Iteraciones Post-Entrega (Backlog Producto v1.1)

1. **Prioridad Alta (P1 — Experiencia Táctil Core):**
   - Protección contra *scroll-trap* en el `iframe` 360° de la landing móvil.
   - Conversión de tarjetas de hotspots informativos (`.info-hotspot-modal`) a *bottom-sheet* fijo en pantallas `<= 640px`.
   - Separación vertical con `env(safe-area-inset-bottom)` entre la barra de audioguía y los chips de navegación rápida.
2. **Prioridad Media (P2 — Ergonomía en Pantallas `< 390px`):**
   - Menú *drawer* hamburguesa en la cabecera de la landing móvil.
   - Agrupación de iconos secundarios del `#titleBar` del visor 360° en pantallas estrechas.
   - Ayuda contextual adaptativa (`pointer: coarse` vs teclado físico).
3. **Prioridad Alta en Accesibilidad Asistiva Móvil (P3 — Verificación en Dispositivo Real):**
   - Conforme a la regla #6 de `AGENTS.md` (*"Do not claim TalkBack/NVDA support without device verification"*), ejecutar protocolo de pruebas físicas con **TalkBack (Android / Chrome)** y **VoiceOver (iOS / Safari)** verificando la lista plana de conexiones de escena fuera del campo visual (`FOV`).

