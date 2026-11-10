# 40 — Fix: identidad Orbe ≠ Unisimón + enlaces canónicos

**Fecha:** 2026-09-14  
**Relacionados:** [39 identidad](./39-identidad-orbe-vs-cliente.md) · [38 Soft Clay](./38-soft-clay-ui.md)

## Qué se unificó por error

Al aplicar Soft Clay / paleta sky Orbe (`#0284c7`) en plataforma + Control Web, el chrome de **operador** quedó azul Orbe (correcto), pero:

1. **Hotspots del viewer público** seguían hardcodeados a verde producto legacy Orbe (`#009b3a`) en lugar de `var(--brand)` → el tour cliente no heredaba TourBranding.
2. Fallbacks CSS de Control Web aún citaban `#0a7a45` (USB) junto a tokens Orbe → confusión de “quién es el verde”.
3. Riesgo de guardar colores Orbe en `tourBrandings` del piloto si alguien copiaba la paleta de plataforma al formulario white-label.

**Datos:** `TourBranding` Unisimón en Convex ya era `#0a7a45` (no se borró el grafo). Se endureció seed + `saveBranding` para no reintroducir Orbe en el piloto. Ver también [41](./41-landing-orbe-y-cliente-unisimon.md) (early-boot + sanitización pública).

## Qué se restauró / fijó

| Capa | Identidad |
|------|-----------|
| `/`, login, superadmin, org-admin chrome | Orbe Soft Clay (`#0284c7`) |
| Control Web chrome | Orbe operador; chip opcional con color **cliente** (`--cw-client`) solo como contexto |
| Viewer `/{org}/{tour}/` | TourBranding Unisimón (`#0a7a45`, PEVCI) vía Convex / `tour-branding.json` |
| Hotspots públicos | `var(--brand)` (cliente), no `#009b3a` / `#0284c7` |

Seed: si el branding del piloto tiene primary Orbe (`#0284c7`, `#009b3a`, …), re-aplica `UNISIMON_BRANDING_SEED` **sin** tocar escenas/conexiones.

## Enlaces (preferir canónicos; no cadenas 302)

Usar siempre:

- Org-admin: `/unisimoncucuta/org-admin.html`
- Tour: `/unisimoncucuta/experienciavirtual/`
- Control: `/unisimoncucuta/experienciavirtual/control-web/`

Redirects de seguridad (legacy/bookmarks) se mantienen en `scripts/dev-server.mjs`, pero **los hrefs de la app ya apuntan a canónicos** — no depender de 302 en desarrollo.

## Verificación

- QA: TourBranding Unisimón `#0a7a45`; tokens Orbe `#0284c7`; hotspots sin `#009b3a` hardcode.
- Playwright: path canónico aplica `--brand: #0a7a45`; Control Web título Orbe360 + chip cliente.
