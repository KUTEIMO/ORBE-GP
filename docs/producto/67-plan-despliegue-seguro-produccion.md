# 67 — Plan de Despliegue Seguro en Producción (Entrega Final 15%)

**Fecha:** 2026-11-10  
**Estado:** Planificado para ejecutarse al recibir el material fotográfico 360° restante (Sede 4 Bloque G, Sede 1 Bloque A, Sede 3 Bloques E y F) previo al cierre del último 15% (`24/11/2026`).  
**Principio rector:** Mantener un único motor compartido (`AGENTS.md`), separar marca Orbe de marca cliente (`TourBranding`), cero exposición de secretos/herramientas internas y cero pérdida de grafos curados en Convex.

---

## 1. Diagnóstico del Entorno Actual vs. Producción

| Componente | Estado Actual (Avance 15% congelado) | Requisito para Despliegue Público Seguro (Cierre 15%) |
| :--- | :--- | :--- |
| **Backend y BD** | Convex local (`http://127.0.0.1:3210` en `.env.local`). | **Convex Cloud Production** (`https://<deployment>.convex.cloud`) con TLS automático. |
| **Configuración Runtime (`orbe-config.js`, `plataforma/config.js`)** | Resuelve `"http://127.0.0.1:3210"` en loopback y `""` en dominios externos. | Inyectar `window.__CONVEX_URL__` apuntando al deployment productivo (via script generado en deploy o `config.local.js` no versionado en secretos). |
| **Routing Virtual Multi-Empresa (`scripts/dev-server.mjs`)** | Reescribe `/{org}/{tour}/`, `/{org}/org-admin.html`, bloquea `BLOCKED_PREFIXES`/`BLOCKED_FILES` y legacy `/panoramas/` raíz. | Traducir las mismas reglas de rewrite, redirección `/plataforma/ -> /` y exclusión estática en `firebase.json` (Firebase Hosting) o equivalente CDN/Nginx TLS. |
| **Estudio de Audio / Voz Salomé (`POST /api/tts/salome`)** | `dev-server.mjs` ejecuta `python scripts/tts-salome.py` en local y sube el audio resultante a Convex File Storage. | En hosting estático puro no existe Python local. Ver sección 3 (pre-generación a Convex Storage o Action autenticada). |
| **Imágenes nuevas (Sede 4, 1 y 3)** | `sede-4` listo en borrador para carga por interfaz; piloto Unisimón curado en `experienciavirtual`. | Carga autenticada en **Convex File Storage** (`convex/media.ts`) o carpeta aislada `media/unisimoncucuta/{tourSlug}/panoramas/` tras respaldo previo. |

---

## 2. Arquitectura Segura Recomendada (Sin Duplicar el Motor)

1. **Capa de Datos y Archivos (Convex Cloud + Convex File Storage):**
   - Toda la gestión multi-rol (`platformUsers`, `organizations`, `tours`, `tourBranding`, `scenes`, `hotspots`, `connections`, `loginAttempts`) opera sobre HTTPS/WSS administrado por Convex.
   - Los panoramas nuevos y los audios MP3/WAV + subtítulos WebVTT subidos desde Control Web usan `convex/media.ts` (`generateUploadUrl`), con claves lógicas aisladas `orgs/{organizationId}/tours/{tourId}/panoramas/...` y validación estricta `userCanEditTour` (el `superadmin` permanece bloqueado para editar contenido de tours).
2. **Capa Web Estática (Firebase Hosting / Cloudflare Pages / Nginx TLS):**
   - Publicar **exclusivamente** las superficies web necesarias: `index.html`, `orbe-config.js`, `src/`, `css/`, `plataforma/`, `control-web/`, `vendors/` y `media/`.
   - Configurar **exclusión explícita en empaquetado (`ignore`)** para que jamás suban al CDN: `.env*`, `.git/`, `.convex/`, `convex/`, `docs/`, `scripts/`, `tests/`, `backups/`, `reports/`, `playwright-report/`, `test-results/`, `entregables-corte-*`, `node_modules/`, `package*.json`, `AGENTS.md`, `*.md`, `*.zip`.
   - Mantener **redirecciones y rewrites virtuales** en el hosting:
     - `/plataforma`, `/plataforma/`, `/plataforma/index.html` → `302 /`
     - `/:org/org-admin.html` → `/plataforma/org-admin.html`
     - `/:org/:tour/control-web` → `/control-web/index.html`
     - `/:org/:tour/panoramas/*` → `/media/:org/:tour/panoramas/*`
     - `/:org/:tour/` → `/index.html`
     - Bloqueo `404/410` sobre `/panoramas/*` y `/assets/*` compartidos de raíz.

---

## 3. Manejo Seguro de Estudio de Audio (Voz Salomé + Micrófono)

Al pasar de `scripts/dev-server.mjs` a un hosting estático HTTPS:

- **Vía recomendada (Cero superficie de abuso público):** Generar la narración con Voz Salomé o grabar la locución humana real desde Control Web en el entorno local autenticado antes de publicar cada bloque; el archivo `.mp3` resultante ya se almacena en **Convex File Storage** junto con su pista WebVTT. En producción pública el visor solo consume URLs firmadas/públicas de lectura del tour publicado, sin exponer ningún endpoint `POST /api/tts/salome` sin autenticación.
- **Vía alternativa (Si se requiere síntesis TTS desde la web pública):** Migrar `tts-salome.py` a una acción serverless (`"use node"` en Convex o Cloud Function) que **exija token de sesión válido (`requireUser` + permiso de editor sobre el tour)**, limite tamaño de texto y deshabilite peticiones anónimas para evitar abuso de cuota o SSRF.
- **Micrófono en navegador:** Exige origen seguro **HTTPS** (provisto automáticamente por Firebase Hosting / Cloudflare / Nginx TLS) y cabecera `Permissions-Policy: microphone=(self)`.

---

## 4. Checklist de Endurecimiento (Hardening Obligatorio Pre-Deploy)

Antes de abrir el enlace público definitivo para evaluación del 100%:

- [ ] **Respaldo previo del grafo:** Ejecutar `npm run backup:unisimon-graph` y crear tag anotado `estable-YYYY-MM-DD` en Git (`AGENTS.md` regla 8).
- [ ] **Rotación de credenciales y limpieza de secretos:**
  - Retirar credenciales de demostración en claro de repositorios públicos (p. ej. revisar `entregables-corte-2/CUENTAS_Y_CREDENCIALES_PROYECTO.txt` en el repo maestro antes de exposición final).
  - Definir contraseñas robustas (≥ 12 caracteres, aleatorias) en variables de entorno de Convex Prod: `SEED_SUPERADMIN_PASSWORD` y `SEED_ORGADMIN_PASSWORD`.
- [ ] **Bootstrap seguro de Convex Prod:**
  - Confirmar que `ALLOW_OPEN_SEED` **NO** está activo (`0` o inexistente) en producción (`convex/seed.ts`).
  - Usar `SEED_BOOTSTRAP_SECRET` únicamente durante el seed inicial y eliminarlo inmediatamente después (`npx convex env remove SEED_BOOTSTRAP_SECRET`).
- [ ] **Aislamiento de visibilidad pública:** Confirmar que `graph:getTourGraph` solo expone tours en estado `published` (los borradores como `sede-4` no se muestran al visitante hasta completar fotos y checklist a11y).
- [ ] **Cabeceras HTTP de seguridad en el hosting:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: microphone=(self), camera=(), geolocation=()`
  - `Content-Security-Policy` permitiendo solo `'self'` y el dominio exacto `https://<deployment>.convex.cloud` / `wss://<deployment>.convex.cloud` (más `blob:`/`data:` si Marzipano/audio local lo requiere en preview).
- [ ] **Prueba de rutas bloqueadas tras deploy:** Verificar por HTTP que `/docs/README.md`, `/.env.local`, `/convex/auth.ts`, `/backups/` y `/package.json` devuelven `403` o `404` en la URL pública.

---

## 5. Secuencia de Ejecución cuando Lleguen las Imágenes Restantes (Último 15%)

1. **Preparación de media y carga en entorno local validado:**
   - Optimizar panoramas equirectangulares nuevos de **Sede 4 (Bloque G)** y **Sedes 1 y 3 (Bloques A, E y F)** (formato WebP/JPG optimizado sin pérdida visual).
   - Cargar escenas, hotspots, conexiones, locuciones y subtítulos WebVTT en Control Web (`sede-4` y bloques pendientes) verificando `npm run check:a11y`.
   - Ejecutar `npm run backup:unisimon-graph` como respaldo inmediato de seguridad.
2. **Despliegue de Backend Productivo (`Convex Cloud`):**
   - Ejecutar `npx convex deploy` hacia el deployment de producción (nunca sobrescribir sin respaldo).
   - Configurar variables de entorno productivas y ejecutar bootstrap único sin `ALLOW_OPEN_SEED`.
   - Sincronizar el grafo curado, branding USB (`#0a7a45`, `--brand-ink`) y paquetes multimedia hacia producción.
3. **Despliegue de Frontend Estático Seguro (`Firebase Hosting` o equivalente):**
   - Configurar `firebase.json` con `ignore` estricto, rewrites virtuales multi-tenant y cabeceras HTTP de seguridad.
   - Inyectar `window.__CONVEX_URL__` de producción sin hardcodear secretos privados.
   - Publicar mediante `firebase deploy --only hosting`.
4. **Verificación Post-Despliegue y Cierre Académico (100%):**
   - Correr `npm run qa`, `npm run qa:authz`, `npm run check:a11y` y el 100% de la suite `npx playwright test` apuntando contra la URL productiva HTTPS.
   - Verificar carga en vivo de landing `/`, visor `/unisimoncucuta/experienciavirtual/`, `/unisimoncucuta/sede-4/`, login multi-rol y contraste WCAG 2.1 AA.
   - Actualizar `ENLACES_OFICIALES_DRIVE_GITHUB_Y_DESPLIEGUE.docx`, Gantt (`Fase 5: 100%`, `Fase 6: 100%`, `Fase 7: 100%`), `ORBE-GP` y firma final del Acta UAT antes del `24/11/2026`.
