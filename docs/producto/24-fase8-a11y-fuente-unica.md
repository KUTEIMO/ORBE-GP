# 24 — Fase 8: Fuente única de accesibilidad (publish SoT)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Unificar dual SoT residual de Fase 7 — checklist de publicación canónico = campos a11y en Convex.  
**Estándar:** production-grade **local**, migration-ready (URLs en DB; object storage después solo cambia URLs).

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `PENDIENTE` | `NO VERIFICADO`

---

## Resumen ejecutivo

El claim “tour accesible” ya **no** se declara ready solo desde `assets/accessibility/a11y-package.json`. La fuente canónica es **`evaluateTourFromDb`**: escenas/hotspots en Convex con `srSummary`, `narrationUrl`, `transcriptUrl`, `captionUrl`, `timingUrl`, `narrationOptional`. El JSON estático queda como **input de authoring/TTS** → import/sync a Convex. El visor Unisimón offline sigue pudiendo mergear el paquete local sin romper fallback.

**Veredicto:** dual SoT de publicación **cerrado** en local para el piloto tras sync/seed.

---

## Cómo funciona el SoT (Phase 8)

```
a11y-package.json  ──(import/sync/seed)──►  Convex scenes/hotspots a11y fields
        │                                              │
        │ authoring / TTS / check:a11y                 │ evaluateTourFromDb
        │ offline merge (viewer)                       │ setTourPublished(requireAccessible)
        ▼                                              ▼
   disk binaries                               publishChecklist snapshot
```

| Rol | Artefacto | ¿Declara ready de publicación? |
|-----|-----------|--------------------------------|
| Authoring / TTS pipeline | `a11y-package.json` + assets en disco | **No** (solo input) |
| Publish gate | Campos Convex + `evaluateTourFromDb` | **Sí** |
| Snapshot | `tour.accessibilityProfile.publishChecklist` | Derivado del eval DB |
| Viewer offline | merge paquete / rutas locales | Playback; no es el gate admin |

**Alcance del checklist en DB:** solo escenas **con metadata a11y** (piloto tras sync). Escenas espaciales sin campos a11y no entran al claim (no se inventa ready ni se exige el campus completo).

---

## A) Sync / import

| Ítem | Estado | Notas |
|------|--------|-------|
| `importA11yPackage` (authz editor) | **IMPLEMENTADO** | Match `fileKey` / `clientKey`; salta `aliasOf` |
| `syncPilotA11yPackage` (Unisimón) | **IMPLEMENTADO** | Embed + `createMissing` stubs si faltan escenas |
| Seed aplica piloto si hay escenas | **IMPLEMENTADO** | `seedPlatform` best-effort + createMissing |
| org-admin “Sincronizar paquete → Convex” | **IMPLEMENTADO** | Fetch JSON → `importA11yPackage` (`createMissing` en piloto) |
| No borra TTS en disco | **IMPLEMENTADO** | Solo escribe URLs en DB |

---

## B) Publish gate (org-admin)

| Ítem | Estado | Notas |
|------|--------|-------|
| Evaluar = `evaluateTourFromDb` | **IMPLEMENTADO** | Ya no prefiere paquete estático |
| `setTourPublished` + `requireAccessible` | **IMPLEMENTADO** | Siempre evalúa DB; `scenes` client **ignorado** |
| Publish espacial sin claim | **IMPLEMENTADO** | Checkbox desmarcado / `forcePublish` |
| Snapshot al publicar / sync | **IMPLEMENTADO** | `publishChecklist` en tour |

---

## C) Viewer / graph

| Ítem | Estado | Notas |
|------|--------|-------|
| `getTourGraph` expone a11y | **IMPLEMENTADO** | Ya mapeaba `narrationUrl` → `narration`, etc. |
| Offline Unisimón | **SIN CAMBIO** | `mergeA11yPackage` + rutas locales intactos |
| Migration object storage | **LISTO** | Cambiar URLs en Convex; checklist igual |

---

## Cómo se verifica

| Suite | Resultado |
|-------|-----------|
| `npm run qa` | Phase 8: sync + DB/package ready YES + SoT ignora scenes client |
| Playwright | org-admin markup: sync + `evaluateTourFromDb` |
| `npm run check:a11y` | Inventario disco / paquete (authoring); no sustituye SoT Convex |

---

## Archivos tocados

| Área | Archivos |
|------|----------|
| Convex | `accessibilityPublish.ts`, `seed.ts`, `lib/pilotA11yPackage.ts`, `lib/applyA11yPackage.ts` |
| Admin | `plataforma/org-admin.html` |
| Checklist JS | `src/a11yPublishChecklist.js` (comentario rol package) |
| Assets docs | `a11y-package.json` notes, `assets/accessibility/README.md` |
| QA | `scripts/qa-orbe.mjs`, `tests/smoke.spec.js` |
| Docs | `docs/producto/24-fase8-a11y-fuente-unica.md` *(este)* |

---

## Gaps residuales

1. `pilotA11yPackage.ts` es mirror del JSON piloto — si editas el JSON, re-sync o actualiza el embed para seed offline.
2. `syncPilot` / import con `createMissing` crea stubs espaciales mínimos (`images/{fileKey}`); Control Web sigue siendo la fuente rica de yaw/pitch/nav.
3. Claim piloto histórico ≠ full campus — **cerrado en Fase 9** (sync full campus).
4. Pretty URL `/tour/{slug}` (Fase 6) y upload logos (doc 22) fuera de alcance.
5. NVDA / TalkBack: **NO VERIFICADO**.
6. Escenas QA residuales en DB local no afectan el claim (solo escenas con metadata a11y).

---

## Conclusión

Fase 8 cierra el residual de Fase 7: **una** fuente de verdad para el claim de publicación accesible (Convex). El paquete estático permanece útil para TTS, `check:a11y` y fallback offline, pero ya no puede mentir al admin con ready YES mientras la DB está vacía.

*Fase 8 implementación. No se afirma hosting multi-tenant ni verificación AT en dispositivo.*
