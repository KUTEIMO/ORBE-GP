# 53 — Inventario de fugas de acceso / aislamiento

**Fecha:** 2026-09-14  
**Alcance:** arco multi-tenant Orbe360 (sandbox, media por tour, Control Web, authz).  
**Conteo:** **8** fugas identificadas en este arco (3 críticas de aislamiento + 5 de authz/admin/API).

Política de producto: el **viewer público** puede quedar abierto; **Control Web**, org-admin y APIs de mutación/snapshot admin **no**.

---

## Tabla

| # | Fuga | Severidad | Status | Fecha / contexto |
|---|------|-----------|--------|------------------|
| 1 | **Tenant bleed media:** `dev-server` servía `config.json` / `panoramas/` del root Unisimón bajo `/orbe/sandbox/` | Crítica | **Fixed** | 2026-09-14 — [49-aislamiento-tour-media-roles.md](./49-aislamiento-tour-media-roles.md); media en `media/{org}/{tour}/` |
| 2 | **Wipe de grafo:** tras migrate media, Control Web arrancaba con `tour-graph` vacío y **Guardar** llamaba `saveTourSnapshot` con 0 aristas → borraba campus Unisimón | Crítica | **Fixed** | 2026-09-14 — [51-grafo-post-migracion-media.md](./51-grafo-post-migracion-media.md); guard `allowEmptyConnections` + replace isolation |
| 3 | **Control Web sin gate de cuenta/org:** UI de modos/panoramas con “Modo lectura” anónimo; otra org veía editor | Crítica | **Fixed** | 2026-09-14 — [52-control-web-authz.md](./52-control-web-authz.md); `auth-gate.js` + `assertTourEditorAccess` |
| 4 | **Admin snapshot/save por slug global:** `orgSlug` opcional → resolución cross-tenant posible si el cliente omitía org | Alta | **Fixed** | 2026-09-14 — `orgSlug` **requerido** en `getAdminSnapshot` / `saveTourSnapshot` / branding admin |
| 5 | **org-admin por URL de org ajena:** HTML del panel cargaba; tours de esa org no, pero superficie confusa | Media | **Fixed** | 2026-09-14 — redirect a org propia + `?deniedOrg=` |
| 6 | **Legacy `findTourByOrgAndSlug` sin `orgSlug`:** resolución global `tours.by_slug` aún existe para compat pública / sync espacial | Media | **Open (residual)** | Callers públicos (`getTourGraph`) OK si published; admin tooling ya exige org. Cerrar legacy en APIs mutadoras restantes (`syncCampusSpatialGraph` slug-only) |
| 7 | **Demo secrets en login:** antes se podían revelar passwords en UI con `?demo=1` | Media | **Fixed** (previo) | Login ya no muestra secretos; docs en `05-como-levantar.md` |
| 8 | **Session en `localStorage`:** XSS en el origin roba token admin | Media (arquitectura) | **Open** | Documentado en `plataforma/convex-client.js`; mitigación futura: IdP + cookie HttpOnly |

---

## Qué **no** cuenta como fuga (intencional)

| Superficie | Por qué |
|------------|---------|
| `graph:getTourGraph` / branding público | Tours **published** para visitantes |
| Motor a11y del viewer (TalkBack, dual-channel, teclado, captions) | Público por diseño; **no** se tocó en el gate de Control Web |
| HTML estático de `control-web/` en disco | OK servir bytes; **JS debe gatear** (ahora lo hace) |
| Superadmin ve todas las orgs en listados | Ops de plataforma; **no** puede `userCanEditTour` |

---

## Authz universal (cualquier usuario nuevo)

```
session token → platformUsers (active)
             → memberships(userId, organizationId)  // orgAdmin | tourEditor
             → tour.organizationId match
```

Creación: `auth:createAdminUser` (superadmin) inserta usuario **y** membership. No hay lista de emails privilegiados en Control Web.

Verificación con tercer usuario: `node scripts/verify-control-web-authz.mjs`.

---

## Relacionados

- [49-aislamiento-tour-media-roles.md](./49-aislamiento-tour-media-roles.md)
- [50-media-por-tour-unisimon.md](./50-media-por-tour-unisimon.md)
- [51-grafo-post-migracion-media.md](./51-grafo-post-migracion-media.md)
- [52-control-web-authz.md](./52-control-web-authz.md)
- [55-grafo-y-guardado-control-web.md](./55-grafo-y-guardado-control-web.md) — borrador local + Guardar explícito (no nueva fuga)
- [16-auditoria-fase1-seguridad.md](./16-auditoria-fase1-seguridad.md)
