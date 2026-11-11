# 68 — Auditoría Multi-Agente, Hardening y Empaquetado de Desarrollo Final (`dev/proyecto-final-15`)

**Rama:** `dev/proyecto-final-15` (separada del baseline congelado `estable-2026-11-10-solo-sede2` y de las carpetas entregadas en aula/OneDrive)  
**Objetivo:** Llevar la plataforma multi-tenant Orbe360 a calidad de producción previa al cierre del último 15%, corrigiendo brechas funcionales, de seguridad, aislamiento de marca, flujos multi-rol, accesibilidad WCAG 2.1 AA y empaquetado estático HTTPS.

---

## 1. Línea base aislada y separación de entregables

- El punto de restauración previo quedó congelado e intacto en la etiqueta Git `estable-2026-11-10-solo-sede2` (`c29bc01`) y comprimido en `copia estable sin imagenes de otra sede diferente a 2.zip`.
- Todo el trabajo de hardening descrito en este documento vive en la rama `dev/proyecto-final-15` y se refleja únicamente en la carpeta separada `ORBE360_DESARROLLO_FINAL/`, sin modificar las entregas cerradas de segundo o tercer corte (`ORBE-GP`, `ORBE360_ENTREGA_TERCER_CORTE_*`).

---

## 2. Correcciones principales por capa

### 2.1 Seguridad, aislamiento multi-tenant y backend Convex
- **Validación de URLs y activos (`convex/lib/urlSafety.ts`, `src/tourBranding.js`, `src/hotspotPanel.js`):** bloqueo de esquemas peligrosos (`javascript:`, `data:text/html`, URLs protocol-relative `//`) en branding (`logoUrl`, `fallbackImageUrl`) y descargas de transcripción.
- **Restricción estricta de roles (`convex/tourAdmin.ts`, `convex/organizations.ts`, `convex/accessibilityPublish.ts`, `convex/branding.ts`, `convex/auth.ts`):**
  - `superadmin` permanece bloqueado para editar contenido de tours (`userCanEditTour`).
  - `tourEditor` puede editar escenas/hotspots/multimedia en Control Web de su organización, pero recibe denegación en publicación (`setTourPublished`), renombrado/archivado de tours (`updateTourTitle`, `setTourArchived`) y branding (`saveBranding`).
  - Requisitos de contraseña mínima (`>= 10` caracteres) en `auth:changePassword` y `auth:resetUserPassword`, más gestión de perfil, activación/desactivación de cuentas, cambio de rol y revocación de sesiones (`listUsersDetailed`, `setUserActive`, `setUserRole`, `updateProfile`, `revokeAllUserSessions`).
- **Métricas y bitácora (`convex/audit.ts`, `convex/schema.ts`):** registro anónimo de telemetría de tours (`audit:recordTourEvent` con `{ orgSlug?, tourSlug, event: "view" | "scene" | "hotspot" }`), consulta por rango para `org-admin` (`audit:getTourMetrics`) y bitácora filtrable (`audit:listAuditLogs`).
- **Hardening HTTP en servidor local y router Cloudflare (`scripts/dev-server.mjs`, `functions/[[path]].js`):** bloqueo explícito de `/dist/`, `/functions/`, `/deploy/`, `/entregables-corte-*`, dotfiles (`.env*`, `.agents/`, `.claude/`), `convex/`, `docs/`, `scripts/`, `backups/`, `tests/` y archivos de configuración internos.
- **Portabilidad entre equipos y carga limpia (`css/base.css`, `plataforma/index.html`, `INICIAR_PROYECTO.bat`, `scripts/fotitos-catalog.mjs`, `scripts/generate-fotitos-tts.py`):** eliminación de `@import` externo redundante de fuentes dentro de CSS del visor, eliminación de script bloqueante innecesario de Marzipano en la landing `/`, favicons SVG integrados sin 404, instalación automática de `node_modules` al iniciar en Windows y reemplazo de rutas personales por `ORBE_FOTITOS_SRC`.
- **Resiliencia frente a bloqueadores EasyList / AdBlock / VPN (`plataforma/portal.css`, `plataforma/portal-ui.js`, `plataforma/portal-i18n.js`, `plataforma/portal-notice.js`):** renombrado de activos bloqueables (`marketing-*`, `cookie-consent.js` y `.cookie-banner`), carga dinámica aislada (`.catch(() => {})`) del aviso de almacenamiento local y estrategia *fail-open* (`html.orbe-motion [data-reveal]`) para garantizar render completo incluso si extensiones de navegador bloquean módulos secundarios.

### 2.2 Visor 360° público y accesibilidad WCAG 2.1 AA
- **Aislamiento de marca (`index.html`, `src/tourBranding.js`, `css/*.css`):** purga de colores hardcoded del cliente piloto en CSS del motor; cálculo dinámico de contraste `--brand-ink`, `--brand-strong-ink` y `--hotspot-icon-ink` vía luminancia relativa (`contrastInkForHex`).
- **Hotspots táctiles y modales (`src/hotspotPanel.js`, `src/uiLayers.js`, `src/hotspotManager.js`, `css/components/hotspots.css`):** prevención de cierre accidental al tocar hotspots informativos o la superficie del modal (`touch-action: none` y aislamiento `pointerdown`), narración y subtítulos estrictamente ligados al hotspot activo (`hotspotData`) y control de carrera en carga asíncrona de `.vtt` (`captionLoadSeq`).
- **Navegación, buscador y diagnóstico (`index.html`, `src/menu.js`, `src/viewer.js`, `src/accessibility.js`):** iconos SVG en flechas `#prevScene`/`#nextScene` (deshabilitadas hasta hidratar el visor) y cierre de paneles; buscador en tiempo real `#sceneSearchInput` insensible a tildes; soporte `?sede=` y `?embed=1`; matriz `#wcagAuditDialog` calculada en vivo desde Convex sin datos estáticos de terceros.

### 2.3 Control Web, paneles multi-rol y portal B2B
- **Control Web (`control-web/index.html`, `control-web/admin.js`, `control-web/admin.css`, `control-web/auth-gate.js`):** rutas root-absolute bajo URLs virtuales, paleta Orbe Soft Clay (`#0284c7`) sin residuos verdes heredados, eliminación de jerga técnica en etiquetas de estado, validación WebVTT conservando cues válidos ante sintaxis errónea, límites de carga (`panorama <= 25 MB`, `audio <= 30 MB`) y protección contra sobrescritura accidental al previsualizar grafos.
- **Portales `login.html`, `org-admin.html` y `superadmin.html`:** saneamiento de `?return=` contra open redirects con barra invertida o retorno cross-org, inicialización temprana de `--preview-ink`, cargas paralelas en `superadmin.html`, supresión de botones destructivos (`#seedBtn`), pestañas de métricas/bitácora (`Métricas y bitácora`) y autoservicio de cuenta (`Mi cuenta`).
- **Landing y páginas legales (`plataforma/index.html`, `plataforma/portal-i18n.js`, `plataforma/accesibilidad.html`, `privacidad.html`, `cookies.html`, `terminos.html`, `tratamiento-datos.html`):** idioma inicial consistente (`es`) con conmutador EN/ES y tema claro/oscuro persistente, tarjetas de Sede 1–4 sin fugas de borradores privados y tablas de verificación con iconos SVG.

---

## 3. Empaquetado estático productivo y despliegue gratuito (`$0`)

- El script `scripts/build-static-dist.mjs` genera `./dist` excluyendo fuentes de Convex, `.env*`, pruebas, documentación interna y scripts de desarrollo.
- Empaqueta los CSS y módulos ES críticos de la landing y el visor en bundles productivos únicos (`dist/plataforma/portal.bundle.css`, `dist/plataforma/portal-ui.bundle.js`, `dist/css/viewer.bundle.css`, `dist/src/viewer.bundle.js`) y carga fuentes externas de forma no bloqueante para evitar fallos parciales por bloqueadores o VPN.
- Incluye `dist/index.html` (portal Orbe360), `dist/viewer.html` (visor 360°), `dist/orbe-config.js` / `dist/plataforma/config.js` (con `ORBE_CONVEX_URL` HTTPS), `dist/_routes.json`, `dist/_headers`, `dist/404.html` y `dist/firebase.json`.
- El router multi-tenant `functions/[[path]].js` en Cloudflare Pages sirve `/{org}/{tour}/`, `/{org}/org-admin.html`, `/{org}/{tour}/control-web/` y bloquea rutas internas (`/.env*`, `/convex/*`, `/docs/*`, `/panoramas/*`) mientras excluye `/media/*`, `/css/*`, `/src/*` y `/vendors/*` en `_routes.json` para tráfico estático gratuito ilimitado.
- **Instancias desplegadas en producción (0 USD):**
  - Frontend HTTPS (Cloudflare Pages Free): `https://orbe360-unisimon.pages.dev`
  - Backend Convex Cloud Free (`orbe360-unisimon`): `https://careful-gnu-592.convex.cloud` (sin `ALLOW_OPEN_SEED` ni `SEED_BOOTSTRAP_SECRET` residual).
- **Integración de los 29 panoramas nuevos (`Fotitos`, 10 nov):**
  - 26 escenas incorporadas en `unisimoncucuta/experienciavirtual` (Bloque D + acceso esquina Sede 2, alcanzando 88 escenas y 127 conexiones sin perder el grafo curado previo).
  - 3 portadas iniciales en estado borrador (`published: false`, `a11yReady: true`) para `sede-1` (Bloque A), `sede-3` (Bloques E y F) y `sede-4` (Bloque G), con 40 paquetes de audio Voz Salomé (`.mp3`, `.vtt`, `.txt`, `.json`).
- Ver `deploy/README.md` y `docs/producto/67-plan-despliegue-seguro-produccion.md` para la operación y actualización continua.

---

## 4. Verificación automatizada ejecutada

| Suite / Herramienta | Comando | Cobertura |
| :--- | :--- | :--- |
| Lint + Typecheck Convex | `npm run check:static` | ESLint (`eslint .`, 0 errores) y `tsc -p convex/tsconfig.json --noEmit` |
| Auditoría de rutas y links | `npm run audit:routes` | Integridad de enlaces Markdown, rutas HTTP y assets multi-tenant |
| Cobertura accesible DB/Media | `npm run check:a11y` | Validación de escenas, hotspots informativos y archivos binarios locales |
| Pruebas unitarias Node | `npm run test:unit` | Slugs, contraste WCAG/branding, parser WebVTT, navegación espacial y checklist a11y |
| Autorización RBAC Control Web | `npm run qa:authz` | Aislamiento entre `superadmin`, `orgAdmin`, `tourEditor` y anónimo en Convex |
| Suite QA Backend + Contrato | `npm run qa` | Auth, snapshot DB, File Storage, branding, routing virtual, fases a11y/espacial y rate-limit |
| Pruebas E2E Chromium | `npx playwright test` | Landing i18n/tema, viewer 360°, hotspots/modales, auth/roles multi-tenant, Control Web y hardening HTTP |
| Validación en vivo Chrome | `chrome-devtools-mcp` | Revisión visual, consola limpia (0 errores JS), landing, visor, org-admin y Control Web |

