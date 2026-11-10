# 19 — TTS de accesibilidad (narraciones temporales Orbe360)

> Generación de audio real (placeholder de producción) + guiones para reemplazo humano.
> Piloto: tour Unisimón Sede 2 / Biblioteca Anita Bolívar de Consuegra.

---

## Decisión de herramienta

| Opción | Calidad | Offline | Costo | Esfuerzo en este PC | Notas |
|---|---|---|---|---|---|
| **edge-tts** (elegida) | Neural alta (Edge) | Online (API gratuita Edge) | $0, sin cuenta | `pip install edge-tts` | Voces `es-CO-*` nativas Colombia |
| Windows SAPI | Baja–media | Offline | $0 | Nativo | Robótica; peor para demo a11y |
| Azure Speech | Neural alta | Online | Cuenta + cuota | Media | Requiere suscripción |
| Google / Amazon TTS | Neural alta | Online | Cuenta | Media | Misma barrera de cuenta |
| `speechSynthesis` browser | Variable | Offline | $0 | Ya en motor | No produce archivos multimedia |

**Elección:** `edge-tts` + voz **`es-CO-SalomeNeural`** (español Colombia, femenina).

**Por qué:**

1. Calidad neural usable en demos de accesibilidad.
2. Sin API key ni cuenta de pago.
3. CLI/API Python con **SentenceBoundary** → subtítulos con tiempos reales.
4. Voz colombiana alineada al campus Unisimón (Barranquilla).

**Rate por defecto:** `-5%` (un poco más lento, mejor comprensión).

**Licencia / uso:** el paquete `edge-tts` es open source; las voces se sirven vía el endpoint gratuito de Microsoft Edge. Tratar el audio como **placeholder temporal de producto**. Para publicación institucional definitiva, reemplazar por locución humana (mismos paths / mismos guiones). Revisar política interna de la universidad si el TTS de Edge se puede usar en demos públicas.

---

## Convención de rutas (Phase 3 / pipeline)

**Una sola convención canónica** (alineada con `docs/producto/18-fase3-audio-publicacion.md` y `assets/accessibility/README.md`):

```text
assets/audio/scenes/{sceneKey}.mp3
assets/transcripts/scenes/{sceneKey}.txt
assets/captions/scenes/{sceneKey}.vtt
assets/accessibility/scripts/scenes/{sceneKey}.md
assets/accessibility/timing/scenes/{sceneKey}.json

assets/audio/hotspots/{hotspotId}.mp3
assets/transcripts/hotspots/{hotspotId}.txt
assets/captions/hotspots/{hotspotId}.vtt
assets/accessibility/scripts/hotspots/{hotspotId}.md
assets/accessibility/timing/hotspots/{hotspotId}.json
```

- `{sceneKey}` / `{hotspotId}` = `id` estable del tour (`entrada-principal`, `82-rampa`, `78-mostrador`, …), no el JPG.
- Los `.md` son el **guion** para talento humano.
- Los `.vtt` se generan desde boundaries reales de edge-tts (no timestamps inventados), salvo `--dry-run`.
- **Legacy mirror:** `assets/scripts/...` puede existir como copia del lote TTS; no usarla en wiring nuevo. `npm run a11y:tts` escribe canónico + mirror.

---

## Lote generado (primer batch)

**Escenas campus (ruta por defecto + zonas clave):** entrada, hall, cafetería (entrada/mesas/caseta), cultural (acceso/interior), patio (cancha/rampa), salida Av. 3.

**Escenas biblioteca:** todas las de `biblioteca-scenes.json` (~34).

**Hotspots POI (ids de tour):** `punto-informacion`, `acceso-accesible`, `mostrador-prestamo`, `zona-estudio`, `82-rampa`, `78-mostrador`.

Aliases TTS legacy (mismos bytes / no cablear): `rampa-pre-biblioteca` → `82-rampa`, `control-bolsos` → `78-mostrador`.

Estilo de texto: orientación accesible en español (qué espacio es, dónde estás, puntos de interés, cómo seguir sin panorama). No marketing turístico.

**Scopes en `a11y-package.json`:**
- `scopes.pilotPublishChecklist` — 4 escenas canónicas (+ alias lobby) + hotspots piloto → `npm run check:a11y` claim metadata.
- `scopes.fullCampusTts` — inventario completo en disco (~45 escenas + hotspots de tour).

---

## Regenerar

Requisito: Python 3.10+ y red (edge-tts consulta el servicio Edge).

```bash
python -m pip install -r scripts/requirements-a11y-tts.txt
npm run a11y:tts
```

Equivalente directo:

```bash
python scripts/generate-a11y-tts.py
```

Opciones útiles:

```bash
python scripts/generate-a11y-tts.py --only entrada-principal,biblioteca-lobby
python scripts/generate-a11y-tts.py --voice es-MX-DaliaNeural
python scripts/generate-a11y-tts.py --dry-run   # guiones + VTT estimado, sin MP3
python scripts/generate-a11y-tts.py --skip-config-patch
```

Salida de inventario: `scripts/a11y-tts-manifest.json`.

El script también actualiza referencias `narration` / `transcript` / `captionFile` / `scriptFile` en `config.json` y `biblioteca-scenes.json` (salvo `--skip-config-patch`).

---

## Wiring en el motor

`src/configLoader.js` ya descarta `assets/audio/placeholder.mp3`. Los paths reales bajo `assets/audio/scenes|hotspots/` pasan `resolveNarrationUrl` y se pueden reproducir en el panel.

Tras regenerar TTS, recargar el tour (`npm start`) y probar play en escena/hotspot con captions.

---

## Reemplazo por voz humana (más adelante)

1. Abrir `assets/accessibility/scripts/scenes/{sceneKey}.md` (o hotspot).
2. Grabar leyendo el bloque «Texto para leer».
3. Exportar MP3 y sobrescribir `assets/audio/.../{key}.mp3`.
4. Opcional: rehacer `.vtt` / `timing` con tiempos de la grabación real; el `.txt` suele mantenerse.
5. No hace falta cambiar el código si se conserva el mismo nombre de archivo.
