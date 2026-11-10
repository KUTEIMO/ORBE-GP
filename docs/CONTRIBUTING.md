# Contributing — Orbe360

How to work on this repo without breaking the Unisimón pilot or multi-tenant authz.

## Quick start

See [producto/05-como-levantar.md](producto/05-como-levantar.md) and root [README.md](../README.md).

```bash
npm install
npx convex dev          # terminal 1 — never use deploy for local work
npm start               # terminal 2 — scripts/dev-server.mjs :8081
npm run seed:allow-local && npm run seed   # first empty DB only
npm run qa
npx playwright test
```

## npm scripts

| Script | Qué hace | Cuándo |
|--------|----------|--------|
| `npm start` | Servidor estático :8081 con rewrites multi-tenant | Desarrollo diario |
| `npm run dev:convex` | `npx convex dev` (**nunca** `deploy` en local) | Desarrollo diario |
| `npm run lint` / `lint:fix` | ESLint + `@convex-dev/eslint-plugin` | Antes de cada commit |
| `npm run typecheck` | `tsc --noEmit` sobre `convex/` | Antes de cada commit |
| `npm run check:static` | `lint` + `typecheck`, sin servicios | Rápido, sin Convex |
| `npm run check:drift` | Divergencia contra el árbol que sirve la demo | Antes de cada push |
| `npm run check` | QA + authz + rutas + accesibilidad (requiere Convex + web) | Antes de una release |
| `npm run check:full` | `check:static` + `check` + Playwright | Puerta de release |
| `npm test` | Playwright | Antes de una release |

## Un solo árbol de trabajo

El producto vive **solo** en `APLICATIVOS\proyectos unisimon\ORBE`. Cualquier otra copia
(la carpeta del curso, una carpeta de demo) es un **despliegue**, no un sitio donde se
edita. En septiembre de 2026 los dos árboles llegaron a divergir en 31 archivos, con el
backend en uno y la documentación en el otro; ver
[arquitectura/01-auditoria-2026-09-29.md](arquitectura/01-auditoria-2026-09-29.md).

```bash
npm run check:drift                       # exit 0 = árboles alineados
npm run check:drift -- --other <ruta>     # comparar contra otra copia
```

## Ramas y commits

| Tipo de rama | Formato | Ejemplo |
|--------------|---------|---------|
| Funcionalidad | `feat/<ámbito>-<resumen>` | `feat/control-web-paginacion` |
| Corrección | `fix/<ámbito>-<resumen>` | `fix/viewer-preload-escena` |
| Documentación | `docs/<tema>` | `docs/auditoria-arquitectura` |
| Respaldo (no se borra) | `backup/estable-YYYY-MM-DD` | `backup/estable-2026-09-29` |

Commits en imperativo, con ámbito, explicando el **porqué**:

```
fix(convex): paginar listTours para que el dashboard no escanee la tabla entera
docs(arquitectura): registrar la divergencia ORBE/PROTOTIPO y su plan de unión
```

Prefijos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `a11y`.

Nunca: `git push --force` a `main`, `git reset --hard` ni `git clean -fd` sobre un árbol
con trabajo sin commitear. Para congelar un estado, usa un tag anotado más un snapshot
en `backups/` (el procedimiento está en
[VERSION-ESTABLE-2026-09-29.md](VERSION-ESTABLE-2026-09-29.md)).

## Checklist de release

- [ ] `npm run check:drift` en verde (un solo árbol)
- [ ] `npm run check:static` sin errores
- [ ] `npm run check` en verde (Convex + web levantados)
- [ ] `npx playwright test` en verde
- [ ] Tag anotado `estable-YYYY-MM-DD` + snapshot en `backups/`
- [ ] `media/` respaldado fuera de la máquina y verificado contra su manifiesto
- [ ] Sin credenciales en claro en archivos versionados
- [ ] Checklist de seguridad de más abajo revisado
- [ ] Hotspots del piloto verificados sin movimiento respecto a la release anterior

## Conventions

1. **One shared motor** — do not copy `index.html` / `control-web` / `plataforma` into per-tour folders. Use path routing (`scripts/dev-server.mjs` + `src/tourSlug.js`).
2. **Spanish for product docs**, English OK for technical notes — stay consistent with nearby files.
3. **Convex:** validate `args` + `returns`; await all promises; authz on every public function that touches user/org data; use indexes (`by_org_and_slug`), not `.filter()`.
4. **Superadmin ≠ tour editor** — never grant content-edit via superadmin alone.
5. **Do not wipe the connection graph** — migrate with `patch` / sync packages; never delete pilot scenes to “fix” slugs.
6. **No TalkBack/NVDA claims** without device evidence.
7. **No billing** in near-term scope.

## URL map (local)

| URL | Surface |
|-----|---------|
| http://127.0.0.1:8081/ | Orbe360 marketing |
| http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/ | Unisimón viewer |
| …/org-admin.html under `/{org}/` | Org admin (all tours) |
| …/control-web/ | Control Web |
| /plataforma/login.html | Login |
| /plataforma/superadmin.html | Superadmin |

Canonical contract: [producto/32-routing-multi-empresa-url.md](producto/32-routing-multi-empresa-url.md).

## Security checklist

Before any shared/staging host:

- [ ] Disable `ALLOW_OPEN_SEED`; rotate demo passwords
- [ ] TLS + non-localStorage session plan (or IdP)
- [ ] Inject `__CONVEX_URL__` (no secrets in git)
- [ ] Confirm `listTours` / media / publish require authz
- [ ] Public paths only return `published` tours
- [ ] Review [producto/16-auditoria-fase1-seguridad.md](producto/16-auditoria-fase1-seguridad.md)

## Tests

- `npm run qa` — API + HTTP + authz (needs Convex + web)
- `npx playwright test` — smoke + a11y motor
- `npm run check:a11y` — publish package readiness

## Agents / AI

Root [AGENTS.md](../AGENTS.md) points here. Prefer incremental, reversible changes; document decisions under `docs/decisiones/` or producto 3x docs.

## Reglas obligatorias para nuevas vistas, componentes y flujos (UI/UX)

Cualquier cambio en `plataforma/`, `control-web/` o el visor `src/` / `css/` debe seguir [producto/66-reglas-diseno-ui-ux-y-flujos-orbe360.md](producto/66-reglas-diseno-ui-ux-y-flujos-orbe360.md):

- **Política de contenido (5 categorías):** Identidad, Estado operativo, Acción, Entrada de datos y Confirmación/error accionable; cero jerga interna (*Convex*, *SoT*, *ready YES/NO*, rutas de storage).
- **Frontera de marca:** Chrome de plataforma y Control Web en **Orbe Soft Clay / Sky** (`#0284c7`); visor público exclusivamente en **White-Label Cliente** (`TourBranding`, `--brand`, `--brand-ink` calculado por luminancia WCAG `>= 4.5:1`), con iconos SVG (`fill="currentColor"`), nunca emojis.
- **Modales y listados limpios:** Un solo scroll en modales, flujo secuencial de tareas, líneas divisorias sutiles en lugar de tarjetas repetidas y una sola acción contextual de cabecera por listado en vez de botones repetidos por fila.
- **Protección de BD y sesiones reales:** Prohibido reintroducir botones destructivos de grafo/sync en UI o fallbacks silenciosos a cuentas demo en caliente. Validar los estados mutuamente excluyentes por rol (`anon`, `tourEditor`, `orgAdmin`, `superadmin`) y las URLs canónicas en Chrome local con 0 errores de consola antes de sincronizar copias espejo o hacer push.
