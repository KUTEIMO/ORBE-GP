# Cómo levantar Orbe360 (local, migration-ready)

## Principio

Trabajar en este PC **no** implica código temporal. Authz, multi-tenant y config portable
se implementan ya; HTTPS/CDN/object-storage se documentan como infra (ver `16-auditoria-fase1-seguridad.md`).

## 1. Backend Convex

```bash
npm install
npx convex login
npx convex dev
```

URL por defecto local: `http://127.0.0.1:3210` (en `orbe-config.js` / `plataforma/config.js`).

**Overrides portables (sin paths Windows):**

1. `localStorage.setItem("orbe360.convexUrl", "https://….convex.cloud")`
2. Script no versionado `config.local.js` (gitignored; plantilla `config.local.js.example`) que setea `window.__CONVEX_URL__` / `__ORBE_TOUR_SLUG__` / `__ORBE_ORG_SLUG__` **antes** de cargar `orbe-config.js`
3. En hosting Linux: inyección Nginx/`envsubst` del mismo símbolo

**Slugs piloto (DB = URL pública):**

| | Valor |
|--|--------|
| Org | `unisimoncucuta` |
| Tour | `experienciavirtual` |

Aliases legacy (`unisimon-cucuta`, `unisimon-campus`) se resuelven y el seed **migra in-place** (patch de slug; no borra grafo).

> **⚠️ Grafo del piloto:** la navegación pública vive en Convex (`connections`).  
> **Nunca** ejecutes `syncCampusSpatialGraph` / “Reset grafo campus” sobre `experienciavirtual` salvo reset consciente (~161 aristas del paquete campus y se pierde el trabajo admin).  
> Flujo diario: Control Web → **Guardar** → verificar URL pública → **Exportar JSON**.  
> Tras migrate de media: `npm run sync:unisimon-graph` (static ← Convex; nunca dejar `tour-graph.json` vacío).  
> Detalle: [37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md) · [36-fix-grafo-admin-vs-publico.md](./36-fix-grafo-admin-vs-publico.md) · [51-grafo-post-migracion-media.md](./51-grafo-post-migracion-media.md).

Precedencia pública: **path `/{org}/{tour}/`** → `?slug=` (compat) → inject/`config.local.js` → default.

## 2. Seed (primera vez)

Bootstrap de DB vacía está **bloqueado** salvo:

```bash
npm run seed:allow-local   # npx convex env set ALLOW_OPEN_SEED 1
npm run seed
```

O bien `SEED_BOOTSTRAP_SECRET` en Convex env + `bootstrapSecret` en la mutación.

Si la DB ya tiene Unisimón, `seed:seedPlatform` exige sesión **superadmin** (desde UI Superadmin → Ejecutar seed) y solo migra slugs/branding faltante. **Ya no reinyecta** el grafo espacial ni a11y (evita pisar conexiones del org-admin). Ver `36-fix-grafo-admin-vs-publico.md`.

El **primer** seed (DB vacía) aplica en orden:

1. **Grafo espacial** campus (`syncCampusSpatialGraph` / embed) — yaw, pitch, nav, connections
2. **Paquete a11y TTS** campus (`syncCampusA11yPackage`) — narration/transcript/srSummary

Re-aplicar después (opt-in explícito desde org-admin / Control Web o mutaciones):

- `tourAdmin:syncCampusSpatialGraph` — **borra** el grafo curado y restaura ~144 aristas campus
- `accessibilityPublish:syncCampusA11yPackage` — metadatos TTS

Regenerar embed espacial tras editar JSON estático:

```bash
npm run spatial:embed
```

### Usuarios demo (solo docs / CLI — no en HTML público)

| Email | Password | Rol |
|-------|----------|-----|
| superadmin@orbe360.local | OrbeSuper2026! | Superadmin |
| admin@unisimon.local | UnisimonAdmin2026! | Admin Unisimón |

Rotar antes de cualquier hosting compartido. Login con `?demo=1` solo indica que existe modo demo; **no muestra passwords**.

## 3. Web estática

```bash
npm start
```

Usa `scripts/dev-server.mjs` (rewrites multi-tenant). Puerto **8081**.

| URL | Superficie |
|-----|------------|
| http://127.0.0.1:8081/ | Marketing Orbe360 Soft Clay (SaaS B2B; Acceso solo en footer) |
| http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/ | Tour Unisimón |
| http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/?scene=entrada-principal | Escena |
| http://127.0.0.1:8081/unisimoncucuta/org-admin.html | Org-admin dashboard (tabs Tours / Branding / Publicación / Accesos) |
| http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/control-web/ | Control Web (**login + membership** — [52](./52-control-web-authz.md)) |
| http://127.0.0.1:8081/orbe/sandbox/ | **Sandbox Orbe** (editor P1; aislado — ver [48](./48-sandbox-orbe-editor-p1.md), [49](./49-aislamiento-tour-media-roles.md)) |
| http://127.0.0.1:8081/orbe/sandbox/control-web/ | Control Web sandbox (**requiere** login + membership Orbe; ver [52](./52-control-web-authz.md)) |
| http://127.0.0.1:8081/orbe/org-admin.html | Org-admin Orbe sandbox |
| http://127.0.0.1:8081/plataforma/login.html | Login (global) |
| http://127.0.0.1:8081/plataforma/superadmin.html | Superadmin dashboard (KPIs + empresas + cuota opcional) |

**Patrones multi-empresa (local):**

| Patrón | Uso |
|--------|-----|
| `/{orgSlug}/{tourSlug}/` | Tour público |
| `/{orgSlug}/org-admin.html` | Panel de la organización |
| `/{orgSlug}/{tourSlug}/control-web/` | Editor espacial del tour |
| `/plataforma/superadmin.html` | Ops Orbe (crear org/tour/admin) |

Compat (bookmarks): `…/experienciavirtual/org-admin.html` → **302** → `/unisimoncucuta/org-admin.html`.  
`http://127.0.0.1:8081/?slug=unisimon-campus` → redirect al path canónico del tour.  
**En desarrollo, enlazar canónicos** (tabla arriba) — no encadenar redirects.  
Fuente física de marketing: `plataforma/index.html` — **solo** se sirve en `/`.  
`/plataforma/index.html` y `/{org}/{tour}/plataforma/index.html` redirigen **302 → `/`** (ver [35-fix-landing-assets-routing.md](./35-fix-landing-assets-routing.md)).  
Identidad Orbe vs cliente: [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md) · [40-fix-identidad-separada.md](./40-fix-identidad-separada.md) · [41-landing-orbe-y-cliente-unisimon.md](./41-landing-orbe-y-cliente-unisimon.md) · [42-branding-multi-empresa-data-driven.md](./42-branding-multi-empresa-data-driven.md).  
`npm run start:static` = `http-server` sin rewrites (solo para depurar archivos; `/` no tendrá CSS de marketing).

Comprobar rápido: panoramas cargan desde `/media/unisimoncucuta/experienciavirtual/panoramas/…`, hay destinos **nav**, play de audio en escenas con MP3. Checklist: [26-qa-manual-tour-audio.md](./26-qa-manual-tour-audio.md). En Control Web (hotspots), encuadra el frente y usa **“Usar vista actual como Adelante”** ([30-vista-frontal-adelante.md](./30-vista-frontal-adelante.md)).

**Media por tour (no root compartido):** layouts y anti-leak en [50-media-por-tour-unisimon.md](./50-media-por-tour-unisimon.md). Unisimón vive en `media/unisimoncucuta/experienciavirtual/`; Orbe sandbox en `media/orbe/sandbox/`. Root `/panoramas/` está deprecado (410).

**Identidad (no mezclar):**

| URL | Debe verse |
|-----|------------|
| `/` | Marketing Orbe360 Soft Clay — sin CTA admin en hero/nav |
| `/unisimoncucuta/experienciavirtual/` | TourBranding desde Convex (`#0a7a45` seed Unisimón) — no sky Orbe; early-boot neutro |
## 4. QA

Con Convex + web arriba:

```bash
npm run qa
npm run check:a11y
npx playwright test
```

`npm run qa` exige Convex en `127.0.0.1:3210` (o `CONVEX_URL`) y web en `8081` (o `WEB_URL`). Incluye sync espacial + a11y del campus **en tours desechables** (el piloto no se resetea).

Limpieza de basura QA (`qa-pub-*`, escenas `QA_TEST_*`): `npm run qa:cleanup` — ver [28-hotspots-roles-qa-cleanup.md](./28-hotspots-roles-qa-cleanup.md).

## Curso vs producto

El tour Unisimón sigue siendo el entregable del curso. La plataforma Orbe360 es la capa multi-org
(roles, media con `organizationId`/`tourId`/`objectKey`, auth, URLs `/{org}/{tour}/`).

Contrato URL: [32-routing-multi-empresa-url.md](./32-routing-multi-empresa-url.md).  
Implementación P0: [34-implementacion-routing-p0.md](./34-implementacion-routing-p0.md).  
Fix landing assets: [35-fix-landing-assets-routing.md](./35-fix-landing-assets-routing.md).  
Protección grafo diario: [37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md).  
Soft Clay UI: [38-soft-clay-ui.md](./38-soft-clay-ui.md).  
Identidad Orbe vs cliente: [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md).  
Landing B2B + viewer USB: [41-landing-orbe-y-cliente-unisimon.md](./41-landing-orbe-y-cliente-unisimon.md).  
UX dashboards multi-empresa: [45-ux-landing-org-superadmin.md](./45-ux-landing-org-superadmin.md).  
Media por tour / anti-leak: [50-media-por-tour-unisimon.md](./50-media-por-tour-unisimon.md).  
Aislamiento sandbox: [49-aislamiento-tour-media-roles.md](./49-aislamiento-tour-media-roles.md).
