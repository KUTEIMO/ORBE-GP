# Análisis: vista frontal / facing inicial por escena

Fecha: 2026-09-10. **Solo análisis** — no implementar aún.

Necesidad: al capturar 360, el lente primario a menudo no miraba “hacia delante” del recorrido. Al cambiar de escena, el visor arranca en el centro equirectangular (yaw ≈ 0) o en la última orientación de esa escena, y el salto se siente como reorientación brusca. En **Control Web (modo hotspots)** quieren configurar la **vista frontal** por escena para que el tour se sienta como caminar hacia adelante.

---

## 1. Cómo Marzipano / `viewer.js` fija la vista inicial

En `src/viewer.js` → `createScene()`:

```text
initialView = sceneData.initialView || { yaw: 0, pitch: 0, fov: π/2 }
view = new Marzipano.RectilinearView(initialView, limiter)
```

- La vista se aplica **solo al construir** el `RectilinearView` de cada escena.
- `switchScene()` llama a `marzipanoScene.switchTo({ transitionDuration })` y **no** vuelve a aplicar yaw/pitch/fov.
- Comportamiento efectivo:
  - **Primera visita** a una escena: usa `initialView` (o 0/0).
  - **Revisita**: Marzipano conserva la última orientación de esa escena (no “reset” a frontal).
- No hay lógica de “facing de entrada” según el hotspot nav que originó el salto.

Conclusión: el producto ya tiene el *gancho* conceptual (`initialView`), pero el viewer no lo trata como “frontal al entrar”, ni Convex/Control Web lo editan ni lo publican.

---

## 2. ¿Ya existe yaw / initialView / north / heading / rotation?

| Fuente | ¿Campo de vista frontal? | Notas |
|--------|--------------------------|--------|
| `config.json` → `accessibleScenes[file].initialView` | Sí (piloto estático) | `{ yaw, pitch, fov }` en algunas escenas (p. ej. entrada yaw 0, lobby biblioteca yaw 0.2). |
| `biblioteca-scenes.json` | Sí | Mismo shape `initialView` en muchas escenas. |
| `src/configLoader.js` | Lee `override.initialView` | Lo pasa a `scene.initialView`. **No** lo rellena desde Convex. |
| Convex `scenes` (`schema.ts`) | **No** | Solo metadatos, imagen, a11y URLs. Sin yaw/pitch/fov de vista. |
| `graph:getTourGraph` | **No** | Payload de escena sin `initialView`. |
| `tourAdmin:getAdminSnapshot` / `saveTourSnapshot` | **No** | Snapshot de escenas: título/zona/imagen/hotspots; sin vista. |
| `campusSpatialPackage` / sync espacial | **No** | Solo hotspots yaw/pitch y connections. |
| Control Web `admin.js` | **No** | Editor 360 con yaw de hotspots; presets “Adelante” = yaw `0`. Sin botón de frontal de escena. |
| Hotspots / connections | yaw/pitch | Coordenadas de **posición del hotspot** en el panorama, no “north” del mundo. |
| `north` / `heading` / `rotation` (textura) | **No** | No hay modelo de norte magnético ni rotación UV. |

**Resumen:** el JSON estático ya conoce `initialView`; la fuente viva (Convex) y el editor no. Por eso en tours publicados vía Convex casi siempre se entra a yaw 0 (salvo memoria de visita previa).

---

## 3. Hotspots vs “rotar el frente”

Los hotspots se anclan con Marzipano en **espacio de imagen / esfera equirectangular**:

```text
hotspotContainer().createHotspot(el, { yaw, pitch })
```

Ese yaw es el mismo sistema que `view.yaw()` / `screenToCoordinates`. No es relativo a un “frente lógico” editable.

| Si cambiamos… | ¿Remapear hotspots? |
|---------------|---------------------|
| **Solo look-at al entrar** (opción A) | **No.** El hotspot sigue pegado al mismo punto de la foto. |
| Rotar textura/UV (opción B) | Sí, implícitamente todo se mueve; frágil con tiles, caches y previews. |
| Restar offset a todos los yaw de hotspots (opción C) | Sí, migración masiva + presets + packages espaciales. |

Los presets del editor (`DIRECTION_PRESETS.forward = yaw 0`, etc.) y el enriquecimiento offline de `spatialNav.js` (seq next a yaw 0, prev a π) asumen **convención de captura**: “adelante en el recorrido ≈ centro de la equirectangular”. Eso es independiente de `initialView` mientras los hotspots sigan en coords de imagen.

**Regla recomendada:** hotspots **siempre** en espacio de imagen. La vista frontal solo cambia hacia dónde mira la cámara al entrar; no redefine el origen del panorama.

---

## 4. Modelos evaluados

### Opción A — `initialView` / offset de look-at (recomendada)

- Guardar por escena algo equivalente a lo que ya existe en JSON:  
  `initialView: { yaw: number, pitch?: number, fov?: number }`  
  (alias UX: “vista frontal”; opcionalmente documentar `frontYaw` = `initialView.yaw`).
- Al **entrar** a la escena (no solo al crear el view), aplicar yaw/pitch/(fov).
- Hotspots sin tocar.
- Migración Unisimón: default `0` / omitido = comportamiento actual.

**Pros:** mínimo riesgo, alinea viewer + JSON existente, UX clara en Control Web.  
**Contras:** un solo “frente” por escena no captura entradas laterales (pasillo en T); para eso hace falta fase 2 de transición (abajo).

### Opción B — rotar textura / UV

- Reprocesar o rotar el panorama para que el frente quede en yaw 0.

**Pros:** el centro de la imagen “es” el frente.  
**Contras:** peor para assets ya publicados, File Storage, previews CSS (`--preview-yaw`), regeneración spatial, y no hace falta si A funciona. **No recomendar.**

### Opción C — remapear todos los yaw de hotspots por un offset

- Guardar offset y sumar/restar a cada hotspot (y a `direction` clasificada).

**Pros:** deja yaw 0 = frente y reutiliza presets mentales.  
**Contras:** migración de ~187 hotspots + package espacial + riesgo de desalineación si se aplica dos veces; pelea con Convex SoT. **No como modelo primario.**

### Híbrido útil (fase 2, no bloqueante)

- **A** como default al abrir escena (menú, deep link `?scene=`).
- En navegación por hotspot nav A→B: opcionalmente mirar el **facing de entrada** (hotspot inverso B→A, o yaw del nav de llegada + π). Mejora “caminar hacia el destino” sin remapear hotspots.

---

## 5. UX en Control Web (propuesta)

Contexto: modo **hotspots** (ya hay viewer Marzipano local + `state.view`).

1. Mirar alrededor en el editor 360 de la escena seleccionada.
2. Botón: **“Usar vista actual como frontal”** → guarda `initialView.yaw/pitch` (y opcionalmente fov) en la escena en memoria.
3. Indicador leve: “Frontal: yaw X.XX” + chip o marcador vertical en yaw frontal (opcional).
4. **Guardar** vía `saveTourSnapshot` (mismo flujo que hotspots).
5. Preview: tras guardar, “Probar transición” A→B en el editor o abrir visor público y saltar entre escenas vecinas con offset aplicado.
6. No exigir recalibrar hotspots existentes si ya están bien sobre la foto.

Presets “Adelante / Atrás / …” del editor: **seguir en coords de imagen**. Texto de ayuda: *“Adelante = yaw 0 de la foto; la vista frontal del visitante puede ser otro yaw.”* Evita mezclar “preset de colocación” con “facing de entrada”.

---

## 6. Calidad de transición (fase 2)

Orden sugerido:

| Prioridad | Comportamiento | Efecto |
|-----------|----------------|--------|
| P0 | Al entrar a B sin contexto de origen → `initialView` de B | Menú, URL, primera carga |
| P0 | Reaplicar vista al **cada** `switchScene` cuando no hay override de entrada (o política: “siempre reset a frontal salvo override”) | Evita quedarse en orientación rara de una visita anterior |
| P1 | Si el salto viene de nav A→B, setear vista de B hacia el hotspot (o connection) **B→A** si existe; si no, `initialView` de B | Sensación Street View |
| P2 | Suavizar con transición Marzipano corta ya existente (~90–110 ms); no hace falta tween de yaw en v1 | |

Política de revisita: para tours “caminata”, **sí** conviene reaplicar frontal (o entry facing) en cada entrada; conservar última vista solo en modo exploración libre (futuro toggle). Recomendación v1: **reaplicar** en cada `switchScene`.

---

## 7. Schema, Convex, snapshot, migración

### Campos

En tabla `scenes` (Convex), opcional:

```ts
initialViewYaw: v.optional(v.number()),   // radians, default 0
initialViewPitch: v.optional(v.number()), // default 0
initialViewFov: v.optional(v.number()),   // optional; viewer already has maxFov
```

O un objeto opcional `initialView: v.optional(v.object({ yaw, pitch, fov? }))` — más fiel al JSON actual.

En runtime del viewer (tras merge): `scene.initialView` como hoy.

### Touches necesarios

1. `convex/schema.ts` — campos nuevos (opcionales → sin romper datos).
2. `tourAdmin:saveTourSnapshot` + `scenePatchValidator` — persistir.
3. `tourAdmin:getAdminSnapshot` — devolver al Control Web.
4. `graph:getTourGraph` — incluir en cada escena para el visor público.
5. `configLoader.mergeConvexTourGraph` — copiar a `accessibleScenes[file].initialView`.
6. `control-web/admin.js` — UI + payload de sync.
7. `src/viewer.js` — en `switchScene`, aplicar look-at (y entry override si P1).
8. **No** obligatorio en `campusSpatialPackage` v1: default 0; editores fijan en Control Web. Más adelante se puede enriquecer el embed si se quiere seed reproducible.

### Migración Unisimón

- Escenas existentes: campos ausentes ⇒ yaw/pitch 0 (igual que hoy).
- Opcional: one-shot copiar `initialView` desde `biblioteca-scenes.json` / `config.json` al seed/sync (pocas escenas con yaw ≠ 0; lobby biblioteca ~0.2).
- Sin remap de hotspots.

### Impacto a11y / spatial graph

- Anuncios (`announcer`) no dependen del yaw → riesgo bajo.
- Sync espacial (yaw de hotspots) **no** debe sobrescribir `initialView` al upsert (mismo patrón que preservar a11y URLs en `saveTourSnapshot` / `applySpatialPackage`).
- Cue de dirección y `pickSpatialTarget` siguen en coords de imagen → sin cambio si no se remapean hotspots.

---

## 8. Riesgos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Confundir “preset Adelante (yaw 0)” con “frontal del visitante” | Media | Copy en UI; marcador de frontal distinto del chip nav |
| No reaplicar vista en `switchScene` → feature “invisible” tras primera visita | Alta | Aplicar en cada entrada (política v1) |
| Sync espacial pisa `initialView` | Media | Patch selectivo; no incluir en replace-all de package sin campo |
| Entry facing P1 mal calculado (grafo incompleto) | Baja | Fallback a `initialView` |
| Opción B/C rompe hotspots y packages | Alta | **No hacer** |
| Preview CSS `--preview-yaw` desalineado del frontal | Baja | Usar `initialView.yaw` en crop de preview de lista |

---

## 9. Recomendación

**Implementar Opción A**, reutilizando el nombre `initialView` ya presente en configLoader/viewer/JSON:

1. Persistirlo en Convex + snapshot + `getTourGraph`.
2. Control Web: “Usar vista actual como frontal” + guardar.
3. Viewer: aplicar `initialView` (o override de entrada) en **cada** `switchScene`.
4. Hotspots: **coords de imagen sin remap**.
5. **No** rotar texturas; **no** migración masiva de yaw de hotspots.
6. Fase 2 (mismo epic o siguiente): entry facing desde nav inverso.

**Qué no hacer**

- No rotar UV/textura como solución de producto.
- No restar un offset global a todos los hotspots “para que el frente sea 0”.
- No depender solo del `initialView` del JSON estático cuando Convex es SoT.
- No dejar la aplicación solo en el constructor de Marzipano.

**Esfuerzo:** **M** (schema + 3–4 APIs + admin button + viewer apply + merge + smoke).  
Entry facing P1: **M** adicional o **M+** si se quiere preview de transiciones en admin.

**¿Implementar a continuación?** **Sí.** Encaja con el dolor de Unisimón, el gancho ya existe en el viewer estático, y desbloquea recorridos “tipo caminata” sin tocar el grafo espacial de hotspots. Priorizar P0 (persistencia + apply on switch + UX Control Web) antes de P1 (entry facing).

---

## 10. Checklist de implementación (cuando se autorice)

- [ ] Schema + validators `initialView*`
- [ ] `saveTourSnapshot` / `getAdminSnapshot` / `getTourGraph`
- [ ] Merge en `configLoader`
- [ ] `switchScene` aplica vista (+ política revisita)
- [ ] Botón Control Web + dirty/save
- [ ] Default 0; opcional import desde JSON piloto
- [ ] Preservar campo en sync espacial/a11y
- [ ] QA: entrar por menú, por nav, revisita; hotspots siguen alineados a la foto
- [ ] Doc corta en `05-como-levantar` o CONTROL-WEB (1 párrafo) solo si hace falta para editores
