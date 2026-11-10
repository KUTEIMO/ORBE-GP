# 22 — Estado de producto consolidado (ORBE360, fases 0–9)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Síntesis honesta de lo hecho en auditorías/fases 0–9 y de lo que sigue siendo deuda.  
**Estándar:** production-grade **local**, migration-ready; **no** equivale a “listo para hosting multi-tenant público”.

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `PENDIENTE` | `NO VERIFICADO`

---

## Veredicto en una frase

Orbe360 tiene **motor + authz + grafo publicado + branding + org-admin publish + SoT a11y en Convex (campus TTS sync)** verificados en local; **faltan** IdP/HTTPS, object storage/CDN, CI Linux, pretty URLs, upload logos y verificación AT en dispositivo.

---

## Mapa de fases (evidencia)

| Fase | Doc | Foco | Veredicto |
|------|-----|------|-----------|
| **0** | [15](./15-auditoria-tecnica-fase0.md) | Inventario técnico / roadmap | Baseline; no “cerrado” |
| **1** | [16](./16-auditoria-fase1-seguridad.md) | Security / authz P0 | Controles locales OK; no prod multi-tenant |
| **2** | [17](./17-auditoria-fase2-motor-a11y.md) | Dual SoT + a11y motor P0 | Motor operable; claim a11y incompleto |
| **3** | [18](./18-fase3-audio-publicacion.md) | Audio pipeline + checklist publish | Contrato drop-in + checklist metadata |
| **3b** | [19](./19-tts-accesibilidad.md) | TTS edge-tts piloto | Placeholders temporales cableados |
| **4** | [20](./20-fase4-white-label-branding.md) | TourBranding white-label | Arquitectura mínima lista |
| **5** | [21](./21-fase5-limpieza-y-portabilidad.md) | Chrome Orbe360 + portabilidad docs | Residual chrome limpio |
| **6** | este doc (histórico) + código | Multi-tour `?slug=` | Routing público por slug |
| **7** | [23](./23-fase7-publicacion-admin.md) | Publish UI org-admin | Checklist + publish/unpublish |
| **8** | [24](./24-fase8-a11y-fuente-unica.md) | Publish SoT = Convex DB | Dual SoT de claim cerrado |
| **9** | [25](./25-fase9-campus-tts-sync.md) | Full campus TTS → Convex | Claim campus (no solo piloto 4) |

### Conteos QA históricos (docs previos → este pase)

| Momento | `npm run qa` | Playwright | `check:a11y` |
|---------|--------------|------------|--------------|
| Fase 1 (doc 16) | 33 OK · 0 FAIL | — | — |
| Fase 2 (doc 17) | 33 OK · 0 FAIL | 7 passed | — |
| Fase 3 (doc 18) | 35 OK · 0 FAIL | 7 passed | ready YES (piloto 10/10) |
| Fase 4 (doc 20) | 42 OK · 0 FAIL | 8 passed | — |
| Fase 5 (doc 21) | 48 OK · 0 FAIL | 9 passed | ready YES |
| Fase 6 | 52 OK · 0 FAIL | 12 passed | ready YES (piloto; full TTS disco 45/45) |
| **Fase 9 (este pase)** | **69 OK · 0 FAIL** | **14 passed** | **package + disco ready YES**; **DB ready YES** tras sync (**44** escenas + 6 hotspots) |

---

## A) Seguridad

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| `listTours` con token + scope org | **IMPLEMENTADO Y VERIFICADO** | doc 16; QA authz |
| Upload scoped a tour (`userCanEditTour`) + `objectKey` | **IMPLEMENTADO Y VERIFICADO** | `convex/media.ts` |
| PBKDF2 + migración login | **IMPLEMENTADO Y VERIFICADO** | doc 16 |
| Seed gate (`ALLOW_OPEN_SEED` / secret) | **IMPLEMENTADO Y VERIFICADO** | `convex/seed.ts` |
| Login HTML sin passwords | **IMPLEMENTADO Y VERIFICADO** | doc 16 |
| Rate-limit login | **IMPLEMENTADO Y VERIFICADO** | QA |
| Grafo / demos públicos solo `published` | **IMPLEMENTADO Y VERIFICADO** | `graph:getTourGraph` |
| Sync/import a11y con authz editor | **IMPLEMENTADO Y VERIFICADO** | docs 24–25 |
| Sesión en `localStorage` (XSS = sesión) | **PARCIAL** | Residual documentado Fase 1 |
| IdP / cookies HttpOnly / TLS | **PENDIENTE** | Requiere hosting |
| Rotar passwords seed antes de prod | **PENDIENTE** | En repo a propósito (piloto) |
| Slug global (no `(org, slug)`) | **PARCIAL** | Deuda multi-tenant doc 13/15 |

---

## B) Accesibilidad (visitante)

| Ítem | Estado | Evidencia |
|------|--------|-----------|
| Escape/backdrop detiene audio | **IMPLEMENTADO Y VERIFICADO** | doc 17; Playwright |
| Lista semántica destinos + POI | **IMPLEMENTADO Y VERIFICADO** | doc 17 |
| Labels toggles / `#panorama` region | **IMPLEMENTADO Y VERIFICADO** | doc 17 |
| Audio honesto (sin fake data-URI) | **IMPLEMENTADO Y VERIFICADO** | `resolveNarrationUrl` |
| Paquete a11y + checklist publish | **IMPLEMENTADO Y VERIFICADO** | docs 18, 24–25 |
| TTS campus (edge-tts) en rutas canónicas | **IMPLEMENTADO** | doc 19; placeholders de producto |
| Sync full campus → Convex publish SoT | **IMPLEMENTADO Y VERIFICADO** | doc 25 |
| Locución humana definitiva | **PENDIENTE** | Mismos paths |
| NVDA / TalkBack en dispositivo | **NO VERIFICADO** | docs 17–19, 25 |
| Contraste AA automático por tema cliente | **PARCIAL** | Tokens sí; auditoría por cliente no |
| Admin a11y profunda | **PENDIENTE** | Fuera de política actual |

---

## C) Audio / TTS / publicación

| Ítem | Estado | Notas |
|------|--------|-------|
| Convención paths escenas/hotspots | **IMPLEMENTADO** | docs 18–19 |
| Checklist metadata Convex + script local | **IMPLEMENTADO Y VERIFICADO** | `check:a11y` + `evaluateTourFromDb` |
| UI publish / unpublish en org-admin | **IMPLEMENTADO Y VERIFICADO** | docs 23–24 |
| UI publish en Control Web | **PENDIENTE** | org-admin cubre el claim; Control Web espacial |
| Claim “tour accesible” campus TTS en DB | **IMPLEMENTADO** | Fase 9; AT device no verificado |
| Claim marketing sin AT device | **PARCIAL** | Honest: TTS placeholder + sin TalkBack |

---

## D) White-label / identidad

| Ítem | Estado | Notas |
|------|--------|-------|
| Plataforma Orbe360 ≠ cliente Unisimón | **IMPLEMENTADO Y VERIFICADO** | docs 20–21 |
| `tourBrandings` + `getTourGraph.branding` | **IMPLEMENTADO Y VERIFICADO** | QA / Playwright `--brand` |
| Viewer title/meta/CSS neutros hasta datos | **IMPLEMENTADO Y VERIFICADO** | doc 20 |
| Landing / Control Web chrome Orbe360 | **IMPLEMENTADO Y VERIFICADO** | doc 21 |
| Upload logo / preview live branding | **PENDIENTE** | Solo URL string |
| CMS multi-cliente selector de tour | **PENDIENTE** | — |

---

## E) Multi-tour routing (Fase 6)

| Ítem | Estado | Notas |
|------|--------|-------|
| Resolver tour por `?slug=` | **IMPLEMENTADO Y VERIFICADO** | `orbe-config.js`, `src/tourSlug.js` |
| Fallback `__ORBE_TOUR_SLUG__` / default Unisimón | **IMPLEMENTADO Y VERIFICADO** | Sin query → `unisimon-campus` |
| Landing demos → `/?slug={slug}` | **IMPLEMENTADO Y VERIFICADO** | `plataforma/index.html` |
| Branding + grafo del slug elegido | **IMPLEMENTADO** | vía `getTourGraph` |
| Rechazo slug no publicado / inexistente | **IMPLEMENTADO** | `getTourGraph` null |
| Pretty URL `/tour/{slug}` | **PENDIENTE** | Rewrite hosting futuro |
| Control Web multi-tour UI | **PENDIENTE** | Sigue default inject |

---

## F) Portabilidad / hosting / media

| Ítem | Estado | Notas |
|------|--------|-------|
| Paths relativos; sin Windows absolutos en runtime | **IMPLEMENTADO** | doc 21 |
| `config.local.js.example` + gitignore | **IMPLEMENTADO** | — |
| Docs copia → Linux | **IMPLEMENTADO** | `EJECUCION-Y-DEPLOY.md`, doc 21 |
| Despliegue real Linux / Nginx / TLS | **PENDIENTE** | Fuera de alcance local |
| Object storage (R2/S3/MinIO) | **PENDIENTE** | `objectKey` listo; panoramas ~243 MB en git |
| CDN tiles 360 | **PENDIENTE** | doc 13 |
| CI + ESLint Convex | **PENDIENTE** | Roadmap quality/ops |

---

## Qué sigue necesitando hosting / Linux / object storage

1. **TLS + dominio** y cookies de sesión seguras (o IdP).  
2. **Inyección** de `__CONVEX_URL__` (y opcional rewrite `/tour/{slug}` → `/?slug=`).  
3. **Object storage** para panoramas/audio; vaciar git de binarios pesados.  
4. **CDN** para tiles / thumbs.  
5. **Quitar** `ALLOW_OPEN_SEED`, rotar passwords demo.  
6. **CI** en runner Linux (`qa` + Playwright + `check:a11y`).

El código ya es **copiable** a una carpeta Linux; eso **no** sustituye el checklist de infra anterior.

---

## Fases recomendadas después de esta

1. **Quality/ops:** CI, ESLint Convex, `check:full` en pipeline.  
2. **Media scale:** migrar panoramas a object storage usando `objectKey`.  
3. **Pretty URLs** `/tour/{slug}` en reverse proxy.  
4. **Auth endurecida:** IdP o cookie HttpOnly; rotación secretos.  
5. **Verificación AT** (NVDA/TalkBack) sobre campus publicado.  
6. **Locución humana** drop-in en paths TTS.  
7. **Slug por org** `(organizationId, slug)` si hay multi-tenant comercial real.

---

## Residual gaps (honestos)

- Un solo caso real publicado (Unisimón); no inventar clientes.  
- Dual SoT residual solo para **playback offline**; el **claim de publicación** es Convex (Fase 8).  
- Draft editor (`?draft=1`) sigue localStorage — no es multi-usuario.  
- `package.json` name legado `tour-virtual-accesible` (P3).  
- White-label sin upload de logo ni tipografías custom.  
- Stubs espaciales de sync a11y ≠ riqueza de Control Web (yaw/pitch/nav).

---

## Archivos clave fases 6–9

| Archivo | Rol |
|---------|-----|
| `src/tourSlug.js` / `orbe-config.js` | Routing `?slug=` |
| `plataforma/org-admin.html` | Publish + sync a11y |
| `convex/accessibilityPublish.ts` | SoT DB + sync campus |
| `convex/lib/pilotA11yPackage.ts` | Embed full campus |
| `assets/accessibility/a11y-package.json` | Authoring / TTS input |
| `scripts/gen-pilot-a11y-embed.mjs` | Regenerar embed desde JSON |
| `docs/producto/23`–`25` | Fases 7–9 |

---

*Consolidado fases 0–9. Verificado en local 2026-09-09 (Fase 9): QA **69 OK · 0 FAIL**, Playwright **14 passed**, `check:a11y` **ready YES** (disco 45/45 + 6/6; DB **44** escenas tras sync).*
