# 62 — Landing dinámica: stack, media y roadmap storytelling

**Proyecto:** Orbe360  
**Fecha:** 2026-09-29  
**Relacionados:** [61 design system v2](./61-design-system-orbe-v2.md) · [39 identidad Orbe vs cliente](./39-identidad-orbe-vs-cliente.md) · [41 landing Orbe y cliente](./41-landing-orbe-y-cliente-unisimon.md) · [12 design system](./12-design-system-orbe360.md)

Referencias visuales del usuario: [anime.js](https://animejs.com), [Skiper UI](https://skiper-ui.com), [Mobbin](https://mobbin.com).

---

## 1. Stack recomendado

### 1.1 Animación

| Opción | Cuándo usar | Peso | A11y |
|--------|-------------|------|------|
| **CSS + WAAPI** (v1 actual) | Reveals, hover, orb hero, parallax ligero | ~0 KB extra | Fácil con `prefers-reduced-motion` |
| **GSAP + ScrollTrigger** | Pinning de secciones, timelines complejas al scroll, morph SVG | ~45 KB gzip (core+ScrollTrigger) | Requiere `matchMedia` + kill timelines |
| **anime.js v4** | Stagger de iconos, micro-interacciones puntuales, spring feel | ~17 KB gzip | Igual que GSAP; lazy-load vía CDN |

**Decisión v1:** CSS + IntersectionObserver + `requestAnimationFrame` en `marketing-motion.js`. Sin dependencias externas en la ruta crítica.

**Decisión v2 (opcional):** GSAP ScrollTrigger para **una** sección pinneada (p. ej. “Cómo funciona” con 3 pasos que se encadenan). anime.js solo si hace falta stagger no expresable en CSS (`animation-delay` por índice).

**No usar:** librerías de “scroll hijacking” pesadas (fullpage.js) — rompen accesibilidad y scroll nativo.

### 1.2 Scroll suave

| Librería | Rol |
|----------|-----|
| **Lenis** (~3 KB) | Inercia suave tipo Mobbin; opcional v2 |
| **CSS `scroll-behavior: smooth`** | Anclas `#valor`, `#caso`; ya activo |
| **ScrollTrigger** | Sincroniza animación con posición; v2 |

v1: scroll nativo + barra de progreso + fondo dinámico por capítulo (`data-story-chapter`).

### 1.3 i18n

| Enfoque | v1 | v2 |
|---------|----|----|
| **JSON inline + `data-i18n`** | ES/EN en `marketing-i18n.js`; toggle en nav | Mismo formato, más claves |
| **Formato estándar** | Claves planas `nav.oferta`, `hero.title` | Migrar a ICU/`{count}` si hay plurales |
| **Alternativa futura** | — | `@formatjs/intl` o `i18next` si >3 idiomas |

Persistencia: `localStorage.orbe_lang` (`es` | `en`). `<html lang>` se actualiza al cambiar.

### 1.4 Modo oscuro / claro

- Atributo `data-theme="light"|"dark"` en `<html>`.
- Tokens en `plataforma/tokens.css` bajo `[data-theme="dark"]`.
- Persistencia: `localStorage.orbe_theme`.
- Respetar `prefers-color-scheme` solo si el usuario **no** eligió manualmente (v1: elección explícita gana).

### 1.5 Accesibilidad

- Skip link, landmarks, headings en orden.
- Focus visible (`:focus-visible`) — ya en tokens.
- **`prefers-reduced-motion: reduce`:** desactivar parallax, animaciones CSS, transiciones de reveal; mantener contenido visible.
- Toggle tema: `aria-pressed`, etiquetas i18n.
- Barra de progreso: `role="progressbar"` + `aria-valuenow`.
- No afirmar NVDA/TalkBack sin verificación en dispositivo (regla AGENTS.md).
- Contraste WCAG AA en ambos temas (sky `#0284c7` sobre blanco y sobre `#0b1220`).

---

## 2. Generación de media (sin JPG rotos del tour)

### 2.1 Qué conectar

| Herramienta | Uso en Orbe360 landing |
|-------------|------------------------|
| **Cursor `GenerateImage`** (MCP `cursor`) | Fondos abstractos mesh, texturas grain, ilustraciones hero — **nunca** screenshots del tour |
| **Phosphor Icons** / **Lucide** | Iconografía consistente; v1: SVG inline + sprites en `plataforma/assets/shapes/` |
| **SVG hand-coded** | Orbes, anillos 360°, chips a11y — ya en hero/caso |
| **Figma / Penpot** | Export SVG para marketing; design tokens alineados a doc 61 |
| **Squoosh / sharp** | Optimizar PNG/WebP si se generan fondos raster |
| **Convex** | Solo datos dinámicos del **caso publicado** (`listPublishedDemos`), no media del tour en hero |

### 2.2 Qué evitar

- Panoramas JPG del campus en la landing Orbe (confunde marca cliente vs plataforma).
- Stock “AI slop” purple-gradient-on-white.
- Banners “demo” o watermarks de prototipo.

### 2.3 Pipeline sugerido para v2

1. Brief por sección (hero, problema, a11y) → prompt en GenerateImage: *“abstract sky blue mesh, no text, 16:9, Orbe brand #0284c7”*.
2. Export WebP + fallback SVG/CSS gradient (v1 ya usa gradientes puros).
3. Iconos: pack Lucide subset → sprite `<symbol>` en un solo SVG.
4. Revisión contraste en light/dark antes de publicar.

---

## 3. Arquitectura storytelling (scroll = historia)

```text
Capítulo 0 — HERO          → “ORBE360 · Tu sede, visitable por todos”
Capítulo 1 — PROBLEMA      → Visitantes excluidos, tours opacos, marca perdida
Capítulo 2 — SOLUCIÓN      → Motor + white-label + control institucional
Capítulo 3 — FLUJO         → Prepara → Configura → Publica
Capítulo 4 — ACCESIBILIDAD → WCAG-oriented, audio, teclado, contraste
Capítulo 5 — CASO          → Unisimón (cliente); Orbe detrás
Capítulo 6 — CTA           → Acceder / explorar caso
```

Cada `<section>` lleva `data-story-chapter="N"`. JS actualiza `--mk-bg-hue`, `--mk-bg-depth` en el fondo fijo según capítulo visible (IntersectionObserver + scroll %).

Nav sticky: enlaces ancla + progreso visual + toggles tema/idioma.

---

## 4. v1 vs v2

### v1 (implementado 2026-09-29)

- [x] Modo claro/oscuro + localStorage
- [x] i18n ES/EN parcial (nav, hero, secciones clave, footer)
- [x] 7 capítulos con reveals + parallax hero
- [x] Fondo dinámico por scroll (gradientes/mesh CSS, sin JPG)
- [x] Barra de progreso de scroll
- [x] Footer con declaración de accesibilidad
- [x] Iconografía SVG ampliada
- [x] `prefers-reduced-motion`

### v2 (backlog)

- [ ] Lenis scroll suave (opt-in, respetando reduced motion)
- [ ] GSAP ScrollTrigger: sección “flujo” pinneada
- [ ] i18n completo + meta/SEO por idioma
- [ ] Sprite Lucide/Phosphor unificado
- [ ] Imágenes GenerateImage optimizadas por capítulo
- [ ] Métricas: Core Web Vitals, lazy anime.js solo en hover de cards
- [ ] Tests Playwright: toggle tema, idioma, progressbar

---

## 5. Peso y performance

| Recurso | Objetivo |
|---------|----------|
| CSS marketing + tokens | < 25 KB sin comprimir |
| JS motion + i18n | < 8 KB |
| Fuentes Google (Outfit + Syne) | `display=swap`, preconnect |
| LCP | Hero texto + orb CSS (sin imagen LCP pesada) |
| CLS | Reservar altura hero `100dvh`, no inject layout |

**`prefers-reduced-motion`:** una sola media query desactiva animaciones, parallax y transiciones de reveal; el fondo dinámico salta por capítulo sin interpolación.

**CDN anime.js:** solo v2 y con `import()` dinámico tras `requestIdleCallback` si se justifica stagger no CSS.

---

## 6. Archivos de la landing

| Archivo | Responsabilidad |
|---------|-----------------|
| `plataforma/index.html` | Estructura, capítulos, toggles, i18n hooks |
| `plataforma/marketing.css` | Layout, temas, motion CSS, responsive |
| `plataforma/marketing-motion.js` | Scroll, reveals, parallax, fondo, tema |
| `plataforma/marketing-i18n.js` | Diccionario ES/EN |
| `plataforma/tokens.css` | Paleta Orbe + overrides dark |

Cache-bust en query string: `?v=20260929d` o superior.

---

## 7. Sync demo :8081

Copiar `plataforma/*` modificados a `PROTOTIPO-360-CURSOR-V1` (mismo árbol). No reiniciar cloudflared. Hard refresh en URL pública tras sync.
