# 43 — Auditoría: ¿cada empresa gestiona sus propios tours?

**Fecha:** 2026-09-14  
**Alcance:** read-only (código + docs; sin cambios de producto)  
**Pregunta:** ¿“Cada empresa gestiona sus propios tours” es data-driven o hardcodeado a Unisimón (PEVCI / USB)?

---

## 1. Veredicto

**PARTIAL** — listo para multi-empresa en el **backend de datos y authz**, pero **no listo de punta a punta** sin código: enlaces de UI, defaults de slug, resolución legacy de org, media por `by_slug` global y paquetes campus siguen acoplados al piloto.

| Criterio | Estado |
|---|---|
| Modelo Convex (orgs / memberships / tours) | Data-driven |
| `listTours` / `createTour` / `createOrganization` | Data-driven + authz |
| Org-admin lista tours de **cualquier** org de membership | Data-driven (path + Convex) |
| Routing `/{org}/{tour}/` (dev-server) | Data-driven (genérico) |
| Branding viewer / `TourBranding` | Data-driven (ver doc 42) |
| Enlaces HTML admin / superadmin / landing | Hardcoded Unisimón (residual) |
| Defaults `DEFAULT_*` / `config.js` / Control Web | Hardcoded piloto |
| Media upload por slug | Hardcoded lookup global (`by_slug`) |
| Paquetes espacial / a11y campus | Seed-only Unisimón (engine limitado a ese slug) |
| Onboarding empresa #2 sin tocar código | **Parcial** (API sí; UX y hrefs rotos o engañosos) |

---

## 2. Tabla de capacidades

| Capacidad | Status | Evidencia (archivo) |
|---|---|---|
| Schema multi-tenant (`organizations`, `memberships`, `tours.organizationId`, `by_org_and_slug`) | **data-driven** | `convex/schema.ts` |
| Seed piloto Unisimón (`unisimoncucuta` / `experienciavirtual`, PEVCI branding) | **seed-only** (fixture, no motor) | `convex/seed.ts`, `convex/lib/branding.ts` (`UNISIMON_BRANDING_SEED`) |
| Alias legacy `unisimon-campus` / `unisimon-cucuta` | **hardcoded** (compat piloto) | `src/tourSlug.js`, `convex/lib/tourResolve.ts`, `scripts/dev-server.mjs` (`SLUG_TO_PATH`) |
| `createOrganization` (superadmin) | **data-driven** | `convex/organizations.ts`, `plataforma/superadmin.html` |
| `createTour` (superadmin o `orgAdmin`) | **data-driven** | `convex/organizations.ts` |
| UI crear tour en **org-admin** | **missing** | `plataforma/org-admin.html` (sin `createTour`; solo superadmin) |
| `listTours` scoped por membership / `organizationId` | **data-driven** | `convex/organizations.ts` |
| Org-admin carga tours vía Convex para org del path | **data-driven** | `plataforma/org-admin.html` (`listOrganizations` + `listTours`) |
| Preferencia de tour activo = `experienciavirtual` si existe | **hardcoded** (fallback UX) | `plataforma/org-admin.html` (`DEFAULT_TOUR_SLUG`) |
| Hrefs iniciales nav/CTA org-admin | **hardcoded** | `plataforma/org-admin.html` (`/unisimoncucuta/experienciavirtual/…`) — JS `syncDeepLinks` los corrige al cargar |
| Login redirect → primera org de membership | **data-driven** (fallback piloto) | `plataforma/login.html` (`resolveOrgAdminHome`; fallback `DEFAULT_ORG_SLUG`) |
| Superadmin nav / redirect no-superadmin | **hardcoded** | `plataforma/superadmin.html` (`/unisimoncucuta/org-admin.html`) |
| Superadmin lista tours + `publicTourHref(t.slug)` **sin** `orgSlug` | **hardcoded / roto** para org #2 | `plataforma/superadmin.html` + `src/tourSlug.js` (`defaultOrgForTour` → siempre `unisimoncucuta`) |
| `DEFAULT_ORG_SLUG` / `DEFAULT_TOUR_SLUG` | **hardcoded** piloto | `src/tourSlug.js`, `plataforma/config.js` |
| Path routing viewer / control-web / org-admin | **data-driven** | `scripts/dev-server.mjs` (cualquier slug URL-safe) |
| Inyección path → `window.__ORBE_*_SLUG__` | **data-driven** | `src/tourSlug.js` (`applyPathContextToWindow`) |
| Control Web default si no hay path | **hardcoded** | `control-web/admin.js` (`experienciavirtual` / `unisimoncucuta`) |
| `getTourGraph` / publish público por org+tour | **data-driven** | `convex/graph.ts`, `convex/lib/tourResolve.ts` |
| `findOrganizationBySlug` incluye siempre piloto en candidatos | **hardcoded / riesgo** | `convex/lib/tourResolve.ts` (si el slug pedido no existe, puede devolver Unisimón) |
| Branding create/save/apply | **data-driven** | `convex/branding.ts`, `convex/lib/branding.ts` (`defaultBrandingForTour`), `src/tourBranding.js` |
| Early-boot viewer | **data-driven** (neutro) | `index.html` (gray/ink; no USB) |
| Publish / unpublish + checklist | **data-driven** (por `tourId`) | `convex/accessibilityPublish.ts`; org-admin UI |
| Sync a11y campus embebido | **hardcoded** piloto | `syncCampusA11yPackage` solo si `tour.slug === experienciavirtual` |
| Import `a11y-package.json` / `createMissing` | **hardcoded** parcial | `plataforma/org-admin.html` (`createMissing` / fallback sync solo piloto); `assets/accessibility/a11y-package.json` |
| Paquete espacial campus | **seed-only / hardcoded slug** | `convex/lib/campusSpatialPackage.ts` (`CAMPUS_SPATIAL_TOUR_SLUG`) |
| Media `objectKey` `orgs/{orgId}/tours/{tourId}/…` | **data-driven** | `convex/media.ts` |
| Media resolve tour por `by_slug` global | **hardcoded / frágil** | `convex/media.ts` (no `orgSlug`; colisión multi-org) |
| Authz edición contenido (membership; superadmin no edita) | **data-driven** | `convex/lib/authHelpers.ts` (`userCanEditTour`) |
| Landing marketing caso Unisimón | **hardcoded** (contenido marketing) | `plataforma/index.html` (CTA/hrefs piloto; demos desde Convex si hay red) |
| QA / smoke acoplados a Unisimón | **seed-only** (tests) | `tests/smoke.spec.js`, `scripts/qa-orbe.mjs` |

---

## 3. Qué funciona hoy para empresa #2 **sin** cambios de código

Flujo viable vía **API + path canónico** (superadmin + usuario org):

1. **Superadmin** crea organización (`organizations:createOrganization`) con slug propio.
2. **Superadmin** crea tour en esa org (`organizations:createTour`) → branding neutro automático (`defaultBrandingForTour`).
3. **Superadmin** crea usuario con membership (`auth:createAdminUser`).
4. Ese admin inicia sesión → login resuelve `orgAdminHref(orgs[0].slug)` → `/{su-org}/org-admin.html`.
5. Org-admin lista **solo** tours de esa org (`listTours` + `organizationId`) y puede:
   - editar branding,
   - evaluar checklist / publicar (mutaciones por `tourId`),
   - abrir visor/Control Web **después** de que JS ejecute `syncDeepLinks` con `activeOrgSlug`.
6. Público: `http://127.0.0.1:8081/{orgSlug}/{tourSlug}/` lo sirve el rewrite genérico; grafo/branding salen de Convex si el tour está `published`.
7. Control Web bajo `/{org}/{tour}/control-web/` toma contexto del path (`__ORBE_*`).

**No** hace falta clonar carpetas ni recompilar el viewer para un segundo cliente.

---

## 4. Qué sigue requiriendo código o está hardcodeado

### P0 — rompe o engaña onboarding empresa #2

| Gap | Detalle |
|---|---|
| `defaultOrgForTour` siempre `unisimoncucuta` | Cualquier `publicTourHref(slug)` / `controlWebHref(slug)` sin `orgSlug` apunta al piloto. Superadmin “visor público” de tours ajenos → URL incorrecta. |
| Media por `tours.by_slug` global | `generateUploadUrl` / `attachPanoramaToScene` no usan `(org, tour)`. Dos orgs con el mismo `tourSlug` → ambigüedad / `.unique()` falla. `createTour` solo garantiza unicidad **por org**. |
| `findOrganizationBySlug` candidatos incluyen piloto | Org inexistente o typo puede resolver a Unisimón en lugar de `null`. |
| Superadmin HTML hrefs fijos | Nav y copy enlazan `/unisimoncucuta/…`; redirect de usuario no-superadmin también. |

### P1 — UX / operación multi-empresa incompleta

| Gap | Detalle |
|---|---|
| Org-admin sin UI `createTour` | API lo permite a `orgAdmin`; la UI no. Empresa #2 depende del superadmin para crear tours. |
| Hrefs estáticos Unisimón en org-admin | Flash/incorrecto si JS falla; placeholders `brandSlug=experienciavirtual`. |
| Preferencia `DEFAULT_TOUR_SLUG` al elegir tour activo | Si la org #2 no tiene ese slug, cae a `tours[0]` (OK), pero prioriza piloto cuando hay multi-tour y membership cruzada rara. |
| `plataforma/config.js` inyecta slugs piloto | Contamina páginas sin path context. |
| Control Web defaults piloto | Abrir `/control-web/` sin prefijo → Unisimón. |
| Landing marketing | CTA/caso Unisimón hardcodeado (aceptable como marketing; no como admin multi-tenant). |
| Label superadmin “Slug (global)” | Mentiroso: unicidad es por org. |

### P2 — fixtures piloto (OK como seed; no como engine genérico)

| Gap | Detalle |
|---|---|
| `syncCampusA11yPackage` / spatial package | Solo `experienciavirtual`. Empresa #2 no hereda TTS/grafo campus (correcto como fixture; falta story “tour vacío → editor”). |
| `a11y-package.json` + `createMissing` solo piloto | Org-admin trata Unisimón como caso especial. |
| Alias / `SLUG_TO_PATH` / seed PEVCI | Compat y datos del cliente piloto — no deben generalizarse. |
| QA smoke / `qa-orbe.mjs` | Asumen Unisimón; no validan empresa #2 E2E. |

---

## 5. Fixes recomendados (priorizados)

### P0

1. **`publicTourHref` / `controlWebHref` / `orgAdminHref`:** exigir `orgSlug` cuando el tour no es el piloto; en listados admin pasar siempre `{ tourSlug, orgSlug }` desde Convex (join org o devolver `orgSlug` en `listTours`).
2. **`defaultOrgForTour`:** no devolver siempre Unisimón; o eliminar y fallar explícito sin `orgSlug`.
3. **`media.ts`:** resolver tour por `(organizationId \| orgSlug, tourSlug)` o por `tourId`; dejar de usar solo `by_slug`.
4. **`findOrganizationBySlug`:** candidatos = canonical + legacy **solo** cuando el input es alias legacy; nunca añadir piloto a búsquedas de otros slugs.
5. **Superadmin:** hrefs dinámicos desde `listOrganizations` / org del tour; quitar `/unisimoncucuta/…` hardcode.

### P1

6. Botón **Crear tour** en org-admin (`organizations:createTour`).
7. Quitar hrefs Unisimón del HTML estático de org-admin (vacío / `#` hasta `syncDeepLinks`).
8. `plataforma/config.js`: no fijar `__ORBE_*` a Unisimón; solo path/`applyPathContextToWindow`.
9. Control Web: si no hay path/slug, error claro en lugar de default piloto.
10. Devolver `orgSlug` (o `organization`) en `listTours` para UI.

### P2

11. Documentar/onboard: tour nuevo = vacío; paquetes campus = opt-in piloto.
12. Smoke/QA: caso mínimo org B + tour B + login admin B + control-web path + media upload.
13. Renombrar UI “Slug (global)” → “Slug (único en la org)”.
14. Índice/unique policy: decidir si `tours.slug` es global o solo por org (hoy API = por org; media asume casi-global).

---

## 6. Respuesta directa a las preguntas de búsqueda

| Pregunta | Respuesta |
|---|---|
| ¿Hardcode `unisimon*` / PEVCI / USB en admin? | **Sí residual** en HTML nav/CTA (org-admin, superadmin, landing) y defaults JS; **no** en authz Convex ni listado de tours. |
| ¿Org-admin lista tours de cualquier membership? | **Sí** — data-driven por path `/{org}/org-admin.html` + `listTours({ organizationId })`. No asume Unisimón en la query. |
| ¿Crear 2ª org+tour vía superadmin sin código? | **Casi:** filas Convex + URL pública + org-admin branding/publish **sí**; enlaces superadmin, media por slug, y defaults **requieren cuidado/código**. |
| ¿Seed vs engine? | Unisimón/PEVCI/campus packages = **seed/fixtures**. Motor de routing + branding neutro = multi-tenant. |
| ¿URLs HTML/JS que rompen company #2? | Superadmin `publicTourHref(t.slug)`; defaults `DEFAULT_*`; nav hardcode; media `by_slug`; `findOrganizationBySlug` fallback piloto. |

---

## Relacionados

- [44-fix-multi-empresa-y-branding-tour.md](./44-fix-multi-empresa-y-branding-tour.md) — **fixes aplicados** (P0 + branding)
- [42-branding-multi-empresa-data-driven.md](./42-branding-multi-empresa-data-driven.md) — branding (READY data-driven)
- [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md)
- [32-routing-multi-empresa-url.md](./32-routing-multi-empresa-url.md)
- [34-implementacion-routing-p0.md](./34-implementacion-routing-p0.md)
- [05-como-levantar.md](./05-como-levantar.md) — slugs/credenciales piloto
