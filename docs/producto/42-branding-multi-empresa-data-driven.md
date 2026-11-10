# 42 — Branding multi-empresa data-driven

## Respuesta corta

**Sí, el diseño por empresa es data-driven.** La identidad de cada cliente vive en Convex `tourBrandings`, no en el motor del viewer. Alta de empresa #2 = org + tour + branding en admin/seed — **cero cambios de código del viewer**.

## Arquitectura

| Superficie | Identidad | Fuente |
|---|---|---|
| Orbe platform (`/`, login, superadmin, Soft Clay) | Fija Orbe (`#0284c7`) | `plataforma/tokens.css` |
| Tour público `/{org}/{tour}/` | 100% cliente | Convex `tourBrandings` (+ JSON offline **genérico**) |
| Control Web | Chrome Orbe + chip cliente | Orbe CSS + `getBrandingForAdmin` |

## Campos `TourBranding`

| Campo | Uso |
|---|---|
| `clientName` | Nombre legal / chip / landing |
| `clientShortName` | Header del viewer |
| `logoUrl` | Logo en header (opcional) |
| `primaryColor` / `primaryStrong` / `accentColor` | CSS `--brand*` / `--accent` |
| `metaTitle` / `metaDescription` | `<title>` y meta |
| `headerTitle` | Título corto UI |
| `showPoweredByOrbe360` | Badge “Powered by Orbe360” |
| `fallbackImageUrl` | Imagen no-JS / landing |

## Flujo onboarding empresa #2 (sin tocar código)

1. **Superadmin** → crear organización (`slug` URL) + usuario admin de org.
2. **Superadmin / org-admin** → crear tour (`slug`, título) y publicar cuando esté listo.
3. **Org-admin → Branding del tour** → nombre, colores, logo, meta. Guardar (`branding:saveBranding`).
4. Público: `/{orgSlug}/{tourSlug}/` aplica CSS vars desde el grafo (`graph:getTourGraph.branding`).
5. Landing: `graph:listPublishedDemos` incluye campos de branding; nuevos tours published aparecen solos.

**No hace falta** editar `tourBranding.js`, `index.html`, CSS del motor ni seed Unisimón.

## Qué hace el viewer (motor)

1. **Early paint:** gray/ink neutro (`#4b5563` / `#1f2937`) en cualquier path de tour — evita FOUC Orbe o de otro cliente.
2. **Load:** Convex `getTourGraph` → `applyTourBranding`.
3. **Sanitización genérica:** si `primaryColor` ∈ tokens Orbe (`#0284c7`, `#009b3a`, …) → neutro (cualquier slug).
4. **Offline:** `tour-branding.json` es genérico; no es Unisimón.

## Seed Unisimón (contenido, no motor)

`UNISIMON_BRANDING_SEED` en `convex/lib/branding.ts` + `seed:seedPlatform` solo rellena la fila del piloto si falta o si se filtró Orbe. Es **dato del cliente piloto**, no default del engine.

## Residuales OK (contenido / fixtures)

- Markup estático de landing (caso Unisimón) si Convex offline.
- Credenciales / slugs QA (`experienciavirtual`, `admin@unisimon.local`).
- Playwright/QA que **leen** branding Unisimón desde Convex como fixture del piloto.
- Placeholders de ejemplo en org-admin (`#0a7a45`).

## Residuales a no reintroducir

- Early-boot o `bootPilot*` que fuerce verde USB.
- `if (slug === "experienciavirtual")` para paleta en viewer.
- Hardcode de `clientName` / título PEVCI en `index.html`.

Ver también: [39](./39-identidad-orbe-vs-cliente.md) · [40](./40-fix-identidad-separada.md) · [41](./41-landing-orbe-y-cliente-unisimon.md) · [20](./20-fase4-white-label-branding.md).
