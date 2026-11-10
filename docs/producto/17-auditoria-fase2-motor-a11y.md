# 17 — Auditoría Fase 2: Motor hardening + a11y visitante P0 (ORBE360)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Fase 2 del roadmap (docs 15/16) + ítems **T-P0** del backlog 14 (motor/tours).  
**Estándar:** production-grade local, portable a hosting; sin inventar audio; sin rewrite Marzipano/Convex.  
**Regla de negocio:** a11y profunda = tours/visor; admin = básico (no tocado salvo rutas compartidas de cierre/audio).

**Leyenda:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `NO IMPLEMENTADO` | `NO VERIFICADO`

---

## Resumen ejecutivo

Se endureció el merge público (Convex published gana sobre `tour-graph.json` cuando el grafo está disponible; offline/draft Unisimón intacto), se eliminó el N+1 de hotspots en `graph`/`tourAdmin`, y se cerraron los P0 de motor a11y del backlog 14 que bloqueaban claim de recorrido no visual: cierre Escape/backdrop unificado con stop de audio/speech, lista semántica completa, labels en toggles, live regions más quietas, audio honesto (sin placeholder/data-URI fingido), y `#panorama` como `role="region"` en lugar de `application`.

**Veredicto:** el motor ya no miente sobre audio y ya no deja audio fantasma al Escape; el recorrido por lista semántica es operable por teclado. **Aún no** se puede afirmar “tour verdaderamente accesible” (§2 backlog 14): faltan narraciones reales (T-P0-6), NVDA/TalkBack en dispositivo (`NO VERIFICADO`), y checklist de publicación (T-P0-8).

---

## A) Architecture / motor

| Ítem | Estado | Cambio | Evidencia |
|------|--------|--------|-----------|
| Dual SoT público | **IMPLEMENTADO** | Si `getTourGraph` responde, se marca `__convexGraphLoaded` y **no** se sobrescribe con `tour-graph.json`. `?draft=1` / fallo Convex → JSON/localStorage como antes | `src/configLoader.js` |
| Offline Unisimón | **IMPLEMENTADO** (conservado) | Sin Convex URL o grafo vacío → merge estático intacto | mismo archivo |
| N+1 hotspots | **IMPLEMENTADO Y VERIFICADO** (QA graph) | Una query `hotspots.by_tour` + group en memoria en `getTourGraph` y `getAdminSnapshot` | `convex/graph.ts`, `convex/tourAdmin.ts` |
| Índice published | **IMPLEMENTADO** | `tours.by_published`; `listPublishedDemos` lo usa | `convex/schema.ts`, `graph.ts` |
| Solo published en público | **IMPLEMENTADO Y VERIFICADO** | `getTourGraph` sigue retornando `null` si `!published`; demos solo published | QA “Tour público refleja snapshot”; Phase 1 authz intacta |
| Publish mutation / UI | **NO IMPLEMENTADO** | Fuera de este pase (roadmap posterior) | — |

---

## B) Visitor a11y P0 (backlog 14)

| ID | Ítem | Estado | Notas |
|----|------|--------|-------|
| **T-P0-1** | Escape/backdrop → misma ruta que `closePanel` (stop audio/speech) | **IMPLEMENTADO Y VERIFICADO** | `mediaSession.js` + `uiLayers.closeHotspotPanelDom` → `stopActiveMedia()`; cambio de escena también para media y oculta panel. Playwright Escape cierra panel |
| **T-P0-2** | Lista semántica completa (sin `.slice(0,4)`) + POI info | **IMPLEMENTADO Y VERIFICADO** | `main.updateSceneDestinations`; botones nav + “Abrir detalle”; Playwright lista visible con botones |
| **T-P0-3** | Flujo sin depender de foco en panorama | **PARCIAL** | Listas + menú operables; anuncio corto; no se reescribió flujo móvil gestual |
| **T-P0-4** | Restringir `role="application"` | **IMPLEMENTADO Y VERIFICADO** | `#panorama` = `role="region"`; modo accesible refuerza copy hacia listas. Playwright |
| **T-P0-5** | Live region = resumen corto | **IMPLEMENTADO** | Quitado `aria-live` de `#tourApp` y `#sceneZone`; `buildSceneAnnouncement` sin `longDescription`; debounce; menú ya no anuncia duplicado |
| **T-P0-6** | Audios reales del piloto | **PARCIAL / NO IMPLEMENTADO** (contenido) | Código **honesto**: `resolveNarrationUrl` anula `placeholder.mp3` y data-URI fake; UI status dice que no hay archivo; speech = fallback etiquetado. **No** se inventaron MP3 |
| **T-P0-7** | Labels toggles TTS/captions | **IMPLEMENTADO Y VERIFICADO** | `label for=` + `aria-describedby`. Playwright |
| **T-P0-8** | Checklist publicación / metadata | **NO IMPLEMENTADO** | Queda para fase contenido/publicación |

---

## Cómo se verificó

| Suite | Resultado | Cobertura relevante |
|-------|-----------|---------------------|
| `npm run qa` | **33 OK · 0 FAIL** | Login/authz Phase 1, `getTourGraph` público, `listPublishedDemos`, snapshot, media scoped |
| Playwright (smoke + keyboard) | **7 passed** | Landing/tour, admin link oculto, `role=region`, labels toggles, lista destinos, Escape cierra panel |
| TalkBack (Android) | **NO VERIFICADO** | Sin dispositivo en este pase |
| NVDA (Windows) | **NO VERIFICADO** | No ejecutado manualmente en esta sesión |

*Runtime: Convex local `127.0.0.1:3210` + estático `:8081`.*

---

## Archivos tocados

| Área | Archivos |
|------|----------|
| Convex | `convex/schema.ts`, `convex/graph.ts`, `convex/tourAdmin.ts` |
| Motor | `src/configLoader.js`, `src/mediaSession.js` *(nuevo)*, `src/uiLayers.js`, `src/hotspotPanel.js`, `src/main.js`, `src/announcer.js`, `src/viewer.js`, `src/accessibility.js`, `src/menu.js` |
| Shell | `index.html` |
| Tests | `tests/keyboard-navigation.spec.ts` |
| Docs | `docs/producto/17-auditoria-fase2-motor-a11y.md` *(este)* |

---

## Gaps residuales (honestos)

### P0 producto / backlog aún abiertos

1. **T-P0-6 contenido:** grabar/generar narraciones reales + transcripts para escenas clave Biblioteca; hasta entonces el claim “audio accesible” es **no**.  
2. **T-P0-8:** checklist de publicación más allá de booleanos `accessibilityProfile`.  
3. **TalkBack / NVDA:** matriz §6 backlog 14 — **NO VERIFICADO**.

### P1 (siguiente fase natural)

- Player de narración a nivel escena (T-P1-1).  
- VTT timed u honest “transcripción” (T-P1-3).  
- Modelo a11y en Convex (T-P1-7).  
- Menú `role="tree"` incompleto (T-P1-6).  
- Ampliar Playwright stop-speech assertion con mock (hoy Escape + panel hide).

### Riesgos aceptados

- Dual SoT **sigue** para a11y JSON (narration/transcript/caption) hasta modelo Convex.  
- `speechSynthesis` sigue como fallback explícito (no como “audio del tour”).  
- Sesiones `localStorage` / hashing PBKDF2: residuales de Fase 1.  
- Panoramas ~243 MB en git: ops/hosting.

---

## Criterios §2 backlog 14 — scorecard rápido

| Criterio | Estado |
|----------|--------|
| Recorrido no visual completo | **PARCIAL** (listas OK; AT device NO VERIFICADO; sin audio real) |
| Teclado desktop + Escape para audio | **IMPLEMENTADO Y VERIFICADO** (Escape cierra; stop wired) |
| Anuncios limpios | **PARCIAL** (mejorado; sin AT) |
| Audio real | **NO IMPLEMENTADO** (honest empty) |
| Captions/transcript honestos | **PARCIAL** (sin fingir audio; VTT timed sigue P1) |
| Preferencias / nombres accesibles | **IMPLEMENTADO Y VERIFICADO** |
| Fallback noscript | **IMPLEMENTADO** (sin cambio) |
| Branding vs a11y content | **NO IMPLEMENTADO** (white-label Fase C) |

---

## Conclusión

Fase 2 **cumple** el contrato de código: motor endurecido + P0 a11y ejecutables sin fake audio y sin romper Unisimón offline. El producto **no** está listo para marketing “accesible verificado en TalkBack” hasta T-P0-6 contenido + verificación AT (`NO VERIFICADO`).

*Fase 2 implementación + auditoría. No se afirma readiness SaaS ni a11y completa del piloto.*
