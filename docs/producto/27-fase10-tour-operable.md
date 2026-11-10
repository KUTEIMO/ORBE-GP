# 27 — Fase 10: Tour operable (spatial + audio)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Hacer navegable el tour Unisimón publicado en Convex (yaw/pitch/nav/connections) sin borrar TTS a11y de Fase 9.  
**Estándar:** production-grade **local**, migration-ready.  
**Prerrequisito:** [25 — Fase 9 campus TTS](./25-fase9-campus-tts-sync.md).

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `PENDIENTE` | `NO VERIFICADO`

---

## Resumen ejecutivo

Fase 9 dejó ~40+ escenas en Convex con metadatos a11y pero **stubs espaciales** (yaw/pitch 0, sin grafo nav rico). El viewer público prioriza Convex y **no** mezcla `tour-graph.json` cuando el grafo Convex carga — y ese JSON estaba vacío; la riqueza real vivía en `biblioteca-scenes.json` + `config.json`.

Fase 10 **sincroniza el grafo espacial** de esas fuentes a Convex, **preserva** `narrationUrl` / transcript / srSummary, y deja un camino visitante operable: navegar campus + reproducir MP3.

**Veredicto:** tour Convex-first **navegable + audio** en local tras sync (**VERIFICADO** en QA/Playwright). TalkBack **NO VERIFICADO**.

---

## Qué se corrigió

| Ítem | Estado | Notas |
|------|--------|-------|
| Embed espacial desde JSON conocidos | **IMPLEMENTADO Y VERIFICADO** | `scripts/gen-campus-spatial-embed.mjs` → `convex/lib/campusSpatialPackage.ts` |
| `applySpatialPackageToTour` | **IMPLEMENTADO Y VERIFICADO** | Upsert escenas/hotspots/conexiones; no pisa a11y |
| `tourAdmin:syncCampusSpatialGraph` | **IMPLEMENTADO Y VERIFICADO** | Authz editor; meta query |
| Seed aplica spatial → luego a11y | **IMPLEMENTADO** | `seed.ts` |
| `saveTourSnapshot` preserva a11y por `clientKey` | **IMPLEMENTADO** | Evita wipe al guardar Control Web |
| Safety viewer si Convex sin nav | **IMPLEMENTADO** | `configLoader` mezcla nav estático solo si Convex trae 0 nav en esa escena |
| Offline JSON fallback | **SIN CAMBIO** | Sigue si Convex falla / draft |
| TTS assets en disco | **INTACTOS** | Solo URLs / metadatos en DB |

### Conteos sincronizados (local, post-sync)

| Métrica | Embed | `getTourGraph` tras sync |
|---------|-------|---------------------------|
| Escenas espaciales | **62** | **81** total en DB (extras = stubs previos no borrados) |
| Hotspots nav | **145** | **~146** |
| Connections | **144** | **144** |
| Escenas con MP3 URL | — | **44** (a11y preservado / re-sync) |
| Escenas con yaw nav ≠ 0 | — | **59** |

---

## Cómo verificar

1. Levantar Convex + web ([05](./05-como-levantar.md)).
2. Como org-admin (o vía `npm run qa`):
   - `tourAdmin:syncCampusSpatialGraph`
   - `accessibilityPublish:syncCampusA11yPackage` (reafirma URLs TTS)
3. Abrir `http://127.0.0.1:8081/?slug=unisimon-campus`
4. Checklist: [26 — QA manual tour+audio](./26-qa-manual-tour-audio.md)
5. Suites: `npm run qa`, `npm run check:a11y`, `npx playwright test`

---

## Flujo de datos

```
config.json + biblioteca-scenes.json (+ tour-graph.json)
        │ gen-campus-spatial-embed
        ▼
campusSpatialPackage.ts ──syncCampusSpatialGraph──► Convex scenes/hotspots/connections
                                                          │
a11y-package / FULL_CAMPUS ──syncCampusA11yPackage─────────┤ (preserva / rellena URLs)
                                                          ▼
                                              graph:getTourGraph (published)
                                                          ▼
                                              configLoader (Convex-first)
```

---

## Suites (local, 2026-09-09)

| Suite | Resultado |
|-------|-----------|
| `npm run qa` | **74 OK · 0 FAIL** (Phase 10 spatial incluido) |
| `npm run check:a11y` | Package ready YES; disco **45/45** + **6/6** |
| Playwright | **14 passed** |

---

## Gaps residuales

1. **NVDA / TalkBack:** **NO VERIFICADO**.
2. `tour-graph.json` en repo sigue vacío — bootstrap espacial = biblioteca+config (+ embed). Control Web puede re-exportarlo.
3. DB puede tener escenas stub extra (>62) de Fase 9 `createMissing`; no se borran automáticamente (seguro). El grafo operable son las 62 espaciales + nav.
4. Locución humana: drop-in en los mismos paths (doc 19).
5. Pretty URL `/tour/{slug}`: fuera de alcance.
6. Mutación spatial es pesada (62 escenas); en deploys muy lentos valorar batch interno futuro.

---

## Archivos tocados

| Área | Archivos |
|------|----------|
| Convex | `lib/campusSpatialPackage.ts`, `lib/applySpatialPackage.ts`, `tourAdmin.ts`, `seed.ts` |
| Viewer | `src/configLoader.js` (safety nav) |
| Scripts | `gen-campus-spatial-embed.mjs`, `qa-orbe.mjs` |
| Docs | este, [26 QA manual](./26-qa-manual-tour-audio.md), [05 levantar](./05-como-levantar.md) |

---

*Fase 10. No se afirma hosting multi-tenant ni verificación AT en dispositivo.*
