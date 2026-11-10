# Auditoría de infraestructura y arquitectura — Orbe360

**Alcance:** `PROTOTIPO-360-CURSOR-V1` (lectura; sin refactor en este pase)  
**Fecha:** 2026-09-09  
**Objetivo de producto:** plataforma multi-organización para crear/publicar tours 360° inclusivos (viewer Marzipano + Convex + plataforma admin + Control Web), lista para universidades/orgs, escalable y con estructura de software sólida.

---

## 1. Resumen ejecutivo (severidad)

| Dimensión | Veredicto | Severidad |
|-----------|-----------|-----------|
| Piloto Unisimón / curso PM | Maduro y usable | Baja |
| Producto multi-tenant “listo para orgs” | Parcial — schema y roles existen; gaps de aislamiento y ops | **Alta** |
| Seguridad de producción | MVP endurecido (rate-limit, roles) pero hashing débil, tokens en `localStorage`, APIs públicas filtrables | **Alta (P0)** |
| Escalabilidad media/largo plazo | Cuellos claros: panoramas ~243 MB, N+1 hotspots, `.collect()` global, escenas Marzipano eagerly creadas | **Media–Alta (P1)** |
| DX / DevOps | Scripts QA útiles; sin CI, sin ESLint Convex, docs raíz desalineadas | Media (P2) |

**Veredicto global:** Orbe360 es un **piloto técnico sólido** (auth por roles, grafo en Convex, Control Web sincronizado, landing/plataforma) pero **no está listo como producto SaaS multi-org** sin cerrar P0 de seguridad/aislamiento y P1 de assets + consultas. La deuda no es “falta de features de marketing”: es estructura dual (JSON estático + Convex), auth casera y carga de panoramas.

---

## 2. Fortalezas

1. **Modelo de dominio alineado con la visión** (`docs/producto/01-vision.md`): tablas `organizations`, `memberships`, `tours`, `scenes`, `hotspots`, `connections`, `assets` en `convex/schema.ts`, con índices por slug, org, tour y escena.
2. **Separación de superficies** clara en carpetas:
   - Viewer: `index.html` + `src/*` + `css/*`
   - Plataforma: `plataforma/` (landing, login, superadmin, org-admin)
   - Editor: `control-web/`
   - Backend: `convex/`
3. **Auth con controles reales** (no solo UI):
   - Sesiones con token aleatorio 32 bytes (`convex/lib/authHelpers.ts`)
   - Rate-limit login 8/15 min (`convex/auth.ts` + tabla `loginAttempts`)
   - Timing-safe-ish path (hash dummy si usuario inexistente)
   - Superadmin vs orgAdmin en mutaciones sensibles (`createOrganization`, `createAdminUser`, `createTour`)
4. **Tour público filtrado por `published`** en `graph:getTourGraph` (`convex/graph.ts`).
5. **Viewer con precarga parcial**: crea escenas Marzipano pero solo `preload()` de inicial + vecinos (`src/viewer.js`) — evita descargar los 63 JPG al arranque.
6. **Fuente de verdad compartida**: `mergeConvexTourGraph` en `src/configLoader.js` prioriza Convex frente a JSON local; draft solo con `?draft=1`.
7. **File Storage** para panoramas (`convex/media.ts` + UI en Control Web) y cuidado al no pisar URLs remotas con rutas locales (`saveTourSnapshot` en `convex/tourAdmin.ts`).
8. **Documentación de producto** consistente en `docs/producto/` (visión, RFs, hallazgos sprints 3–4, design system) y scripts `npm run qa` / `audit:routes` / Playwright.
9. **Accesibilidad como eje**: módulos dedicados (`accessibility.js`, `announcer.js`, skip-links, fallback noscript) y tests de teclado.

---

## 3. Riesgos críticos / cuellos de botella (priorizados)

### P0 — Bloqueantes para producción multi-org

| ID | Hallazgo | Evidencia | Impacto |
|----|----------|-----------|---------|
| **P0-1** | `organizations:listTours` **no exige autenticación** y, sin `publishedOnly`, puede devolver **todos los tours (incl. no publicados)** | `convex/organizations.ts` L75–112: `token` opcional no se usa; `ctx.db.query("tours").collect()` | Filtración de metadatos de tours privados / drafts entre clientes |
| **P0-2** | Hash de passwords **SHA-256 + salt** (rápido, vulnerable a GPU) | `hashPassword` en `convex/lib/authHelpers.ts`; documentado en RNF-05 como “Should” | Compromiso de credenciales si hay leak de DB |
| **P0-3** | Credenciales demo **en código y docs** (`seed.ts`, `login.html` con `?demo=1`, `05-como-levantar.md`) | `convex/seed.ts` L6–9, L96–107; `plataforma/login.html` | En cualquier deployment con seed sin rotar, acceso admin trivial |
| **P0-4** | Token de sesión en **`localStorage`** (`orbe360.session`) | `plataforma/convex-client.js`, `control-web/admin.js` | XSS ⇒ robo de sesión (sin HttpOnly/SameSite cookie) |
| **P0-5** | `media:generateUploadUrl` solo exige “cualquier usuario autenticado”, **sin scope a org/tour** | `convex/media.ts` L21–27 | Abuso de storage / costos por cuenta comprometida de bajo privilegio |
| **P0-6** | `Date.now()` en **queries** vía `getUserBySession` | `authHelpers.ts` L27 usado desde `auth:me` y otras queries | Rompe caching/reactividad Convex; sesiones “expiradas” inconsistentes en suscripciones |

### P1 — Escalabilidad y arquitectura (próximos orgs / tours grandes)

| ID | Hallazgo | Evidencia | Impacto |
|----|----------|-----------|---------|
| **P1-1** | **~63 panoramas / ~243 MB** en repo (`panoramas/`, ~3.9 MB promedio); no ignorados en `.gitignore` | Medición local; `config.json` lista 60+ escenas | Clone/deploy estático lento; hosting caro; sin CDN/tiles |
| **P1-2** | Equirectangulares a ancho por defecto **8192** sin pirámide de tiles | `src/viewer.js` `EquirectGeometry([{ width: sceneData.width \|\| 8192 }])` | Memoria GPU/CPU alta en móviles; latencia alta en redes universitarias |
| **P1-3** | **N+1**: por cada escena, query de hotspots | `graph.ts` L78–82; `tourAdmin.ts` L102–106 | Latencia O(escenas) en tours grandes |
| **P1-4** | `.collect()` sin paginación en listados globales | `listPublishedDemos`, `listUsers`, `listTours`, `listOrganizations` (superadmin) | OK en piloto; falla al crecer orgs/users |
| **P1-5** | Snapshot admin = **reemplazo completo** de hotspots/conexiones en una mutación | `saveTourSnapshot` | Riesgo de límites de tamaño/args Convex y ventanas de inconsistencia |
| **P1-6** | **Doble fuente de verdad**: `config.json` + `biblioteca-scenes.json` (~77 KB) + `tour-graph.json` + Convex | `configLoader.js` merge en cascada | Drift, bugs de prioridad, onboarding de nuevos clientes confuso |
| **P1-7** | Slug de tour **global** (`tours.by_slug`), no `(org, slug)` | `schema.ts` + `createTour` | Colisiones entre universidades; multi-tenant incompleto (RF-13/14 “Could”) |
| **P1-8** | Control Web es **HTML/JS público** (~65 KB `admin.js`); el gate de edición es cliente + token en mutaciones | `control-web/index.html` accesible sin login | Superficie de ataque/UI expuesta; OK si mutaciones están bien, pero P0-1 debilita el modelo |
| **P1-9** | Sin mutación de **publish/unpublish** post-creación | Solo `published` en `createTour`; no hay `setPublished` en `convex/` | Operación editorial incompleta para orgs |
| **P1-10** | `getAdminSnapshot` retorna `scenes: v.any()` | `tourAdmin.ts` L46 | Pierde type-safety Convex; facilita contratos rotos |

### P2 — DX, modularidad, alineación docs

| ID | Hallazgo | Evidencia |
|----|----------|-----------|
| **P2-1** | Sin CI (`.github/` ausente), sin ESLint / `@convex-dev/eslint-plugin` | `package.json`, glob de config |
| **P2-2** | README / `docs/EJECUCION-Y-DEPLOY.md` hablan de puerto **8080** y stack pre-plataforma; scripts reales usan **8081** | `package.json` `dev:web`; docs raíz |
| **P2-3** | `docs/ARQUITECTURA.md` describe solo viewer + `config.json`; no Convex/plataforma | Desalineación docs vs código |
| **P2-4** | Sin bundler (Vite/Webpack): ES modules + `http-server` | Adecuado para MVP; sin tree-shake, env inject, CSP build |
| **P2-5** | Monolito `control-web/admin.js` | Acoplamiento UI/estado/Convex en un archivo |
| **P2-6** | `styles(old_together).css`, `demo.html` / legado | Ruido en raíz del repo |
| **P2-7** | Auth **casera** en lugar de Clerk/Auth0/WorkOS + `ctx.auth` | Patrón Convex recomendado no adoptado |
| **P2-8** | Sin limpieza de sesiones expiradas / revoke-all | Tabla `sessions` crece |

---

## 4. Evaluación por área de auditoría

### 4.1 Estructura y modularidad

```text
PROTOTIPO-360-CURSOR-V1/
├── index.html, src/, css/, panoramas/, vendors/   # Viewer público
├── plataforma/                                     # Marketing + admin HTML
├── control-web/                                    # Editor tour
├── convex/                                         # Backend (auth, orgs, graph, media, tourAdmin, seed)
├── docs/producto/                                  # Producto / sprints (fuerte)
└── scripts/, tests/                                # QA y smoke
```

**Bien:** fronteras por carpeta coinciden con actores (visitante / org admin / superadmin).  
**Mal:** acoplamiento fuerte viewer↔JSON estático↔Convex; naming del package (`tour-virtual-accesible`) vs marca Orbe360; docs raíz vs `docs/producto`.

### 4.2 Frontend

| Superficie | Stack | Notas |
|------------|-------|-------|
| Tour | Marzipano local (`vendors/marzipano.min.js`) + módulos ES | Fallback CDN jsDelivr; muchos CSS linkeados en `index.html` (15+) |
| Plataforma | HTML + CSS tokens + `convex-client.js` fetch HTTP | Sin framework; auth client-side redirect |
| Control Web | Vanilla JS monolítico | Sync Convex + `localStorage` graph |

**Asset loading:** prioridad `imageUrl` https (File Storage) → `data:` → `basePath + file` (`viewer.js` `resolveSceneImageUrl`).  
**Bundling:** ninguno. Config Convex hardcodeada a `http://127.0.0.1:3210` en `orbe-config.js` / `plataforma/config.js` (riesgo si se despliega sin cambiar).

### 4.3 Backend Convex

| Práctica | Estado |
|----------|--------|
| `args` + `returns` validators | Mayormente sí |
| Auth en mutaciones sensibles | Sí (salvo gaps P0) |
| Índices FK | Sí (`by_tour`, `by_org`, `by_user_and_org`, …) |
| Índice `tours` por `published` | **No** (filtro TS post-collect) |
| Paginación | **No** |
| Custom `authedQuery` wrappers | **No** — helpers manuales |
| `ctx.auth` Convex Auth | **No** — token propio |

### 4.4 Escalabilidad vs producto deseado

| Capacidad deseada | Hoy | Gap |
|-------------------|-----|-----|
| Multi-org aislada | Schema + memberships | `listTours` público; slug global; UI multi-tour parcial (RF-13/14) |
| Tours publicados | `getTourGraph` + demos | Falta toggle publish; demos hacen full scan |
| Escala de media 360° | Storage Convex OK | Sin tiles/CDN; 243 MB locales; equirect 8K |
| Muchos editores concurrentes | Snapshot replace | Conflictos last-write-wins; sin versionado/optimistic lock |
| Universidades (cientos de escenas) | N+1 + collect | Necesita batch hotspots + paginación admin |

### 4.5 Seguridad (detalle)

- **Positivo:** rate-limit, roles en QA (`scripts/qa-orbe.mjs`), engranaje admin oculto sin sesión (`src/main.js`), demo creds ocultas sin `?demo=1`, `.env.*` en `.gitignore`.
- **Negativo:** P0-1…P0-6; Control Web públicamente linkeable; passwords seed en repo; sin CSP documentada (sprint 5 en hallazgos); CORS no es un issue típico con Convex HTTP API, pero el token viaja en body JSON desde cualquier origen que conozca la URL del deployment.

### 4.6 DevOps / DX

| Ítem | Estado |
|------|--------|
| `npx convex dev` en scripts | Sí (`dev:convex`) |
| Seed | `npm run seed` |
| QA automatizado | `qa`, `audit:routes`, Playwright smoke + teclado |
| CI | No |
| Lint / typecheck root | Solo `convex/tsconfig.json`; sin ESLint |
| Deploy guía | Estático genérico; no pipeline Convex prod vs web |

### 4.7 Alineación con goals de producto

| Goal | Alineación |
|------|------------|
| Crear/publicar experiencias 360° | Alta (piloto); media (multi-tour UI) |
| Admin separado de visitante | Alta (plataforma + control-web + ocultar gear) |
| Multi-tenant orgs | Schema listo; enforcement incompleto (P0-1, P1-7) |
| Escalable sin bottlenecks mayores | No aún (media + queries) |
| Best practices software | MVP pragmático; no “production Convex checklist” |

---

## 5. Arquitectura objetivo (concreta, corta)

```text
[CDN / object storage]  panoramas tiles (multi-res) + thumbs
         ↑
[Static host]  viewer build (Vite)  |  admin SPA (misma build o aparte)
         ↓
[Convex]
  ├── Auth provider (Clerk/WorkOS) → ctx.auth + platformUsers mapping
  ├── orgScopedQuery/Mutation (customFunctions)
  ├── tours: index by_org_and_published, slug by_org_and_slug
  ├── graph:getTourGraph: 1 query hotspots by_tour (sin N+1)
  ├── media: upload URL solo si membership en tour.org
  └── publishTour / listToursAuthenticated / paginate

Fuente de verdad única: Convex (eliminar dependencia runtime de biblioteca-scenes.json
para tours publicados; JSON solo seed/import).
```

Principios:
1. **Un grafo publicado = lectura pública**; drafts solo con auth.
2. **Media fuera del git**; git LFS o solo URLs Convex/R2.
3. **Tiles o al menos maxResolution/downscale** por escena.
4. **Tokens en cookie HttpOnly** o JWT de proveedor; nunca solo `localStorage` a largo plazo.
5. **Password hashing** argon2/bcrypt en action `"use node"` o delegar auth al IdP.

---

## 6. Arquitectura futura de servidor y base de datos

### 6.1 Estado actual: este PC como servidor + assets locales

Hoy el prototipo opera como una mezcla de:

- **Servidor web local** con `http-server` (`package.json` `start` / `dev:web`) sirviendo la raíz del repo.
- **Backend Convex en desarrollo** vía `npx convex dev`.
- **Assets panorámicos locales** en `panoramas/` (medidos en esta auditoría: ~63 archivos / ~243 MB).
- **Configuración híbrida** entre `config.json`, `biblioteca-scenes.json`, `tour-graph.json` y Convex (`src/configLoader.js`).

Esto es válido para desarrollo y demo, pero como arquitectura real tiene límites claros:

1. El PC del desarrollador no ofrece disponibilidad, redundancia, monitoreo ni backups formales.
2. El disco local no es una estrategia robusta para media 360° pesada.
3. La ruta actual mezcla responsabilidades de **hosting web**, **API**, **base de datos** y **storage** en un flujo de operación manual.
4. `orbe-config.js` y `plataforma/config.js` apuntan por defecto a `http://127.0.0.1:3210`, lo que confirma que el despliegue actual está pensado para entorno local, no hosted.

### 6.2 Arquitectura objetivo en Linux hosting / servidor

Arquitectura objetivo recomendada para el primer entorno productivo:

```text
[Usuarios web]
    ↓
[CDN / reverse proxy TLS]
    ├── sirve frontend público (viewer)
    ├── sirve frontend admin/control-web
    └── cachea assets estáticos y panoramas
    ↓
[Hosting Linux]
    ├── Nginx o Caddy
    ├── build estático del viewer/admin
    ├── jobs operativos (backups, rotación, health checks)
    └── observabilidad básica
    ↓
[Convex]
    ├── datos transaccionales de producto
    ├── auth / sesiones / permisos
    ├── tours, escenas, hotspots, organizaciones
    └── APIs públicas y privadas
    ↓
[Object storage]
    ├── panoramas originales
    ├── panoramas optimizados / tiles
    ├── thumbnails
    └── exportaciones / backups de media
```

**Recomendación práctica inicial:** Linux VPS o instancia pequeña administrada, con `Nginx` o `Caddy` para TLS y serving del build estático, dejando **Convex como backend** y **object storage/CDN** para media. No conviene empezar con un servidor Linux que también haga de “file server principal” para panoramas pesados.

### 6.3 Estrategia de base de datos para producción

#### Qué debe permanecer en Convex

Conviene mantener en Convex lo que ya encaja bien con el modelo del producto:

- `organizations`
- `platformUsers` o su mapping hacia proveedor de auth
- `memberships`
- `tours`
- `scenes`
- `hotspots`
- `connections`
- `assets` como **catálogo/metadata**, no como repositorio lógico principal de archivos
- sesiones, auditoría de login y estados editoriales

**Por qué Convex sí encaja aquí:**

1. El producto necesita **datos relacionales ligeros + APIs tipadas + lógica de permisos**.
2. Las superficies `viewer`, `plataforma` y `control-web` ya dependen del modelo Convex.
3. Convex simplifica mucho la fase MVP y reduce DevOps respecto a autohospedar API + DB desde el inicio.

#### Qué podría migrarse o self-hostearse más adelante

Más adelante, si el producto crece y necesita mayor control de costo o integración corporativa, se podría evaluar:

- **Auth corporativa** fuera de Convex: Keycloak, Authentik, WorkOS, Clerk, Auth0.
- **Object storage** self-hosted o compatible S3: MinIO, Ceph, Backblaze B2, Cloudflare R2, Wasabi.
- **Analítica / logs** en stack propia: Grafana + Loki + Prometheus.
- **PostgreSQL self-hosted** solo si aparecen requisitos no cubiertos por Convex:
  - reporting complejo multi-tenant,
  - BI institucional,
  - integraciones SQL corporativas,
  - políticas de residencia de datos muy estrictas.

#### Recomendación de decisión

- **Corto plazo:** mantener **app data en Convex**.
- **Medio plazo:** mover **media 360°** a object storage dedicado con CDN.
- **Largo plazo:** evaluar self-hosted auth / storage / data warehouse solo si el negocio lo justifica.

No recomiendo migrar prematuramente la base transaccional principal fuera de Convex antes de resolver los problemas ya detectados en queries, auth y assets.

### 6.4 Estrategia de static assets / object storage para panoramas y carpetas del proyecto

#### Qué no debe seguir ocurriendo

No conviene sostener producción con este patrón:

- panoramas dentro de `panoramas/` versionados junto al código,
- deploy del sitio arrastrando cientos de MB por release,
- viewer leyendo archivos pesados locales desde el mismo host del frontend.

#### Estrategia recomendada

Separar claramente:

1. **Código fuente**
   - Repo git: `src/`, `control-web/`, `plataforma/`, `convex/`, `docs/`, scripts.
2. **Configuración semilla / import**
   - `config.json`, `biblioteca-scenes.json`, `tour-graph.json` solo como seed/migración o compatibilidad temporal.
3. **Media maestra**
   - originales 360° en bucket privado o semi-privado.
4. **Media publicada**
   - panoramas optimizados, thumbnails y tiles en bucket público detrás de CDN.

#### Estructura sugerida de object storage

```text
orbe360-media/
  orgs/
    {orgSlug}/
      tours/
        {tourSlug}/
          source/
            panorama-original-001.jpg
          published/
            scenes/
              {sceneFileKey}.jpg
            thumbs/
              {sceneFileKey}.jpg
            tiles/
              {sceneFileKey}/...
          exports/
            snapshot-YYYY-MM-DD.json
```

#### Regla operacional

- El repo git guarda **referencias y metadatos**.
- El storage guarda **archivos binarios**.
- Convex guarda **URLs, IDs, checksums, tamaños, estados y ownership**.

### 6.5 Separación app / API / DB / storage

La separación objetivo debería ser explícita:

| Capa | Responsabilidad | Tecnología sugerida |
|------|------------------|---------------------|
| App web pública | Render del viewer 360°, landing, navegación | Build estático servido por Nginx/Caddy/CDN |
| App admin | Login, org admin, superadmin, control editorial | Build estático separado o misma app con rutas |
| API / lógica | Authz, CRUD de tours, publish, snapshots, uploads | Convex |
| Base de datos operativa | Organizaciones, usuarios, escenas, hotspots, sesiones | Convex |
| Storage binario | JPG 360, thumbs, tiles, exportaciones | S3-compatible / R2 / MinIO / Convex Storage temporal |
| CDN | Distribución rápida de panoramas y caché | Cloudflare / CDN del proveedor |

**Punto clave:** incluso si se mantiene Convex, la media pesada no debería seguir acoplada al mismo artefacto de despliegue del frontend.

### 6.6 Camino de migración por fases: prototipo local → producción hosted

#### Fase 0 — actual

- PC local como servidor web.
- Convex dev.
- Assets en disco local del repo.

#### Fase 1 — staging funcional

- Mover frontend a hosting Linux o estático administrado.
- Mantener Convex como backend.
- Configurar dominio/subdominio y TLS.
- Remover credenciales demo de cualquier entorno hosted.
- Pasar `__CONVEX_URL__` a variable de entorno/build.

#### Fase 2 — media desacoplada

- Subir panoramas a object storage.
- Actualizar `assets` / `scenes.imageUrl` para usar URLs publicadas.
- Mantener `config.json` solo como bootstrap temporal.
- Incorporar thumbnails y compresión.

#### Fase 3 — endurecimiento productivo

- Auth real con cookies/JWT de proveedor.
- Publicación formal draft/published.
- Índices multi-tenant y paginación.
- Backups, alertas y dashboard operativo.

#### Fase 4 — escala inicial

- Tiles multi-res para panoramas grandes.
- CDN delante de media.
- Métricas y capacity planning.
- Evaluación de storage adicional o self-hosted según costos.

### 6.7 Backup y recuperación esperados

Para una plataforma vendible a universidades/orgs, el estándar mínimo debería ser:

#### Base de datos / metadatos

- Backup/export regular de datos críticos:
  - organizaciones,
  - tours,
  - escenas,
  - hotspots,
  - conexiones,
  - memberships,
  - assets metadata.
- Objetivo operativo:
  - **RPO inicial**: hasta 24 horas máximo.
  - **RTO inicial**: 4 a 8 horas razonable para MVP institucional.

#### Assets 360°

- Versionado o replicación del bucket.
- Copia secundaria en otra región o proveedor cuando haya clientes reales.
- Export periódico de manifest (`tourSlug` → escenas → URLs → hashes).

#### Recomendación concreta

1. Backup lógico de Convex/metadatos en rutina programada.
2. Backup de bucket/media por replicación nativa del proveedor o sync incremental.
3. Procedimiento escrito de restore:
   - restaurar metadata,
   - restaurar bucket o prefijo del tour,
   - recalcular URLs si cambia dominio/CDN,
   - validar viewer + admin.

Sin procedimiento de restore probado, no hay backup confiable.

### 6.8 Tamaño inicial de servidor MVP y primeras métricas a monitorear

#### Tamaño MVP sugerido

Si el frontend se sirve desde Linux propio y Convex sigue como backend:

- **1 VPS Linux pequeño/mediano**:
  - 2 vCPU
  - 4 GB RAM
  - 60–100 GB SSD
  - Nginx/Caddy
  - logs + cron + agentes livianos

Esto es suficiente para:

- sitio estático,
- panel admin,
- proxy/rewrite,
- monitoreo básico,
- sin alojar panoramas pesados en disco como estrategia principal.

Si además se insiste en servir panoramas desde el mismo servidor en una primera etapa, el cuello real no será CPU sino:

- ancho de banda,
- almacenamiento,
- latencia,
- picos concurrentes.

#### Primeras métricas a monitorear

- Tiempo de respuesta del viewer inicial.
- Tiempo de carga de primera escena.
- Tamaño promedio de panorama servido.
- Tasa de errores 4xx/5xx.
- Frecuencia de `graph:getTourGraph` y tamaño de payload.
- Latencia de mutaciones admin (`saveTourSnapshot`, uploads).
- Uso de ancho de banda mensual.
- Cache hit ratio de CDN si existe.
- Crecimiento de tablas `sessions`, `loginAttempts`, `assets`.
- Concurrencia de usuarios por tour/org.

### 6.9 Riesgos y tradeoffs: assets 360° en disco del servidor vs object storage/CDN

| Opción | Ventajas | Riesgos / costos |
|--------|----------|------------------|
| Disco del servidor Linux | Simple al inicio, menos piezas, fácil de entender | Escala mal, backups pesados, deploys frágiles, poca distribución geográfica, saturación de ancho de banda, acoplamiento fuerte con el host |
| Object storage sin CDN | Mejor durabilidad, separa binarios del app host, más limpio para backups | Latencia variable, costo de egreso, menor performance global |
| Object storage + CDN | Mejor opción para 360° publicado: caché global, desacople, mejor throughput, releases más limpios | Más piezas operativas, costo CDN/egress, requiere naming y expiración de cache bien pensados |

**Conclusión de costo/riesgo:** para Orbe360, los panoramas 360° se comportan más como **media de distribución** que como archivos “adjuntos” tradicionales. Por eso, a partir del primer despliegue serio, conviene tratarlos como contenido de object storage/CDN y no como archivos del mismo servidor web o del repositorio git.

---

## 7. Roadmap accionable (2–4 sprints)

### Sprint A — Seguridad / aislamiento (P0)

- [ ] Autenticar y autorizar `listTours` (y cualquier listado que exponga `published: false`).
- [ ] Restringir `generateUploadUrl` / attach a membership del tour.
- [ ] Rotar/deshabilitar passwords seed en deployments no locales; quitar credenciales del HTML o gate por env `ALLOW_DEMO_CREDS`.
- [ ] Sustituir SHA-256 por argon2/bcrypt **o** migrar a Convex Auth + IdP (preferible).
- [ ] Evitar `Date.now()` en path de queries de sesión (pasar `now` desde cliente o cron que marque `sessions.expired`).
- [ ] Añadir `publishTour` / `unpublishTour` con auth orgAdmin+.

### Sprint B — Media y performance viewer (P1-1, P1-2)

- [ ] Pipeline: comprimir/redimensionar panoramas (p.ej. ≤4096 o tiles Marzipano).
- [ ] Sacar `panoramas/` del deploy web o servir solo desde Convex Storage/CDN.
- [ ] Lazy-create escenas Marzipano (no `createScene` de las 60+ al boot; crear on-demand).
- [ ] Thumbs dedicados en tabla `assets` kind `thumb`.

### Sprint C — Backend queries / multi-tenant (P1-3…P1-7)

- [ ] `getTourGraph` / `getAdminSnapshot`: hotspots con `.withIndex("by_tour")` una vez + groupBy en memoria.
- [ ] Índices `by_org_and_published`, `by_org_and_slug`.
- [ ] Paginación en `listUsers` / demos admin.
- [ ] Tipar `scenes` en snapshot (eliminar `v.any()`).
- [ ] UI multi-tour por org (RF-13).

### Sprint D — DX / estructura (P2)

- [ ] Vite (o similar) + env `VITE_CONVEX_URL`; unificar config.
- [ ] ESLint + `@convex-dev/eslint-plugin`; CI GitHub Actions: `npm run check` + `npm test` + `tsc`.
- [ ] Actualizar `README.md`, `ARQUITECTURA.md`, `EJECUCION-Y-DEPLOY.md` a Orbe360 real (puerto 8081, Convex, plataforma).
- [ ] Partir `control-web/admin.js` en módulos; limpiar CSS legado.
- [ ] Cron limpieza `sessions` / `loginAttempts`.

**Fuera de este pase (no implementado):** los ítems anteriores son recomendaciones; ningún cambio de código salvo este informe.

---

## 8. Inventario de evidencias clave

| Archivo | Rol en la auditoría |
|---------|---------------------|
| `convex/schema.ts` | Modelo multi-org + índices |
| `convex/auth.ts` / `lib/authHelpers.ts` | Sesiones, rate-limit, SHA-256 |
| `convex/organizations.ts` | **listTours sin auth** |
| `convex/graph.ts` | Grafo público + N+1 + listPublishedDemos collect |
| `convex/tourAdmin.ts` | Snapshot replace + `v.any()` |
| `convex/media.ts` | Upload URL poco scoped |
| `convex/seed.ts` | Credenciales demo en código |
| `src/configLoader.js` | Merge multi-fuente |
| `src/viewer.js` | Equirect 8192, preload vecinos |
| `plataforma/convex-client.js` | Token localStorage |
| `orbe-config.js` | URL Convex localhost por defecto |
| `package.json` | Scripts; sin lint/CI |
| `docs/producto/07-requisitos.md` | RNF-05 hashing; RF-13/14 Could |
| `panoramas/` | ~243 MB / 63 archivos |

---

## 9. Conclusión

Orbe360 ya demuestra el **camino de producto** (roles, publish flag, editor sincronizado, landing). Para universidades reales hace falta tratar el sistema como **SaaS multi-tenant con media pesada**, no como tour estático + API: cerrar fugas de listados, endurecer auth/media, y sacar los panoramas del modelo “todo en el repo / equirect completo”. Con los sprints A–B se elimina el riesgo de “demo en producción”; con C–D se obtiene una base mantenible y escalable.
