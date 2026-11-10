# 35 — Fix landing assets + marketing bajo tenant

**Fecha:** 2026-09-14  
**Entrada:** [34](./34-implementacion-routing-p0.md) · [32](./32-routing-multi-empresa-url.md)

## Problema

1. `GET /` servía `plataforma/index.html` con `href="marketing.css"` **relativo**. El navegador pedía `/marketing.css` → 404 → landing sin estilos.
2. `/{org}/{tour}/plataforma/index.html` resolvía al mismo HTML de marketing Orbe bajo el path del tour (incorrecto: las empresas no tienen landing corporativa Orbe).

## Decisión

| URL | Comportamiento |
|-----|----------------|
| `/` | **Única** landing pública Orbe360 (CSS/JS root-absolute) |
| `/plataforma/index.html` · `/plataforma/` | **302 → `/`** (fuente física no se publica en esa URL) |
| `/{org}/{tour}/plataforma/index.html` | **302 → `/`** |
| `/{org}/{tour}/plataforma/login.html` | **302 → `/plataforma/login.html`** |
| `/{org}/{tour}/plataforma/org-admin.html` | **302 → `/{org}/org-admin.html`** |
| `/{org}/{tour}/org-admin.html` | **302 → `/{org}/org-admin.html`** (legacy) |
| `/{org}/org-admin.html` | Canónico (rewrite → `plataforma/org-admin.html`) |

## Cambio técnico

- `plataforma/index.html` → `<link href="/plataforma/marketing.css">`
- `marketing.css` / `admin-shell.css` → `@import url("/plataforma/tokens.css")`
- `scripts/dev-server.mjs` → `tourPlataformaRedirect()` + redirect global `/plataforma(/index.html)` → `/`
- Enlaces de marca → `/` (login, org-admin, superadmin, control-web, viewer)

Modelo virtual de doc 32 **sin cambio**: un solo codebase; sin carpetas físicas por tour; grafo intacto.

## Verificación

```bash
npm start
# / debe verse con Soft Clay / Outfit
# /plataforma/index.html → 302 /
# /unisimoncucuta/experienciavirtual/plataforma/index.html → 302 /

npm run qa
npx playwright test tests/smoke.spec.js
```
