# 39 — Identidad Orbe360 vs cliente (Unisimón)

**Proyecto:** Orbe360  
**Fecha:** 2026-09-14  
**Relacionados:** [12 design system](./12-design-system-orbe360.md) · [20 white-label](./20-fase4-white-label-branding.md) · [32 routing](./32-routing-multi-empresa-url.md) · [38 Soft Clay](./38-soft-clay-ui.md)

---

## Separación de producto

| Actor | Qué es | Dónde se ve |
|-------|--------|-------------|
| **Orbe360** | Empresa que **vende** el SaaS / motor multi-tenant | `/`, login, superadmin, org-admin chrome, Control Web operator chrome |
| **Cliente (ej. Unisimón)** | Organización que **crea y administra** tours 360 con su marca | Viewer público `/{org}/{tour}/` vía `TourBranding` |

Unisimón Cúcuta es un **caso piloto / entregable de curso**, no la marca de la plataforma.

```text
Orbe360 (plataforma)
  └── cliente: unisimoncucuta
        └── tour: experienciavirtual   → branding USB / TourBranding
```

**Regla:** nunca pintar el chrome de Orbe con verde institucional Unisimón (`#0a7a45`). Nunca aplicar Soft Clay Orbe al viewer white-label del cliente.

---

## Paleta Orbe360 (plataforma) — 2026-09

Fuente: `plataforma/tokens.css`

| Token | Hex | Uso |
|-------|-----|-----|
| `--orbe-accent` | `#0284c7` | CTA primario, acentos Soft Clay |
| `--orbe-accent-deep` | `#0369a1` | Hover / énfasis |
| `--orbe-signal` | `#38bdf8` | Highlight sobre hero / dark |
| `--orbe-ink` | `#101828` | Texto principal |
| `--orbe-muted` | `#5a6a7e` | Texto secundario |
| `--orbe-paper` | `#f4f7fb` | Fondos admin / paper |
| `--orbe-line` | `#dbe3ee` | Bordes |
| `--orbe-white` | `#ffffff` | Superficies |
| `--orbe-night` | `#0b1220` | CTA band / bloques oscuros |
| `--orbe-clay-surface-tint` | `#eef6fc` | Tint Soft Clay |

Aliases de compatibilidad: `--orbe-green` → `--orbe-accent`, `--orbe-green-deep` → `--orbe-accent-deep`.

**Retirada:** el verde producto anterior `#009b3a` / `#007a2e` ya no es la identidad Orbe (demasiado cercano al look campus).

### Cliente Unisimón (solo tour)

| Token / campo | Hex | Dónde |
|---------------|-----|--------|
| Primario institucional | `#0a7a45` | `TourBranding.primaryColor` / `tour-branding.json` |
| Primario fuerte | `#086638` | branding cliente |

El motor del viewer arranca neutro (`css/base.css`) y el branding del tour sobrescribe.

---

## Superficies y look

| Superficie | Identidad | Notas |
|------------|-----------|--------|
| Landing `/` | Orbe Soft Clay + foto immersiva | Brand hero-level; motion: ken-burns, brand pulse, mesh drift |
| Login / org-admin / superadmin | Orbe Soft Clay admin | Sky/slate; no USB |
| Control Web | Orbe operator chrome (ligero) | Nodos/edges accent Orbe; chip opcional con color cliente (`--cw-client`); **datos / TourBranding intactos** |
| Tour público | White-label cliente | Sin Soft Clay Orbe; hotspots usan `var(--brand)` |

---

## URLs (admin org-level)

| Path | Rol |
|------|-----|
| `/` | Marketing Orbe |
| `/plataforma/login.html` | Login Orbe |
| `/plataforma/superadmin.html` | Ops plataforma |
| `/{orgSlug}/org-admin.html` | **Admin de organización** (todos los tours) |
| `/{orgSlug}/{tourSlug}/` | Viewer público |
| `/{orgSlug}/{tourSlug}/control-web/` | Control Web del tour |

Legacy (solo bookmarks / seguridad): `/{org}/{tour}/org-admin.html` → **302** → `/{org}/org-admin.html`.  
**En la app:** enlazar siempre canónicos (`/unisimoncucuta/org-admin.html`, `…/experienciavirtual/`, `…/control-web/`) — no depender de cadenas 302. Ver [40-fix-identidad-separada.md](./40-fix-identidad-separada.md).

---

## Checklist de no-regresión

- [ ] Landing/login/admin no usan `#0a7a45`
- [ ] Tour Unisimón sigue verde USB vía TourBranding (`#0a7a45`), no `#0284c7`
- [ ] Hotspots públicos usan `var(--brand)`, no verde/azul Orbe hardcode
- [ ] Org-admin en `/{org}/org-admin.html` lista tours de esa org
- [ ] Control Web y visor siguen bajo `/{org}/{tour}/…`
- [ ] Superadmin no sustituye al editor de contenido del cliente
- [ ] Hrefs canónicos (sin pasar por legacy org-admin / plataforma index)