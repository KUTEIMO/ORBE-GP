# 23 — Fase 7: Publish UI + multi-tour admin (ORBE360)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** UI de publicar/despublicar en org-admin, checklist a11y real, basics multi-tour admin + deep-link Control Web `?slug=`.  
**Estándar:** production-grade **local**, migration-ready; admin a11y = básico.

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `PENDIENTE` | `NO VERIFICADO`

---

## Resumen ejecutivo

Se cableó la **UI de publicación** en `plataforma/org-admin.html` contra las APIs reales de Fase 3 (`evaluatePackage` / `evaluateTourFromDb` / `setTourPublished`). El checklist muestra **ready YES/NO** y bloqueos reales — no se inventa readiness. Superadmin lista tours con **slug + publicado** y puede crear tours. Control Web ya respetaba `?slug=` vía `orbe-config.js`; org-admin y el header del editor enlazan con slug explícito.

**Veredicto:** publish admin **listo en local** para el piloto; claim “tour accesible” sigue gobernado por checklist (paquete estático o campos Convex), no por marketing.

---

## A) Publish / unpublish (org-admin)

| Ítem | Estado | Notas |
|------|--------|-------|
| Lista de tours de la org (authz Phase 1) | **IMPLEMENTADO** | `organizations:listTours` + token |
| Título, slug, published, link `/?slug=` | **IMPLEMENTADO** | Tabla + badge |
| Publicar / despublicar | **IMPLEMENTADO** | `accessibilityPublish:setTourPublished` |
| Checklist antes/después | **IMPLEMENTADO** | ready YES/NO + blockingIssues |
| Fuente paquete piloto | **IMPLEMENTADO** | Si `a11y-package.json.tourSlug` coincide → `scenesFromA11yPackage` + `evaluatePackage` |
| Fuente Convex DB | **IMPLEMENTADO** | Si no hay paquete → `evaluateTourFromDb` |
| Bloqueo claim a11y incompleto | **IMPLEMENTADO Y VERIFICADO** | QA: requireAccessible + escenas incompletas no cambia `published` |
| Publish espacial sin claim | **IMPLEMENTADO** | Checkbox “Exigir checklist a11y” desmarcado |

**Regla de negocio (sin cambios):**

- `published: true` sin `requireAccessible` = grafo espacial público.
- `requireAccessible: true` = evalúa checklist; si no `ready` y no `forcePublish` → error y **no** publica.
- `setTourPublished` ahora construye escenas desde DB si `requireAccessible` y no se pasan `scenes`.

---

## B) Multi-tour admin

| Ítem | Estado | Notas |
|------|--------|-------|
| Selector tour activo | **IMPLEMENTADO** | Branding + deep-links siguen al slug activo |
| Control Web `?slug=` | **IMPLEMENTADO** | `orbe-config.js` + `controlWebHref()`; header Tour sincronizado |
| Superadmin create org/tour | **IMPLEMENTADO** | Form crear tour + tabla slug/publicado |
| Org-admin `?slug=` preferido | **IMPLEMENTADO** | Prefiere tour de query al cargar |

---

## C) Authz

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Publish solo editores del tour | **IMPLEMENTADO** | `userCanEditTour` en `setTourPublished` / `evaluateTourFromDb` |
| Sin publish cross-org | **IMPLEMENTADO** | Misma guarda; QA token falso + listTours Phase 1 |

---

## Cómo se verifica

| Suite | Resultado |
|-------|-----------|
| `npm run qa` | **62 OK · 0 FAIL** (pase local 2026-09-09) |
| Playwright | **14 passed** (smoke + keyboard; Control Web `?slug=`; org-admin publish markup) |
| `npm run check:a11y` | Sin cambio de contrato (piloto) |

---

## Archivos tocados

| Área | Archivos |
|------|----------|
| Convex | `convex/accessibilityPublish.ts` (DB scenes helper + requireAccessible sin `scenes`) |
| Admin | `plataforma/org-admin.html`, `plataforma/superadmin.html`, `plataforma/admin-shell.css` |
| Routing | `src/tourSlug.js` (`controlWebHref`), `control-web/admin.js`, `control-web/index.html` |
| Checklist | `src/a11yPublishChecklist.js` (`scenesFromA11yPackage`) |
| QA | `scripts/qa-orbe.mjs`, `tests/smoke.spec.js` |
| Docs | `docs/producto/23-fase7-publicacion-admin.md` *(este)* |

---

## Gaps residuales

1. Dual SoT: claim a11y del piloto usa **paquete estático**; campos a11y en Convex seed pueden seguir vacíos → `evaluateTourFromDb` puede ser ready NO mientras el paquete es YES (esperado y etiquetado en UI).
2. No hay UI `forcePublish` en org-admin (solo espacial vs requireAccessible).
3. Pretty URL `/tour/{slug}` sigue pendiente (Fase 6).
4. Admin a11y profundo / NVDA / TalkBack: fuera de alcance.
5. Drafts QA (`qa-pub-*`) quedan en DB despublicados (basura de prueba aceptable en local).
6. Upload logo branding / CMS selector rico: pendiente (doc 22).

---

## Conclusión

Fase 7 cierra el gap “API lista, Control Web no cableado” de doc 18: **org-admin** es el panel de publicación con checklist real. Unisimón piloto permanece operable; multi-tour se administra por slug sin inventar clientes.

*Fase 7 implementación. No se afirma hosting multi-tenant ni verificación AT en dispositivo.*
