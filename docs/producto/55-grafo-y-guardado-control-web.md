# 55 — Grafo y guardado en Control Web

**Fecha:** 2026-09-14 · **Renumerado:** era `54-grafo-…` (colisión con landing 54); handoff = [56](./56-handoff-conversacion-y-ubicacion.md).  
**Relacionados:** [51](./51-grafo-post-migracion-media.md) · [52](./52-control-web-authz.md) · [53](./53-inventario-fugas-acceso.md) · a11y motor (`14`, `17–19`, `24–27`)

## Problema

1. Con **60+ escenas** (Unisimón) el SVG del grafo era ilegible; con **pocas** (sandbox) el mismo UI debía seguir simple.
2. Cada edición de conexión llamaba `persistGraph()` → **push inmediato a Convex**, sin borrador claro ni protección anti-doble-clic.
3. Riesgo de wipe (doc 51) si se guardaba un grafo vacío.

## Qué cambió

| Área | Comportamiento |
|------|----------------|
| **Authz** | Sin cambio de política: `requireControlWebAccess` (sesión + membership org/tour) sigue bloqueando el editor. Deny UI enfoca el primer enlace (teclado). Ver [52](./52-control-web-authz.md). |
| **Borrador local** | Edits → `persistGraphLocal()` + badge **Cambios sin guardar**. Convex solo con **Guardar cambios** (o Import confirmado). |
| **Guardar** | Anti-spam (`saving`); progreso “Guardando N escenas / M conexiones”; toast/status con conteos; confirma 0 conexiones o Δ grande en tours grandes; `allowEmptyConnections` intacto. |
| **Grafo** | Contador conexiones/huérfanas; filtro zona + buscar; **vecindario** de la escena (auto en ≥16 escenas); resaltar huérfanas; formulario **Conectar** (teclado); confirmar al borrar; lista filtrada al foco. |
| **Autosave** | **No** — explícito Guardar evita wipe accidental. |
| **A11y Control Web** | Labels en toggles/form; `aria-live` dirty/save/status; nodos/aristas focusables + Enter; deny gate focusable. **No** se tocó el viewer público (hotspot panel, transcripts, Escape audio). |

## Cómo probar

### Authz (no regresión)

1. Sin sesión → `/orbe/sandbox/control-web/` → redirect login con `return`.
2. `admin@unisimon.local` → mismo URL → **Acceso denegado** (Tab llega a “Cambiar de cuenta”).
3. `admin@orbe.local` → editor OK.
4. Script: `node scripts/verify-control-web-authz.mjs`

### Pocas escenas (sandbox ~4)

1. Hotspots → conectar con formulario o drag → badge dirty.
2. **Guardar cambios** → mensaje corto con conteos; badge limpio.
3. Export no limpia dirty ni publica solo.

### Muchas escenas (Unisimón ~62 / ~55 aristas)

1. Abrir Control Web → vecindario ON; stats muestran conexiones.
2. Seleccionar escena → solo vecinos en SVG; “Reordenar” / desmarcar vecindario para ver filtrado por zona.
3. Editar un enlace → dirty; **no** cambia Convex hasta Guardar.
4. Guardar → progreso + toast; confirmar si Δ ≥ 20 o si intentas 0 conexiones.
5. Verificar público: grafo Unisimón **no** wipeado (~62/55).

### A11y

- TalkBack en dispositivo: **NO VERIFICADO** en este cambio.
- Manual: Tab por grafo/form/lista; status anunciado al guardar; gate deny operable.

## Inventario fugas

Authz ya cubierta en [53](./53-inventario-fugas-acceso.md) (#3 Fixed). Este doc no abre nuevas superficies admin.
