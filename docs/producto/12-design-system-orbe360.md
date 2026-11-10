# 12 — Design System Orbe360

Mini sistema de diseño para el sitio público, el acceso administrativo y los paneles. Fuente de verdad de tokens: [`plataforma/tokens.css`](../../plataforma/tokens.css).

> **Corrección 2026-09-29:** la fuente única de color de plataforma es
> [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md). El verde `#009b3a` que
> aparece más abajo en §Separación de estilos está **retirado**; el acento Orbe es `#0284c7`
> (ya reflejado en §Paleta). Escalas compartidas (espacio, radios, elevación, movimiento):
> [61-design-system-orbe-v2.md](./61-design-system-orbe-v2.md).

## Identidad

| Token | Valor |
|-------|--------|
| Marca | ORBE360 |
| Concepto | El espacio físico convertido en experiencia digital |
| Tagline | Explora. Descubre. Conecta. |
| Personalidad | tecnológica, inmersiva, profesional, educativa, accesible |

**Posicionamiento:** Orbe360 convierte espacios físicos en **experiencias digitales**, no “vende un tour 360”.

## Principios

1. **Fotografía / espacio como protagonista** — hero full-bleed, crops de panoramas reales.
2. **Experiencias reales antes que features técnicas** — lenguaje de usuario en público.
3. **Una sección, un propósito** — sin mezclar marketing y administración.
4. **Narrativa:** problema → experiencia → casos de uso → accesibilidad → CTA.
5. **Separación de voces:** público = experiencia; admin = sistema.

## Paleta

| Token CSS | Hex / valor | Uso |
|-----------|-------------|-----|
| `--orbe-accent` | `#0284c7` | Acento / CTA (no fondo de página) |
| `--orbe-accent-deep` | `#0369a1` | Hover CTA, énfasis |
| `--orbe-signal` | `#38bdf8` | Highlight sobre foto / dark |
| `--orbe-ink` | `#101828` | Texto principal |
| `--orbe-muted` | `#5a6a7e` | Texto secundario |
| `--orbe-paper` | `#f4f7fb` | Fondos secundarios |
| `--orbe-line` | `#dbe3ee` | Bordes / divisores |
| `--orbe-white` | `#ffffff` | Superficies |
| `--orbe-night` | `#0b1220` | Bandas oscuras |
| Overlay foto | `rgba(16, 24, 40, 0.42–0.68)` | Legibilidad sobre panoramas |

Aliases: `--orbe-green` / `--orbe-green-deep` → accent (compat).

**Separación:** ver [39-identidad-orbe-vs-cliente.md](./39-identidad-orbe-vs-cliente.md). El verde Unisimón `#0a7a45` **no** es chrome Orbe.

## Tipografía

- **Display:** Sora 600/700 — hero y H2.
- **Cuerpo / UI:** Outfit 400/500/600 — nav, párrafos, formularios.

| Rol | Familia | Peso | Tamaño |
|-----|---------|------|--------|
| Display / Hero | Sora | 700 | `clamp(2.5rem, 6vw, 4rem)` |
| H2 | Sora | 600–700 | ~1.75–2.25rem |
| Cuerpo | Outfit | 400–500 | 1.05–1.125rem |
| Labels / nav | Outfit | 500 | ~0.95rem, tracking ligero |

## Espaciado y layout

- Contenedor marketing: `min(1120px, 100% - 2.5rem)`
- Hero: full-bleed (sin card)
- Ritmo vertical de secciones: 5–7rem
- Cards solo donde hay interacción (CTA de experiencia), no por defecto

## Componentes públicos

| Componente | Rol |
|------------|-----|
| `PublicNav` | Inicio · Experiencias · Soluciones · Accesibilidad · Nosotros · Acceso (discreto) |
| `Hero` | Foto campus + headline + CTAs de exploración |
| `ValueTrio` | Explora / Descubre / Conecta |
| `ExperienceShowcase` | Caso publicado (datos Convex / fallback piloto Unisimón) + CTA |
| `CategoryStrip` | Educación, Cultura, Turismo, Empresas |
| `AccessibilityBlock` | Valor de inclusión + labels secundarios |
| `CtaBand` | CTA final de contacto/conocimiento |
| `Footer` | Tagline + Acceso (login; sin copy “administrativo” en marketing) |

## Separación de estilos

```text
plataforma/
  tokens.css       ← marca Orbe360 (--orbe-accent #0284c7) — NO es Unisimón
  marketing.css    ← solo sitio público
  admin-shell.css  ← login + paneles (SaaS limpio)

viewer (tour motor)/
  css/base.css     ← chrome neutro (--brand #2d6a4f por defecto)
  TourBranding     ← Convex + tour-branding.json override CSS vars del cliente
```

**Decisión de color:** `--orbe-accent` (#0284c7) de plataforma y el verde institucional Unisimón (#0a7a45) son **distintos a propósito**. No unificarlos: la plataforma no debe “volverse USB” ni el motor hardcodear el cliente.

`landing.css` está **deprecado**; no usarlo en páginas nuevas.

## Movimiento

1. Fade/slide del copy del hero al cargar (`heroIn`).
2. Ken-burns sutil en imagen hero (`heroKen`).
3. Pulso de marca ORBE360 sobre foto (`brandPulse`) + mesh drift en CTA band.

Respetar `prefers-reduced-motion: reduce`.

## Fotografía

Usar panoramas existentes con `object-fit: cover` + `object-position` (sin pipeline de crop):

- Hero: zona `entrada` (p. ej. R0010060)
- Showcase: hall / biblioteca
- Categorías: crops distintos del campus + overlay tipográfico

## Admin (identidad propia)

- Superficie densa, tipografía compacta, sin hero de marketing.
- Login: “Administración Orbe360” — sin explicar roles en el formulario público.
- `?demo=1` **no revela credenciales** (corregido; ver [53](./53-inventario-fugas-acceso.md) fuga #7). Solo indica que existe modo demo.

## Verificación

- Landing pública: cero mención de Superadmin / roles internos / limitaciones de demo.
- Tour anónimo: sin enlace a Control Web.
- CTAs verdes sobre foto: overlay obligatorio para contraste.
