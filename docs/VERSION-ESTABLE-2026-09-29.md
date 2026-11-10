# Versión estable — 2026-09-29

Punto de restauración del producto **Orbe360** tomado antes de empezar el refactor de
arquitectura. **Nada de lo que hay aquí es destructivo:** el árbol de trabajo, el índice
y la rama `main` quedaron exactamente como estaban.

---

## 1. Qué funciona en este punto

| Superficie | Estado | URL local |
|-----------|--------|-----------|
| Landing Orbe360 | ✅ 200 | `http://127.0.0.1:8081/` |
| Visor Unisimón (piloto) | ✅ 200 | `http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/` |
| Login plataforma | ✅ 200 | `http://127.0.0.1:8081/plataforma/login.html` |
| Control Web (rol invitado) | ✅ | `…/unisimoncucuta/experienciavirtual/control-web/` |
| Org-admin / superadmin | ✅ (bloqueados en demo pública) | `/{org}/org-admin.html`, `/plataforma/superadmin.html` |
| Demo pública por túnel | ✅ 200 | `https://dog-them-forgot-criticism.trycloudflare.com` |
| `tsc` sobre `convex/` | ✅ sin errores | `npm run typecheck` |

Contenido: 62 panoramas Unisimón (243 MB) + 4 panoramas del sandbox Orbe (16 MB),
grafo de hotspots y conexiones vivo en Convex, paquete de accesibilidad por escena.

### Procesos vivos en el momento del snapshot

| PID | Proceso | Rol |
|-----|---------|-----|
| 54276 | `node scripts/start-demo.mjs` | Servidor estático :8081 con `DEMO_PUBLIC=1` |
| 53636 | `cloudflared tunnel --url http://127.0.0.1:8081` | Túnel público (**no reiniciar**) |
| 49220 | `convex dev` | Backend Convex :3210 |

> El servidor :8081 corre desde **PROTOTIPO-360-CURSOR-V1**, no desde este repo.
> Ver [arquitectura/01-auditoria-2026-09-29.md](arquitectura/01-auditoria-2026-09-29.md) § divergencia.

> Los PID del servidor estático cambian cuando se reinicia (ocurrió durante esta misma
> auditoría: 54276 → 38128). **El túnel sobrevive al reinicio** porque `cloudflared`
> apunta al puerto, no al proceso: la URL pública no cambió y siguió devolviendo 200.
> Eso es lo que hace viable la fase 3 del plan de unificación.

---

## 2. Dónde quedó el punto de restauración

### 2.1 Repo producto — `C:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE`

| Referencia | Valor |
|-----------|-------|
| Rama de respaldo | `backup/estable-2026-09-29` |
| Tag anotado | `estable-2026-09-29` |
| Commit | `8692fc14c6cb5b4e3ce37515a06e83a9593122d5` |
| Padre | `51123ae` (`main`) |
| Contenido | 208 archivos: código, docs y config (sin `media/`, sin `node_modules/`, sin `_restos_exras_bloqueados/`) |

### 2.2 Árbol que sirve la demo — `…\gestion de proyectos\PROTOTIPO-360-CURSOR-V1`

| Referencia | Valor |
|-----------|-------|
| Rama de respaldo | `backup/estable-2026-09-29-prototipo` |
| Tag anotado | `estable-2026-09-29-demo` |
| Commit | `7128c59528405369dbea85346e8504eccc747004` |
| Contenido | 208 archivos, estado exacto que sirve el túnel |

### 2.3 Copias fuera de git — `backups/estable-2026-09-29/`

| Archivo | Tamaño | Qué es |
|---------|--------|--------|
| `orbe-codigo-estable-2026-09-29.zip` | 0,61 MB | Árbol ORBE completo (código + docs + config) |
| `prototipo-codigo-estable-2026-09-29.zip` | 0,62 MB | Árbol PROTOTIPO completo |
| `media-manifest.csv` | 0,06 MB | 410 rutas de `media/` con tamaño y SHA-256 |

**`media/` no se copió** (272,8 MB) por tres razones: nunca ha estado en git, existe
íntegro y **byte a byte idéntico** en los dos árboles (verificado), y el manifiesto
permite detectar cualquier corrupción o borrado posterior.

---

## 3. Cómo volver a este estado

Ninguno de estos pasos toca el árbol de trabajo actual salvo que se indique.

### 3.1 Solo mirar el estado estable (recomendado primero)

```bash
git show estable-2026-09-29 --stat
git diff estable-2026-09-29 -- convex/schema.ts     # comparar un archivo
```

### 3.2 Recuperar un archivo suelto

```bash
git checkout estable-2026-09-29 -- convex/schema.ts
```

### 3.3 Trabajar sobre el estado estable sin tocar `main`

```bash
git switch -c rescate-2026-09-29 estable-2026-09-29
```

### 3.4 Restaurar el árbol completo en otra carpeta (cero riesgo)

```bash
git worktree add ../ORBE-estable estable-2026-09-29
```

O descomprimir `backups/estable-2026-09-29/orbe-codigo-estable-2026-09-29.zip`
en una carpeta nueva.

### 3.5 Verificar que `media/` sigue íntegro

```powershell
Import-Csv backups\estable-2026-09-29\media-manifest.csv | ForEach-Object {
  $p = Join-Path 'media' $_.Path
  if (-not (Test-Path $p)) { "FALTA: $($_.Path)" }
  elseif ((Get-FileHash $p -Algorithm SHA256).Hash -ne $_.SHA256) { "CAMBIÓ: $($_.Path)" }
}
```

> **Prohibido** para volver atrás: `git reset --hard`, `git clean -fd`,
> `git checkout --force`, `git push --force`. No hacen falta: todo lo anterior es aditivo.

---

## 4. Credenciales y secretos

Todo **redactado**. Los valores reales no se copian a documentación.

| Qué | Dónde vive | Nota |
|-----|-----------|------|
| `CONVEX_DEPLOYMENT`, `CONVEX_URL`, `CONVEX_SITE_URL` | `.env.local` | Ignorado por git (`.env.*`). No está en los respaldos. |
| Usuario invitado de la demo | `invitado@unisimon.local` / `<REDACTADO>` | ⚠️ La contraseña **está en claro** en `scripts/start-demo.mjs`, que sí está versionado. Ver riesgo R4 de la auditoría. |
| Contraseñas de seed | `convex/seed.ts` | Rotar antes de cualquier hosting compartido. |
| `ALLOW_OPEN_SEED` | variable de entorno Convex | Debe quedar desactivada fuera de local. |

---

## 5. Qué NO se tocó

- No se hizo commit en `main` de los 138 archivos modificados/sin trackear.
- No se movió ningún hotspot del tour.
- No se reinició `cloudflared` ni el servidor :8081.
- No se ejecutó `npm install` ni ningún cambio en el árbol PROTOTIPO que sirve la demo.
- La URL pública `https://dog-them-forgot-criticism.trycloudflare.com` sigue siendo la misma.

Verificación posterior a todos los cambios: las cinco URLs clave (local y túnel)
respondieron **200** y los tres procesos críticos seguían vivos.

---

*Punto de restauración creado el 2026-09-29. Auditoría asociada:
[arquitectura/01-auditoria-2026-09-29.md](arquitectura/01-auditoria-2026-09-29.md).*
