# Vista frontal / Adelante por escena

Fecha: 2026-09-10. Implementación Option A (ver [29-analisis-vista-frontal-escena.md](./29-analisis-vista-frontal-escena.md)).

## Qué resuelve

Si la captura 360 no miraba “hacia delante” del recorrido, el pad ATRÁS/ADELANTE y la entrada a la escena quedan desfasados. Cada escena puede guardar una **vista principal** (`initialView`) que el visitante ve al entrar y que el pad usa como referencia de **Adelante**.

## Cómo usarlo (Control Web)

1. Inicia sesión como **org-admin / tour editor** (no superadmin).
2. Abre Control Web → modo **Editar hotspots** → elige la escena.
3. Gira el 360 hasta el encuadre frontal deseado (p. ej. hall / BLOQUE B).
4. Pulsa **“Usar vista actual como Adelante”**.
5. Comprueba que el pad marca **Adelante** en ese encuadre; **Atrás/Izq/Der** saltan relativos a ese frente.
6. **Aplicar y guardar escena** o **Guardar cambios** (persiste en Convex).
7. Recarga el tour público (F5): al entrar/reentrar a esa escena, la cámara mira ese frente.

Los hotspots **no se remapean**: sus yaw/pitch siguen en coordenadas de imagen. Solo cambia el look-at de entrada y la brújula del editor.

## Datos

- Convex `scenes.initialView`: `{ yaw, pitch, fov? }` (radianes). Ausente ⇒ `{0, 0, π/2}`.
- Publicado en `graph:getTourGraph`, snapshot admin y `saveTourSnapshot`.
- Viewer: `switchScene` reaplica `initialView` en **cada** entrada.
- Sync espacial / a11y no pisan `initialView` ni URLs a11y al guardar.