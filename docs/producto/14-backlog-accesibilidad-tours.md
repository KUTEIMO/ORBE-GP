# 14 — Backlog de remediación de accesibilidad (tours / motor Orbe360)

> Documento de producto. **No es implementación.** Prioriza hallazgos de la auditoría de accesibilidad real, el plan de audio accesible y la arquitectura white-label, **reordenados por la regla de negocio del cliente**.

**Fuentes:** auditoría a11y del visor (`index.html` + `src/*`), plan dual-canal SR/audio, modelo `TourBranding`, `backlog.md` legacy, `tests/keyboard-navigation.spec.ts`, `audit-runner.js`, `convex/schema.ts`.

**Estado del trabajo:** PC local (Windows). Portable a Linux más adelante; **no** incluye hosting/producción en este backlog.

---

## 1. Alcance / regla de negocio

### En alcance profundo (P0–P1 sensorial)

La accesibilidad **profunda** (TalkBack / lectores de pantalla, narraciones de audio reales, navegación no visual del tour, capa semántica equivalente, subtítulos y transcripciones) aplica **solo** a:

| Superficie | Ruta principal | Rol |
|---|---|---|
| Tour público | `index.html` + `src/*` | Experiencia del visitante |
| Motor / visor Orbe360 | Marzipano + menús/paneles del tour | Motor reutilizable white-label |
| Contenido de accesibilidad del tour | `assets/{audio,captions,transcripts}/`, JSON seed, futuro Convex | Narración por tour/cliente |

### Fuera de alcance profundo (admin = básico)

| Superficie | Ruta | Nivel esperado |
|---|---|---|
| Login / plataforma | `plataforma/login.html`, `plataforma/index.html` | Labels, teclado en formularios, foco, semántica básica |
| Superadmin / org-admin | `plataforma/superadmin.html`, `plataforma/org-admin.html` | Idem |
| Control Web | `control-web/index.html`, `control-web/admin.js` | Labels y teclado en formularios/diálogos; **no** authoring TalkBack-first ni colocación no visual de hotspots como P0 |

**Premisa de negocio:** los operadores de admin (día a día) se asumen sin discapacidad sensorial. No priorizar “Control Web operable por autores ciegos” como P0. Eso puede vivir como mejora futura (P2+), no como bloqueo del producto accesible para visitantes.

### Principio de arquitectura (del plan de audio)

No intentar que el panorama 360 “sea” el lector de pantalla.

- **Canal 1 — Lector de pantalla:** mensajes cortos de estado/navegación vía ARIA / live regions.
- **Canal 2 — Audio accesible:** narraciones editoriales (escena/hotspot), con controles del usuario, transcripción y captions.
- **Capa semántica sincronizada:** listas de destinos/POI + panel de detalle, sincronizadas por ID de escena/hotspot con el visor visual.

---

## 2. Criterios de aceptación de producto — tour público verdaderamente accesible

Un tour publicado se considera accesible cuando se cumplen **todos** estos puntos (visitante, no autor):

1. **Recorrido no visual completo:** con TalkBack (Android) o NVDA (desktop), el visitante puede: entrar a una escena, oír/leer un resumen corto, listar destinos y puntos de interés, activarlos, cambiar de escena y cerrar paneles **sin manipular el panorama** (sin drag, sin depender del cue direccional).
2. **Teclado desktop:** orden de foco lógico; menú de escenas, panel de accesibilidad, ayuda, compartir y panel de hotspot abren/cierran con teclado; Escape detiene audio/speech; sin trampas de foco.
3. **Anuncios limpios:** un anuncio corto al entrar a escena; sin duplicados ruidosos; el SR no lee párrafos largos si hay narración de audio disponible.
4. **Audio real:** escenas/hotspots clave del piloto tienen archivo de narración usable (no solo `DEFAULT_AUDIO_DATA_URI` / placeholder); play/pause/stop/volumen funcionan; al cerrar panel o cambiar escena el audio se detiene.
5. **Captions / transcript:** si hay audio, hay transcripción descargable; captions no mienten (o son timed reales, o se presentan como transcript etiquetado).
6. **Modo accesible / preferencias:** panel con nombres accesibles reales; preferencias persistidas; autoplay de narración larga **conservador** cuando hay SR (ideal: off por defecto o detectable).
7. **Fallback sin JS / degradación:** `noscript` y mensajes existentes en `index.html` siguen ofreciendo al menos imagen + texto/transcript de entrada.
8. **Branding vs contenido a11y:** contraste/tema del cliente (`TourBranding`) no rompe legibilidad AA de UI del motor; textos/audio de accesibilidad son **contenido del tour**, no identidad Orbe360.

**No es criterio de aceptación P0:** que un autor ciego coloque yaw/pitch o edite el grafo SVG en Control Web.

---

## 3. Backlog por fases (P0 / P1 / P2)

### Fase A — Contrato y bugs bloqueantes del motor (P0)

| ID | Ítem | Por qué | Archivos |
|---|---|---|---|
| **T-P0-1** | Unificar cierre de capas: Escape/backdrop deben llamar la misma ruta que `closePanel()` (parar audio + `speechSynthesis`) | Hoy `uiLayers.js` solo oculta el DOM; el audio sigue → ruido crítico con SR | `src/uiLayers.js`, `src/hotspotPanel.js`, `src/accessibility.js` |
| **T-P0-2** | Construir **capa semántica de tour** como superficie primaria para SR: lista completa de destinos + POI por escena (no solo `.slice(0, 4)`) | TalkBack no puede depender de geometría/pointer del panorama | `src/main.js`, `index.html` (`#hotspotList`), `src/hotspotManager.js`, `src/navigation.js` |
| **T-P0-3** | Flujo “entrar escena → anuncio corto → explorar listas → activar” sin requerir foco en `#panorama` | `role="application"` + teclas físicas no equivalen a ruta móvil SR | `index.html`, `src/viewer.js`, `src/announcer.js`, `src/keyboardControls.js` |
| **T-P0-4** | Revisar / restringir `role="application"` en `#panorama`; documentar contrato de teclado o degradar a región no-application cuando modo accesible | Riesgo TalkBack (cursor virtual) | `index.html`, `src/accessibility.js` |
| **T-P0-5** | Separar canales: live region = resumen corto; no duplicar `longDescription` vía SR si hay narración | Evitar pelea TalkBack vs app speech | `src/announcer.js`, `src/viewer.js`, `src/hotspotPanel.js` |
| **T-P0-6** | Audios reales del piloto (reemplazar placeholder/`data:audio/wav` en escenas/hotspots clave Biblioteca) + wiring correcto | Sin audio real no hay promesa de producto | `assets/audio/`, `src/configLoader.js`, `config.json` / `biblioteca-scenes.json` |
| **T-P0-7** | Labels accesibles en toggles del panel (`textToSpeechToggle`, `captionAutoToggle`) | Texto visual no está asociado al input | `index.html`, CSS del switch si aplica |
| **T-P0-8** | Criterios de “tour accesible publicado” en metadata (más que booleanos vacíos) — al menos checklist de contenido requerido por escena | `accessibilityProfile` hoy es marketing-metadata | `convex/schema.ts` (campos mínimos), docs de publicación |

**Definition of Done Fase A:** con teclado + NVDA (y al menos una pasada TalkBack en dispositivo) se completa el tour piloto Biblioteca sin arrastrar el panorama; Escape no deja audio fantasma; toggles anuncian nombre.

---

### Fase B — Audio, captions y semántica robusta (P1)

| ID | Ítem | Archivos |
|---|---|---|
| **T-P1-1** | Controles de narración a **nivel escena** (intro), no solo hotspot | `index.html`, `src/hotspotPanel.js` (extraer player compartido) o nuevo `src/narrationPlayer.js` |
| **T-P1-2** | Reglas de interrupción: cambio de escena / abrir hotspot / Pause / SR speaking | `src/narrationPlayer.js` (nuevo), `src/viewer.js`, `src/hotspotPanel.js` |
| **T-P1-3** | Parser VTT real o UI honesta de “transcripción” (dejar de renderizar timestamps como captions) | `src/hotspotPanel.js` (`parseVtt`) |
| **T-P1-4** | `speechSynthesis` solo como fallback documentado; idioma configurable; no primario en producción | `src/hotspotPanel.js` |
| **T-P1-5** | Reducir live regions: quitar `aria-live` global de `#tourApp`; un announcer de escena + uno de estado/acción | `index.html`, `src/announcer.js` |
| **T-P1-6** | Menú de escenas: o lista anidada de botones, o ARIA tree **completo** (hoy `role="tree"` sin flechas) | `src/menu.js`, `index.html` |
| **T-P1-7** | Modelo de contenido a11y en Convex: `srSummary`, scripts, `audioAssetId`, transcript/caption refs (por locale) | `convex/schema.ts`, `convex/graph.ts`, `convex/media.ts`, `src/configLoader.js` |
| **T-P1-8** | Completar cobertura de transcripts/captions para escenas del piloto usadas en demos | `assets/transcripts/`, `assets/captions/` |
| **T-P1-9** | Ampliar Playwright: paneles, foco de retorno, stop audio al Escape, activación de hotspot por lista | `tests/keyboard-navigation.spec.ts` |
| **T-P1-10** | Sustituir `audit-runner.js` “¿existe el campo?” por checks de operabilidad mínima (o axe + escenarios teclado) | `audit-runner.js`, `instrumento_auditoria_v1.json` |

**Definition of Done Fase B:** visitante puede reproducir narración de escena y hotspot con transcript; captions no engañan; anuncios no saturan; menú operable de forma predecible.

---

### Fase C — White-label a11y content + endurecimiento (P2)

| ID | Ítem | Notas |
|---|---|---|
| **T-P2-1** | Empaquetar contenido a11y **por tour** junto a `TourBranding` (no en CSS de plataforma) | Ver §7 |
| **T-P2-2** | Authoring de textos/audio a11y en admin (formularios básicos: title, srSummary, upload audio) — **sin** exigir SR-first en el editor espacial | `plataforma/` o sección en Control Web; prioridad baja vs motor |
| **T-P2-3** | Contraste AA de chrome del viewer bajo temas de cliente | CSS tokens del motor + override branding |
| **T-P2-4** | i18n ES/EN de strings de UI del motor (ARIA y ayudas) | Separado del contenido editorial del tour |
| **T-P2-5** | Analytics anónimas de uso de modo accesible / captions | Del `backlog.md` legacy; no bloquea aceptación |
| **T-P2-6** | Modo recorrido guiado (ruta narrativa ordenada) | Mejora producto; después de capa semántica |
| **T-P2-7** | Object storage / CDN para audio (Linux/hosting) | Solo cuando se copie el proyecto al servidor; Convex = metadata |

---

## 4. Mapa de remediación archivo por archivo (visor / motor)

### Shell y DOM

| Archivo | Problema actual | Acción concreta |
|---|---|---|
| `index.html` | Título/meta aún acoplados a Unisimón/PEVCI; `#tourApp` con `aria-live="polite"` global; `#panorama` `role="application"`; toggles sin nombre; `#hotspotList` como lista corta | Neutralizar copy del motor; live regions dedicadas; asociar labels; preparar slots de branding + región semántica (summary + listas) |
| `css/components/accessibility-controls.css`, `css/menu/accessibility-menu.css`, `css/components/hotspot-panel.css`, `css/components/skip-links.css` | Estilos OK como base; riesgo de contraste con futuros temas cliente | Tokens de chrome del motor; estados focus visibles |
| `demo.html` / `demo-report.html` | Demo/auditoría legacy | No P0; alinear claims con criterios §2 cuando se toquen |

### Runtime JS del motor

| Archivo | Problema actual | Acción concreta |
|---|---|---|
| `src/main.js` | Destinos inline limitados a 4; orquesta init | Lista completa destinos + POI; punto de montaje de capa semántica |
| `src/viewer.js` | Cue direccional oculto en touch; anuncios de escena; avance espacial pointer-driven | Anuncio corto; no bloquear ruta SR; sincronizar escena con listas |
| `src/keyboardControls.js` | Solo yaw/pitch/zoom con teclas en panorama | Mantener para usuarios de teclado visuales; **no** es la ruta TalkBack primaria |
| `src/hotspotManager.js` | Crea botones (bien); acoplado a modo autoNarration | Exponer mismas acciones a lista semántica; no depender solo de markers visuales |
| `src/hotspotPanel.js` | Player + VTT naive + speech fallback; `closePanel` correcto pero no siempre invocado | Extraer player; fix VTT/transcript; API `forceStop()` usada por uiLayers |
| `src/uiLayers.js` | `closeHotspotPanelDom` sin stop audio | Delegar a `closePanel()` / `forceStop()` |
| `src/announcer.js` | API mínima buena | Ampliar a escena vs acción; debounce; no full paragraph |
| `src/accessibility.js` | Preferencias locales; focus trap panel | Labels sync; política autoplay con SR; modo accesible enfoca capa semántica |
| `src/menu.js` | `role="tree"` incompleto | Simplificar a botones o implementar tree real |
| `src/configLoader.js` | Merge multi-fuente; `DEFAULT_AUDIO_DATA_URI`; normaliza narration/transcript/caption | Contrato claro SR vs audio; dejar de fingir audio con data-URI vacío; preparar payload Convex |
| `src/navigation.js`, `src/spatialNav.js` | Grafo espacial para cue/doble-clic | Útil para vista visual; alimentar **también** la lista semántica de destinos con labels humanos |
| `src/fallback.js` | Fallback textual | Mantener alineado a transcripts reales |
| `src/state.js` | Settings | Flags: `autoNarration`, `autoCaptions`, futuro `srConciseMode` |
| `src/hotspotEditing.js` | Edición en viewer | **No P0 a11y profunda**; si se toca, no romper listas semánticas |

### Assets de contenido (piloto)

| Ruta | Estado | Acción |
|---|---|---|
| `assets/audio/` | Solo `placeholder.mp3` en inventario | Grabar/generar narraciones reales por escena/hotspot clave; naming estable |
| `assets/captions/*.vtt` | Hay VTT de biblioteca/entrada/hotspots | Revisar calidad; sincronizar con audio real |
| `assets/transcripts/*.txt` | Misma cobertura parcial | Obligatorios si hay audio (regla de publicación) |
| `config.json`, `biblioteca-scenes.json`, `tour-graph.json` | Seed híbrido | Hasta Convex: campos `srSummary`, `narration`, `transcript`, `captionFile` consistentes |

### Convex (modelo de narración / contenido)

| Archivo | Estado | Acción (P1, no bloquear P0 local) |
|---|---|---|
| `convex/schema.ts` | `scenes`: alt/longDescription; `hotspots`: description; `assets.kind` incluye `audio`; `tours.accessibilityProfile` booleanos | Añadir (fase B): refs audio/transcript/caption; `srSummary` / `srLabel`; opcional tablas `sceneContent` / `hotspotContent` por locale |
| `convex/graph.ts` | Payload público del grafo | Incluir paquete a11y **publicado** por tour |
| `convex/media.ts` | Upload panoramas | Extender patrón a audio (local primero; object storage en Linux) |
| `convex/tourAdmin.ts` | Snapshot espacial | Más adelante: campos de texto a11y en formularios básicos (P2), sin editor SR-first |
| `convex/seed.ts` | Seed Unisimón | Seed de contenidos a11y del piloto |

### Tests / auditoría

| Archivo | Estado | Acción |
|---|---|---|
| `tests/keyboard-navigation.spec.ts` | Solo foco panorama + skip-link | Escenarios §6 |
| `tests/smoke.spec.js` | Smoke general | No sustituye AT |
| `audit-runner.js` | Metadata presence | Operabilidad o deprecar claims |
| `playwright.config.js` | baseURL local | Mantener PC-first; CI Linux después |

---

## 5. Fuera de alcance / menor prioridad — paneles admin

Explicitamente **no** son P0 (aunque la auditoría original los marcara alto):

| Ítem admin | Por qué baja prioridad | Nivel mínimo aceptable |
|---|---|---|
| Control Web: drag de hotspots, grafo SVG pointer-driven (`control-web/admin.js`) | Autores sin discapacidad sensorial | Formularios con `<label>`, botones nombrados, Escape en diálogos, foco al abrir modal |
| `role="listbox"` incompleto en lista de escenas admin | No bloquea visitante | Preferible corregir a lista de botones cuando se toque el archivo (P2 higiene) |
| `role="application"` en visor embebido de Control Web | Solo operadores | P2: alinear con motor o documentar “solo ratón” |
| Authoring TalkBack-first / alternativa no visual a yaw-pitch | Fuera de regla de negocio | Backlog futuro opcional |
| Plataforma: tablas sin caption, `innerHTML` async sin foco | Higiene | P2: `role="status"` en errores/éxito de login ya existe; mejorar foco post-submit |
| Landing marketing (`plataforma/index.html` sección Accesibilidad) | Claims | Alinear copy a criterios §2; no inventar capacidades |

**Higiene básica admin (hacer si se toca el archivo, no como epic a11y):**

- `plataforma/login.html` — labels + mensajes de error anunciables (ya cercano).
- `control-web/index.html` — cada input de diálogo escena/hotspot con label visible asociado.
- No invertir sprint en “hotspot placement without mouse”.

---

## 6. Plan de pruebas

### Tours / motor (estricto)

| Capa | Qué | Dónde |
|---|---|---|
| A. Semántica automática | axe (o equivalente) en `index.html` tras load de escena | PC local; luego CI Linux |
| B. Teclado E2E | Playwright: skip-links, menú, panel a11y, hotspot desde lista, Escape detiene audio, retorno de foco | `tests/keyboard-navigation.spec.ts` |
| C. NVDA (Windows) | Recorrido Biblioteca completo solo teclado + SR | Este PC |
| D. TalkBack (Android + Chrome) | Misma ruta; foco inicial **no** atrapado en panorama; listas usables con gestos SR | Dispositivo físico (obligatorio antes de claim público) |
| E. Audio QA | Play/pause/stop; cambio de escena corta audio; transcript abre; captions honestas | Piloto + 2 hotspots info |
| F. Regresión visual | Modo alto contraste + text scale no rompe listas | Manual corto |

**Matriz mínima de release del tour:**

- [ ] TalkBack: escena → destino → nueva escena
- [ ] TalkBack: hotspot info → audio → cerrar → silencio
- [ ] NVDA: mismos flujos
- [ ] Teclado-only sin SR: mismos paneles
- [ ] Sin JS: fallback entrada + transcript link

### Admin (ligero)

| Capa | Qué |
|---|---|
| Tab order en login y un diálogo de Control Web | Inputs alcanzables; submit con Enter |
| axe smoke opcional | Sin blocker de release del tour |
| **No** exigir matriz TalkBack en Control Web / org-admin |

### PC ahora vs Linux después

| Ahora (Windows PC) | Después (carpeta copiada a Linux) |
|---|---|
| Desarrollo motor + assets locales | Mismos tests Playwright/axe en CI |
| NVDA + Android TalkBack manual | CI **no** reemplaza TalkBack |
| Audio/transcripts en `assets/` | Migrar binarios a object storage; Convex metadata |
| Sin implementar hosting en este backlog | Planificar deploy cuando exista servidor |

---

## 7. Intersección con `TourBranding` / white-label

Del plan de arquitectura white-label:

- **Orbe360** = identidad de plataforma (`plataforma/`, admin chrome).
- **Tour del cliente** = contenido + **branding visual** + **paquete de accesibilidad**.

| Capacidad | ¿Va en TourBranding? | ¿Va en contenido a11y del tour? |
|---|---|---|
| Logo, colores, tipografía del cliente | Sí | No |
| Nombre del tour en header del viewer | Sí (datos tour) | Complementa `srSummary` |
| Narraciones, VTT, transcripts, `srLabel` | No | Sí — por tour / locale |
| Strings de UI del motor (“Reproducir”, “Escenas”) | No (motor Orbe360; i18n propio) | No |
| `accessibilityProfile` / checklist de publicación | Metadatos del tour | Evidencia de contenido a11y completo |
| Claims en landing Orbe360 | Plataforma | Deben reflejar capacidad del **motor**, no un cliente |

**Regla:** un tema de cliente nunca debe ser el único vehículo de accesibilidad. El motor neutro aporta la capa semántica y el player; el cliente aporta (o no) el contenido narrado. Un tour sin paquete a11y completo **no** debe marcarse como “accesible publicado”.

**Acoplamientos Unisimón a retirar del motor (alineado a white-label, impacto a11y):**

- Meta/título hardcodeados en `index.html`.
- Fallbacks de copy campus-específicos en `configLoader.js` cuando falten datos.
- Assets y seed del piloto viven como **contenido del tour Unisimón**, no como defaults globales del motor.

---

## 8. Orden de ejecución sugerido (accionable)

1. **T-P0-1** stop audio en cierre de capas (bug rápido, alto impacto).  
2. **T-P0-7** labels del panel.  
3. **T-P0-5 / T-P0-3 / T-P0-2** capa semántica + anuncios cortos + listas completas.  
4. **T-P0-4** `role="application"`.  
5. **T-P0-6** audios reales del piloto + transcripts.  
6. Ampliar tests teclado (**T-P1-9**) en paralelo a TalkBack manual.  
7. Player de escena + VTT honesto (**T-P1-1..3**).  
8. Normalizar Convex content model (**T-P1-7**) cuando el merge JSON duela.  
9. Authoring admin de campos a11y (**T-P2-2**) solo formularios.  
10. Hosting/CDN audio cuando exista Linux — fuera de implementación ahora.

---

## 9. Anti-objetivos (para no diluir el backlog)

- No convertir Control Web en editor accesible espacial P0.  
- No usar más ARIA decorativo sin ruta operable.  
- No tratar `speechSynthesis` ni booleanos de `accessibilityProfile` como prueba de accesibilidad.  
- No bloquear white-label visual por falta de authoring a11y admin; sí bloquear el **claim** “tour accesible” sin contenido.  
- No implementar hosting en este documento.

---

## 10. Referencias rápidas en repo

| Recurso | Uso |
|---|---|
| `backlog.md` | Legacy; re-priorizado aquí (admin/SR authoring ↓; audio real y capa semántica ↑) |
| `docs/producto/07-requisitos.md` (RNF-01) | WCAG básica tour — elevar a criterios §2 |
| `docs/producto/13-auditoria-infraestructura.md` | Object storage / portable Linux |
| `docs/producto/01-vision.md` | Accesibilidad como NFR del visitante |
| `assets/captions/`, `assets/transcripts/` | Base de contenido piloto |
| `src/announcer.js`, `src/accessibility.js`, `src/hotspotPanel.js` | Núcleo a11y actual del motor |

---

*Última actualización: 2026-09-09 — backlog de remediación priorizado por regla tours-profundos / admin-básico. Sin cambios de código asociados a este documento.*
