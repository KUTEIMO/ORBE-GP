# 16 — Auditoría Fase 1: Seguridad & autorización (ORBE360)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Alcance:** Fase 1 Security/Authz únicamente (P0/P1 de docs 13/15).  
**Estándar:** calidad production-grade en código local; portable hacia Linux hosting sin rewrite.  
**Veredicto:** **No “seguro para producción multi-tenant pública”**, pero los controles de authz/aislamiento/media ownership que el código puede hacer **sin infra** están implementados.

---

## Resumen ejecutivo

Se cerraron los P0 de listados sin auth (`listTours`), uploads sin scope de tour/org, hashing débil (SHA-256 → PBKDF2 + migración en login), exposición de credenciales en HTML, XSS VTT→`innerHTML`, y bootstrap de seed abierto. El diseño de media ya registra `organizationId` / `tourId` / `objectKey` listo para object storage futuro.

**Honestidad:** sesiones siguen en `localStorage` (riesgo XSS), no hay IdP/cookies HttpOnly, panoramas locales en git aún pesan ~243 MB, y HTTPS/CDN requieren hosting.

---

## Qué se corrigió (evidencia)

| ID | Hallazgo | Cambio | Evidencia |
|----|----------|--------|-----------|
| V-01 / P0-1 | `listTours` sin auth | Token obligatorio; scope por membership / superadmin; drafts no cruzan orgs | `convex/organizations.ts`; QA `listTours exige token`, `listTours bloquea org ajena` |
| V-05 / P0-5 | Upload URL global | `generateUploadUrl` exige `tourSlug` + `userCanEditTour`; retorna ownership | `convex/media.ts`; Control Web pasa slug; QA ownership |
| V-02 / P0-2 | SHA-256+salt | PBKDF2-SHA256 100k (Web Crypto); legacy verify + rehash en login | `convex/lib/authHelpers.ts`, `convex/auth.ts` |
| V-03 / P0-3 | Passwords en HTML | Eliminados del cliente; solo docs/`seed.ts`; `?demo=1` sin secretos | `plataforma/login.html`; QA “Login sin secretos” |
| V-04 / P0-4 | Session localStorage | Expiry vía `expiresAt` + `now` en queries; logout borra fila; **documentado residual** | `authHelpers`, `convex-client.js`, `auth:logout` |
| V-06 | Seed abierto | `ALLOW_OPEN_SEED=1` o `SEED_BOOTSTRAP_SECRET`; re-seed exige superadmin | `convex/seed.ts`; `npm run seed:allow-local` |
| V-07 | VTT → innerHTML | DOM + `textContent` (`buildCaptionList`) | `src/hotspotPanel.js` |
| Multi-tenant media | Paths compartidos | `objectKey` = `orgs/{orgId}/tours/{tourId}/panoramas/{fileKey}`; índices `by_org` / `by_object_key` | `schema.ts`, `media.ts` |
| Config portable | URL hardcode | Precedencia inject → localStorage → default local; `config.local.js` gitignored | `orbe-config.js`, `.gitignore` |

Lectura pública de demos: `graph:listPublishedDemos` / `graph:getTourGraph` (solo `published`) — sin cambio de modelo.

---

## Tests ejecutados

| Suite | Resultado | Qué cubre |
|-------|-----------|-----------|
| `npm run qa` (`scripts/qa-orbe.mjs`) | **33 OK · 0 FAIL** (2026-09-09) | Login roles, listUsers bloqueado, listTours authz + IDOR cross-org, logout, upload scoped + `objectKey` ownership, rate-limit, login HTML sin secretos, snapshot/graph |
| Playwright | No re-corrido en este pase | Smoke previo intacto (admin link / teclado) |

*Ejecutado con Convex local (`127.0.0.1:3210`) + web `:8081`.*

---

## Ya migration-ready (código; no requiere hosting)

1. **Authz multi-org** en listados admin y mutaciones de tour/media.  
2. **PBKDF2** + upgrade transparente de hashes legacy.  
3. **Media ownership contract:** cada upload/attach lleva `organizationId`, `tourId`, `objectKey` estable para copiar a R2/S3/MinIO sin reescribir permisos.  
4. **Config Convex URL** inyectable (sin paths absolutos Windows).  
5. **Seed gated** por env (mismo mecanismo en Linux/`npx convex env set`).  
6. **Separación pública/privada:** demos vía queries published; drafts solo autenticados.  
7. **XSS captions** mitigado en el sink VTT.

Al copiar la carpeta a un servidor Linux: apuntar `__CONVEX_URL__`, quitar `ALLOW_OPEN_SEED`, rotar passwords seed, desplegar estáticos detrás de TLS — **sin redesign** de authz/media.

---

## Aún requiere infraestructura / producto futuro

| Ítem | Por qué no es “atajo local” | Qué falta |
|------|----------------------------|-----------|
| HTTPS / TLS | Necesita reverse proxy o CDN | Nginx/Caddy + certs |
| Cookie HttpOnly / IdP | Arquitectura de cookies cross-site + CSRF o Clerk/WorkOS | Fase auth proveedor |
| Object storage + CDN panoramas | Sustituye File Storage / `panoramas/` en git | Bucket + URLs + tiles |
| CSP / Trusted Types | Build o headers HTTP | Hosting headers / bundler |
| Cron limpieza sesiones | Scheduler Convex en deployment estable | `internal` + cron |
| Slug `(org, slug)` | Migración de índice/URL | Fase arquitectura |
| Publish/unpublish UI | Producto editorial | Mutación + UI |
| A11y visitante P0 (Escape/audio/slice) | Fuera de Fase 1 (doc 14) | Fase 3 roadmap |

---

## Riesgos residuales (aceptados, documentados)

1. **Token en `localStorage`** — XSS = robo de sesión. Logout invalida server-side; no mitiga XSS.  
2. **Passwords demo en repo** (`seed.ts`, docs) — OK para piloto local; **rotar** antes de hosting.  
3. **PBKDF2 ≠ argon2** — mejora fuerte vs SHA-256; IdP sigue siendo preferible a largo plazo.  
4. **`Date.now()` fallback** en helpers si el cliente omite `now` en queries — clientes plataforma ya pasan `now`.  
5. **Admin HTML públicamente servido** — defensa en profundidad UI ausente; mutaciones gated.  
6. **V-08 / N+1 / collect** — deuda P1–P2 no cerrada en Fase 1.  
7. **menu.js / main.js innerHTML** (P2) — no tocados; VTT sí.

---

## Qué no se hizo (fuera de alcance Fase 1)

- TourBranding / white-label  
- Capa semántica TalkBack profunda  
- Migración panoramas a CDN  
- Upgrades masivos de dependencias / ESLint CI completo  

---

## Checklist pre-copia a Linux

- [ ] `ALLOW_OPEN_SEED` **no** está en env de producción  
- [ ] Passwords seed rotados o usuarios demo desactivados  
- [ ] `__CONVEX_URL__` inyectado (no depender del default `127.0.0.1`)  
- [ ] TLS delante del estático  
- [ ] `npm run qa` verde contra el deployment destino  
- [ ] Plan object storage usando `objectKey` existente  

---

*Fase 1 implementación + auditoría. No se afirma readiness SaaS de producción.*
