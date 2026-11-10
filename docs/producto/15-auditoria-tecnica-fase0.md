# 15 — Auditoría técnica FASE 0 (ORBE360)

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-09  
**Tipo:** lectura profunda de código + docs de producto. **Sin cambios de implementación.**  
**Regla de negocio:** a11y profunda = tours/visor; admin = básico.  
**Backlog funcional de referencia:** `docs/producto/14-backlog-accesibilidad-tours.md` (+ `07-requisitos.md`, `13-auditoria-infraestructura.md`). No se rediseña el backlog desde cero.

**Leyenda de estado:** `IMPLEMENTADO` | `IMPLEMENTADO Y VERIFICADO` | `PARCIAL` | `NO IMPLEMENTADO` | `NO VERIFICADO`  
**Severidad:** `P0 CRÍTICO` | `P1 ALTO` | `P2 MEDIO` | `P3 BAJO`  
**HIPÓTESIS:** afirmación no demostrable solo con código/tests del repo.

---

## Resumen ejecutivo

ORBE360 es un **piloto técnico usable** (viewer Marzipano + Convex + plataforma HTML + Control Web) con roles, rate-limit de login, grafo publicado filtrado por `published`, y sync editor→Convex. **No es un producto SaaS multi-org listo para producción:** hay fuga de listados de tours sin auth, hashing débil, sesiones en `localStorage`, credenciales seed en repo, media 360° (~243 MB) en git, accesibilidad real del visitante incompleta (capa semántica truncada, audio placeholder, Escape no detiene audio), y white-label solo documentado.

**Top P0 (bloquean claim “producción / SaaS / tour accesible”):**

1. `organizations:listTours` sin autenticación ni filtro obligatorio → metadatos de drafts (Broken Access Control).
2. Auth casera: SHA-256+salt, tokens en `localStorage`, passwords seed en código/HTML.
3. Upload storage (`media:generateUploadUrl`) para cualquier usuario autenticado sin scope org/tour.
4. A11y visitante: Escape/backdrop no llaman `closePanel()` → audio fantasma; listas `.slice(0,4)`; audio real ausente (`placeholder.mp3` 50 bytes + `DEFAULT_AUDIO_DATA_URI`).
5. Dual fuente de verdad JSON+Convex + `orbe-config.js` hardcodeado a `127.0.0.1:3210`.

**Primera fase de implementación recomendada (después de autorización explícita):** ver § Roadmap priorizado — **Fase 1 Seguridad/Authz**, luego motor a11y P0 del backlog 14, sin rediseño de UI ni white-label profundo aún.

---

## Mapa arquitectónico actual

```text
PROTOTIPO-360-CURSOR-V1/
├── index.html + src/*.js + css/ + vendors/marzipano.min.js   # Viewer público (motor)
├── panoramas/ (~63 JPG, ~243 MB)                             # Media local en repo
├── assets/{captions,transcripts,audio}/                      # A11y content (audio = placeholder)
├── config.json + biblioteca-scenes.json + tour-graph.json    # Seed / fallback estático
├── plataforma/                                               # Landing + login + superadmin + org-admin
├── control-web/                                              # Editor (admin.js monolítico)
├── convex/                                                   # auth, organizations, graph, media, tourAdmin, seed
├── scripts/qa-orbe.mjs                                       # QA API/roles
└── tests/                                                    # Playwright smoke + teclado mínimo
```

```text
[Visitante]
   → http-server :8081 → index.html
        → configLoader: config.json → biblioteca-scenes → Convex getTourGraph → tour-graph
        → viewer.js (Marzipano equirect 8K) + hotspots + panel a11y

[Admin / Superadmin]
   → plataforma/login.html → auth:login → token localStorage orbe360.session
   → plataforma/superadmin.html | org-admin.html
   → control-web/index.html → tourAdmin + media (si hay token)

[Backend]
   → Convex deployment (dev default 127.0.0.1:3210)
   → tablas: organizations, platformUsers, memberships, sessions,
             loginAttempts, tours, scenes, hotspots, connections, assets
```

**Stack:** Vanilla ES modules + `http-server`; Convex `^1.21.0`; Playwright; **sin** bundler, **sin** CI, **sin** ESLint/`@convex-dev/eslint-plugin`, **sin** `ctx.auth` de Convex Auth.

---

## Flujo de datos

```text
1. Boot viewer
   loadConfig()
     ├─ fetch config.json
     ├─ mergeBibliotecaAccessibleScenes (biblioteca-scenes.json)
     ├─ mergeConvexTourGraph (graph:getTourGraph)  [omitido si ?draft=1]
     ├─ mergeTourGraph (localStorage solo draft | tour-graph.json)
     ├─ hotspot-overrides.json
     └─ normalizeConfig / validateConfig

2. Prioridad efectiva (público)
   Convex hotspots/metadata (si hay URL + tour published) > JSON estático
   draft=1 → localStorage tour.graph.v1 sustituye Convex

3. Persistencia admin
   Control Web → saveTourSnapshot (reemplazo hotspots/conexiones)
              → generateUploadUrl + attachPanoramaToScene
              → copia local localStorage / tour-graph.json (cliente)

4. Lectura pública demos
   graph:listPublishedDemos → landing plataforma
```

**Estado fuentes de verdad:** `PARCIAL` — Convex es fuente compartida para grafo publicado; JSON sigue siendo necesario para boot, zonas, narraciones/transcripts/captions y fallback offline.

---

## Flujo de autenticación

```text
POST auth:login { email, password }
  → rate-limit loginAttempts (8 / 15 min)
  → hashPassword SHA-256(salt:password)
  → insert sessions { token 32 bytes hex, expiresAt +14d }
  → return { token, user }

Cliente: setToken → localStorage["orbe360.session"]
Queries/mutations: args.token (NO cookie HttpOnly; NO ctx.auth)

auth:me / requireUser / requireSuperadmin → getUserBySession(token)
auth:logout → delete session row
```

| Capacidad | Estado | Evidencia |
|-----------|--------|-----------|
| Login + sesión | IMPLEMENTADO Y VERIFICADO | `convex/auth.ts`; `scripts/qa-orbe.mjs` |
| Rate-limit | IMPLEMENTADO Y VERIFICADO | `loginAttempts`; QA |
| Timing-safe path (hash dummy) | IMPLEMENTADO | `auth.ts` usuario inexistente |
| Password hashing producción | PARCIAL | SHA-256+salt (`authHelpers.ts`); RNF-05 “Should” |
| Cookie HttpOnly / IdP | NO IMPLEMENTADO | `plataforma/convex-client.js` |
| Limpieza sesiones expiradas | NO IMPLEMENTADO | sin cron/scheduler |

---

## Flujo de autorización

```text
requireUser(token) → active user
requireSuperadmin → isSuperadmin
userCanEditTour → superadmin OR membership en tour.organizationId
                  (cualquier role: orgAdmin | tourEditor — misma capacidad de edición)

createTour → superadmin OR membership.role === "orgAdmin"
createOrganization / createAdminUser / listUsers → superadmin
getAdminSnapshot / saveTourSnapshot / attachPanoramaToScene → userCanEditTour
getTourGraph → solo published (sin token)
listTours → ⚠️ token OPCIONAL E IGNORADO
generateUploadUrl → cualquier requireUser (sin org scope)
```

| Capacidad | Estado |
|-----------|--------|
| Roles superadmin vs org | IMPLEMENTADO Y VERIFICADO (QA bloquea createOrg / listUsers) |
| Aislamiento drafts vía listTours | **NO IMPLEMENTADO** (fuga) |
| Diferenciación tourEditor vs orgAdmin en edición | PARCIAL (existe en schema; edición no distingue) |
| Publish/unpublish post-creación | NO IMPLEMENTADO |
| Wrappers authedQuery/customFunctions | NO IMPLEMENTADO |

---

## Mapa de superficies públicas / privadas

| Superficie | URL / path | Intención | Gate real | Estado |
|------------|------------|-----------|-----------|--------|
| Tour visitante | `/index.html` | Público | Ninguno; grafo solo published vía Convex | IMPLEMENTADO |
| Landing | `/plataforma/index.html` | Público | demos vía `listPublishedDemos` | IMPLEMENTADO |
| Login | `/plataforma/login.html` | Público | — | IMPLEMENTADO |
| Superadmin UI | `/plataforma/superadmin.html` | Privada | **solo cliente**; mutaciones server-side | PARCIAL (UI pública HTTP 200) |
| Org-admin UI | `/plataforma/org-admin.html` | Privada | idem | PARCIAL |
| Control Web | `/control-web/index.html` | Privada edición | HTTP público; guardado exige token; UI lectura sin login | PARCIAL |
| Engranaje en tour | `#adminLink` | Privada | removido sin `orbe360.session` | IMPLEMENTADO Y VERIFICADO (Playwright) |
| Convex `getTourGraph` | API pública | Publicado | `published` check | IMPLEMENTADO |
| Convex `listTours` | API pública | Debería ser privada | **sin auth** | **P0** |
| Convex `listPublishedDemos` | API pública | OK | solo published (post-collect) | IMPLEMENTADO |
| File Storage upload URL | mutation | Privada | auth user, sin org | PARCIAL / P0 abuso |

---

## Fuentes de verdad (JSON vs Convex)

| Dato | JSON estático | Convex | Quién gana en runtime |
|------|---------------|--------|------------------------|
| Lista escenas / zonas base | `config.json` | scenes | merge: Convex enriquece; JSON arranca |
| Hotspots / grafo | `tour-graph.json`, `biblioteca-scenes.json` | hotspots/connections | Convex si disponible (no draft) |
| imageUrl storage | — | scenes.imageUrl / storageId | Convex https preferido |
| Narración / caption / transcript | config + assets/ | **casi ausente** (assets.kind audio existe; graph no expone paquete a11y) | JSON / defaults |
| Branding white-label | hardcode Unisimón/PEVCI | **no hay TourBranding** | N/A |
| published | — | tours.published | Convex |

**Veredicto:** `PARCIAL` — dual-source consciente (`configLoader.js` comentarios), con riesgo de drift y onboarding confuso (alineado P1-6 de doc 13).

---

## Acoplamientos Unisimón

| Ubicación | Acoplamiento | Impacto |
|-----------|--------------|---------|
| `index.html` title/meta | PEVCI / Unisimón Cúcuta | Motor no white-label |
| `orbe-config.js` / `plataforma/config.js` | `__ORBE_TOUR_SLUG__ = "unisimon-campus"` | Default global de cliente |
| `convex/seed.ts` | org `unisimon-cucuta`, tour `unisimon-campus`, passwords fijas | Bootstrap + riesgo prod |
| `control-web` title/CSS/eyebrows | PEVCI / USB Cúcuta | Editor = marca cliente |
| `plataforma/index.html`, `org-admin.html` | copy Unisimón | Landing/piloto |
| `package.json` name | `tour-virtual-accesible` | Naming legado |
| `panoramas/` + seed scene keys | assets campus | Repo = cliente piloto |

---

## 1. Estado actual de arquitectura

| Aspecto | Estado | Notas |
|---------|--------|-------|
| Separación viewer / plataforma / control-web / convex | IMPLEMENTADO | Fronteras por carpeta claras |
| Modelo multi-org en schema | IMPLEMENTADO | `organizations`, `memberships`, índices |
| Convex como API tipada | PARCIAL | args/returns mayormente; `scenes: v.any()` en snapshot |
| Auth provider / ctx.auth | NO IMPLEMENTADO | token manual |
| Custom functions RLS-like | NO IMPLEMENTADO | helpers manuales |
| Bundler / env inject / CSP build | NO IMPLEMENTADO | `http-server` + ES modules |
| CI/CD | NO IMPLEMENTADO | sin `.github/` |
| Docs raíz vs producto | PARCIAL | `docs/ARQUITECTURA.md` desactualizado (solo JSON); `docs/producto/` fuerte |
| Escalabilidad media | PARCIAL | File Storage OK; 243 MB en git; equirect 8192; N+1 hotspots |

**OWASP Insecure Design / Misconfig:** diseño híbrido JSON+Convex y defaults localhost son deuda estructural, no solo bugs.

---

## 2. Estado actual de seguridad

| Control | Estado | OWASP | Severidad |
|---------|--------|-------|-----------|
| Authz en mutaciones admin sensibles | IMPLEMENTADO Y VERIFICADO | A01 | — (positivos) |
| Rate-limit login | IMPLEMENTADO Y VERIFICADO | A07 | — |
| `listTours` público | **fallo** | A01 Broken Access Control | **P0** |
| Hash passwords | débil | A02 Cryptographic Failures | **P0** |
| Session token storage | localStorage | A07 / XSS impact | **P0** |
| Credenciales seed en repo/HTML | presente | A07 | **P0** |
| Upload URL sin org scope | presente | A01 / abuso | **P0** |
| XSS potencial `parseVtt` → `innerHTML` | presente | A03 Injection | **P1** |
| `zoneLabel` en `menu.js` via `innerHTML` | presente | A03 | **P2** |
| `error.message` en `innerHTML` (`main.js`) | presente | A03 | **P2** |
| CSP / Trusted Types | NO VERIFICADO / ausente | A05 | **P2** |
| Marzipano CDN fallback jsDelivr | IMPLEMENTADO | A08 Supply Chain | **P2** |
| Secrets en `.gitignore` | PARCIAL | A05 | `.env*` sí; panoramas/no; creds en código |
| CORS Convex | HIPÓTESIS | A05 | HTTP API acepta body con token desde orígenes que conozcan URL deployment |

**No se afirma “seguro”.** Controles MVP existen; superficie de abuso multi-tenant no cerrada.

---

## 3. Estado actual de autenticación / autorización

Ver flujos arriba.

| Ítem | Estado |
|------|--------|
| Sesiones 14d + logout | IMPLEMENTADO Y VERIFICADO |
| Escalada privilegios org→super | bloqueada en QA | IMPLEMENTADO Y VERIFICADO |
| IDOR / listados cross-tenant | **abierto vía listTours** | P0 |
| RBAC fino publish / billing | NO IMPLEMENTADO | |
| MFA / password reset / revoke-all | NO IMPLEMENTADO | |

---

## 4. Estado actual de multi-tenancy

| Capacidad | Estado | Evidencia |
|-----------|--------|-----------|
| Tablas org + membership | IMPLEMENTADO | `schema.ts` |
| createOrg solo superadmin | IMPLEMENTADO Y VERIFICADO | QA |
| createTour scoped membership | IMPLEMENTADO | `organizations.ts` |
| Slug tour global (`by_slug`) | PARCIAL / deuda | colisiones entre orgs (RF-14 Could) |
| listTours aislamiento | **NO IMPLEMENTADO** | token unused |
| UI multi-tour / multi-org completa | PARCIAL | RF-13/14 “Schema listo” |
| Índice `by_org_and_published` | NO IMPLEMENTADO | collect + filter |

---

## 5. Estado actual del visor

| Capacidad | Estado | Evidencia |
|-----------|--------|-----------|
| Marzipano equirect + drag | IMPLEMENTADO | `viewer.js` |
| Precarga inicial + vecinos | IMPLEMENTADO | evita 63 JPG al boot |
| Hotspots nav/info | IMPLEMENTADO | `hotspotManager.js` |
| Merge Convex | IMPLEMENTADO | `configLoader.js` |
| Escenas eagerly creadas (objetos Marzipano) | IMPLEMENTADO (coste) | forEach createScene |
| Tiles / pirámide | NO IMPLEMENTADO | width default 8192 |
| Parar audio al cambiar escena | NO VERIFICADO / probable NO | switchScene no llama stopAudio |
| `role=application` en `#panorama` | IMPLEMENTADO (riesgo a11y) | `index.html` |

---

## 6. Estado actual de accesibilidad real

**Criterio de producto:** §2 de `14-backlog-accesibilidad-tours.md` (recorrido no visual completo, teclado, anuncios, audio real, captions honestas).

| Criterio §2 | Estado | Evidencia |
|-------------|--------|-----------|
| Recorrido no visual completo | PARCIAL / NO | `#hotspotList` solo `.slice(0, 4)` (`main.js`); depende panorama/`role=application` |
| Teclado desktop paneles | PARCIAL | skip-links, focus trap panel; tests mínimos |
| Anuncios limpios | PARCIAL | `announceScene(title + longDescription)` completo; `#tourApp aria-live=polite` global |
| Audio real | **NO IMPLEMENTADO** | `assets/audio/placeholder.mp3` (50 bytes); `DEFAULT_AUDIO_DATA_URI` |
| Captions/transcript honestos | PARCIAL | VTT/txt existen; `parseVtt` no timed; timestamps como `<li>` |
| Preferencias / modo accesible | IMPLEMENTADO | `accessibility.js` + localStorage settings |
| Fallback noscript | IMPLEMENTADO | `index.html` + transcript entrada |
| Escape detiene audio | **NO** (bug) | `uiLayers.closeHotspotPanelDom` ≠ `closePanel()` |
| Labels toggles TTS/captions | PARCIAL | span hermano, no `for`/`aria-labelledby` en inputs switch |
| TalkBack verificado | NO VERIFICADO | sin evidencia automatizada/manual en repo |
| Admin a11y profunda | fuera de alcance P0 | regla negocio |

**Claims marketing “accesible” en landing:** deben alinearse a criterios §2 — hoy **no** se puede afirmar tour verdaderamente accesible.

---

## 7. Estado actual de audio

| Capacidad | Estado | Evidencia |
|-----------|--------|-----------|
| Player play/pause/stop/volumen en panel | IMPLEMENTADO | `hotspotPanel.js` |
| `closePanel` para audio+speech | IMPLEMENTADO | ruta correcta del botón cerrar |
| Cierre Escape global / backdrop | **roto** | `uiLayers.js` |
| Narración de escena (no solo hotspot) | NO IMPLEMENTADO | backlog T-P1-1 |
| Archivos audio reales piloto | NO IMPLEMENTADO | solo placeholder |
| `speechSynthesis` fallback | IMPLEMENTADO | primario de facto si audio falla |
| Modelo Convex audio/transcript | PARCIAL | `assets.kind: audio`; graph no entrega paquete a11y |
| Upload audio vía media.ts | NO IMPLEMENTADO | solo panoramas |

---

## 8. Estado actual del sistema white-label

| Capacidad | Estado |
|-----------|--------|
| Modelo `TourBranding` en schema/código | **NO IMPLEMENTADO** (solo docs 14) |
| Tokens CSS Orbe360 vs cliente | PARCIAL | design system plataforma (`12-…`); viewer acoplado PEVCI |
| Slug/tour configurable | PARCIAL | `window.__ORBE_TOUR_SLUG__` |
| Paquete a11y por tour | NO IMPLEMENTADO | |
| Neutralizar copy motor | NO IMPLEMENTADO | title/meta Unisimón |

---

## 9. Estado actual de testing

| Capa | Estado | Cobertura |
|------|--------|-----------|
| `scripts/qa-orbe.mjs` | IMPLEMENTADO Y VERIFICADO (si Convex+web up) | roles, snapshot, media auth, logout, demo creds hidden |
| Playwright smoke | IMPLEMENTADO | landing, tour, admin link oculto, control-web login link |
| Playwright teclado | PARCIAL | solo foco panorama + skip + no fuga control-web |
| Tests listTours authz | **ausente** | QA no cubre P0-1 |
| axe / operabilidad SR | NO IMPLEMENTADO | `audit-runner.js` = presencia de campos metadata |
| TalkBack / NVDA automatizado | NO IMPLEMENTADO | |
| CI | NO IMPLEMENTADO | |
| Unit tests Convex | NO IMPLEMENTADO | |

---

## 10. Deuda técnica crítica

1. **Dual source of truth** JSON + Convex (`configLoader.js`).
2. **Auth casera** vs IdP + `ctx.auth`.
3. **Monolito** `control-web/admin.js` (~1.8k líneas).
4. **N+1** hotspots en `graph.ts` / `tourAdmin.ts`.
5. **`.collect()`** global sin paginación / sin índice published.
6. **Panoramas en git** (~243 MB); `.gitignore` no los excluye.
7. **Equirect 8K** sin tiles.
8. **`Date.now()` en queries** vía `getUserBySession` (rompe cache/reactividad Convex).
9. **Sin ESLint Convex / CI / typecheck root.**
10. **Docs raíz** (`ARQUITECTURA.md`, puertos 8080) desalineadas.
11. **Snapshot replace** last-write-wins, sin versionado.
12. **`accessibilityProfile` booleanos** = marketing metadata, no checklist de contenido.

---

## 11. Vulnerabilidades encontradas

### V-01 — listTours sin autenticación (Broken Access Control)
- **Severidad:** P0 CRÍTICO  
- **Ubicación:** `convex/organizations.ts` (`listTours`, ~L75–112)  
- **Evidencia:** `token` opcional **no se usa**; sin `publishedOnly` retorna todos los tours incl. `published: false`; puede filtrar por `organizationId` ajeno.  
- **Impacto:** filtración metadatos drafts entre tenants; inteligencia competitiva / enumeración.  
- **Remediación (hint):** exigir auth; si público, forzar `published === true`; scope por membership; añadir test en `qa-orbe.mjs`.

### V-02 — Password hashing SHA-256 + salt
- **Severidad:** P0  
- **Ubicación:** `convex/lib/authHelpers.ts` `hashPassword`  
- **Impacto:** crack GPU rápido si leak DB.  
- **Remediación:** argon2/bcrypt en action `"use node"` o IdP (Clerk/WorkOS).

### V-03 — Credenciales demo en código y HTML
- **Severidad:** P0  
- **Ubicación:** `convex/seed.ts` L6–9, L96–107; `plataforma/login.html` bloque `demoCreds`  
- **Impacto:** acceso admin trivial en cualquier deployment sembrado sin rotación.  
- **Remediación:** rotar en no-local; gate seed; no embeber passwords en HTML (ni con `?demo=1` en prod).

### V-04 — Session token en localStorage
- **Severidad:** P0  
- **Ubicación:** `plataforma/convex-client.js`; `control-web/admin.js` `SESSION_KEY`  
- **Impacto:** cualquier XSS ⇒ robo de sesión (sin HttpOnly).  
- **Remediación:** cookie HttpOnly SameSite + CSRF strategy, o JWT IdP.

### V-05 — generateUploadUrl sin scope org/tour
- **Severidad:** P0  
- **Ubicación:** `convex/media.ts` L21–27  
- **Impacto:** abuso storage/costos con cuenta de privilegio bajo.  
- **Remediación:** exigir `tourId`/`orgId` + `userCanEditTour` / membership antes de emitir URL.

### V-06 — Seed bootstrap sin token en DB vacía
- **Severidad:** P1  
- **Ubicación:** `convex/seed.ts` primera instalación  
- **Impacto:** en deployment vacío expuesto, cualquiera puede sembrar superadmin conocido.  
- **Remediación:** deploy key / one-time secret env; deshabilitar tras seed.

### V-07 — XSS stored/reflected vía captions VTT → innerHTML
- **Severidad:** P1  
- **Ubicación:** `src/hotspotPanel.js` `parseVtt` + `container.innerHTML`  
- **Impacto:** si caption malicioso (admin comprometido o archivo plantado), XSS en visitante ⇒ robo token localStorage.  
- **Remediación:** textContent / DOM APIs; escapar; no innerHTML.

### V-08 — Date.now() en queries de sesión
- **Severidad:** P2 (correctitud/platform)  
- **Ubicación:** `getUserBySession` usado desde `auth:me` query  
- **Impacto:** comportamiento no determinista / cache Convex.  
- **Remediación:** pasar `now` desde cliente o cron que marque sesiones; no Date.now en query path.

### V-09 — Control Web / admin HTML públicamente servidos
- **Severidad:** P2 (defense in depth)  
- **Ubicación:** estáticos en http-server; QA espera HTTP 200  
- **Impacto:** superficie UI/JS (~65KB+) para ataque; OK si mutaciones firmes, pero V-01 debilita modelo.  
- **Remediación:** authz server ya es línea real; opcional split host / no indexar.

### V-10 — CDN fallback Marzipano
- **Severidad:** P2  
- **Ubicación:** `index.html` onerror → jsDelivr  
- **Impacto:** supply-chain si vendor local falla.  
- **Remediación:** pin integrity/SRI o fallar cerrado sin CDN.

---

## 12. Riesgos de migración

| Riesgo | Detalle | Severidad |
|--------|---------|-----------|
| JSON → Convex-only | Narraciones/captions/zones aún en JSON; cutover prematuro rompe tour | P1 |
| Slug global → `(org, slug)` | Requiere migración índices + URLs públicas | P1 |
| Auth casera → IdP | Re-map `platformUsers` / sessions; downtime login | P1 |
| Panoramas git → object storage | Rewrite imageUrl; CDN; regenerar tiles | P0 ops para prod |
| Hosting PC → Linux/Nginx | `127.0.0.1:3210` hardcode; CORS; TLS; Convex prod URL | P0 |
| Snapshot size | Tours grandes pueden romper límites args Convex | P1 |
| Dual write Control Web | localStorage + Convex drift en draft | P2 |
| Seed passwords en prod | Migración de secretos | P0 |

---

## 13. Dependencias peligrosas o innecesarias

| Dependencia | Evaluación |
|-------------|------------|
| `convex` ^1.21.0 | Necesaria y adecuada |
| `@playwright/test` | Necesaria; cobertura baja |
| `http-server` | OK MVP; no prod hardening |
| `typescript` | Solo `convex/tsconfig`; no gate CI |
| Marzipano vendored + CDN fallback | Vendored OK; CDN = riesgo |
| Google Fonts runtime | Privacidad/latencia; acopla red |
| Sin `@convex-dev/eslint-plugin` | **ausencia peligrosa** (floating promises, validators) |
| Sin bundler | No tree-shake / CSP nonces / env |
| `placeholder.mp3` 50B | Dependencia de contenido falsa |
| Panoramas en repo | “dependencia” de peso; no ignore |

**No hay** dependencias npm obviamente maliciosas; el riesgo está en **ausencias** y **assets/binarios**.

---

## 14. Problemas que podrían impedir producción

1. Fuga `listTours` + credenciales seed conocidas.  
2. Hashing/sesión no aceptables para universidades (compliance).  
3. ~243 MB panoramas en deploy/git; equirect 8K en móviles universitarios.  
4. Defaults Convex localhost.  
5. Sin publish workflow operativo.  
6. Sin CI / lint / monitoreo.  
7. Claim a11y no cumplible (audio + capa semántica + Escape).  
8. Sin plan ops: backups media, rotación secretos, rate-limit storage.  
9. Multi-tenant incompleto (slug global, listados).  
10. Control Web last-write-wins sin concurrencia.

**Veredicto producción:** **NO listo.** Piloto/curso: usable con riesgos aceptados y documentados.

---

## Problemas UX/UI relevantes (no estética como prioridad)

| Problema | Severidad producto | Nota |
|----------|-------------------|------|
| Destinos inline truncados a 4 | P0 a11y/UX visitante | Bloquea recorrido SR |
| Audio sigue tras Escape/backdrop | P0 | Ruido SR |
| Menú `role=tree` sin teclado árbol | P1 | Botones internos OK parcial |
| Copy Unisimón en motor “Orbe360” | P2 white-label | Confunde marca |
| Control Web usable sin login (lectura) | P2 | OK si intencional; documentar |
| Landing claims a11y vs realidad | P1 | Riesgo reputacional |
| Loading overlay / 8K | P1 perf UX | |

---

## Quick wins (bajo esfuerzo / alto valor — **no implementar en FASE 0**)

1. Autenticar/`publishedOnly` forzado en `listTours` + test QA.  
2. Escape/backdrop → `closePanel()` / `forceStop()`.  
3. Labels `for=` en toggles a11y.  
4. Quitar o gatear passwords del HTML; rotar seed en docs “solo local”.  
5. Scope `generateUploadUrl` con tourId.  
6. Escapar `parseVtt` (textContent).  
7. Anuncio de escena = resumen corto (no `longDescription` completo).  
8. Lista destinos sin `.slice(0, 4)`.

---

## Cambios que NO deben hacerse todavía

- Reescribir a React/Next “porque sí”.  
- Migrar DB fuera de Convex.  
- White-label visual completo / TourBranding UI.  
- Control Web TalkBack-first / colocación yaw sin ratón.  
- Hosting/CDN producción sin cerrar P0 seguridad.  
- Eliminar JSON de un golpe sin modelo a11y en Convex.  
- Tiles 360 masivos antes de object storage strategy.  
- Marketplace / i18n completo / PWA (backlog legacy bajo).  
- Refactors cosméticos de design system admin.

---

## Propuesta de arquitectura objetivo (brief)

```text
[CDN] tiles + audio + thumbs
[Static] viewer build + admin build (env CONVEX_URL)
[Convex]
  IdP → ctx.auth → platformUsers
  orgScoped query/mutation wrappers
  tours by_org_and_slug / by_org_and_published
  getTourGraph: hotspots by_tour (1 query)
  media upload scoped + optional R2
  publishTour / audit log
Fuente de verdad runtime: Convex (+ CDN URLs)
JSON: solo import/seed
```

Principios: un grafo publicado = lectura pública; drafts autenticados; media fuera de git; a11y content empaquetado por tour; motor neutro Orbe360.

---

## Roadmap priorizado (alineado backlog 14 + política ingeniería)

**Política:** Security > Architecture > Functionality > Real a11y (visitante = core, no diferible eternamente) > Quality > UX > aesthetics.

| Fase | Foco | Ítems (IDs existentes) | Gate |
|------|------|------------------------|------|
| **1 — Security/Authz** | P0 seguridad | V-01 listTours; V-05 upload scope; rotar/gate seed; endurecer hashing plan | QA authz + pen-test listados |
| **2 — Architecture hardening** | Dual-source + queries | hotspots by_tour; índice published; publish mutation; config Convex URL | sin localhost en “staging” |
| **3 — Real a11y motor (Fase A backlog 14)** | T-P0-1…8 | Escape/audio; capa semántica; application role; audio real piloto; labels | criterios §2 parcial + teclado E2E |
| **4 — Audio/captions (Fase B)** | T-P1-1…10 | player escena; VTT honesto; modelo Convex a11y; Playwright amplio | transcript+audio en escenas clave |
| **5 — Quality/ops** | CI, ESLint Convex, pagination | — | `check:full` en CI |
| **6 — White-label (Fase C selectiva)** | T-P2-1,3 + desacoplar Unisimón del motor | TourBranding mínimo | motor sin meta PEVCI |
| **7 — Media scale** | tiles + object storage | doc 13 §6 | deploy Linux |

**Admin a11y profunda:** permanece P2+ según regla negocio.

---

## Cómo clasificamos evidencia

| Etiqueta | Significado |
|----------|------------|
| IMPLEMENTADO | Código presente con comportamiento observado en lectura |
| IMPLEMENTADO Y VERIFICADO | Además cubierto por `qa-orbe.mjs` y/o Playwright del repo |
| PARCIAL | Existe pero incompleto / bypass / no cumple criterio producto |
| NO IMPLEMENTADO | Ausente en código |
| NO VERIFICADO | Requiere runtime/manual (TalkBack, prod Convex) no ejecutado en esta FASE 0 |
| HIPÓTESIS | Inferencia razonable sin prueba directa en repo |

Severidades: impacto × explotabilidad en contexto multi-tenant universitario / claim a11y.

---

## Referencias cruzadas

- `docs/producto/13-auditoria-infraestructura.md` — P0-1…P0-6 confirmados en código.  
- `docs/producto/14-backlog-accesibilidad-tours.md` — roadmap a11y visitante (fuente de verdad funcional a11y).  
- `docs/producto/07-requisitos.md` — RF/RNF; RF-14/13 Could; RNF-05 hashing.  
- `docs/ARQUITECTURA.md` — **desactualizado** (no usar solo).  
- `backlog.md` — legacy; re-priorizado en doc 14.

---

*FASE 0 completa — solo diagnóstico. Ningún cambio de código de producto asociado a este documento salvo la creación de este informe.*
