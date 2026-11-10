# 47 — Estudio de motores 360 y estrategia competitiva (Orbe Viewer)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-14  
**Tipo:** análisis de arquitectura / competencia (**sin implementación**)  
**Complementa (no sustituye):** [46-gap-editor-tours-inmersivos.md](./46-gap-editor-tours-inmersivos.md)  
**Fuentes código:** `package.json`, `index.html`, `vendors/marzipano.min.js`, `src/viewer.js`, `src/hotspotManager.js`, `src/hotspotIcons.js`, `src/hotspotPanel.js`, `convex/schema.ts`, `scripts/generate-a11y-tts.py`  
**Fuentes externas (licencias):** [Marzipano / Apache-2.0](https://github.com/google/marzipano), [Pannellum / MIT](https://github.com/mpetroff/pannellum), [Photo Sphere Viewer / MIT](https://github.com/mistic100/Photo-Sphere-Viewer), [Three.js / MIT](https://github.com/mrdoob/three.js), [A-Frame / MIT](https://github.com/aframevr/aframe), [Babylon.js / Apache-2.0](https://github.com/BabylonJS/Babylon.js), [krpano comercial](https://krpano.com/buy/).

---

## Veredicto en una frase

**No hay que reescribir Marzipano** para tours avanzados tipo RealVision: hace falta una **capa de producto Orbe Viewer** (modelo de contenido + overlays + editor + platform) encima del core actual; solo evaluar Three.js/A-Frame si paths/world-text pasan a ser must-have de negocio tras spikes P3.

---

## A. ¿Reescribir Marzipano?

### Veredicto corto: **NO** (extender encima; fork/otro motor solo bajo criterio P3)

| Decisión | Motivo técnico |
|----------|----------------|
| **NO** rewrite ahora | Orbe ya tiene grafo multi-escena, hotspots DOM, Control Web, Convex, a11y dual-canal. El gap 46 es de **tipos de contenido / overlays / UX de capas**, no de “falta de motor”. |
| **Parcial** solo si… | Paths proyectados + texto world-space fallan en spikes P3 **y** hay cliente que lo exige como must-have → complementar con overlay WebGL o motor 3D **acotado**, no tirar el stack. |
| **Sí** solo si… | Se pivota a mesh/photogrammetry/WebXR nativo como producto principal (otro mercado; ver §D.3). |

### A.1 Lo que Marzipano YA permite (y Orbe usa)

Estado verificado en código:

| Capacidad | En Marzipano | En Orbe360 hoy |
|-----------|--------------|----------------|
| Equirect (ImageUrlSource + EquirectGeometry) | Sí | Sí — `viewer.js` / Control Web |
| Multi-escena + `switchTo` con transición | Sí | Sí — transición ~110 ms |
| Vista rectilinear + yaw/pitch/fov | Sí | Sí — `initialView` en schema + apply al entrar |
| Hotspots DOM (`hotspotContainer().createHotspot`) | Sí | Sí — solo tipos `nav` \| `info` |
| Stage WebGL | Sí | Sí — `stageType: 'webgl'` |
| Video panorámico (EquirectVideo / video source) | API histórica disponible | **No usado** — escenas son imagen estática |
| Multi-resolution / tiles | Sí | Parcial / deuda infra (docs 13/22); piloto con levels simples |

Carga: `vendors/marzipano.min.js` con fallback CDN jsDelivr (`index.html`, `control-web/index.html`). **No** está en `package.json` como dependencia npm (solo `convex` en runtime).

**Nota de mantenimiento:** el repo oficial `google/marzipano` figura **archivado** (Apache-2.0, uso comercial OK). Eso **no** obliga a migrar mañana: el binario local + API estable cubren el caso Orbe; sí implica **no depender de features nuevas upstream** y tratar Marzipano como *core congelado* bajo capa propia.

### A.2 Lo que se hace **encima** sin tocar el motor

Alineado con gap 46 §4.2 — alto ROI, bajo riesgo:

- CSS animation en pins (`pulse`, reduced-motion)
- Catálogo de iconos SVG (`hotspotIcons.js` hoy: 2 íconos fijos)
- HUD / capas / menús HTML (como `menu.js` / paneles a11y)
- Filtrar hotspots por categoría (`display` / no render)
- Panel multimedia: galería, `<video>`, iframe, PDF en `hotspotPanel` (hoy: texto + audio narración)
- Branding / chrome white-label (`tourBrandings`)
- TTS offline pipeline (`edge-tts` vía `scripts/generate-a11y-tts.py`)

### A.3 Lo que requiere **extensión** (sin fork)

| Necesidad | Enfoque | Riesgo |
|-----------|---------|--------|
| Paths / polylines “en suelo” aproximados | Cada frame: yaw/pitch → screen (`view.coordinatesToScreen` / inverso) → SVG/canvas overlay | FOV extremo / nadir; QA móvil |
| Screenshot “CAPTURA” | Readback canvas WebGL del stage + compose opcional de DOM | DOM overlays pueden faltar en capture |
| Sound zones por proximidad angular | Web Audio / Howler + yaw/pitch/radius en modelo | No confundir con narración a11y |
| Video 360 equirect | Activar source de video Marzipano **o** elemento video + sync | Bandwidth, captions, autoplay policies |
| Shaders / efectos de post | Acceso al stage WebGL (frágil si API interna) | Acoplamiento a internals |

### A.4 Lo que requiere **otro motor o fork**

| Necesidad | Por qué Marzipano no alcanza |
|-----------|------------------------------|
| Texto world-space real (“META” en perspectiva de suelo/fachada) | Hotspots DOM son **billboards**; no deforman con el plano |
| Mesh 3D / photogrammetry (Matterport-like) | Otro pipeline de captura + renderer |
| True AR / GIS / WebXR espacial | Stack A-Frame / Three / Babylon + sensores |
| Geometría densa editable en 3D (polígonos con oclusión real) | Motor 3D con cámara esférica propia |

**Conclusión A:** reescribir = quemar diferencial a11y/grafo/multi-org sin ganar el showreel. Extender = camino correcto.

---

## B. Inventario de multimedia (hoy / corto plazo, sin reescribir viewer)

Modelo actual de hotspot (`convex/schema.ts`): `nav|info` + título + yaw/pitch + description + narración/transcript/caption/timing. Assets: `panorama | thumb | audio | transcript | caption | other` — **sin** `video` / `image_gallery` / `embed` tipados aún.

| Medio | ¿Hoy? | Cómo integrar (corto plazo) | Lib / API concreta | Licencia | Fit Orbe |
|-------|-------|-----------------------------|--------------------|----------|----------|
| Imagen / galería / lightbox | No en panel | Extender panel + `assets.kind` o `media[]` | Nativo HTML + CSS; opcional [PhotoSwipe](https://github.com/dimsemenov/PhotoSwipe) (MIT) / GLightbox | MIT | Alto — no toca Marzipano |
| Video HTML5 (panel o hotspot) | No | `<video controls>` + VTT en panel info | Nativo; Media Session ya parcial (`mediaSession.js`) | — | Alto; checklist a11y captions |
| Video 360 / equirect video | No | Marzipano video source **o** PSV VideoPlugin en spike | Marzipano (Apache-2.0); PSV `@photo-sphere-viewer/video-plugin` (MIT) | Apache / MIT | Medio — piloto aparte de imagen |
| Audio espacial | Narración on-demand solo | Howler / Web Audio + zona angular | [Howler.js](https://howlerjs.com/) (MIT); Web Audio API | MIT / nativo | Medio–alto producto; L esfuerzo UX |
| iframe embeds (YouTube, maps) | No | iframe en panel + CSP allowlist | Nativo; YouTube embed API | Términos de cada proveedor | Alto contenido; riesgo CSP/seguridad |
| PDF / docs | No | `<iframe>` / object o link descarga | Nativo; opcional PDF.js (Apache-2.0) | Apache-2.0 | Medio campus/museo |
| TTS | **Sí** (pipeline) | Ya: `edge-tts` → audio + timing | [edge-tts](https://github.com/rany2/edge-tts) (política MS Edge voices) | Ver nota en manifest | Diferenciador a11y; voices = placeholder institucional |
| Screenshot | No | `canvas.toDataURL` del stage WebGL | Nativo WebGL | — | Marketing; M esfuerzo |
| Icon packs | 2 SVG | Catálogo propio (recomendado) o Lucide subset | SVG inline (como hoy); [Lucide](https://lucide.dev) (ISC) | ISC | Preferir catálogo propio white-label |
| HUD / overlays UI | Menú escenas | Capas HTML absolutas sobre `#panorama` | Nativo + CSS Soft Clay / brand | — | P1–P2 gap 46 |

### B.1 Librerías de viewer / ecosistema (fit resumido)

| Lib | Licencia | Rol respecto a Orbe | ¿Integrar ya? |
|-----|----------|---------------------|---------------|
| **Marzipano** | Apache-2.0 | Core actual | Mantener |
| **Pannellum** | MIT | Alternativa ligera; menos “tour OS” | Solo spike comparación |
| **Photo Sphere Viewer (PSV)** | MIT | Plugins (markers, video, virtual tour); comunidad activa | Candidato **migración futura** si Marzipano se vuelve deuda crítica |
| **A-Frame** | MIT | VR / escenas 3D declarativas | Solo si WebXR es producto |
| **Three.js** | MIT | Overlay geometry / world text / paths | Complemento P3, no reemplazo ciego |
| **Babylon.js** | Apache-2.0 | Motor 3D completo + WebXR | Overkill vs Three para Orbe |
| **Panolens.js** | MIT | Wrapper Three para panos | Redundante si ya se elige Three |
| **krpano** | Comercial | Feature-rich, editor maduro | Vendor lock + coste SaaS/hosting |
| **Matterport / Cupix-like** | SaaS propietario | Mesh scan + hosting | **No competir**; otro vertical |
| **Tour.js / similares** | Varía | Demos marketing | Evaluar caso a caso; no base SaaS |

---

## C. Estudio comparativo de motores

Leyenda esfuerzo migración desde Orbe: **Bajo** (API similar) · **Medio** · **Alto** · **Muy alto** (reescribir viewer + a11y + Control Web).

| Motor | Licencia | Stack | Hotspots | Video 360 | Overlays / UI custom | Paths / geometry | Editor propio | a11y | White-label / SaaS fit | Vendor lock | Migración desde Orbe |
|-------|----------|-------|----------|-----------|----------------------|------------------|---------------|------|------------------------|-------------|----------------------|
| **Marzipano** (base) | Apache-2.0 | JS + WebGL, sin framework | DOM billboard yaw/pitch | Sí (API; Orbe no usa) | Excelente (HTML encima) | No nativo | No (Orbe = Control Web) | Lo aporta Orbe | Excelente (OSS + self-host) | Bajo (repo archivado = riesgo mantenimiento, no legal) | — (ya estamos) |
| **Pannellum** | MIT | WebGL/CSS3D, liviano | Hotspots JSON nativos | Sí | Buena | Limitada | No | Básica; Orbe reharía capa | Bueno | Bajo | Medio (rehacer viewer.js + editing) |
| **Photo Sphere Viewer** | MIT | Three.js bajo el capó + plugins | Markers DOM/3D vía plugins | Plugin video | Muy buena + ecosistema plugins | Mejor vía Three | No oficial completo | Mejorable; hay APIs | Muy bueno OSS | Bajo–medio | Medio–Alto (ganar plugins; revalidar a11y) |
| **A-Frame / Three.js** | MIT | WebGL / WebXR | Entidades 3D + HTML | Sí (esfera + video texture) | Total control | **Sí** (paths, texto, mesh) | Hay que construir | Costoso (todo custom) | Bueno si se encapsula | Bajo OSS | **Muy alto** si se reemplaza todo |
| **krpano** | Comercial | Propietario + XML/JS | Maduros | Sí | Potente pero licencia | Sí (más “pro”) | Herramientas propias | Depende implementación | **Malo** para multi-tenant sin hosting license | **Alto** | Alto + coste |
| **Babylon.js** | Apache-2.0 | Motor 3D completo | Custom | Sí | Total | Sí | Custom | Custom | Bueno | Bajo | Muy alto |
| **Panolens** | MIT | Three wrapper | Hotspots Three | Limitado | Media | Parcial | No | Débil | Medio | Bajo | Alto |
| **WebXR (vía A-Frame/Three)** | — | Browser XR | Spatial | Sí | App XR | Sí | Custom | Distinto paradigma | Nicho VR | Bajo | Solo capa opcional |

### C.1 Lectura competitiva (no solo técnica)

- **RealVision-like / showreel:** gana en overlays proyectados y densidad visual; no demuestra (ni necesita) multi-org + publish a11y.
- **krpano shops:** venden tool + licencia; Orbe vende **plataforma operable**.
- **Matterport/Cupix:** capturan realidad en mesh; precio y ops distintos — **fuera del tablero** P0–P2 (coherente con gap 46 §7).

---

## D. Estrategia competitiva Orbe360 — “nuestro motor” = **Orbe Viewer** sobre Marzipano

No fork ciego de Marzipano. Producto = **capas propias** con contrato estable; Marzipano es un *adapter* sustituible.

### D.1 Capas propuestas

```text
┌─────────────────────────────────────────────────────────┐
│ 5. Platform                                             │
│    Convex · authz · multi-org · publish · branding      │
├─────────────────────────────────────────────────────────┤
│ 4. Editor (Control Web)                                 │
│    Colocar/editar hotspots · grafo · capas · media      │
├─────────────────────────────────────────────────────────┤
│ 3. Overlay engine                                       │
│    HUD · layers · CSS pins · SVG paths · screenshot     │
├─────────────────────────────────────────────────────────┤
│ 2. Content model                                        │
│    Tour graph · hotspot types · media[] · layers[]      │
├─────────────────────────────────────────────────────────┤
│ 1. Core adapter (hoy: Marzipano)                        │
│    Equirect · view · scene switch · hotspot anchors     │
└─────────────────────────────────────────────────────────┘
```

**Regla de oro:** el content model y el editor **no** hablan APIs Marzipano; hablan yaw/pitch, sceneId, media refs. El adapter traduce. Así P3 puede swapear core sin reescribir Convex.

### D.2 Roadmap por fases (alineado a gap 46; este doc = arquitectura)

| Fase | Qué | ¿Toca motor? | Salida |
|------|-----|--------------|--------|
| **P0** | Estabilidad editor/visor, límites documentados, reduced-motion | No | Demos campus creíbles |
| **P1** | `category` / `iconKey` / `animationPreset` / color; catálogo SVG; opcional imagen en panel | No | Escena densa tipada “pro” |
| **P2** | `layers[]` + HUD toggle + sync listas a11y | No | Experiencia por tema (evento/campus) |
| **P2.5** (multimedia) | video/iframe/galería en panel; CSP; captions; screenshot | No / readback ligero | Contenido rico sin proyección |
| **P3** | Spike polyline SVG; spike bake equirect; decidir | Extensión overlay | Path demo **o** “no soporte” documentado |
| **P3+** | Solo si P3 falla calidad comercial **y** hay must-have | Evaluar Three overlay o PSV | Criterio §D.4 |
| **P4** | Guided routes, sound zones, plantillas vertical | Capas 2–4 | “Manager de tours inmersivos inclusivos” |

### D.3 Qué NO competir vs qué SÍ

| NO competir | SÍ competir / construir |
|-------------|-------------------------|
| Matterport mesh scan / dollhouse | Editor operable + grafo publicado |
| RealVision showreel GIS / texto suelo pixel-perfect | a11y dual-canal + TTS + checklists publish |
| Feature parity krpano comercial | Multi-org / white-label / branding por tour |
| AR true / GPS mesh campus | Capas multimedia ricas en panel + HUD categorías |
| Rewrite “porque el demo se ve más wow” | Orbe Viewer como marca de capa (pins, layers, media) |

### D.4 Criterio de decisión: cuándo abandonar o complementar Marzipano

**Mantener Marzipano** mientras:

1. Equirect + multi-escena + DOM hotspots cubren el 90 % de tours campus/museo/evento “POI”.
2. Paths/world-text no son cláusula contractual.
3. El binario local + tests Playwright siguen verdes sin APIs rotas.

**Complementar** (overlay Three/canvas **sin** tirar Marzipano) cuando:

1. Spike P3 SVG demuestra límites FOV inaceptables para un cliente pagador.
2. Se necesita texto perspectiva en **una** vertical (evento deportivo) y bake offline no escala.

**Migrar core** (PSV o Three como adapter primario) cuando **≥2** de:

1. Bug/security sin parche upstream (repo archivado) que no se pueda wrappear.
2. Video 360 + markers 3D son roadmap comprometido y Marzipano cuesta más que rehacer el adapter.
3. Equipo ya domina Three y el coste de mantener dos stacks supera el de uno solo.

**Abandonar por completo** solo si el producto pivota a mesh/WebXR como oferta principal (nuevo PRD).

---

## E. Veredicto final (5 bullets)

1. **¿Reescribir Marzipano?** → **NO.** El gap es contenido/overlays/editor, no el renderer equirect.
2. **Qué construir:** capa **Orbe Viewer** (content model → overlay engine → editor → platform) con Marzipano como adapter congelado/sustituible.
3. **Multimedia ya alcanzable sin motor nuevo:** galería, video HTML5, iframe, PDF, screenshot, Howler/Web Audio, TTS (ya con edge-tts); video 360 como slice aparte.
4. **Competir en:** editor + a11y + multi-org + capas/HUD + media rica — **no** en mesh Matterport ni showreel GIS.
5. **Three.js/PSV:** solo tras spikes P3 fallidos **y** must-have de negocio; hasta entonces P0→P2 del gap 46 es el camino de mayor ROI.

---

## Referencias internas

- Gap visual/producto: [46-gap-editor-tours-inmersivos.md](./46-gap-editor-tours-inmersivos.md)  
- Estado consolidado: [22-estado-producto-consolidado.md](./22-estado-producto-consolidado.md)  
- A11y backlog: [14-backlog-accesibilidad-tours.md](./14-backlog-accesibilidad-tours.md)  
- TTS: [19-tts-accesibilidad.md](./19-tts-accesibilidad.md)  
- Arquitectura: [../arquitectura/00-overview.md](../arquitectura/00-overview.md)  
- Control Web: [../CONTROL-WEB.md](../CONTROL-WEB.md)
