# 66 — Reglas Permanentes de Diseño UI/UX, Política de Contenido, Flujos Multi-Rol y Registro de Remediación

**Proyecto:** Orbe360  
**Vigencia:** Reglas vinculantes para todo nuevo componente, vista, modal, formulario o ruta de navegación.  
**Relacionados:** [12 design system](./12-design-system-orbe360.md) · [32 routing multi-empresa](./32-routing-multi-empresa-url.md) · [39 identidad Orbe vs cliente](./39-identidad-orbe-vs-cliente.md) · [60 marca Orbe refinada](./60-marca-orbe-refinada.md) · [61 design system Orbe v2](./61-design-system-orbe-v2.md) · [64 rediseño motion landing](./64-criterios-redisenio-motion-landing-guia-maestra.md)

---

## Parte I — Reglas Obligatorias de Diseño UI/UX (Nuevos Componentes y Vistas)

Todo componente nuevo o refactorizado en Orbe360 debe cumplir simultáneamente estas **7 reglas arquitectónicas de interfaz**:

### 1. Política Estricta de Contenido (5 Categorías Únicas)
Antes de escribir HTML o copy en cualquier vista, todo texto visible debe clasificarse en una de cinco categorías. Si no encaja con claridad, se elimina o se mueve a documentación interna:

1. **Identidad:** nombre de marca, rol del usuario o contexto de organización/tour activo (`ORBE360 · {org}`, `Admin Org`, `Superadmin`, `Editor`).
2. **Estado operativo:** dato útil para decidir (`Publicada`, `Borrador`, `0 escenas`, `Pendiente`, `Listo`, `Guardado`, `Cambios sin guardar`).
3. **Acción:** verbo breve sobre botón o enlace de objeto específico (`Abrir editor`, `Ver vista previa`, `Publicar`, `Guardar`, `Cerrar`).
4. **Entrada de datos:** `<label>` corto en lenguaje natural + placeholder con formato esperado (`Ej. Sede 4 — Bloque G`), sin párrafos explicativos redundantes.
5. **Confirmación o error accionable:** mensaje breve del resultado real (`Audio generado`, `Error de conexión: inicia Convex`), nunca el estado interno de arranque (`Sin acción aún`).

**Cero jerga de implementación en UI operativa:** quedan prohibidos en textos visibles para usuario términos internos como *Convex*, *SoT*, *WebGL cache*, *fallback JSON*, *ready YES/NO*, *grafo curado (~N enlaces)* o nombres técnicos de almacenamiento en badges.

### 2. Separación Absoluta de Identidad: Plataforma Orbe vs. White-Label del Cliente
Mantener la frontera cromática de [`plataforma/tokens.css`](../../plataforma/tokens.css) y [`src/tourBranding.js`](../../src/tourBranding.js):

| Superficie | Paleta obligatoria | Tokens clave | Prohibido |
| :--- | :--- | :--- | :--- |
| **Plataforma y Operación** (`/`, `login.html`, `superadmin.html`, `org-admin.html`, chrome de `control-web`) | **Orbe Soft Clay / Sky** (`#0284c7`, `#0369a1`, tinta `#101828`, papel frío `#f4f7fb`) | `--orbe-accent`, `--orbe-ink`, `--orbe-paper`, `--orbe-clay-*`, `--cw-*` | Usar verde institucional cliente (`#0a7a45`) ni tarjetas flotantes genéricas oscuras con neón cian/verde. |
| **Visor del Tour Público** (`/{org}/{tour}/`) | **White-Label Cliente** (`TourBranding` desde Convex, p. ej. `#0a7a45` en Unisimón) o neutro gris si no hay marca | `--brand`, `--brand-strong`, `--brand-ink`, `--brand-soft`, `--brand-ghost` | Pintar el visor del cliente con acentos de plataforma (`ORBE_PLATFORM_PRIMARY_COLORS`), usar emojis en controles (`🔊`, `⏸`) o perder contraste AA en iconos del header. |

Todo botón del visor sobre fondo `--brand` debe usar `color: var(--brand-ink, #ffffff)` calculado por luminancia relativa WCAG (`contrastInkForHex`, umbral `0.36`, contraste >= `4.5:1`), con SVGs explícitos usando `fill="currentColor"`.

### 3. Jerarquía Visual y Geometría Soft Clay Contenida
- Usar las escalas neutras de [`css/design-tokens.css`](../../css/design-tokens.css) (`--orbe-rad-xs` `6px` a `--orbe-rad-xl` `22px`, `--orbe-elev-1` a `--orbe-elev-4`) y tipografía `Sora` (títulos) + `Outfit` (cuerpo/UI).
- Preferir **líneas divisorias sutiles** (`1px solid var(--orbe-line)` / `#e2e8f0`), aire tipográfico y fondos claros de consola en modales y listados de filas (`.studio-cue-row` separado por línea inferior, sin envolver cada sub-ítem en tarjetas idénticas pesadas).
- Ancho de trabajo real en paneles administrativos: usar `.admin-shell--wide` (`max-width: 1280px`), grillas adaptativas (`.tour-grid` con `repeat(auto-fit, minmax(310px, 1fr))` y `.tour-card:only-child { max-width: 560px }`) y tarjetas semánticas `<article class="tour-card">` con `.tour-card__actions` uniforme al pie (`margin-top: auto`).

### 4. Flujo Natural de Tareas, Cero Doble Scroll y Cero Botones Repetidos
- En modales complejos (como `#a11yStudioDialog` / `.modal--studio`), toda interacción ocurre dentro de **un único scroll del cuerpo del modal** o contenedor maestro; nunca incrustar listas internas con `overflow-y: auto` dentro de otra columna o diálogo scrolleable.
- Organizar tareas en orden secuencial lógico (p. ej., `1. Guion y descripción` -> `2. Fuente de audio` -> `3. Vista previa de audio` -> `4. Subtítulos`).
- **Regla anti-ruido en listados/tablas:** no repetir N botones textuales por fila (`Usar tiempo`, `Reproducir aquí`, etc. en cada subtítulo). Mantener **una sola acción contextual en cabecera** (`#btnApplyPlayerTime`, que aplica `audio.currentTime` al campo inicio/fin enfocado o activo) y solo iconos SVG compactos esenciales por fila (`.studio-icon-btn` para reproducir fragmento y eliminar).
- En botones y estado vacío, priorizar jerarquía (`btn--primary` único por bloque -> `btn--accent` / `btn` secundario -> `btn--ghost`). No renderizar dos controles que muestren la misma metadata ni mantener activa en pantalla una barra de contexto (`#activeTourBar`) en la pestaña donde ya se listan las tarjetas del mismo conjunto (*Tours*).

### 5. Protección de Datos Curados en Base de Datos y Cero Mocks Silenciosos
- **La base de datos Convex es autoritativa** sobre la estructura curada de escenas, hotspots, conexiones, branding y accesorios multimedia:
  - No incluir botones de destrucción masiva ni sobrescritura accidental en la interfaz operativa (prohibidos controles tipo *Vaciar conexiones*, *Regenerar grafo*, *Resincronizar desde JSON*).
  - Las tareas de importación masiva o migración viven en `scripts/` bajo control explícito de ingeniería.
- **Sin fallbacks silenciosos a cuentas demo en caliente:** si Convex (`127.0.0.1:3210`) no responde, ni `plataforma/convex-client.js` ni `scripts/dev-server.mjs` ni `control-web/auth-gate.js` deben autenticar sesiones simuladas ni borrar el token válido por un error transitorio de red; deben devolver error accionable (`503` / `#loginConnWarn` / `paintConnectionError`) para reintentar sin perder estado.
- En rutas públicas con bandera autoritativa de BD (`strictDb = Boolean(appState.config?.convexAuthoritative)`), no inyectar rutas locales fantasmas de audio/subtítulos si la escena en BD no tiene `narration`/`captionFile`.

---

## Parte II — Flujos Multi-Rol, Estados de Sesión y Reglas de Ruta

### 6. Estados Mutuamente Excluyentes y Redacción Contextual
La interfaz de autenticación (`plataforma/login.html`) y navegación (`plataforma/session-nav.js` + `control-web/admin.js`) adapta su copia y controles según estado real de sesión validado contra `fetchMe(token)`:

1. **Sesión anónima:**
   - `#activeSessionCard` permanece oculto; `#loginForm` visible; `#demoCreds` sin contenido expuesto.
   - En `/`, los CTAs principales apuntan al visor público por defecto (`/unisimoncucuta/experienciavirtual/`) y al acceso de plataforma (`/plataforma/login.html`).
2. **Sesión activa en `login.html`:**
   - `#loginForm` queda **`hidden` de forma estricta** mientras exista sesión activa válida (o sin `?switch=1`), mostrando `#activeSessionCard` con el badge de rol (`Admin Org`, `Editor`, `Superadmin`).
   - El cambio de cuenta exige clic explícito en `#btnSwitchAccount` (*Cerrar sesión y cambiar de cuenta*).
   - Si llega `?return=...` incompatible con el rol (p. ej., `superadmin` intentando volver a `control-web`), `isReturnAllowedForUser` bloquea el retorno directo, muestra `#activeReturnNotice` explicando el límite de tenant y deja como primario el panel válido.
3. **Aislamiento de roles en navegación (`plataforma/session-nav.js`, `superadmin.html`, `control-web/index.html`):**
   - **Never leak internal role labels in raw landing HTML:** el texto `"Superadmin"` no debe existir estático en `plataforma/index.html`; los roles se resuelven dinámicamente al verificar sesión (`"Plataforma"`, `"Admin Org"`, `"Editor"`).
   - **`superadmin` (`roleKind = "platform"`):** administra organizaciones, altas de tours y usuarios en `/plataforma/superadmin.html`. Tiene bloqueado editar contenido de tours (`userCanEditTour` devuelve `false` en Convex); ningún enlace en `superadmin.html` debe enviarlo en bucle hacia `org-admin.html` o `control-web/` sin advertencia de rol (`?notice=superadmin_no_tour_edit`).
   - **`orgAdmin`:** administra sus sedes/tours, branding, publicación y accesos en `/{org}/org-admin.html` y edita contenido en `/{org}/{tour}/control-web/`.
   - **`tourEditor`:** accede directamente a `/{org}/{tour}/control-web/`, visualiza `#cwSessionChip` y recibe etiqueta contextual en `#headerOrgAdminLink` (*Mis tours*) sin exponer acciones exclusivas de administrador de organización.

### 7. Mapa Oficial de Sedes — Universidad Simón Bolívar (Sede Cúcuta)
Todo cambio en `plataforma/index.html`, `plataforma/data/sedes-unisimon.json`, `plataforma/org-admin.html` o scripts/entregables debe respetar esta correspondencia verificada por campus:

| Sede | Bloques asignados | Tour slug en Convex | Estado actual |
| :--- | :--- | :--- | :--- |
| **Sede 1** | **Bloque A** (Núcleo Av. 3: Rectoría, admisiones, registro, financieros) | `null` (pendiente captura) | Catálogo |
| **Sede 2** | **Bloques B, C y D** (Av. 3 #13-34: Biblioteca Anita Consuegra, aulas generales, cómputo, cafetería, laboratorios) | `experienciavirtual` | **Publicado (62 escenas)** |
| **Sede 3** | **Bloques E y F** (Extensiones Av. 4: Consultorio Jurídico, Centro de Conciliación, Cámara Gesell, Psicología) | `null` (pendiente captura) | Catálogo |
| **Sede 4** | **Bloque G** (Extensiones: laboratorios terapéuticos, educación continua, posgrado) | `sede-4` | **Borrador privado en BD (0 escenas)** |

---

## Parte III — Registro de Cambios Implementados y Metodología de Verificación

### A. Resumen Técnico de Remediación Aplicada
1. **Estabilidad de código y sintaxis:** eliminación de llave extra `}}` y código muerto (`persistGraph`, `loadStoredGraph`, `pickRichestGraph`, `cleanTitle`, `clearAllConnections`) en `control-web/admin.js`; corrección de TDZ `activeOrgId` en `plataforma/org-admin.html`; resolución de advertencias ESLint en `convex/tourAdmin.ts`, `src/configLoader.js`, `plataforma/portal-ui.js`, `src/viewer.js`, `src/tourSlug.js` y `plataforma/convex-client.js`.
2. **Eliminación de mocks offline y persistencia real de sesión:** supresión de `DEMO_ACCOUNTS`/`handleOfflineFallback` en `plataforma/convex-client.js`, de `DEV_USERS`/`handleDevApi` en `scripts/dev-server.mjs` (ahora HTTP `503`) y del bypass `demo-`/`orgadmin` en `control-web/auth-gate.js` (conservando el token en fallos de red y mostrando `paintConnectionError`). Actualización de [`INICIAR_PROYECTO.bat`](../../INICIAR_PROYECTO.bat) para levantar/validar Convex en `127.0.0.1:3210` y abrir `http://127.0.0.1:8081/`.
3. **Navegación por rol y copy adaptativo:** creación de [`plataforma/session-nav.js`](../../plataforma/session-nav.js); estados excluyentes en [`plataforma/login.html`](../../plataforma/login.html); limpieza de bucles en [`plataforma/superadmin.html`](../../plataforma/superadmin.html); cabecera con `#cwSessionChip`, `#headerOrgAdminLink`, `#headerAccountLink`, `#headerTourLink` y `#btnCwLogout` en `control-web/index.html` y `control-web/admin.js`.
4. **Visor público, branding y accesibilidad:** cálculo dinámico `--brand-ink` en [`src/tourBranding.js`](../../src/tourBranding.js) y aplicación en [`css/header.css`](../../css/header.css) e `index.html`; `stopPropagation` de clic dentro de `#hotspotPanel` en [`src/hotspotPanel.js`](../../src/hotspotPanel.js); reemplazo de emojis por `<svg>` con `fill="currentColor"` en [`src/sceneAudio.js`](../../src/sceneAudio.js); rediseño limpio de `.scene-caption-banner` y `.wcag-audit-dialog` en [`css/components/accessibility-controls.css`](../../css/components/accessibility-controls.css); estado vacío contextual cuando una sede nueva (como `sede-4`) tiene `0 escenas` en [`src/main.js`](../../src/main.js).
5. **Seguridad operativa y rediseño UI/UX (`P0`–`P3`):** eliminación de `.graph-safety-banner`, `#btnClearAllConnections`, `#spatialDangerSection`/`#syncSpatialBtn` y `#syncA11yBtn`/`syncPackageToConvex`; actualización del shell `1280px`, `.org-subbar`, `#activeTourBar` y `.tour-grid` en [`plataforma/org-admin.html`](../../plataforma/org-admin.html) y [`plataforma/admin-shell.css`](../../plataforma/admin-shell.css); rediseño completo del Estudio de Audio y Subtítulos `#a11yStudioDialog` (flujo 1->4, scroll único, `#btnApplyPlayerTime`, 2 botones SVG por fila) en [`control-web/index.html`](../../control-web/index.html), [`control-web/admin-pro.css`](../../control-web/admin-pro.css) y `control-web/admin.js`.
6. **Alta de Sede 4 (`sede-4`):** mapeo correcto de Sedes 1–4 en landing y `sedes-unisimon.json`, y creación del recorrido `sede-4` (*Sede 4 — Bloque G*) como borrador privado con branding Unisimón heredado.

### B. Metodología Estándar de Auditoría y Verificación (5 Fases)
Antes de aprobar cualquier cambio de interfaz o flujo en el repositorio:

1. **Estático y de tipos:** `npx eslint` sobre archivos modificados, `npm run typecheck` para `convex/` y `node --check` para scripts `.mjs`/`.js`.
2. **Contratos de autorización y API:** `npm run qa:authz` contra Convex local (`127.0.0.1:3210`).
3. **Suite estructural y regresión de rutas/copy:** `npm run qa` (revisando que cualquier fallo único residual esté justificado antes de mezclar).
4. **Inspección real en Chrome (Chrome DevTools / Playwright):** probar flujos reales por rol (`anónimo`, `orgAdmin`, `tourEditor`, `superadmin`), verificar **0 errores de consola**, comprobar visibilidad, contraste y capturas en desktop/móvil antes de sincronizar copias.
5. **Sincronización controlada ("un solo árbol de trabajo"):** aplicar en `ORBE` como fuente de verdad, verificar exclusión de `.env*`/`backups/`/`_restos_exras_bloqueados/`, ejecutar `npm run check:drift` y sincronizar copias espejo únicamente tras la aprobación del resultado local.

