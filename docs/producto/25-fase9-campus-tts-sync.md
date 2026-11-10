# 25 — Fase 9: Sync full campus TTS → Convex (publish claim)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Expandir el claim de publicación accesible del subset piloto (4 escenas + 6 hotspots) al **lote TTS campus completo** sincronizado en Convex.  
**Estándar:** production-grade **local**, migration-ready (URLs en DB).  
**Prerrequisito:** [24 — Fase 8 fuente única](./24-fase8-a11y-fuente-unica.md) (publish gate = `evaluateTourFromDb`).

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `PENDIENTE` | `NO VERIFICADO`

---

## Resumen ejecutivo

Tras Fase 8, el SoT de publicación ya era Convex, pero el sync/embed solo cubría el piloto T-P0-8. Fase 9 hace que **`scopes.fullCampusTts`** (45 keys en disco / **44 fileKeys canónicos** + 6 hotspots de tour) sea el paquete por defecto que seed, `syncCampusA11yPackage` y org-admin importan a Convex — de modo que `evaluateTourFromDb` puede dar **ready YES** para el claim campus real, no solo 9/10 keys piloto.

**Veredicto:** claim campus TTS **cableado en DB local** tras sync; TalkBack/NVDA siguen **NO VERIFICADO**; locución humana = mismos paths.

---

## Conteos

| Capa | Escenas | Hotspots | Notas |
|------|---------|----------|-------|
| Disco TTS (`assets/audio/scenes`) | 45 | 8 en disco / 6 tour | Incluye alias `biblioteca-principal` |
| `a11y-package.json` `scenes` (sync) | 45 keys / **44** sin `aliasOf` | 6 | Alias lobby no crea segunda escena |
| Embed `FULL_CAMPUS_A11Y_PACKAGE` | 44 | 6 | `node scripts/gen-pilot-a11y-embed.mjs` |
| Convex tras sync (`evaluateTourFromDb`) | ≥40 tracked | 6 info OK | Stubs OK si faltaba grafo espacial |

---

## Cómo funciona

```
a11y-package.json (fullCampus) ──sync/import/seed──► Convex a11y fields
        │                                                  │
        │ check:a11y / TTS / offline merge                 │ evaluateTourFromDb
        ▼                                                  ▼
   disk MP3/VTT/txt                               publishChecklist snapshot
```

| Ítem | Estado | Notas |
|------|--------|-------|
| Package `scenes` = full campus | **IMPLEMENTADO** | v3; `publishClaimDefault: true` en scope |
| `syncCampusA11yPackage` | **IMPLEMENTADO** | Authz editor; `createMissing` stubs |
| `syncPilotA11yPackage` | **IMPLEMENTADO** | Alias → full campus (compat) |
| Seed aplica full campus | **IMPLEMENTADO** | `FULL_CAMPUS_A11Y_PACKAGE` |
| org-admin Sync | **IMPLEMENTADO** | Fetch JSON completo; fallback `syncCampusA11yPackage` |
| Publish gate = DB only | **SIN CAMBIO** | Fase 8 intacta |
| No borra TTS en disco | **IMPLEMENTADO** | Solo URLs en DB |
| Offline viewer merge | **SIN CAMBIO** | Fallback local intacto |

---

## Stubs espaciales

`createMissing` inserta escenas mínimas (`images/{fileKey}`, yaw/pitch 0 en hotspots). **Control Web** sigue siendo dueño de yaw/pitch/nav/links ricos. Los stubs sirven para que el claim a11y no dependa de haber importado el grafo completo antes.

---

## Cómo se verifica

| Suite | Resultado |
|-------|-----------|
| `npm run qa` | **69 OK · 0 FAIL** — sync campus 44/6 ready YES; DB SoT YES |
| Playwright | **14 passed** |
| `npm run check:a11y` | Package ready YES; disco **45/45** + **6/6** |

---

## Gaps residuales

1. **NVDA / TalkBack:** **NO VERIFICADO** en dispositivo.  
2. **Locución humana:** pendiente; reemplazo drop-in en los mismos filenames (doc 19).  
3. Stubs ≠ tour espacial completo — regenerar/enriquecer desde Control Web.  
4. Pretty URL `/tour/{slug}`, upload logos, IdP/HTTPS: fuera de alcance (doc 22).  
5. Regenerar embed si editas el JSON: `node scripts/gen-pilot-a11y-embed.mjs`.

---

## Archivos tocados

| Área | Archivos |
|------|----------|
| Package | `assets/accessibility/a11y-package.json`, `README.md` |
| Convex | `lib/pilotA11yPackage.ts`, `lib/applyA11yPackage.ts`, `accessibilityPublish.ts`, `seed.ts` |
| Admin | `plataforma/org-admin.html` |
| Scripts | `gen-pilot-a11y-embed.mjs`, `qa-orbe.mjs`, `check-a11y-publish.mjs` |
| Docs | este + [22 consolidado](./22-estado-producto-consolidado.md) |

---

*Fase 9 implementación. No se afirma hosting multi-tenant ni verificación AT en dispositivo.*
