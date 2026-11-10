# Informe QA — Orbe360 (Sprint 3)

Fecha: 2026-09-09  
Suite: `node scripts/qa-orbe.mjs`

## Resumen ejecutivo
Tras cablear Convex + Control Web + tour público y endurecer auth, la suite automatizada pasó **18/20** y luego **20/20** al corregir rutas de directorio (`/plataforma/` → `/plataforma/index.html` por limitación de `http-server` en Windows con espacios en path).

## Roles probados
| Rol | Resultado |
|-----|-----------|
| Visitante (HTTP páginas) | OK |
| Superadmin login / listUsers / me / logout | OK |
| Admin Unisimón login / bloqueo listUsers / bloqueo createOrg | OK |
| Atacante token falso / save sin auth | Rechazado OK |
| Fuerza bruta password corta / email inexistente | Rechazado OK |

## Seguridad (hallazgos y mitigaciones)
| Riesgo | Severidad | Estado |
|--------|-----------|--------|
| Seed público sin auth tras primer setup | Alta | Mitigado: solo 1ª vez; luego exige superadmin |
| Credenciales demo en login | Media | Mitigado: solo con `?demo=1` |
| localStorage como fuente del tour (desfase navegadores) | Alta (producto) | Mitigado: tour público prioriza Convex; draft solo con `?draft=1` |
| Guardar Control Web sin sesión | Media | Mitigado: modos edición requieren login; sync Convex con token |
| Hash SHA-256+salt (no bcrypt/argon2) | Media (MVP) | Documentado: mejorar en Sprint 4 prod |
| Rate limit login | Media | Parcial (validaciones); falta contador de intentos |
| Tokens en localStorage (XSS) | Media | Aceptado MVP; CSP/hardening Sprint 4 |

## Usabilidad
- Guías in-app en Superadmin, Org-admin y Control Web.
- Landing con demos / quiénes somos / accesibilidad.
- Control Web: mensaje claro si no hay sesión.

## Escalabilidad / estructura
- Schema multi-org listo (`organizations`, `memberships`, `tours`, …).
- Snapshot `tourAdmin:saveTourSnapshot` reemplaza hotspots/conexiones de forma atómica por tour.
- Separación curso (demo Unisimón) vs producto (Orbe360).

## Bugs corregidos en esta pasada
1. Tour/Cursor vs Chrome distintos → Convex como verdad pública.
2. Edición sin auth en Control Web → bloqueada a modo Ver.
3. Seed re-ejecutable sin control → restringido.
4. 404 en `/plataforma/` y `/control-web/` → links a `index.html`.
5. Passwords demo siempre visibles → ocultas.

## Pendiente Sprint 4
- Contador de intentos de login / bloqueo temporal.
- Subida real de panoramas a File Storage + UI guiada.
- CSP, cookies HttpOnly si se migra auth.
- Pruebas Playwright E2E (teclado, contraste, flujos UI).
- Limpiar escenas QA de prueba del deployment local.
