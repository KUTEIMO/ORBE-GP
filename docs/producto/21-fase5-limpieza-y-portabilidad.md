# 21 — Fase 5: Limpieza residual Unisimón + portabilidad

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Neutralizar chrome de producto (landing + Control Web), endurecer regresiones, documentar copia portable a Linux.  
**Estándar:** production-grade local, migration-ready, honest docs.  
**Fuera de alcance:** object storage real, multi-slug routing UI, rewrite Marzipano, a11y profunda adicional, hosting productivo.

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `NO IMPLEMENTADO` | `NO VERIFICADO`

---

## Resumen ejecutivo

Tras el white-label del viewer (Fase 4), quedaba acoplamiento de **producto** a Unisimón/PEVCI en landing y Control Web. Fase 5 separa:

| Capa | Identidad |
|------|-----------|
| Plataforma / editor chrome | **Orbe360** |
| Caso / contenido / TourBranding / seed | **Unisimón** (datos del piloto) |

**Veredicto:** limpieza residual de chrome **lista** para piloto multi-cliente honesto. Unisimón sigue siendo el único caso real publicado; no se inventaron clientes. Portabilidad = docs + config template (sin despliegue real).

---

## A) Residual Unisimón coupling

| Ítem | Estado | Notas |
|------|--------|-------|
| Landing: Unisimón como caso vía `listPublishedDemos` | **IMPLEMENTADO Y VERIFICADO** | Fallback estático honesto si Convex offline |
| Landing: sin “Acceso administrativo” / roles internos | **IMPLEMENTADO Y VERIFICADO** | Footer → “Acceso” |
| Control Web: sin `--usb-*` / header USB-PEVCI | **IMPLEMENTADO Y VERIFICADO** | Tokens `--cw-*`; título Orbe360 Control Web |
| Control Web: nombre de tour desde snapshot | **IMPLEMENTADO** | `applyTourChrome(snap)` tras `getAdminSnapshot` |
| Contenido escena / panoramas / a11y / seed intactos | **IMPLEMENTADO** | No se borró data piloto |
| `__ORBE_TOUR_SLUG__` default + doc override | **IMPLEMENTADO Y VERIFICADO** | `orbe-config.js`, `config.local.js.example` |

### Qué quedó a propósito (datos ≠ chrome)

- Seed Convex Unisimón, `tour-branding.json`, panoramas, paquete a11y campus.
- Default slug `unisimon-campus` para desarrollo local.
- Showcase puede seguir mostrando el campus: es el **caso** publicado.

---

## B) Testing

| Suite | Resultado | Cobertura Phase 5 |
|-------|-----------|-------------------|
| `npm run qa` | **48 OK · 0 FAIL** | Control Web `--cw-*`, landing caso, published-only, slug docs |
| Playwright | **9 passed** | Chrome Control Web, branding CSS `--brand`, landing sin admin interno |
| `npm run check:a11y` | **ready: YES** | Paquete a11y piloto sin regresión |

---

## C) Portable Linux / migration prep (docs + config)

### Checklist copia carpeta → Linux

1. Copiar árbol del repo (sin `node_modules`; sin `config.local.js` con secretos).
2. `npm install`
3. Convex: `npx convex dev` (o deployment cloud) + inyectar `__CONVEX_URL__`.
4. Opcional: copiar `config.local.js.example` → `config.local.js` y cargar **antes** de `orbe-config.js`.
5. `npm start` o Nginx/Caddy sirviendo la raíz con rutas relativas.
6. Sin paths absolutos Windows en código de runtime (ya relative).
7. Media: `objectKey` = `orgs/{organizationId}/tours/{tourId}/panoramas/{fileKey}` — listo para R2/S3/MinIO.
8. Pre-prod: quitar `ALLOW_OPEN_SEED`, rotar passwords seed, TLS.

### Archivos de soporte

| Archivo | Rol |
|---------|-----|
| `config.local.js.example` | Plantilla sin secretos |
| `.gitignore` | `config.local.js`, `plataforma/config.local.js`, `orbe-config.local.js`, `.env*` |
| `docs/EJECUCION-Y-DEPLOY.md` | Flujo local + portable |
| `docs/producto/05-como-levantar.md` | Detalle bootstrap |

### Futuro object storage (no implementado aquí)

Panoramas siguen en `panoramas/` + Convex File Storage. Migración: mapear `objectKey` → bucket CDN; viewer ya tolera `imageUrl` en escenas.

---

## Archivos tocados (principales)

| Área | Archivos |
|------|----------|
| Landing | `plataforma/index.html` |
| Control Web | `control-web/index.html`, `admin.css`, `admin.js` |
| Config | `orbe-config.js`, `plataforma/config.js`, `config.local.js.example` |
| Tests | `scripts/qa-orbe.mjs`, `tests/smoke.spec.js` |
| Docs | este documento, `docs/EJECUCION-Y-DEPLOY.md`, `docs/CONTROL-WEB.md`, design system |

---

## Riesgos residuales

1. **Default slug Unisimón** — OK piloto; multi-tour real necesita inject/UI de selección de tour.
2. **Landing links extras** aún van a `/` (mismo default slug) — sin routing `?slug=` aún.
3. **Passwords seed en repo** — P1 documentado Fase 1; rotar antes de hosting.
4. **Token `localStorage`** — XSS = sesión; sin cambio en Fase 5.
5. **Panoramas ~243 MB en git** — fricción de copia; object storage sigue pendiente.
6. **Control Web sin sesión** muestra slug en eyebrow, no título de org hasta Convex sync.
7. **package.json name** `tour-virtual-accesible` — legado P3.

---

## Qué NO quedó listo

- CMS multi-cliente / selector de tour en Control Web.
- Upload logo branding / preview live.
- CI Linux + ESLint Convex.
- CDN panoramas.
- Contraste AA automático por tema cliente.

---

## Siguiente fase sugerida

Según roadmap doc 15: Quality/ops (CI, ESLint) o media scale (object storage usando `objectKey`), o publish/unpublish UI.

---

*Fase 5 implementada y verificada en local (QA 48 + Playwright 9 + check:a11y ready).*
