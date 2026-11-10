# 51 — Grafo tras migración de media (no re-import manual)

**Fecha:** 2026-09-14  
**Relacionados:** [36](./36-fix-grafo-admin-vs-publico.md) · [37](./37-proteccion-grafo-trabajo-diario.md) · [50](./50-media-por-tour-unisimon.md)  
**Slug:** `unisimoncucuta` / `experienciavirtual`

## Causa raíz

Tras mover Unisimón a `media/unisimoncucuta/experienciavirtual/`, el paquete estático quedó con un **`tour-graph.json` vacío**:

```json
{ "version": 1, "updatedAt": null, "connections": [], "scenes": {} }
```

Eso no es la SoT pública (Convex `connections`), pero sí:

1. **Fallback offline** del viewer si Convex no responde.
2. **Semilla de Control Web** cuando localStorage está vacío o el pull falla.

Secuencia típica del bug:

1. Media migrate mueve/deja el placeholder vacío en el tenant.
2. Control Web arranca con `connections: []` y, con sesión, **Guardar** llama `saveTourSnapshot` con 0 aristas → **borra** el grafo curado en Convex.
3. El tour público deja de mostrar hotspots nav hasta un **Import** manual del backup.

`migratePilotMediaUrls` **no** toca connections (solo reescribe URLs). El wipe venía del snapshot vacío + Guardar, no del rewrite de media.

## Qué se fijó

| Capa | Cambio |
|------|--------|
| `configLoader.mergeTourGraph` | Graph vacío (`0` connections + `scenes: {}`) = **no-op**; no pisa nada |
| Control Web | Elige el grafo más rico entre localStorage y archivo; no aplica `connections: []` de Convex sobre un local curado; **confirma** antes de guardar 0 conexiones |
| `saveTourSnapshot` | Rechaza wipe de connections existentes con snapshot vacío salvo `allowEmptyConnections: true` |
| Static package | `npm run sync:unisimon-graph` escribe `media/…/tour-graph.json` **desde** Convex (offline fallback alineado) |

## SoT (sin cambio de producto)

- **Público:** Convex `connections` → `getTourGraph` nav.
- **Estático `tour-graph.json`:** backup / offline / draft — **nunca** debe ir vacío al tenant tras un migrate.
- **No** ejecutar `syncCampusSpatialGraph` sobre el piloto para “arreglar” esto.

## Operación

```bash
node scripts/backup-unisimon-graph.mjs          # antes de riesgos
npm run sync:unisimon-graph                     # alinea static ← Convex
# Si Convex tiene 0 connections: Import del backup en Control Web + Guardar
```

## Verificación

- Unisimón: ~62 escenas, ~55 connections, branding `#0a7a45`
- Público `/unisimoncucuta/experienciavirtual/` muestra nav sin re-import
- Orbe sandbox: 4 escenas, intacto
- Reabrir Control Web / F5 público: grafo sigue
