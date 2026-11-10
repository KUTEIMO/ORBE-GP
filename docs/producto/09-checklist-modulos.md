# Checklist de módulos — mapa del sistema

## Mapa de rutas canónicas (usar siempre `.../index.html` en dirs)

| Módulo | URL canónica | Actor |
|--------|--------------|-------|
| Tour público Unisimón | `/index.html` o `/` | Visitante |
| Landing Orbe360 | `/plataforma/index.html` | Visitante |
| Login | `/plataforma/login.html` | Admin / Superadmin |
| Superadmin | `/plataforma/superadmin.html` | Superadmin |
| Org admin hub | `/plataforma/org-admin.html` | Admin tour |
| Control Web 360 | `/control-web/index.html` | Admin tour |
| Config Convex | `/orbe-config.js` + `/plataforma/config.js` | Sistema |

## Checklist por módulo

### Tour (`index.html` + `src/*`)
- [x] Carga config + biblioteca
- [x] Merge Convex si hay escenas
- [x] Engranaje → Control Web / login
- [x] Link plataforma ORB
- [x] Escenas subidas (solo Convex) se inyectan al grafo público
- [x] `imageUrl` http(s) de File Storage en viewer
- [ ] Destinos / hotspots coherentes tras save Convex (verificar manual F5)
- [ ] Accesibilidad menú/contraste/teclado (regresión)

### Landing (`plataforma/index.html`)
- [x] Quiénes somos / demos / a11y
- [x] Links a login y tour con `index.html` donde aplica
- [ ] Demos dinámicas desde Convex (fallback estático OK)

### Auth / Superadmin / Org-admin
- [x] Login roles
- [x] returnUrl
- [x] Bloqueo privilegios (QA)
- [x] Seed controlado

### Control Web
- [x] Requiere sesión para editar
- [x] Sync Convex al guardar
- [x] Links header a login / plataforma / tour
- [x] Upload panoramas (Sprint 4) — File Storage + registrar escena

### Backend Convex
- [x] Schema multi-org
- [x] auth / organizations / graph / tourAdmin / seed
- [x] File storage upload (`media:generateUploadUrl` + `attachPanoramaToScene`)
- [x] Rate limit login (`loginAttempts`)
- [ ] bcrypt/argon2 (Sprint 5)
- [ ] CSP headers (Sprint 5)
