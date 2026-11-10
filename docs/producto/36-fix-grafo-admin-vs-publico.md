# Fix: grafo admin vs tour público (desync Convex)

Fecha: 2026-09-14  
Slug canónico: `unisimoncucuta` / `experienciavirtual`  
URL pública: `/unisimoncucuta/experienciavirtual/`

## Causa raíz (plain language)

Había **una sola fila de tour** (`experienciavirtual`; el alias `unisimon-campus` resuelve al mismo documento). Admin y público apuntaban al mismo tour.

El fallo no era “otra base de datos”, sino **dos representaciones del grafo dentro del mismo tour** que se desincronizaron:

| Superficie | Qué lee | Efecto |
|------------|---------|--------|
| Control Web (panel grafo) | Tabla `connections` | El admin veía ~sus conexiones curadas |
| Tour público (`getTourGraph`) | Hotspots `type: "nav"` por escena | El visitante veía ~145 nav del paquete campus (`*-auto-next` / `*-auto-prev`) |

Estado típico del bug en Convex:

- `connections` ≈ 53 (trabajo del org-admin)
- `nav hotspots` ≈ 145 (paquete espacial / seed)

Además:

1. **Re-seed** (`seed:seedPlatform` con org ya existente) volvía a ejecutar `applySpatialPackageToTour` y reinstauraba ~144 aristas fantasma. Eso ya **no** ocurre: el re-seed solo migra slugs/branding; el sync espacial/a11y es **opt-in**.
2. **`npm run qa` (antes)** ejecutaba `syncCampusSpatialGraph` sobre el tour piloto y un “post-cleanup resync” que **pisaba** el grafo curado (~53 → 144). Corregido: el sync espacial de QA usa un tour desechable; el cleanup **no** re-sincroniza espacial.
3. **Import JSON** en Control Web llamaba a `persistGraph` *antes* de aplicar `graph.scenes` al estado → podía guardar conexiones del export + hotspots viejos del campus.
4. El QA antiguo de `saveTourSnapshot` enviaba solo 2 escenas + 1 conexión y **pisaba** todas las conexiones del tour (corregido: merge sobre snapshot completo).

El merge estático (`biblioteca-scenes.json` / `tour-graph.json` / `enrichSpatialGraph`) **no** sobrescribe cuando Convex responde con grafo (`__convexGraphLoaded`). El problema era el contenido de Convex, no un segundo tour.

## Qué quedó como SoT

- **Aristas de navegación públicas** = tabla `connections` del tour publicado.
- `getTourGraph` / `getAdminSnapshot` **filtran** hotspots nav que no estén en `connections`.
- `saveTourSnapshot` escribe nav hotspots **alineados** a `connections` (borrados del panel ganan).
- Control Web: al guardar/importar, `syncNavHotspotsToConnections()`.

## Recuperar desde el JSON exportado

El export de Control Web (`tour-graph.json` / backup) ya se puede reimportar:

1. Arranca Convex + web: `npx convex dev` y `npm start`.
2. Login org-admin: `http://127.0.0.1:8081/plataforma/login.html`
3. Abre Control Web:  
   `http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/control-web/`
4. **Importar** → elige tu JSON de backup.
5. Con sesión activa, el import **aplica hotspots + conexiones y guarda en Convex**.
6. Si el mensaje pide Guardar, pulsa **Guardar cambios**.
7. Verifica público (sin sesión):  
   `http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/`  
   Debe mostrar el mismo número de conexiones que el panel.

### Si solo tienes conexiones en el JSON (sin `scenes.*.hotspots`)

El import usa `connections` como SoT y regenera nav. Luego Guardar.

### Si el público ya se ve bien tras el deploy del fix

`getTourGraph` filtra por `connections` aunque queden hotspots fantasma en disco. Igual conviene **Guardar una vez** desde Control Web para limpiar la tabla `hotspots`.

## Sync espacial / a11y (opt-in — no automático)

| Acción | Cuándo |
|--------|--------|
| `tourAdmin:syncCampusSpatialGraph` | Solo si quieres **resetear** el grafo al paquete campus (~144 conexiones). **Borra el trabajo admin.** |
| `accessibilityPublish:syncCampusA11yPackage` | Solo metadatos TTS/a11y; no debería recrear el grafo espacial completo. |
| Re-seed superadmin | Ya **no** reinyecta el paquete espacial. |

No ejecutes sync espacial “por si acaso” tras recuperar el export.

## QA

`npm run qa` incluye:

- `saveTourSnapshot ↔ getTourGraph parity (nav === connections)` para `experienciavirtual`.
- Asserción anti-fantasma: tras el save admin, conexiones del piloto **sin** aristas `QA_TEST_*` no deben coincidir exactamente con el conteo del paquete espacial (~144).
- Phase 10 `syncCampusSpatialGraph` solo sobre tour desechable; el conteo de conexiones del piloto no cambia.

## Checklist post-fix

- [ ] Import del JSON de backup + Guardar
- [ ] Contar conexiones en Control Web = nav visibles en público
- [ ] No pulsar sync espacial / “Reset grafo campus” salvo reset consciente
- [ ] Export JSON al cerrar el día (ver [37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md))
- [ ] `npm run qa` en verde

## Protección diaria

Hábitos, “qué NUNCA ejecutar” y checklist de cierre: **[37-proteccion-grafo-trabajo-diario.md](./37-proteccion-grafo-trabajo-diario.md)**.
