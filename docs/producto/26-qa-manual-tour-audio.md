# 26 — QA manual: tour + audio (Unisimón)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Checklist humana para verificar navegación espacial + TTS en el tour público.  
**No afirma:** TalkBack / NVDA en dispositivo (**NO VERIFICADO**).

---

## Prerrequisitos

1. `npx convex dev` (local, p.ej. `http://127.0.0.1:3210`)
2. `npm start` → `http://127.0.0.1:8081/`
3. Seed + sync espacial + a11y (ver [05-como-levantar](./05-como-levantar.md)):
   - Primera vez: `npm run seed:allow-local` → `npm run seed`
   - DB ya sembrada: login org-admin → o re-seed como superadmin; QA ejecuta `syncCampusSpatialGraph` + `syncCampusA11yPackage`
4. Tour `unisimon-campus` **published**

---

## Checklist

### A. Slug y carga

| # | Paso | Esperado | ☐ |
|---|------|----------|---|
| A1 | Abrir `http://127.0.0.1:8081/` | Carga tour (default Unisimón) | |
| A2 | Abrir `/?slug=unisimon-campus` | Misma experiencia; panoramas visibles | |
| A3 | Abrir `/?slug=tour-inexistente-xyz` | Error / rechazo (no inventa otro tour) | |
| A4 | DevTools → Network: `graph:getTourGraph` | 200 con `scenes.length` ≥ 40 y hotspots `type:"nav"` | |

### B. Navegación espacial

| # | Paso | Esperado | ☐ |
|---|------|----------|---|
| B1 | Flechas del teclado en el panorama | Yaw/pitch cambian | |
| B2 | Tab / lista de destinos o hotspots nav | Hay destinos (no solo info) | |
| B3 | Activar un hotspot **nav** (clic o teclado) | Cambia de escena; imagen nueva | |
| B4 | Recorrer zona biblioteca (escenas con flechas) | Enlaces con yaw/pitch ≠ 0 en varias escenas | |
| B5 | Recorrer zona entrada / cafetería | Auto-nav o hotspots permiten avanzar/retroceder | |

### C. Audio TTS

| # | Paso | Esperado | ☐ |
|---|------|----------|---|
| C1 | Abrir escena con MP3 (p.ej. entrada-principal / biblioteca) | Panel o auto-narración ofrece play | |
| C2 | Play | Se oye audio (no solo síntesis vacía si el MP3 existe) | |
| C3 | Pause | Audio pausa | |
| C4 | Stop / cerrar panel | Audio para y vuelve a 0 | |
| C5 | **Escape** (panel abierto o capas UI) | Audio / speech se detienen | |
| C6 | Cambiar de escena con audio en curso | Audio anterior para; nueva escena puede narrar | |
| C7 | Escena sin MP3 | Estado honesto (sin fingir archivo); síntesis opcional | |

### D. Publicación / admin

| # | Paso | Esperado | ☐ |
|---|------|----------|---|
| D1 | Org-admin → checklist a11y | Claim campus ready según DB (`evaluateTourFromDb`) | |
| D2 | Tour published = on | Visitante ve grafo | |
| D3 | Unpublish temporal | Visitante con slug no carga Convex graph (piloto default puede caer a JSON offline) | |
| D4 | Control Web guardar snapshot | No borra `narrationUrl` de hotspots ya sincronizados (mismo `clientKey`) | |

### E. Offline / fallback

| # | Paso | Esperado | ☐ |
|---|------|----------|---|
| E1 | Sin Convex URL / Convex caído, `/?` o slug Unisimón | Fallback `config.json` + `biblioteca-scenes.json` sigue navegable | |
| E2 | `?draft=1` | Usa localStorage / `tour-graph.json` (puede estar vacío; draft ≠ prod) | |

---

## Automatizado (complemento)

```bash
npm run qa          # incluye Phase 10 spatial + a11y
npm run check:a11y
npx playwright test
```

Convex + web deben estar arriba para `npm run qa`.

---

## Fallos frecuentes

| Síntoma | Causa probable | Remedio |
|---------|----------------|---------|
| Escenas sin flechas nav tras Convex | Stubs a11y Phase 9 sin spatial sync | `tourAdmin:syncCampusSpatialGraph` + re-sync a11y |
| Audio null en grafo | a11y no sincronizado | `syncCampusA11yPackage` / seed |
| Tour vacío | No published / slug mal | Publicar `unisimon-campus` |
| Dual SoT confuso | Editar solo JSON y esperar Convex | Regenerar embed espacial + sync |

---

*Checklist manual. No sustituye prueba AT real en dispositivo.*
