# 50 — Media por tour (Unisimón under tenant domain)

**Fecha:** 2026-09-14  
**Severidad:** trust-critical (multi-tenant media ownership)  
**Relacionados:** [49-aislamiento](./49-aislamiento-tour-media-roles.md) · [32-routing](./32-routing-multi-empresa-url.md) · [48-sandbox](./48-sandbox-orbe-editor-p1.md)

---

## Convención canónica

```text
media/{orgSlug}/{tourSlug}/
  panoramas/          # equirect JPGs (tour-owned)
  config.json         # basePath absoluto + lista estática fallback
  tour-graph.json     # offline / draft fallback
  biblioteca-scenes.json
  tour-branding.json
  hotspot-overrides.json
  assets/             # a11y: audio, transcripts, captions, scripts, timing
```

**URLs públicas (absolutas, como sandbox Orbe):**

| Recurso | Ejemplo |
|---------|---------|
| Panorama | `/media/unisimoncucuta/experienciavirtual/panoramas/R0010060_….JPG` |
| Config | `/unisimoncucuta/experienciavirtual/config.json` → disco `media/…/config.json` |
| A11y audio | `/media/unisimoncucuta/experienciavirtual/assets/audio/scenes/entrada-principal.mp3` |
| Sandbox Orbe | `/media/orbe/sandbox/panoramas/…` (intacto) |

No hay **config campus compartido** como default para otros tenants. Cada tour posee su host path, históricos y a11y.

---

## Qué se movió (Unisimón)

| Antes (shared root) | Después |
|---------------------|---------|
| `panoramas/*.JPG` (~62) | `media/unisimoncucuta/experienciavirtual/panoramas/` |
| `config.json`, `tour-graph.json`, `biblioteca-scenes.json`, `tour-branding.json`, `hotspot-overrides.json` | mismo tour root bajo `media/…/` |
| `assets/{audio,captions,transcripts,scripts,accessibility}/` | `media/unisimoncucuta/experienciavirtual/assets/…` |

Root `panoramas/` y `assets/` quedan **DEPRECATED** (solo `DEPRECATED.md`). El static server responde **410 Gone** a JPG/a11y bajo `/panoramas/` y `/assets/` (marketing `/` no sirve campus).

**MOVE** (no copia duplicada de JPG). Orbe sandbox ya tenía sus 4 panos propios.

---

## Cómo resuelve el host

`scripts/dev-server.mjs` → `mapTourRest(org, tour, rest)`:

1. `panoramas/*` → `media/{org}/{tour}/panoramas/*` (sin fallback a root).
2. `assets/*` → `media/{org}/{tour}/assets/*`.
3. `config.json` / tour JSON → `media/{org}/{tour}/…`.
4. `/media/…` absoluto → archivo en repo root.
5. Motor compartido (`css/`, `src/`, `control-web/`) sigue virtual bajo `/{org}/{tour}/`.

Convex (piloto): `imageUrl` / `narrationUrl` / transcript / caption reescritos **in-place** a paths absolutos `/media/unisimoncucuta/experienciavirtual/…`. **No** se tocan connections ni se ejecuta sync espacial.

---

## Scripts

```bash
node scripts/backup-unisimon-graph.mjs          # antes de tocar DB
node scripts/migrate-unisimon-media-to-tenant.mjs  # filesystem (idempotente)
npx convex run migratePilotMediaUrls:migratePilotMediaUrls  # URLs Convex
npm run sync:unisimon-graph                     # static tour-graph ← Convex (nunca vacío)
node scripts/gen-pilot-a11y-embed.mjs           # regenera embed a11y
```

npm: `migrate:unisimon-media` · `migrate:unisimon-urls` · `backup:unisimon-graph` · `sync:unisimon-graph`.

**Grafo post-migrate:** no dejar `tour-graph.json` vacío en el tenant — ver [51-grafo-post-migracion-media.md](./51-grafo-post-migracion-media.md).

---

## Checklist anti-leak

- [ ] `/orbe/sandbox/` → solo 4 escenas; media bajo `/media/orbe/sandbox/…`
- [ ] `/unisimoncucuta/experienciavirtual/` → campus; media bajo `/media/unisimoncucuta/experienciavirtual/…`
- [ ] Un JPG Unisimón **no** responde en `/media/orbe/sandbox/panoramas/{ese-archivo}` si no fue copiado al sandbox
- [ ] `/panoramas/R001….JPG` → **410** (no leak por root)
- [ ] `/` marketing sin panoramas Unisimón
- [ ] A11y Unisimón solo bajo `/media/unisimoncucuta/experienciavirtual/assets/…`
- [ ] Branding Unisimón sigue `#0a7a45`
- [ ] Conteo Convex piloto: escenas/conexiones **iguales** tras migrate URLs (solo paths cambian)

---

## Principio de producto

> Historical configs, host, accessibility = **own to each tour**.  
> Shared-root failures must not recur.
