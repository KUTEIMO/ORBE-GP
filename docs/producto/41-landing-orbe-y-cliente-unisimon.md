# 41 — Landing Orbe (B2B) + viewer cliente Unisimón

**Fecha:** 2026-09-14  
**Relacionados:** [39 identidad](./39-identidad-orbe-vs-cliente.md) · [40 fix identidad](./40-fix-identidad-separada.md) · [31 visión](./31-vision-producto-routing-diseno.md)

## Problema

Tras Soft Clay / sky Orbe (`#0284c7`), dos fugas de producto seguían visibles:

1. **Viewer Unisimón** (`/unisimoncucuta/experienciavirtual/`) aún *se sentía* Orbe: título HTML `Orbe360 — Tour virtual 360°` antes del paint, botón ORB/prominence de plataforma, y riesgo de que Convex/`tour-branding.json` con primary Orbe pintara el chrome del cliente.
2. **Landing `/`** se leía como portal admin / CRUD académico: “Acceso” en nav, CTA “Acceso administración”, fotos de campus Unisimón vendidas como portafolio multi-industria.

## Qué se fijó

### A) Paint path del tour público (cliente)

| Paso | Comportamiento |
|------|----------------|
| `index.html` early-boot | Path piloto → `--brand: #0a7a45` + título PEVCI **antes** de JS módulos |
| `bootPilotBrandingIfNeeded` / `applyTourBranding` | Re-aplica en `DOMContentLoaded` + tras `loadConfig` + `rAF` |
| `resolveClientBranding` | Si slug piloto y primary ∈ Orbe (`#0284c7`, `#009b3a`, …) → `UNISIMON_BRANDING_FALLBACK` |
| `graph:getTourGraph` / `getPublicBranding` | Misma sanitización server-side (sin tocar grafo/conexiones) |
| `tour-branding.json` | Sigue `#0a7a45`; si estuviera Orbe, el cliente lo rechaza |
| Header | Cliente (Unisimón) prominente; “Powered by Orbe360” / ORB **sutil** |

Control Web sigue siendo chrome Orbe (correcto). Soft Clay **no** aplica al viewer white-label.

### B) Landing Orbe = marketing B2B SaaS

| Antes (malo) | Ahora |
|--------------|--------|
| Acceso en nav / “Acceso administración” en CTA | Solo enlace discreto **Acceso** en footer |
| Fotos campus como Educación/Cultura/Turismo/Empresas | Caso único Unisimón etiquetado **Cliente · …**; usos = texto de posibilidades |
| Hero con campus sin framing | Hero abstracto Soft Clay / mesh Orbe |
| Lenguaje ops/CRUD | Valor **Explora / Descubre / Conecta** + plataforma white-label |

## Verificación

```bash
npm start          # :8081
npx convex dev     # branding live
npm run qa
npx playwright test
```

Checks clave:

- Playwright: `--brand` / inline `--brand` / `data-tour-brand-primary` = `#0a7a45` en path canónico; título sin Orbe360; menú no pinta sky Orbe.
- QA: `getTourGraph` / `getPublicBranding` Unisimón `#0a7a45`; landing sin login en nav/CTA band; sin category-strip de fotos falsas.
- Manual: hard refresh en `/unisimoncucuta/experienciavirtual/` — verde USB desde el primer paint; `/` vende Orbe, no el campus.

## No tocar

- Grafo / conexiones del piloto (`syncCampusSpatialGraph` / reset).
- Paleta Soft Clay de plataforma (`plataforma/tokens.css`).
