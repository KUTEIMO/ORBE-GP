# 52 — Control Web authz (editors only)

**Fecha:** 2026-09-14  
**Severidad:** trust-critical (acceso admin sin cuenta/org)  
**Producto:** Control Web = **solo editores** con membresía. El tour público `/{org}/{tour}/` puede seguir público.

---

## Amenaza

Cualquier persona (o cuenta de **otra** org) abría:

`http://127.0.0.1:8081/orbe/sandbox/control-web/`

y veía **modos de edición**, lista de panoramas y grafo local — sin membresía en `orbe`. El soft-gate (“Modo lectura”) **no** es seguridad.

## Política (universal — cualquier usuario futuro)

No hay allowlist de emails (`admin@orbe.local`, piloto, etc.).

| Paso | Regla |
|------|--------|
| 1 | Sesión válida (`sessions` + `platformUsers.active`) vía token `orbe360.session` |
| 2 | Usuario **no** superadmin (ops de plataforma ≠ editor de tour) |
| 3 | Tour resuelto por **`orgSlug` + `tourSlug`** (nunca slug global solo en APIs admin) |
| 4 | Fila en `memberships` para `(userId, organizationId)` con rol `orgAdmin` **o** `tourEditor` |

Implementación: `getUserBySession` / `requireUser` + `userCanEditTour` (membership). Usuarios creados mañana con `auth:createAdminUser` + membership heredan la misma regla.

## Fix

| Capa | Cambio |
|------|--------|
| Cliente | `control-web/auth-gate.js` → `requireControlWebAccess` **antes** de cargar config/panoramas/modos |
| UI | `body.cw-locked` oculta editor; sin sesión → `/plataforma/login.html?return=…`; sin membresía → **Acceso denegado** (sin modos) |
| Convex | `tourAdmin:assertTourEditorAccess` (ok/reason, sin filtrar grafo) |
| APIs admin | `getAdminSnapshot` / `saveTourSnapshot` / branding admin exigen `orgSlug` + membership |
| org-admin | URL de org ajena → redirect a org propia (`?deniedOrg=`) |

## Cómo verificar

### Automático

```bash
node scripts/verify-control-web-authz.mjs
# o incluido en:
npm run qa
```

### Manual (dos cuentas seed)

1. Incógnito → `/orbe/sandbox/control-web/` → **login** con `return` al path.
2. Login `admin@unisimon.local` → mismo URL → **Acceso denegado** (no modos).
3. Login `admin@orbe.local` → mismo URL → editor OK.

### Tercer usuario (no seed) — prueba de universalidad

1. Superadmin crea usuario con `auth:createAdminUser` (membresía `tourEditor` en org `orbe`).
2. Ese usuario entra a `/orbe/sandbox/control-web/` → **OK**.
3. Mismo usuario en `/unisimoncucuta/experienciavirtual/control-web/` → **denegado**.
4. El script `verify-control-web-authz.mjs` automatiza crear/limpiar este usuario QA.

## Confirmación

- Control Web **ya no** abre para cuenta incorrecta / sin cuenta.
- Políticas son **membership/role**, no emails hardcodeados.
- Tour público intacto; grafo Unisimón **no** se toca en este fix.

### Accesibilidad del motor 360 (sin regresión)

Este slice **no** modifica el viewer público ni el canal a11y: TalkBack/lector de pantalla, dual-channel (audio + texto), teclado, `srSummary` / narración / captions, ni `accessibilityPublish`.  
`/{org}/{tour}/` sigue público con el mismo motor a11y. Solo se endureció la superficie **Control Web / admin APIs**.

Ver inventario de fugas: [53-inventario-fugas-acceso.md](./53-inventario-fugas-acceso.md).
