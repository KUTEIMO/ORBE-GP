# Hotspots UX, roles y limpieza QA

Fecha: 2026-09-10. Corrige hallazgos tras grabación de pantalla del editor/visor (cue de dirección + doble clic tras borrar conexiones; chips de hotspot; separación Superadmin vs Admin de tour).

## 1. Causa raíz: navegación fantasma tras borrar conexiones

El admin (Control Web) guarda hotspots/conexiones en **Convex**. El visor público sí usa ese grafo (`graph:getTourGraph` → `__convexGraphLoaded`), pero **tres capas extra** seguían alimentando el cue de flecha y el doble clic:

| Capa | Archivo | Efecto |
|------|---------|--------|
| Phase 10 fallback | `src/configLoader.js` | Si Convex tenía 0 nav, re-mezclaba nav de `biblioteca-scenes.json` |
| Zone auto prev/next | `normalizeConfig` | Enlaces automáticos por zona → `navigationHotspots` |
| `enrichSpatialGraph` | `src/spatialNav.js` | Seq Ricoh + órbitas ±2 + puentes hardcodeados del campus |

El array Convex `connections` **no** lo consume el visor (solo hotspots nav). Borrar “conexiones” en UI sí quita hotspots nav al guardar; el fantasma venía del enriquecimiento cliente.

### Fix (admin delete gana)

1. Con `__convexGraphLoaded`: **no** re-mergear nav estático vacío.
2. Con Convex SoT: **no** zone auto-links.
3. `enrichSpatialGraph(scenes, { autoNeighbors: false })` cuando Convex es SoT — solo hotspots nav explícitos entran al cue/doble clic.

Offline / `?draft=1` / sin Convex: se mantiene el enriquecimiento Street-View del piloto.

## 2. Hotspots visuales

- Iconos SVG mínimos (`src/hotspotIcons.js`): info (anillo + i) vs nav (chevron en círculo). Sin deps nuevas.
- Label **siempre visible** en chip (`hotspot__chip` = icono + label); el drag mueve el chip completo.
- Preview de escena: marco tipo viewport 360 (aspect 16:10, viñeta, crop equirect con `--preview-yaw`), no tira plana tipo card.

Viewer: `src/hotspotManager.js` + `css/components/hotspots.css`.  
Control Web: `control-web/admin.js` + `admin.css`.

## 3. Roles

| Rol | Puede |
|-----|--------|
| **Superadmin** | Crear orgs/tours, asignar usuarios, seed, cleanup QA, ver listados. **No** editar contenido de tours. |
| **Org admin / tour editor** | Control Web, branding, publish, sync spatial/a11y del tour de su org. |

### Cambios

- `userCanEditTour`: **ya no** hace bypass por `isSuperadmin` (membership de org obligatoria).
- UI Superadmin: solo enlace **visor público** (sin Control Web / org-admin).
- Org-admin: sin “Ir a Superadmin”; si la sesión es superadmin → redirect a superadmin.
- Control Web: si `auth:me.isSuperadmin` → redirect a superadmin.
- Seed: superadmin **sin** membership de Unisimón.
- Bootstrap spatial/a11y del piloto: `seed:seedPlatform` (superadmin), no day-to-day `tourAdmin:*`.

## 4. Limpieza QA

Mutation: `cleanupQa:cleanupQaArtifacts`

Elimina (sin tocar contenido real Unisimón):

- Tours `qa-pub-*` / `qa-*`
- Escenas `QA_TEST_*` colgadas del piloto
- Orgs desechables (`qa-other-*`, etc.) sin tours reales

### Cómo ejecutarlo

```bash
# Requiere Convex local + seed con superadmin
npm run qa:cleanup

# Solo listar lo que borraría
node scripts/qa-cleanup.mjs --dry-run

# Equivalente directo
npx convex run cleanupQa:cleanupQaArtifacts '{"token":"<sesión superadmin>","dryRun":false}'
```

`npm run qa` llama cleanup al final y re-sincroniza spatial+a11y del campus.

## 5. Verificación

- `npm run qa` — incluye bloqueo superadmin en `saveTourSnapshot` + cleanup.
- Playwright (`npm test`) si el entorno tiene servidor + Convex.
- **No** se afirma verificación TalkBack / lector de pantalla en este cambio.

## 6. Riesgos residuales

- Preview 360 sigue siendo crop CSS de equirect (no segundo Marzipano); se acerca al framing del viewport, no es proyección esférica real.
- Header prev/next del visor sigue yendo por **orden de escenas**, no por grafo (intencional / aparte del cue).
- `saveTourSnapshot` con lista parcial de escenas sigue reemplazando **todas** las `connections` del tour — los editores deben guardar el grafo completo (Control Web ya lo hace).
- DBs ya sembradas pueden tener membership antigua de superadmin; el flag `isSuperadmin` igual bloquea ediciones.
- Grabación `capturas/*.mp4` no estaba en el workspace al implementar; el fix se basó en el síntoma reportado + trazado de código.
