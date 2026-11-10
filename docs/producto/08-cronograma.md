# Cronograma de sprints — Orbe360

| Sprint | Fechas (orientativo) | Objetivo | Criterio de salida (DoD) | Gate |
|--------|----------------------|----------|---------------------------|------|
| 0 | Día 0 | Docs visión/actores | Docs en `docs/producto/` | OK |
| 1 | Día 1 | Convex + auth + seed 2 users | Login + seed | OK |
| 2 | Día 1–2 | Landing + Superadmin | Demos + CRUD org/users | OK |
| 3 | Día 2–3 | Control Web↔Convex + rutas + QA | QA + audit-routes + engranaje | CERRADO |
| **4** | **Día 3–5** | **Upload panoramas + rate-limit + E2E smoke** | **RF-11 + media QA + Playwright** | **CERRADO** |
| 5 | Backlog | Multi-tour UI + CSP + bcrypt | RF-13/14 + RNF-05 | Liberado |

## Regla de gestión
**No abrir el siguiente sprint** hasta checklist Gate del actual en verde.

## Gate Sprint 4 (cerrado)
- [x] `npm run qa` → 26/26 (upload + rate-limit)
- [x] `node scripts/audit-routes.mjs` → 0 problemas
- [x] Control Web: **Subir panorama** → Convex File Storage
- [x] Tour usa `imageUrl` remoto cuando aplica
- [x] Login bloquea tras ~8 fallos / 15 min
- [x] `npm test` smoke Playwright (4 passed)
- [x] Hallazgos en `11-hallazgos-sprint4.md`
- [x] RF-11 Hecho
