# 20 — Fase 4: White-label TourBranding (ORBE360)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Separar identidad de plataforma Orbe360 vs identidad visual del tour cliente (`TourBranding`).  
**Estándar:** production-grade local, migration-ready, portable (sin paths Windows).  
**Fuera de alcance:** rediseño Perspektiva/landing, TalkBack profundo, object storage, rewrite Marzipano.

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `NO IMPLEMENTADO` | `NO VERIFICADO`

---

## Resumen ejecutivo

El visor dejó de hardcodear PEVCI/Unisimón en title/meta y CSS base. La identidad institucional Unisimón vive en **datos** (`tourBrandings` + seed + `tour-branding.json` offline). El público recibe branding en `graph:getTourGraph` y el motor aplica CSS variables en runtime. La plataforma (`plataforma/tokens.css`) permanece Orbe360 y **no** se unificó con el verde USB (`#0a7a45`).

> **Corrección 2026-09-29:** los hex de plataforma citados en este doc (`--orbe-green #009b3a`) son
> los de la fecha original y están **retirados**. Acento Orbe vigente: `--orbe-accent #0284c7`
> (`--orbe-green` sobrevive solo como alias de compatibilidad). Fuente única:
> [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md). La **decisión** de fondo
> —plataforma ≠ cliente, no unificar— sigue vigente.

**Veredicto:** white-label **mínimo de arquitectura listo** para piloto multi-cliente. No es un CMS de branding completo ni un desacople total de copy/contenido Unisimón en landing/seed/default slug.

---

## Decisión de color (plataforma ≠ cliente)

| Capa | Token | Hex | Rol |
|------|-------|-----|-----|
| Plataforma Orbe360 | `--orbe-green` | `#009b3a` | Marketing + admin shell |
| Motor viewer (default) | `--brand` | `#2d6a4f` | Chrome neutro hasta TourBranding |
| Cliente Unisimón (DATA) | `primaryColor` | `#0a7a45` | Seed / Convex / fallback JSON |

Orbe green y USB green son **distintos a propósito**. Documentado en `plataforma/tokens.css`, `css/base.css` y `docs/producto/12-design-system-orbe360.md`.

---

## A) Modelo y API

| Ítem | Estado | Notas |
|------|--------|-------|
| Tabla `tourBrandings` | **IMPLEMENTADO** | Índices `by_tour`, `by_org` |
| Campos logo, colores, meta, powered-by, fallback | **IMPLEMENTADO** | Hex validado server-side |
| `graph:getTourGraph` incluye `branding` | **IMPLEMENTADO Y VERIFICADO** | QA |
| `branding:getPublicBranding` | **IMPLEMENTADO Y VERIFICADO** | Solo tours `published` |
| `branding:getBrandingForAdmin` / `saveBranding` | **IMPLEMENTADO Y VERIFICADO** | Authz `userCanEditTour` |
| Seed Unisimón → TourBranding | **IMPLEMENTADO Y VERIFICADO** | También backfill en re-seed |
| `createTour` crea branding default | **IMPLEMENTADO** | Defaults neutros motor |
| Logo en File Storage / CDN | **NO IMPLEMENTADO** | Solo URL string |

---

## B) Viewer / motor

| Ítem | Estado | Notas |
|------|--------|-------|
| `index.html` title/meta neutros Orbe360 | **IMPLEMENTADO Y VERIFICADO** | QA + Playwright |
| CSS base sin “Verde institucional Unisimón” | **IMPLEMENTADO Y VERIFICADO** | |
| `applyTourBranding` → CSS vars + document.title | **IMPLEMENTADO Y VERIFICADO** | Playwright `--brand #0a7a45` |
| Header cliente + Powered by Orbe360 | **IMPLEMENTADO Y VERIFICADO** | |
| Merge Convex branding en `configLoader` | **IMPLEMENTADO** | |
| Fallback `tour-branding.json` offline | **IMPLEMENTADO** | Datos piloto, no motor |
| Contraste AA bajo temas arbitrarios (T-P2-3) | **PARCIAL** | Tokens aplicados; sin auditoría contraste por cliente |
| Empaquetar a11y content junto a branding (T-P2-1) | **PARCIAL** | A11y package ya por tour; no unificado en misma entidad Convex |

---

## C) Plataforma / admin

| Ítem | Estado | Notas |
|------|--------|-------|
| `plataforma/tokens.css` Orbe360 intacto | **IMPLEMENTADO Y VERIFICADO** | |
| Form branding en `org-admin.html` | **IMPLEMENTADO** | Mínimo get/save; no Control Web |
| Landing marketing sin showcase Unisimón | **NO IMPLEMENTADO** (out of scope) | Copy piloto sigue |
| Control Web white-label completo | **NO IMPLEMENTADO** (out of scope) | |

---

## Cómo se verificó

| Suite | Resultado | Cobertura |
|-------|-----------|-----------|
| `npm run qa` | **42 OK · 0 FAIL** | Branding en grafo, authz save, HTML/CSS neutros, tokens Orbe |
| Playwright | **8 passed** | Incluye test TourBranding runtime |
| TalkBack / contraste AA por tema | **NO VERIFICADO** | |

---

## Archivos tocados (principales)

| Área | Archivos |
|------|----------|
| Schema / API | `convex/schema.ts`, `convex/lib/branding.ts`, `convex/branding.ts`, `convex/graph.ts`, `convex/seed.ts`, `convex/organizations.ts` |
| Viewer | `index.html`, `css/base.css`, `css/header.css`, `src/tourBranding.js`, `src/configLoader.js`, `src/main.js`, `tour-branding.json` |
| Plataforma | `plataforma/tokens.css`, `plataforma/org-admin.html`, `docs/producto/12-design-system-orbe360.md` |
| Tests / docs | `scripts/qa-orbe.mjs`, `tests/smoke.spec.js`, este documento |

---

## Acoplamientos residuales a Unisimón

| Ubicación | Estado | Severidad residual |
|-----------|--------|--------------------|
| `orbe-config.js` / `plataforma/config.js` `__ORBE_TOUR_SLUG__ = unisimon-campus` | Default de piloto | P2 — OK local; parametrizar en multi-tenant real |
| `convex/seed.ts` org/tour/passwords Unisimón | Bootstrap piloto | P1 prod secrets (ya documentado Fase 1) |
| `tour-branding.json` contenido Unisimón | Fallback offline del piloto | Esperado; no es hardcode de motor |
| `plataforma/index.html` showcase Unisimón | Marketing piloto → **cerrado en Fase 5** (caso vía demos) | — |
| `control-web` copy PEVCI/USB | Editor → **cerrado en Fase 5** (`--cw-*`, Orbe360 chrome) | — |
| Panoramas / `config.json` / a11y package campus | Contenido del tour piloto | Esperado (contenido ≠ motor) |
| `package.json` name `tour-virtual-accesible` | Naming legado | P3 |

**Motor (viewer shell):** title/meta/CSS comments/USB green hardcode → **retirados**. Identidad USB vía datos → **OK**.

---

## Migration notes

1. DB ya sembrada: re-ejecutar `seed:seedPlatform` como superadmin → crea `tourBrandings` si faltaba.  
2. Tours creados antes de Fase 4 sin branding: `getTourGraph.branding` es `undefined`; viewer usa `tour-branding.json` o chrome neutro. Admin puede `saveBranding`.  
3. Nuevo `createTour`: branding neutro automático.  
4. Portable: URLs relativas / hex; sin paths absolutos Windows.

---

## Qué NO quedó listo

- UI rica de branding (upload logo, preview live, tipografías custom).  
- Neutralizar landing/Control Web copy Unisimón.  
- Multi-slug routing sin `__ORBE_TOUR_SLUG__` default.  
- Auditoría contraste AA automática por tema cliente.  
- Unificar paquete a11y Convex + TourBranding en un solo “tour package” exportable.

---

## Siguiente fase sugerida

Según roadmap doc 15: Quality/ops (CI, ESLint Convex) o media scale; o endurecer white-label en landing/Control Web si el producto prioriza multi-cliente comercial antes que ops.

---

*Fase 4 implementada y verificada en local (QA 42 + Playwright 8).*
