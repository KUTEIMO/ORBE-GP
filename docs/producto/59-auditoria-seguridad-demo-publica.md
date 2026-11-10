# 59 · Auditoría de seguridad — demo pública por túnel (Orbe360)

Auditoría con verificación activa (peticiones reales contra `127.0.0.1:8081`, el
túnel público y el backend Convex local). Alcance: autenticación, RBAC
multi-tenant, validación de argumentos, inyección, el proxy `/__convex`, fugas de
información, secretos, cabeceras, uploads, rate limiting y malas prácticas Convex.

Repos auditados:

- `PROTOTIPO-360-CURSOR-V1` — copia que sirve la demo pública (puerto 8081 + cloudflared)
- `ORBE` — repo de producto

## 1. Hallazgos

| # | Sev. | Archivo:línea | Descripción | Impacto |
|---|------|---------------|-------------|---------|
| 1 | **Crítica** | `convex/migratePilotMediaUrls.ts:57-73` | Mutation pública con `args: v.object({})` y **sin autenticación**. Verificado alcanzable desde Internet por `POST /__convex/api/mutation`. | Cualquier anónimo reescribía `imageUrl`/`narrationUrl` de escenas, URLs de hotspots y branding del tour del dueño. Corrupción de datos y DoS por escritura repetida. |
| 2 | **Crítica** | `scripts/dev-server.mjs` (proxy `/__convex`) | El proxy reenviaba **cualquier** `path` de función a `/api/mutation` y `/api/action`. La seguridad de toda la BD dependía de que cada función tuviera su propio guard. | Una sola función sin guard (ver #1) = base de datos del dueño expuesta. Superficie: 31 funciones públicas alcanzables por nombre. |
| 3 | **Alta** | Backend Convex local (bind `0.0.0.0:3210` y `:3211`) | Convex escucha en todas las interfaces. Verificado alcanzable en `192.168.99.32:3210`. **Salta por completo** `DEMO_PUBLIC` y el allowlist del proxy. | Cualquiera en la misma red (aula/Wi-Fi) llama funciones directamente, sin pasar por las defensas del servidor web. |
| 4 | **Alta** | `ORBE/scripts/dev-server.mjs` | El repo de producto no tenía `DEMO_PUBLIC`, ni blocklist de secretos, ni restricción de verbos. Verificado: servía `.env.local`, `docs/`, `backups/`, `convex/*.ts`, `.convex/` y aceptaba `POST`. | Tunelizar ORBE (un `cloudflared --url` de distancia) publicaba secretos y código fuente al instante. |
| 5 | **Alta** | `ORBE/scripts/dev-server.mjs` `sendFile()` | Contención de ruta con `abs.startsWith(ROOT)` sin separador: `…/ORBE-backup` satisface el prefijo de `…/ORBE`. | Lectura fuera del directorio servido vía directorios hermanos. |
| 6 | **Media** | `scripts/dev-server.mjs` `BLOCKED_FILES` | La blocklist compara en minúsculas pero tenía entradas en mayúsculas → nunca coincidían. Verificado 200 público en `/AGENTS.md`, `/CHANGELOG.md`, `/LICENSE`, `/UBICACION_Y_ARCHIVO.md`. | Divulgación de documentación interna, rutas locales e instrucciones del proyecto. |
| 7 | **Media** | Respuestas del proxy Convex | Los errores de Convex en dev incluían stack trace, ruta y línea del archivo (`../convex/cleanupQa.ts:109:4`) y el **validador completo de argumentos**. | Mapa de la API y del esquema interno servido en bandeja a un atacante. |
| 8 | **Media** | `convex/lib/authHelpers.ts` `getUserBySession` | No comprobaba `user.active`; solo `requireUser` lo hacía. | `auth:me` seguía respondiendo para cuentas desactivadas → desactivar un usuario no cortaba su sesión en todas las rutas. |
| 9 | **Media** | `convex/seed.ts`, `scripts/start-demo.mjs` | Tres contraseñas (superadmin, orgAdmin, invitado) hardcodeadas en el repo. | Credenciales en el código y en el historial de git. |
| 10 | **Media** | `convex/tourAdmin.ts` `saveGuestDraft` | `payload` con `v.any()` sin límite de tamaño. | Un invitado autenticado podía crecer el almacenamiento sin cota (DoS). |
| 11 | **Media** | Proxy `/__convex` | Sin rate limiting ni límite de cuerpo. | Amplificación de DoS y fuerza bruta contra Convex desde Internet. |
| 12 | **Media** | Cabeceras en `DEMO_PUBLIC` | CSP solo con `frame-ancestors`, sin `X-Frame-Options`, y el proxy emitía `Access-Control-Allow-Origin: null`. | Clickjacking parcial y política CORS innecesaria. |
| 13 | **Baja** | `plataforma/convex-client.js:16`, `control-web/auth-gate.js:10` | Token de sesión en `localStorage` (no cookie `HttpOnly`), 14 días, sin rotación tras login ni timeout por inactividad. | Un XSS exfiltra la sesión; ventana de validez larga. |
| 14 | **Baja** | `scripts/dev-server.mjs` `http.createServer` | `new URL(req.url, base)` con URL protocolo-relativa (`//algo`) hace que el host lo controle el cliente y `pathname` pase a `/`. Verificado: `//.env.local` devuelve la landing (**no** filtra el secreto). | Confusión de enrutado; sin fuga de datos. |
| 15 | **Baja** | `graph:listPublishedDemos` | Expone públicamente el tour interno `orbe/sandbox`. | Divulgación de recursos internos. |
| 16 | **Informativo** | Entorno local | Un `httpd.exe` (Apache/XAMPP) escucha en `0.0.0.0:8080`, ajeno a Orbe. No sirve el repo. | Superficie de red adicional en el equipo del dueño. |

### Lo que **no** está mal (verificado por prueba activa)

- **Sin inyección explotable.** No hay `eval`, ni construcción dinámica de queries, ni
  concatenación de identificadores. Convex usa índices tipados. El traversal de rutas
  falló en todas las variantes probadas (`../`, `..%2f`, `%2e%2e%2f`, `....//`, `//`).
- **Validación de argumentos y returns completa.** Las 31 funciones públicas declaran
  `args` y `returns`. No encontré ninguna sin validadores.
- **Hash de contraseñas correcto:** PBKDF2-SHA256, 100 000 iteraciones, salt por
  usuario, comparación en tiempo constante, migración automática de hashes SHA-256
  legacy al iniciar sesión.
- **Rate limiting de login** por email: 8 intentos / 15 min.
- **Buenas prácticas Convex respetadas:** consultas por índice (no `.filter()`),
  `now` pasado desde el cliente para evitar `Date.now()` en queries, `await` en todas
  las promesas de BD. No hay `ctx.scheduler` con funciones `api`.
- `seedPlatform`, `cleanupQaArtifacts` y `seedOrbeSandbox` **sí** exigían superadmin.

## 2. Estado del aislamiento multi-tenant

**Sólido.** Probado con una sesión real de `tourGuest` contra el tenant ajeno
`orbe/sandbox` y contra su propio tour:

| Intento (como `tourGuest`) | Resultado |
|---|---|
| `saveTourSnapshot` en su propio tour | DENEGADO — «No autorizado para guardar este tour» |
| `saveTourSnapshot` en `orbe/sandbox` | DENEGADO |
| `getAdminSnapshot` en `orbe/sandbox` | DENEGADO — «No autorizado para este tour» |
| `saveGuestDraft` en `orbe/sandbox` | DENEGADO |
| `getGuestDraft` en `orbe/sandbox` | `null` (sin fuga) |
| `createAdminUser` con `isSuperadmin: true` (IDs válidos) | DENEGADO — «Se requiere superadmin» |
| `createOrganization`, `setOrganizationMaxTours`, `listUsers`, `getPlatformStats` | DENEGADO |
| `setTourPublished`, `importA11yPackage`, `syncPilotA11yPackage`, `evaluateTourFromDb` | DENEGADO |
| `syncCampusSpatialGraph` | DENEGADO |
| `saveGuestDraft` en su propio tour | PERMITIDO (solo overlay en `guestTourDrafts`) |

- El invitado **no escala privilegios** ni **persiste en producción**.
- `userCanEditTour` devuelve `false` para `isSuperadmin` → la regla de que
  **superadmin no edita contenido de tours se respeta** en todas las mutaciones de
  producción (`saveTourSnapshot`, media, spatial, branding, a11y, publicación).
- Las escrituras del invitado van a `guestTourDrafts` con clave `userId + tourId`.
- `saveTourSnapshot` revalida que el tour pertenezca al `orgSlug` solicitado, además
  del chequeo de membresía.

El único camino de fuga real no venía del RBAC, sino del transporte: el proxy sin
allowlist (#2) y Convex en `0.0.0.0` (#3).

## 3. Correcciones aplicadas

### Prioridad absoluta

1. **`convex/migratePilotMediaUrls.ts`** (ambos repos) — ahora exige
   `token: v.string()` + `requireSuperadmin`. Verificado: rechaza token forjado.
2. **`scripts/dev-server.mjs`** — allowlist de funciones en el proxy bajo
   `DEMO_PUBLIC`. Solo las funciones que la demo necesita llegan a la base de datos;
   el resto se corta con 403 **antes** de tocar Convex:
   - Queries: `graph:getTourGraph`, `graph:resolvePublicTour`,
     `graph:listPublishedDemos`, `branding:getPublicBranding`,
     `branding:getBrandingForAdmin`, `tourAdmin:assertTourEditorAccess`,
     `tourAdmin:getAdminSnapshot`, `tourAdmin:getGuestDraft`, `auth:me`,
     `auth:requireSession`, `organizations:listOrganizations`
   - Mutations: `auth:login`, `auth:logout`, `tourAdmin:saveGuestDraft`
   - Actions: ninguna (el código no define ninguna)

   Las mutaciones de producción (`saveTourSnapshot`, `media:*`, `branding:saveBranding`,
   publicación, a11y, seeds, migraciones) quedan **inalcanzables desde Internet**. El
   rol `tourGuest` no las usa, así que la demo no se ve afectada. Para editar contenido
   real: ejecutar **sin** `DEMO_PUBLIC`.

3. **`scripts/dev-server.mjs`** — rate limiting por IP real de cliente
   (`Cf-Connecting-Ip`, confiada solo si el peer es loopback), 600 req/min, y límite de
   cuerpo de 4 MB con 413.

4. **`ORBE/scripts/dev-server.mjs`** — portada la protección: blocklist de secretos
   (`.env*`, `convex/`, `docs/`, `backups/`, `.convex/`, `scripts/`, `node_modules/`,
   `_restos_exras_bloqueados/`, dotfiles), denegación previa al enrutado (cubre trucos
   codificados), solo `GET`/`HEAD` (405 en el resto), cabeceras `nosniff` y
   `Referrer-Policy`, y **corregida la contención de ruta** a `ROOT + path.sep`.

### Resto

5. **`convex/lib/authHelpers.ts`** (ambos repos) — `getUserBySession` valida
   `user.active`: desactivar un usuario invalida su sesión en todas las rutas.
6. **`convex/tourAdmin.ts`** — cota de 2 MB en el payload de `saveGuestDraft`.
7. **`scripts/dev-server.mjs`** — redacción de errores de Convex bajo `DEMO_PUBLIC`:
   se conserva el mensaje de negocio y se eliminan stack trace, rutas de archivo y
   validadores.
8. **`scripts/dev-server.mjs`** — `BLOCKED_FILES` en minúsculas (corrige la blocklist
   muerta) y añadidos `readme.md` / `leeme.md`.
9. **Cabeceras** bajo `DEMO_PUBLIC`: CSP ampliada con `object-src 'none'`,
   `base-uri 'self'`, `form-action 'self'`; `X-Frame-Options: DENY`;
   `Cross-Origin-Opener-Policy: same-origin`; eliminado
   `Access-Control-Allow-Origin: null` del proxy.
10. **Secretos fuera del repo** — `convex/seed.ts` (ambos repos) exige
    `SEED_SUPERADMIN_PASSWORD`, `SEED_ORGADMIN_PASSWORD` y `SEED_GUEST_PASSWORD` por
    variable de entorno Convex y falla con mensaje claro si faltan. Solo se leen al
    **crear** un usuario nuevo, así que re-sembrar el deployment actual no las necesita.
    `scripts/start-demo.mjs` lee `DEMO_GUEST_EMAIL` / `DEMO_GUEST_PASSWORD`.

### Verificación posterior

- Ataques desde el túnel: **403** en `migratePilotMediaUrls`, `seedPlatform`,
  `cleanupQaArtifacts`, `seedOrbeSandbox`, `saveTourSnapshot`, `createAdminUser`,
  `createOrganization`, `setTourPublished`, `syncCampusSpatialGraph`,
  `importA11yPackage`, `generateUploadUrl`, `saveBranding`, `listUsers`,
  `getPlatformStats`, `listTours`.
- Secretos y docs internos: **403** en `.env.local`, `AGENTS.md`, `CHANGELOG.md`,
  `LICENSE`, `UBICACION_Y_ARCHIVO.md`, `backlog.md`, `package.json`, `docs/…`,
  `convex/seed.ts`, `scripts/start-demo.mjs`, `backups/…`, `superadmin.html`,
  `org-admin.html`.
- Demo pública: **200** en `/`, tour, `control-web/`, `login.html`, `config.json`,
  `orbe-config.js`, CSS.
- Flujo invitado completo sobre el túnel: login → `auth:me` →
  `assertTourEditorAccess` (`role=tourGuest`, `persistProduction=false`) →
  `getAdminSnapshot` → `getBrandingForAdmin` → `saveGuestDraft` → `getGuestDraft`: **todo OK**.
- **Grafo intacto**: 62 escenas, 79 conexiones, 120 hotspots (79 nav / 41 info), con
  los valores `yaw`/`pitch` en precisión completa. **No se movió ningún hotspot.**
- Errores ya sin stack trace ni validadores.

## 4. Pendiente (y por qué)

| # | Pendiente | Motivo |
|---|-----------|--------|
| 3 | **Convex en `0.0.0.0:3210` / `:3211`** | Requiere reiniciar `npx convex dev`, lo que cortaría la demo en vivo. Es riesgo **solo de LAN** (el túnel apunta a 8081, no a 3210). Mitigación inmediata sin reiniciar, en PowerShell como administrador:<br>`New-NetFirewallRule -DisplayName "Block Convex LAN" -Direction Inbound -LocalPort 3210,3211 -Protocol TCP -Action Block -RemoteAddress LocalSubnet`<br>Tras la demo, arrancar el backend con bind a `127.0.0.1`. |
| 9 | **Rotar las tres contraseñas** | El código ya no las contiene, pero siguen en el historial de git y la del invitado se compartió con la clase. Rotar al terminar la demo (`auth:createAdminUser` / re-seed con las nuevas variables de entorno). |
| 13 | **Sesión en `localStorage`** | Migrar a cookie `HttpOnly`+`Secure`+`SameSite` exige cambiar el transporte de Convex y tocar login, Control Web y viewer. Cambio estructural, no apto con la demo en vivo. |
| 12 | **CSP estricta (`default-src` / `script-src`)** | Marzipano necesita scripts inline y workers `blob:`; una CSP estricta rompería el visor 360 ahora mismo. Requiere refactor a `nonce` y scripts externos. |
| 7 | **Ocultar `Request ID`** | Se mantiene para poder depurar la demo; no revela datos. |
| 15 | **`orbe/sandbox` en la landing** | Cosmético; quitar `published` al sandbox cuando no se use como escaparate. |
| 14 | **URL protocolo-relativa** | Sin fuga de datos; conviene normalizar `req.url` a ruta relativa antes de `new URL()`. |
| 16 | **Apache en `0.0.0.0:8080`** | Ajeno a Orbe; revisar si hace falta que escuche en toda la red. |

## 5. Veredicto

**Sí, es seguro continuar con la demo pública tal como está ahora** — después de estas
correcciones, y con una salvedad de red local.

Antes de la auditoría **no** lo era: cualquier persona con la URL podía reescribir las
escenas, hotspots y branding del tour del dueño con una sola petición sin autenticar.
Eso ya está cerrado por dos capas independientes (autenticación en la función y
allowlist en el proxy).

Situación actual frente a los cuatro objetivos marcados:

1. **Nadie desde Internet puede mutar la base de datos del dueño** — cumplido. Las
   únicas mutaciones alcanzables son `auth:login`, `auth:logout` y
   `tourAdmin:saveGuestDraft` (overlay por usuario, con cota de tamaño).
2. **Nadie lee secretos** — cumplido en la superficie del túnel (verificado).
3. **El invitado no escala privilegios** — cumplido (13 intentos de escalada denegados).
4. **No se puede saltar el aislamiento entre empresas** — cumplido vía túnel.

**Salvedad:** el objetivo 4 (y el 1) siguen siendo evitables por alguien **en la misma
red local** mientras Convex escuche en `0.0.0.0` (#3). Aplicar la regla de firewall de
arriba si la demo se presenta desde una red compartida; no es necesario para acceso por
Internet a través del túnel.

## 6. Recomendaciones para producción real

**Transporte y despliegue**

1. Convex gestionado (o self-hosted detrás de proxy inverso) con TLS; nunca exponer
   el backend de desarrollo. Bind a loopback siempre.
2. Sustituir el servidor estático de Node por un CDN / hosting estático. `dev-server.mjs`
   es una herramienta de desarrollo: no es un servidor endurecido.
3. Mantener el allowlist del proxy como patrón permanente (deny-by-default), no solo
   para la demo.

**Autenticación**

4. Mover la sesión a cookie `HttpOnly` + `Secure` + `SameSite=Lax` y añadir token CSRF.
5. Rotar el token al iniciar sesión, reducir la vida de 14 días a ~8 h con refresh, y
   añadir timeout por inactividad y revocación de sesiones por usuario.
6. Subir PBKDF2 a ≥600 000 iteraciones o migrar a Argon2id/scrypt.
7. Añadir MFA para `superadmin` y `orgAdmin`.
8. Rate limiting por IP además de por email en login, y bloqueo progresivo.

**Autorización**

9. Migrar a los wrappers `customQuery` / `customMutation` de `convex-helpers`
   (`authedQuery`, `orgMutation`, `tourEditorMutation`) para que el guard sea
   estructural. Hoy cada función repite `requireUser` + `userCanEditTour`, y basta
   olvidarlo una vez para reproducir el hallazgo #1.
10. Convertir seeds y migraciones en `internalMutation` para que no sean alcanzables
    por HTTP en absoluto.
11. Sustituir `v.any()` en `guestTourDrafts` por validadores explícitos.

**Operación**

12. ESLint con `@convex-dev/eslint-plugin` en CI (`no-floating-promises`,
    `require-argument-validators`) más un test de regresión que verifique que ninguna
    mutación pública carece de guard.
13. Desactivar mensajes de error detallados en producción; enviar el detalle a un
    servicio de observabilidad.
14. Escaneo de secretos en CI (gitleaks / trufflehog) y limpieza del historial de git
    de las credenciales ya expuestas.
15. Auditoría append-only de mutaciones de producción (quién cambió qué tour y cuándo)
    y backups automáticos del grafo antes de cada `saveTourSnapshot`.
16. CSP estricta con `nonce` tras extraer los scripts inline del visor.
17. Cuotas por organización en subida de media y validación de `Content-Type` y tamaño
    real del archivo, no solo del nombre.
