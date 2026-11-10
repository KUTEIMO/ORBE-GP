# 38 — Soft Clay UI (P0 visual)

**Proyecto:** Orbe360  
**Fecha:** 2026-09-14  
**Plan origen:** [31-vision-producto-routing-diseno.md](./31-vision-producto-routing-diseno.md) §A  
**Tokens:** `plataforma/tokens.css` (`--orbe-clay-*`)

## ¿Qué pasó con Soft Clay? (auditoría)

En el doc **31** (2026-09-11) Soft Clay quedó definido como sistema primario de plataforma, pero **ese pase fue solo documentación**. El trabajo siguiente priorizó **routing multi-empresa** (docs 32–35: `/` = marketing, `/{org}/{tour}/`, assets, landing). El restyle Soft Clay quedó **aplazado a propósito** para no mezclar migraciones de URL con un rediseño visual.

**Estado ahora:** P0 Soft Clay **implementado** en chrome de plataforma + Control Web (superficies/nodos). El viewer público del cliente **no** adopta Soft Clay Orbe (white-label Unisimón / TourBranding).

## Alcance aplicado

| Superficie | Archivos | Qué cambió |
|------------|----------|------------|
| Landing `/` | `marketing.css`, `tokens.css` | Atmósfera suave, CTAs clay (verde Orbe), showcase body elevado; hero foto intacto |
| Login / org-admin / superadmin | `admin-shell.css` | Fondo con profundidad, cards/botones clay, login card elevado |
| Control Web | `admin.css`, nodos SVG | Paneles clay, banner seguridad grafo, nodos/edges con más lift; **datos e interacción intactos** |
| Tour público 360 | `css/*`, Marzipano | **Sin** Soft Clay Orbe — chrome cliente / branding |

## Tokens

| Token | Uso |
|-------|-----|
| `--orbe-clay-surface` / `-tint` / `-depth` | Superficies elevadas |
| `--orbe-clay-shadow` / `-sm` | Una elevación difusa |
| `--orbe-clay-inset` | Highlight superior sutil |
| `--orbe-clay-radius` / `-admin` | 16px marketing · 12px admin |
| `--orbe-clay-node` / `-edge` | Grafo Control Web |
| `--cw-clay-*` | Espejo local en Control Web |

## Qué no se hizo (a propósito)

- Neomorphism agresivo / texturas de barro.
- Purple glow, cream+serif terracotta, broadsheet.
- Soft Clay sobre el hero fotográfico.
- Unificar verde Orbe (`#0284c7`) con Unisimón (`#0a7a45`).
- Cambiar modelo de drag nodo→nodo ni persistencia del grafo.

## Contraste

| CTA primario | blanco sobre `#0284c7` / `#0369a1` | Texto ink sobre paper/white. Focus rings sky semitransparentes. |

Ver paleta completa y separación Unisimón: [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md).

## Verificación manual

1. `/` — hero foto + CTAs soft elevated.
2. `/plataforma/login.html` — card clay.
3. Org-admin / superadmin — paneles elevados.
4. Control Web — nodos verdes soft; mismas conexiones tras Guardar.
5. `/unisimoncucuta/experienciavirtual/` — branding cliente, no look Orbe Soft Clay.
