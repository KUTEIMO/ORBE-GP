# 49 — Aislamiento tour / media / roles (sandbox Orbe)

**Fecha:** 2026-09-14  
**Severidad:** trust-critical (multi-tenant leak)  
**Alcance:** fijar aislamiento org+tour; **no** aspirar a editor tipo RealVision en este slice.

---

## Qué estaba roto

1. **Routing virtual sin carpeta de media por tour.**  
   `scripts/dev-server.mjs` resolvía `/{org}/{tour}/config.json` y `…/panoramas/*` contra el **root compartido** (`config.json` + `panoramas/` del campus Unisimón ≈ 63 escenas). Abrir `/orbe/sandbox/` o Control Web bajo ese path **listaba el campus entero**.

2. **Merge en lugar de replace.**  
   Viewer (`mergeConvexTourGraph`) y Control Web (`pullConvexSnapshot`) **añadían** escenas Convex encima del JSON estático en lugar de **reemplazar** el set del tour. Aunque Convex devolviera 4 escenas sandbox, la UI seguía mostrando Unisimón.

3. **Authz admin débil en resolución de slug.**  
   `getAdminSnapshot` / `saveTourSnapshot` / branding admin resolvían por `slug` global sin `orgSlug` obligatorio en el cliente. Membresía por org ya existía (`userCanEditTour`), pero el path de edición no pasaba org de forma consistente.

**Honestidad:** el sandbox P1 (iconos / categoría / pulse) **nunca** fue el editor aspiracional. El fallo de aislamiento es más grave: sin control de información por tenant, el resto del producto no es confiable.

---

## Qué se fijó

| Área | Cambio |
|------|--------|
| Dev server | `mapTourRest(org, tour, rest)` → `media/{org}/{tour}/…` primero; piloto puede caer a root; **otros tenants nunca** heredan `panoramas/` ni `config.json` Unisimón |
| Media sandbox | `media/orbe/sandbox/config.json` (4 escenas) + panoramas propios; seed usa `imageUrl` absoluto `/media/orbe/sandbox/panoramas/…` |
| Viewer | Convex graph **reemplaza** `scenes` / `accessibleScenes`; a11y + biblioteca solo en org piloto |
| Control Web | Snapshot Convex **reemplaza** lista; `orgSlug` en queries/mutations; `localStorage` keyed por org+tour; `PANORAMA_BASE` → `/media/{org}/{tour}/panoramas/` |
| Convex | `orgSlug` opcional + guard de pertenencia en snapshot/save/branding |

**No se tocó** el grafo Unisimón (`unisimoncucuta` / `experienciavirtual`): sin sync espacial, sin wipe, sin mutación de seed sobre piloto.

---

## URLs (siguen válidas)

| Superficie | URL |
|------------|-----|
| Sandbox público | http://127.0.0.1:8081/orbe/sandbox/ |
| Control Web sandbox | http://127.0.0.1:8081/orbe/sandbox/control-web/ |
| Org-admin Orbe | http://127.0.0.1:8081/orbe/org-admin.html |
| Piloto (intacto) | http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/ |

Login sandbox: `admin@orbe.local` / `OrbeSandbox2026!` — solo ve/edita tours de org `orbe` (membership).

---

## Gaps que quedan (aspiracional ≠ aislamiento)

- Isolation **verde** ≠ editor completo: P1 = iconos/categorías/pulse; no HUD de capas, paths, world-text, video/iframe.
- Root `/panoramas/` **deprecado** (moved to `media/unisimoncucuta/experienciavirtual/`); ver [50-media-por-tour-unisimon.md](./50-media-por-tour-unisimon.md).
- `findTourByOrgAndSlug` sin `orgSlug` (legacy) aún permite resolución global por slug — clientes nuevos deben **siempre** enviar org.
- Roles finos (tourEditor vs orgAdmin) existen en schema/membership; no hay UI completa de ACL por escena.
- Object storage / CDN por `objectKey` ya modelado en `media.ts`; disco local sigue siendo el transporte del prototipo.

**Siguiente slice (después de isolation green):** endurecer “orgSlug required” en APIs admin, tests de no-leak, y solo entonces ampliar editor P2.

---

## Smoke manual

1. `/orbe/sandbox/` → **4** escenas, media bajo `/media/orbe/sandbox/panoramas/…`.  
2. `/orbe/sandbox/control-web/` (login orbe) → misma lista; no campus Unisimón.  
3. `/unisimoncucuta/experienciavirtual/` → campus completo, branding USB.  
4. `admin@orbe.local` no puede guardar snapshot de `experienciavirtual`.

Relacionados: [48-sandbox-orbe-editor-p1.md](./48-sandbox-orbe-editor-p1.md) · [37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md).
