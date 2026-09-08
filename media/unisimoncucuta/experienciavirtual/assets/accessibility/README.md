# Paquete de accesibilidad (contenido del tour)

Convenciones **portables** (rutas relativas al root del repo). Sin paths absolutos de Windows.

Un agente TTS o una grabación humana puede soltar archivos en estas rutas **sin cambiar código** si los nombres coinciden.

## Audio (narración)

| Tipo | Ruta canónica | Extensiones |
|------|---------------|-------------|
| Escena | `assets/audio/scenes/{sceneKey}.mp3` | `.mp3` preferido; `.wav` aceptado si se actualiza el paquete |
| Hotspot | `assets/audio/hotspots/{hotspotId}.mp3` | igual |

`sceneKey` = campo `id` estable de la escena (ej. `entrada-principal`), **no** el JPG.

Hasta que exista el archivo, el visor **no finge** audio: status honesto + síntesis de voz solo como fallback etiquetado.

## Transcripciones

| Tipo | Ruta |
|------|------|
| Escena | `assets/transcripts/scenes/{sceneKey}.txt` |
| Hotspot | `assets/transcripts/hotspots/{hotspotId}.txt` |

Regla de publicación: si hay narración, debe haber transcript.

## Captions (VTT)

| Tipo | Ruta |
|------|------|
| Escena | `assets/captions/scenes/{sceneKey}.vtt` |
| Hotspot | `assets/captions/hotspots/{hotspotId}.vtt` |

Pueden ser timed reales o transcript etiquetado en VTT; no inventar timestamps desalineados del audio.

## Guiones (scripts) para TTS / locutor

| Tipo | Ruta |
|------|------|
| Escena | `assets/accessibility/scripts/scenes/{sceneKey}.md` |
| Hotspot | `assets/accessibility/scripts/hotspots/{hotspotId}.md` |

## Timing metadata

| Tipo | Ruta |
|------|------|
| Escena | `assets/accessibility/timing/scenes/{sceneKey}.json` |
| Hotspot | `assets/accessibility/timing/hotspots/{hotspotId}.json` |

Formato mínimo:

```json
{
  "sceneKey": "entrada-principal",
  "locale": "es-CO",
  "durationSec": null,
  "cues": [
    { "startSec": 0, "endSec": 3.5, "text": "…" }
  ],
  "source": "tts-pending|tts|human",
  "audioFile": "assets/audio/scenes/entrada-principal.mp3"
}
```

## Manifest

`assets/accessibility/a11y-package.json` — registro Unisimón:

- **`scopes.fullCampusTts`** — **claim de publicación accesible por defecto** (Phase 9): ~45 escenas TTS + hotspots de tour; sync → Convex → `evaluateTourFromDb`.
- **`scopes.pilotPublishChecklist`** — subset histórico T-P0-8 (referencia / regresión); ya no es el claim por defecto.
- Entradas `scenes` / `hotspots` del JSON = **full campus** (authoring / TTS / offline merge / import).

**Phase 8/9 — fuente única de publicación:** el claim “tour accesible” se evalúa con `evaluateTourFromDb` sobre campos Convex (`srSummary`, `narrationUrl`, …). Este JSON es **input de authoring**: sincronízalo a Convex con `importA11yPackage` / `syncCampusA11yPackage` / seed. No declares ready solo desde el archivo estático. El visor offline Unisimón puede seguir cargando audio desde rutas locales. Stubs `createMissing` no sustituyen la riqueza espacial de Control Web.

El loader (`src/configLoader.js`) aplica este paquete **después** de merges de grafo (fallback offline). Cuando Convex ya tiene URLs a11y, esas ganan. Fuera del piloto, `applyConventionAssetFallbacks` apunta por `id` a las rutas canónicas si existen en disco.

## Drop-in para agente TTS

1. Leer guion en `accessibility/scripts/…/{key}.md`
2. Generar audio → exactamente `audio/scenes/{key}.mp3` (o hotspots)
3. Opcional: regenerar `captions/…/{key}.vtt` y `timing/…/{key}.json` alineados
4. No renombrar keys; reemplazo humano = mismo filename

Legacy (pre-fase 3): `assets/transcripts/*.txt` y `assets/captions/*.vtt` en raíz de carpeta siguen existiendo; el paquete canónico es `…/scenes/` y `…/hotspots/`.  
Legacy TTS: `assets/scripts/` es **mirror**; canónico = `assets/accessibility/scripts/`.
