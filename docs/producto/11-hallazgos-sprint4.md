# Hallazgos Sprint 4 — upload + rate-limit + smoke

## Objetivo
RF-11 (subida panoramas), endurecer login (rate-limit), smoke E2E Playwright, y que el tour use `imageUrl` de Convex (File Storage) sin romper escenas locales.

## Hallazgos y resolución

| # | Hallazgo | Impacto | Resolución | Verificado |
|---|----------|---------|------------|------------|
| H1 | API `media.ts` existía sin UI | Alto | Botón **Subir panorama** en Control Web + diálogo upload | Código |
| H2 | Tour solo cargaba `panoramas/{file}` | Alto | `viewer` / Control Web / thumbs usan `imageUrl` http(s) si existe | Código |
| H3 | Escenas solo-Convex no entraban al `config.scenes` | Alto | `mergeConvexTourGraph` inyecta escenas faltantes | Código |
| H4 | `saveTourSnapshot` pisaba URL de storage con ruta relativa | Alto | Conserva `imageUrl` almacenada si el patch es local y hay `storageId` | Código |
| H5 | Snapshot admin no devolvía `imageUrl` | Medio | `getAdminSnapshot` incluye `imageUrl` + orden; pull crea escenas nuevas | Código |
| H6 | Login sin límite de intentos / `throw` revertía contador | Medio | `loginAttempts` + login retorna `{ok:false}` (sin rollback) | QA |
| H7 | Sin smoke E2E | Medio | `tests/smoke.spec.js` + `playwright.config.js` | `npm test` |

## Gate Sprint 4
**CERRADO** tras verificación:
- [x] `npm run qa` → 26/26 OK (upload + rate-limit)
- [x] `npm run audit:routes` → 0 problemas
- [x] Control Web: **Subir panorama** → Convex File Storage → escena en lista
- [x] Tour usa `imageUrl` remoto cuando aplica
- [x] Login bloquea tras ~8 fallos en 15 min (sin rollback por throw)
- [x] `npm test` smoke Playwright
- [x] Hallazgos en `11-hallazgos-sprint4.md`
- [x] RF-11 Hecho en `07-requisitos.md`

```bash
npm run check
npm test
```

Sprint 5 liberado: multi-tour UI + CSP + bcrypt/argon2.