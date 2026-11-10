# 48 — Sandbox Orbe + editor P1 (iconos / categorías / pulse)

**Fecha:** 2026-09-14  
**Alcance:** tour **aislado** `orbe` / `sandbox` + slice P1 del gap editor (docs 46–47).  
**No toca** el piloto Unisimón Cúcuta (`unisimoncucuta` / `experienciavirtual`).

---

## Backup Unisimón (antes de sandbox)

| | |
|--|--|
| Archivo | `backups/graph-unisimoncucuta-experienciavirtual-YYYYMMDD.json` |
| Cómo se generó | `node scripts/backup-unisimon-graph.mjs` → `graph:getTourGraph` (HTTP, solo lectura) |
| Contenido | Escenas, hotspots públicos, conexiones, branding (`#0a7a45`) |

**Restaurar (si hiciera falta):** Control Web Unisimón → Importar JSON compatible + **Guardar**, o `tourAdmin:saveTourSnapshot` con escenas/conexiones derivadas del backup.  
**Nunca** uses `tourAdmin:syncCampusSpatialGraph` / “Reset grafo campus” sobre `experienciavirtual` (borra el grafo curado). Ver [37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md).

Re-backup:

```bash
node scripts/backup-unisimon-graph.mjs
```

---

## URLs sandbox (local)

| Superficie | URL |
|------------|-----|
| Tour público | http://127.0.0.1:8081/orbe/sandbox/ |
| Control Web | http://127.0.0.1:8081/orbe/sandbox/control-web/ |
| Org-admin | http://127.0.0.1:8081/orbe/org-admin.html |

Login admin sandbox (solo local / docs): `admin@orbe.local` / `OrbeSandbox2026!`  
(Superadmin sigue siendo `superadmin@orbe360.local`.)

Branding Soft Clay Orbe (`#0284c7`) en `tourBrandings` — permitido **solo** para org slug `orbe`. Unisimón sigue en verde USB.

---

## Seed / re-seed (idempotente)

```bash
node scripts/seed-orbe-sandbox.mjs
```

1. Copia **4** panoramas a `media/orbe/sandbox/panoramas/` (no el campus entero).  
2. Mutación `seedOrbeSandbox:seedOrbeSandbox` (superadmin): org `orbe`, tour `sandbox` publicado, branding Soft Clay, escenas, mini-grafo (3 aristas) + 3 info demos P1.  
3. Verifica conteos Unisimón vs sandbox (Unisimón no se escribe).

---

## Qué configura P1 (editor + viewer)

En Control Web, al crear/editar hotspots:

| Campo | Valores | Persistencia |
|-------|---------|--------------|
| `iconKey` | nav, info, pin, bath, medical, transport, drone, expo, wardrobe | Convex `hotspots` |
| `category` | general, facilities, medical, transport, expo, navigation | chip color |
| `animationPreset` | `none` \| `pulse` | CSS; respeta `prefers-reduced-motion` |

**No incluido (P2+):** HUD de capas, paths/polylines, texto world-space, video/iframe.

Código: `convex/schema.ts`, `src/hotspotIcons.js`, `src/hotspotManager.js`, `css/components/hotspots.css`, `control-web/admin.js`, validators en `tourAdmin` / `graph`.

---

## Confirmación Unisimón

- Org/tour piloto **sin** mutaciones de este seed.  
- Backup + smoke del seed imprimen `unisimonUntouched` (escenas/conexiones/branding).  
- URL pública piloto: http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/

---

## Relacionados

- [05-como-levantar.md](./05-como-levantar.md)  
- [46-gap-editor-tours-inmersivos.md](./46-gap-editor-tours-inmersivos.md) (P1)  
- [32-routing-multi-empresa-url.md](./32-routing-multi-empresa-url.md)  
- [37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md)
