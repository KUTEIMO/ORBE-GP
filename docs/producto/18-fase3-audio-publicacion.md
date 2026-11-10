# 18 — Fase 3: Pipeline de audio real + checklist de publicación (ORBE360)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** T-P0-6 (wiring + contenido drop-in) y T-P0-8 (checklist publicación).  
**Estándar:** production-grade local, portable (sin paths absolutos Windows); UI honesta (sin fake audio).

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `NO IMPLEMENTADO` | `NO VERIFICADO`

---

## Resumen ejecutivo

Se dejó listo el **contrato de drop-in** para narraciones reales (TTS o humano) con las mismas keys/filenames, guiones, transcripts, captions y timing metadata. El visor carga rutas canónicas y solo marca “audio listo” si el archivo **reproduce** (`canplay`); si el MP3 aún no existe, el status es honesto. Se añadió checklist de publicación accesible (metadata) en Convex + script local.

**Veredicto:** pipeline y metadata **listos**; lote TTS campus **cableado 1:1** a rutas canónicas. Claim “audio accesible del piloto” depende del checklist piloto (no de las ~45 escenas TTS). Checklist metadata del paquete piloto puede pasar con transcripts/scripts; binarios piloto también presentes tras TTS.

---

## Path conventions (agente TTS / locutor)

| Tipo | Ruta |
|------|------|
| Audio escena | `assets/audio/scenes/{sceneKey}.mp3` |
| Audio hotspot | `assets/audio/hotspots/{hotspotId}.mp3` |
| Transcript escena | `assets/transcripts/scenes/{sceneKey}.txt` |
| Transcript hotspot | `assets/transcripts/hotspots/{hotspotId}.txt` |
| Captions escena | `assets/captions/scenes/{sceneKey}.vtt` |
| Captions hotspot | `assets/captions/hotspots/{hotspotId}.vtt` |
| Guion | `assets/accessibility/scripts/{scenes\|hotspots}/{key}.md` |
| Timing | `assets/accessibility/timing/{scenes\|hotspots}/{key}.json` |
| Manifest | `assets/accessibility/a11y-package.json` |

`sceneKey` = `id` estable (ej. `entrada-principal`), no el JPG.  
Reemplazo humano = **mismo filename**. Ver `assets/accessibility/README.md`.

**Legacy:** `assets/scripts/...` es mirror del lote TTS; no preferir en wiring nuevo. Ver también `docs/producto/19-tts-accesibilidad.md`.

**Scopes del manifest:** `pilotPublishChecklist` (claim T-P0-8) vs `fullCampusTts` (inventario ~45 escenas + hotspots de tour).

---

## A) T-P0-6 — Audio pipeline

| Ítem | Estado | Notas |
|------|--------|-------|
| Rutas canónicas + guiones | **IMPLEMENTADO** | Paquete Unisimón piloto |
| Transcripts / VTT / timing placeholders | **IMPLEMENTADO** | Listos para alinear a TTS |
| Wiring configLoader | **IMPLEMENTADO** | `mergeA11yPackage` después de merges espaciales |
| UI honesta | **IMPLEMENTADO** | `canplay` / `error`; sin placeholder fingido |
| Binarios MP3 piloto | **IMPLEMENTADO Y VERIFICADO** (paquete) | Escenas + hotspots del `a11y-package` presentes; más escenas TTS por convención de id |
| Convención auto-wire | **IMPLEMENTADO** | Si existe `{sceneKey}.mp3` / `{hotspotId}.mp3`, el loader apunta la ruta canónica |
| Player a nivel escena (T-P1-1) | **NO IMPLEMENTADO** | Sigue panel hotspot; escena usa mismos campos |

---

## B) T-P0-8 — Publish checklist

| Ítem | Estado | Notas |
|------|--------|-------|
| Reglas metadata (srSummary, narración o optional, transcript si audio) | **IMPLEMENTADO** | `src/a11yPublishChecklist.js` + `convex/lib/a11yPublishChecklist.ts` |
| Convex `evaluatePackage` / `saveChecklistSnapshot` / `setTourPublished` | **IMPLEMENTADO** | Authz editor; `requireAccessible` bloquea claim |
| Schema `publishChecklist` + campos a11y en scenes/hotspots | **IMPLEMENTADO** | Migration-ready; seed espacial aún no rellena URLs |
| Script local `npm run check:a11y` | **IMPLEMENTADO** | Inventario binarios + checklist paquete |
| UI admin “Publicar accesible” | **NO IMPLEMENTADO** | API lista; Control Web no cableado |

**Regla de negocio:** publicar el grafo espacial (`published: true`) puede seguir con `forcePublish` / sin `requireAccessible`. El **claim** “tour accesible” exige checklist `ready` + (para demo pública) binarios presentes.

---

## Cómo se verificó

| Suite | Resultado | Cobertura |
|-------|-----------|-----------|
| `npm run check:a11y` | **ready YES**; piloto **10/10** binarios; full TTS **45/45** escenas + **6/6** hotspots tour | Package + fs inventory |
| `npm run qa` | **35 OK · 0 FAIL** | Incluye `accessibilityPublish:evaluatePackage` ready + bloqueo incompleto |
| Playwright (smoke + keyboard) | **7 passed** *(pase previo Fase 3)* | Regresión Escape/lista/toggles |
| TalkBack / NVDA | **NO VERIFICADO** | Fuera de este pase |
| Audio play E2E con MP3 | **PARCIAL** | Binarios en disco; smoke de reproducción manual pendiente |

---

## Archivos tocados (principales)

| Área | Archivos |
|------|----------|
| Assets | `assets/accessibility/**`, `assets/audio/{scenes,hotspots}/`, `assets/transcripts/{scenes,hotspots}/`, `assets/captions/{scenes,hotspots}/` |
| Motor | `src/a11yPaths.js`, `src/a11yPublishChecklist.js`, `src/configLoader.js`, `src/hotspotPanel.js` |
| Config | `config.json`, `assets/accessibility/a11y-package.json` |
| Convex | `convex/schema.ts`, `convex/graph.ts`, `convex/accessibilityPublish.ts`, `convex/lib/a11yPublishChecklist.ts` |
| Scripts | `scripts/check-a11y-publish.mjs`, `package.json` |
| Docs | `docs/producto/18-fase3-audio-publicacion.md` *(este)* |

---

## Gaps residuales

1. ~~Completar transcripts/captions/scripts para el resto de escenas TTS~~ → **hecho** en reconcile TTS (lote completo + timing desde VTT).  
2. Re-validar VTT/timing contra reproducción real (smoke play manual).  
3. Cablear Control Web / org-admin a `setTourPublished` + checklist.  
4. Seed Convex de `srSummary` / `narrationUrl` desde el paquete (hoy dual SoT JSON gana en a11y).  
5. T-P1-1 player de escena; T-P1-3 VTT timed real en UI.  
6. Verificación NVDA/TalkBack (matriz §6 backlog 14).  
7. Limpiar aliases huérfanos en disco (`rampa-pre-biblioteca`, `control-bolsos`) cuando ya no haga falta migración.

---

## Criterios §2 backlog 14 — delta vs Fase 2

| Criterio | Fase 2 | Fase 3 |
|----------|--------|--------|
| Audio real | NO (honest empty) | **PARCIAL↑** (piloto + lote TTS campus; claim AT aún no) |
| Captions/transcript | PARCIAL | **PARCIAL↑** (canónicos + package + TTS batch) |
| Checklist publicación | NO | **IMPLEMENTADO** (metadata + binarios paquete OK; scope piloto ≠ full TTS) |

---

## Conclusión

Fase 3 **no bloquea** en TTS: el drop-in está definido y el motor no miente. Los MP3 del lote Unisimón ya viven en las rutas del README; Unisimón recoge narración por `id` / paquete sin cambiar código. La publicación “accesible” queda gobernada por checklist **piloto**, no por el inventario completo ni por booleanos de marketing solos.

*Fase 3 implementación + auditoría + reconcile TTS. No se afirma verificación AT (NVDA/TalkBack).*

---

## Addendum — reconcile TTS ↔ pipeline (2026-09-09)

**Qué no cuadraba**

| Mismatch | Detalle |
|----------|---------|
| Guiones | TTS escribió `assets/scripts/…`; pipeline/`a11yPaths` esperaban `assets/accessibility/scripts/…` |
| Scope checklist | `check:a11y` solo veía piloto **9** keys; en disco había **~45** escenas TTS |
| Hotspot ids | TTS usó `rampa-pre-biblioteca` / `control-bolsos`; el tour usa `82-rampa` / `78-mostrador` |
| Timing | Solo placeholders piloto; el lote TTS no tenía `timing/*.json` |
| `scriptFile` en config | Apuntaba al path legacy |

**Qué se fijó**

- Copia de guiones TTS → canónico; mirror legacy documentado; `npm run a11y:tts` escribe ambos.
- Alias de assets TTS → ids de tour; sidecars de `82-rampa` alineados al texto TTS; `78-mostrador` materializado desde `control-bolsos`.
- Timing generado desde VTT para todo el lote en disco.
- `a11y-package.json` v2 con `scopes.pilotPublishChecklist` vs `scopes.fullCampusTts`.
- `check:a11y` reporta piloto + inventario full campus.
- Docs 18/19 + READMEs alineados a **una** convención.
- Sin regenerar MP3 (salvo copia de `control-bolsos` → `78-mostrador`).