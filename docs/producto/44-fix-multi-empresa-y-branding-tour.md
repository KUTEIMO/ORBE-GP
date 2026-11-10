# 44 — Fix multi-empresa P0 + branding tour público

**Fecha:** 2026-09-14  
**Relacionados:** [43 auditoría](./43-auditoria-gestion-multi-empresa.md) · [42 branding data-driven](./42-branding-multi-empresa-data-driven.md) · [39 identidad](./39-identidad-orbe-vs-cliente.md)

---

## Problema

1. Tour público Unisimón (`/unisimoncucuta/experienciavirtual/`) se *sentía* Orbe otra vez (chrome / FOUC / branding no pintado a tiempo).
2. Auditoría 43: hrefs y defaults multi-empresa seguían cayendo a `unisimoncucuta`.
3. Org-admin mostraba “Organización activa” en blanco y header solo “ORBE360” al gestionar Unisimón.

## Root cause — Orbe en el tour público

| Causa | Detalle |
|---|---|
| Branding Convex llega tarde | Early-boot neutro (`#4b5563`) + “Powered by Orbe360” / botón ORB visibles **antes** de `TourBranding` → sensación de producto Orbe. |
| Apply no agresivo | `applyTourBranding` solo al final de `loadConfig`; no se re-pintaba al recibir el grafo. |
| Soft Clay **no** se importaba en el viewer | Confirmado: `index.html` no carga `plataforma/tokens.css`. El bug no era CSS Soft Clay en el tour. |
| Seed / drift | Si `primaryColor` en Convex no era `#0a7a45`, el piloto no se veía USB green. Seed ahora repara drift del piloto. |

**Contrato correcto:**

- Plataforma / org-admin / Control Web → chrome Orbe Soft Clay (`#0284c7`) — OK SaaS.
- Viewer `/{org}/{tour}/` → **solo** `TourBranding` del cliente (`#0a7a45` Unisimón seed). Orbe = “Powered by” sutil.

## Fixes P0 (doc 43)

1. **`publicTourHref` / `controlWebHref` / `orgAdminHref`** — `orgSlug` obligatorio; sin fallback a `unisimoncucuta`.
2. **`media.ts`** — resuelve tour por `(organizationId | orgSlug) + tourSlug` (`by_org_and_slug`), no `by_slug` global.
3. **`findOrganizationBySlug`** — candidatos = input + canonicalize; **nunca** añade piloto si el slug pedido no existe.
4. **Superadmin / org-admin** — hrefs dinámicos desde path/API; HTML sin `/unisimoncucuta/…` hardcode.
5. **`listTours`** — devuelve `orgSlug` para armar URLs en UI.

## Org-admin UX

- Header: `ORBE360 · {nombre de org}` (SaaS claro: estás en Orbe gestionando al cliente).
- `[hidden] { display: none !important }` — `.field { display: grid }` ya no deja visible el select vacío.
- Select de org siempre poblado; visible solo si hay 2+ orgs.
- Deep-links Ver tour / Control Web desde tour activo + `activeOrgSlug`.

## Verificación

| Check | Esperado |
|---|---|
| Playwright `TourBranding…` | `--brand` ≈ `#0a7a45`, no `#0284c7`; cliente visible; powered-by menor |
| Playwright `publicTourHref…` | sin `orgSlug` lanza; org ajena sin `unisimoncucuta` |
| Playwright viewer tokens | no carga `/plataforma/tokens.css`; `--orbe-accent` vacío |
| QA `qa-orbe.mjs` | helpers exigiendo `orgSlug` |
| Seed re-run | piloto `primaryColor` = `#0a7a45` sin tocar grafo espacial |

## No tocado

- Grafo espacial / conexiones / hotspots (sin wipe).
- Soft Clay de plataforma (intencional en admin).
- Paquetes campus a11y/espacial (siguen opt-in piloto).
