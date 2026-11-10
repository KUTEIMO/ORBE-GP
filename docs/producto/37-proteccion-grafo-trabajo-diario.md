# 37 — Protección del grafo (trabajo diario)

**Proyecto:** Orbe360 / piloto Unisimón  
**Relacionados:** [36-fix-grafo-admin-vs-publico.md](./36-fix-grafo-admin-vs-publico.md) · [05-como-levantar.md](./05-como-levantar.md)  
**Slug:** `unisimoncucuta` / `experienciavirtual`  
**URL pública:** `/unisimoncucuta/experienciavirtual/`

## Principio

Unisimón se comporta como **ya publicado**. La fuente de verdad de navegación es la tabla Convex `connections`. El trabajo del org-admin en Control Web **no** se regenera solo: solo se pierde si alguien ejecuta un reset espacial o un import destructivo sin backup.

## Flujo diario (obligatorio)

1. Abrir Control Web: `/unisimoncucuta/experienciavirtual/control-web/`
2. Editar conexiones / hotspots / “Adelante”.
3. Pulsar **Guardar cambios** (sesión org-admin).
4. Verificar el tour público (sin sesión): `/unisimoncucuta/experienciavirtual/`
5. Contar: conexiones en el panel ≈ nav visibles en público.
6. **Exportar JSON** → guardar `tour-graph-YYYY-MM-DD.json` fuera del repo (hábito de backup).

## Checklist — antes de cerrar el día

- [ ] **Guardar cambios** en Control Web (badge “Cambios sin guardar” oculto).
- [ ] Recarga F5 del tour público: mismos destinos nav.
- [ ] **Exportar JSON** descargado y archivado (OneDrive / correo / carpeta de backups).
- [ ] No dejaste un import a medias ni un reset espacial a medias.
- [ ] Si tocaste branding/a11y en org-admin, re-abrir el visor público una vez.

## Qué NUNCA ejecutar (salvo reset consciente)

| Acción | Por qué |
|--------|---------|
| `tourAdmin:syncCampusSpatialGraph` sobre `experienciavirtual` | Restaura ~144 aristas campus y **borra** el grafo curado. |
| Org-admin → **Reset grafo campus (sobrescribe)** | Misma mutación; exige confirm + escribir `SOBRESCRIBIR`. |
| Re-seed “por si acaso” esperando refrescar el campus | Re-seed **ya no** reinyecta espacial; no lo uses como sync. |
| Import JSON de un export viejo / ajeno sin leer | Puede sobrescribir Convex si hay sesión. |
| Confiar solo en `tour-graph.json` estático del repo | La vida del piloto está en Convex; el JSON es backup. |
| Dejar QA antiguo o scripts custom que llamen sync espacial al piloto | `npm run qa` usa tour **desechable**; no copies ese patrón al piloto. |

## Recuperación rápida

1. Importar el último `tour-graph-*.json` en Control Web (confirma el diálogo).
2. Con sesión: el import guarda en Convex; si no, pulsa **Guardar**.
3. Verificar público.
4. Detalle: [36-fix-grafo-admin-vs-publico.md](./36-fix-grafo-admin-vs-publico.md).

## Salvaguardas en producto

- Banner en Control Web: “Sync espacial campus sobrescribe tu grafo”.
- Import siempre pide confirmación.
- Reset espacial en org-admin: botón peligroso + doble confirmación.
- `npm run qa`: parity `nav === connections`; falla si el piloto (sin aristas QA) tiene exactamente el conteo del paquete espacial fantasma; Phase 10 no altera conexiones del piloto.
