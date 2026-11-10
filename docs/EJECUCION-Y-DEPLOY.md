# Ejecución y despliegue

## Requisitos

- **Node.js** ≥ 18
- Navegador con **WebGL**
- `vendors/marzipano.min.js` incluido en el repo (sin CDN obligatorio)

## Servidor local (desarrollo)

```bash
npm install
npx convex dev          # terminal 1 — backend
npm start               # terminal 2 — estático :8081
```

URL típicas:

| Superficie | URL |
|------------|-----|
| Tour / viewer | http://127.0.0.1:8081/ |
| Landing | http://127.0.0.1:8081/plataforma/ |
| Control Web | http://127.0.0.1:8081/control-web/ |
| Login | http://127.0.0.1:8081/plataforma/login.html |

Config: `orbe-config.js` / `plataforma/config.js`. Overrides portables vía `config.local.js` (gitignored; ver `config.local.js.example`) o `localStorage.orbe360.convexUrl`.

**Multi-tour público (Phase 6):** el viewer resuelve el tour por `?slug=` en la URL, luego `__ORBE_TOUR_SLUG__` / config.local, luego default piloto `unisimon-campus`.

| URL | Comportamiento |
|-----|----------------|
| `/?slug=unisimon-campus` o `/index.html?slug=…` | Carga ese tour publicado (+ branding) |
| `/` sin query | Default piloto Unisimón |
| Futuro `/tour/{slug}` | Pretty URL vía rewrite de hosting → `/?slug=` (no implementado aún) |

Landing “Experiencias publicadas” enlaza cada demo a `/?slug={slug}`. `graph:getTourGraph` solo devuelve tours `published`.

Default de piloto: `window.__ORBE_TOUR_SLUG__ = "unisimon-campus"` — **override** para multi-tour; no es identidad de producto.

Detalle paso a paso: `docs/producto/05-como-levantar.md`.  
Portabilidad Linux / migración: `docs/producto/21-fase5-limpieza-y-portabilidad.md`.

## Auditoría accesibilidad (criterios MinTIC)

```bash
npm run audit
```

Genera `reports/audit-report.json` y `reports/audit-report.html`.

## QA y tests

Con Convex + web arriba:

```bash
npm run qa              # API / authz / branding / chrome neutro
npm run check:a11y      # paquete a11y piloto
npm test                # Playwright (servidor en :8081)
```

Suite combinada: `npm run check` · con Playwright: `npm run check:full`.

## Despliegue estático (portable → Linux)

El frontend es HTML/JS estático. Flujo migration-ready (sin hosting real en este doc):

1. Copiar la carpeta del proyecto a Linux (rutas **relativas**; no paths Windows).
2. `npm install`
3. Apuntar Convex: inyectar `window.__CONVEX_URL__` (Nginx/`envsubst`/script `config.local.js` no versionado).
4. Servir la raíz del repo (mantener `panoramas/`, `assets/`, `vendors/`).
5. Media ownership ya usa claves `orgs/{orgId}/tours/{tourId}/panoramas/...` — listas para object storage futuro.
6. Quitar `ALLOW_OPEN_SEED`, rotar passwords seed, TLS delante del estático.

Puede publicarse en Firebase Hosting, Netlify, GitHub Pages, Nginx/Caddy, etc.

## Demo

- `demo.html` — pasos para demostración
- `demo-report.html` — reporte de demo
