# Hallazgos Sprint 3 — cierre de calidad

## Hallazgos y resolución

| # | Hallazgo | Impacto | Resolución | Verificado |
|---|----------|---------|------------|------------|
| H1 | Tour distinto en Cursor vs Chrome (localStorage) | Alto | Tour prioriza Convex; draft solo `?draft=1` | QA snapshot |
| H2 | `/plataforma/` y `/control-web/` → 404 en http-server Windows | Alto | Links canónicos a `.../index.html` | audit + HTTP |
| H3 | Engranaje apuntaba a `control-web/` (404) | Alto | `control-web/index.html` + redirect a login si no hay sesión | Código |
| H4 | Edición Control Web sin login | Alto | Modos edición bloqueados sin token | Código + mensaje |
| H5 | Passwords demo visibles | Medio | Solo `?demo=1` | QA HTML |
| H6 | Seed sin auth reutilizable | Alto | Solo 1ª instalación o superadmin | Código |
| H7 | Falta mapa requisitos/cronograma | Medio | docs 07–09 | Docs |

## Gate Sprint 3
**CERRADO 2026-09-09** — `npm run check` → QA 20/20 + audit-routes 0 problemas.

```bash
npm run check
```

Sprint 4 liberado: upload panoramas + rate-limit + E2E.