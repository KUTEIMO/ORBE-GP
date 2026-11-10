# 34 — Implementación routing P0 (auditoría)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-11  
**Entrada:** [32](./32-routing-multi-empresa-url.md) · [31](./31-vision-producto-routing-diseno.md)

---

## Decisión de slugs (piloto)

| Antes (seed) | Después (DB = URL) |
|--------------|--------------------|
| `organizations.slug = unisimon-cucuta` | **`unisimoncucuta`** |
| `tours.slug = unisimon-campus` | **`experienciavirtual`** |

**Migración:** `migratePilotSlugsIfNeeded` en seed hace **`db.patch` in-place** sobre org/tour existentes.  
No se borran `scenes` / `hotspots` / `connections`. Aliases legacy siguen resolviendo en `convex/lib/tourResolve.ts` y `src/tourSlug.js`.

---

## Qué se implementó (P0 + foundations)

| Ítem | Estado |
|------|--------|
| `/` = marketing Orbe360 (`plataforma/index.html`) | Hecho — `scripts/dev-server.mjs` |
| CSS landing root-absolute (`/plataforma/marketing.css`) | Hecho — ver [35](./35-fix-landing-assets-routing.md) |
| Bloqueo marketing bajo `/{org}/{tour}/plataforma/` | Hecho — 302 → `/` |
| Viewer en `/{org}/{tour}/` (mismo `index.html`) | Hecho — rewrite virtual |
| `/{org}/org-admin.html` canónico → `plataforma/org-admin.html` | Hecho |
| Legacy `/{org}/{tour}/org-admin.html` → 302 org-level | Hecho |
| `…/control-web/` → `control-web/` | Hecho |
| Assets bajo prefijo (`css`, `src`, panoramas…) | Hecho — strip prefix → root |
| Compat redirect `/?slug=` · `/index.html?slug=` | Hecho (mapa conocido) |
| `organizations.slug` + `tours.by_org_and_slug` | Hecho |
| `getTourGraph({ orgSlug, tourSlug })` + `{ slug }` legacy | Hecho |
| `resolvePublicTour` | Hecho |
| `createTour` unicidad por org | Hecho |
| `listPublishedDemos.orgSlug` + hrefs canónicos | Hecho |
| Soft Clay tokens + CTA landing + nodos grafo CSS | Hecho (ligero; sin tocar lógica grafo) |
| Authz superadmin ≠ editor | Sin cambio de política |
| Docs spine (README, arquitectura, épicas, CONTRIBUTING, ADR index, 05, 34) | Hecho |

---

## Archivos clave tocados

- `scripts/dev-server.mjs` — server + rewrites  
- `src/tourSlug.js`, `orbe-config.js`, `src/configLoader.js`  
- `convex/schema.ts`, `convex/graph.ts`, `convex/seed.ts`, `convex/lib/tourResolve.ts`, `convex/organizations.ts`, …  
- `plataforma/index.html`, `org-admin.html`, `tokens.css`, `marketing.css`  
- `control-web/admin.js`, `admin.css`  
- `tests/smoke.spec.js`, `tests/keyboard-navigation.spec.ts`, `scripts/qa-orbe.mjs`  
- Docs: `README.md`, `AGENTS.md`, `docs/**`

---

## Cómo abrir Unisimón localmente

```text
http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/
http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/?scene=entrada-principal
http://127.0.0.1:8081/unisimoncucuta/org-admin.html
http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/control-web/
```

Paleta Orbe vs cliente: [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md).

---

## Gaps residuales

- Hosting prod (Nginx/Caddy rewrite mirror del dev-server; TLS; IdP)
- Embed kit + CSP `frame-ancestors` por org
- Upload de logo branding
- AT device (NVDA/TalkBack) — **no verificado**; no afirmar
- `by_slug` global aún existe (lookup legacy); unicidad comercial real = compuesto
- Big-bang move de carpetas a `apps/` — documentado, no ejecutado
- Billing — fuera de alcance

---

## Reversible

- Compat `?slug=` + aliases legacy  
- `npm run start:static` vuelve a `http-server` sin rewrites  
- Slugs se pueden re-patchar; grafo no depende del string de slug
