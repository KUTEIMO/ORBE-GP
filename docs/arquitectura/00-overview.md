# Arquitectura — overview

**Proyecto:** Orbe360 (`PROTOTIPO-360-CURSOR-V1`)  
**Fecha:** 2026-09-11

## Diagrama (runtime local)

```text
Browser
  │
  ├─ GET /                              → marketing (plataforma/index.html)
  ├─ GET /{org}/{tour}/                 → viewer (index.html)  ─┐
  ├─ GET /{org}/org-admin.html           → org-admin            │ shared motor
  ├─ GET /{org}/{tour}/                  → viewer               │ shared motor
  ├─ GET /{org}/{tour}/control-web/      → control-web          │ shared motor
  ├─ GET /{org}/{tour}/control-web/     → Control Web          ─┘
  │
  └─ Convex HTTP API (127.0.0.1:3210)
        ├─ graph:getTourGraph / resolvePublicTour
        ├─ auth / memberships / tourAdmin
        └─ DB: organizations, tours, scenes, hotspots, connections, …
```

**Routing virtual:** un solo codebase. El path fija el contexto; **no** se copian carpetas por tour.  
Detalle: [producto/32-routing-multi-empresa-url.md](../producto/32-routing-multi-empresa-url.md).

## Carpetas

| Path | Rol |
|------|-----|
| `index.html` + `src/` + `css/` | Motor viewer Marzipano (compartido) |
| `plataforma/` | Marketing Orbe360, login, org-admin, superadmin |
| `control-web/` | Editor espacial + grafo |
| `convex/` | Schema, auth, graph, seed, media |
| `scripts/dev-server.mjs` | Static server + rewrites P0 (`npm start`) |
| `panoramas/` · `assets/` | Media del piloto (git; futuro object storage) |
| `docs/` | Producto + arquitectura + decisiones |
| `tests/` | Playwright |

## Resolución de tour

1. Path `/{orgSlug}/{tourSlug}/` (canónico)
2. Query `?slug=` (compat; el server redirige slugs conocidos)
3. Inject `__ORBE_TOUR_SLUG__` / `__ORBE_ORG_SLUG__`
4. Default piloto: `unisimoncucuta` / `experienciavirtual`

Helpers: `src/tourSlug.js`. API: `graph:getTourGraph({ orgSlug, tourSlug })` o `{ slug }` legacy.

## Authz (no negociable)

- **Superadmin:** crea org/tour/usuarios; **no** edita contenido de tour (`userCanEditTour` lo impide).
- **orgAdmin / tourEditor:** editan grafo, branding, publish de su org.
- Público: solo tours `published`.

## Target structure (documentada; sin big-bang)

Hoy las apps viven en la raíz por compatibilidad con paths relativos. Objetivo evolutivo (sin mover aún):

```text
apps/viewer · apps/control-web · apps/plataforma
packages/tour-slug · convex/
```

Preferir documentar y rewrites antes de mover `src/` / `convex/`.
