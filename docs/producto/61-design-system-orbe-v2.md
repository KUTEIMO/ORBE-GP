# 61 — Design System Orbe v2: tokens compartidos, movimiento y decisión anime.js

**Proyecto:** Orbe360
**Fecha:** 2026-09-29
**Relacionados:** [12 design system](./12-design-system-orbe360.md) · [38 Soft Clay](./38-soft-clay-ui.md) · [39 identidad Orbe vs cliente](./39-identidad-orbe-vs-cliente.md) · [42 branding data-driven](./42-branding-multi-empresa-data-driven.md) · [55 grafo y guardado](./55-grafo-y-guardado-control-web.md)

---

## 1. Problema que resuelve

Antes de este doc había **tres sistemas de diseño paralelos sin base común**:

| Superficie | Archivo raíz | Tokens propios |
|------------|--------------|----------------|
| Marketing + admin plataforma | `plataforma/tokens.css` | color, sombras, radios, `--orbe-t-*` |
| Control Web (operador) | `control-web/admin.css` | `--cw-*`, `--shadow`, `--radius` |
| Viewer del tour (motor) | `css/base.css` | `--brand*`, radios sueltos, duraciones inline |

Consecuencias reales medidas en el repo:

1. **Radios y sombras divergentes** entre panel admin y viewer sin razón de diseño.
2. **Duraciones de transición escritas a mano** (`0.2s`, `.18s`, `250ms`, `0.3s`) en decenas de reglas → imposible ajustar el ritmo del producto de forma global.
3. **`prefers-reduced-motion` implementado a parches**: cada archivo decidía qué desactivar, y varias animaciones nuevas quedaban fuera.
4. **Fugas de identidad**: verde Orbe retirado (`#009b3a`) y azul Orbe (`#0284c7`) apareciendo en superficies white-label del cliente, contra la regla del doc 39.

## 2. Arquitectura elegida: una capa incolora compartida

Nuevo archivo: **[`css/design-tokens.css`](../../css/design-tokens.css)**.

```text
css/design-tokens.css          ← escalas compartidas, SIN color de marca
   ├── importado por css/base.css            (motor del viewer → todo tour lo hereda)
   ├── importado por plataforma/tokens.css   (marketing + login + org-admin + superadmin)
   └── importado por control-web/admin.css   (chrome de operador)
```

**Contrato no negociable: la capa compartida no define un solo color de marca.**
Solo escalas neutras: espacio, radios, elevación, movimiento, z-index, tipografía y foco. El color sigue viviendo donde manda el doc 39/42:

- Chrome Orbe → `plataforma/tokens.css` (`--orbe-accent #0284c7`).
- Tour del cliente → Convex `tourBrandings` → variables `--brand*` en runtime.

Así se cumple lo que el doc 42 exige: **onboarding de la empresa #2 sin tocar CSS del motor**. Si los tokens compartidos tuvieran color, cada cliente nuevo obligaría a editar el motor.

### Por qué `@import` y no un bundler

El repo es **web estática sin build step** (ver [05-como-levantar.md](./05-como-levantar.md)): ES modules nativos, sin Vite/Webpack. `@import` al inicio del archivo es el único mecanismo nativo de composición CSS disponible.

Coste: una petición extra de ~5 KB, cacheada, sin bloquear el render del panorama.

Riesgo verificado: bajo el routing virtual del doc 32, `/{org}/{tour}/css/design-tokens.css` **no** cae en el aislamiento de media por tenant (`mapTourRest` solo reasigna `panoramas/`, `assets/` y los JSON del tenant), así que resuelve al motor compartido. Comprobado con 200 en ambas rutas — ver §7.

## 3. Inventario de tokens

### Espacio

`--orbe-space-1` … `--orbe-space-12` → `0.25rem` … `3rem`. Escala de 4px con saltos útiles; sustituye los `padding: 0.55rem 0.85rem` inventados caso por caso.

### Radios

| Token | Valor | Uso |
|-------|-------|-----|
| `--orbe-rad-xs` | `6px` | chips, tags, badges pequeños |
| `--orbe-rad-sm` | `8px` | inputs, botones compactos |
| `--orbe-rad-md` | `12px` | cards, paneles, listas |
| `--orbe-rad-lg` | `16px` | contenedores mayores |
| `--orbe-rad-xl` | `22px` | hero / bloques Soft Clay |
| `--orbe-rad-pill` | `999px` | cápsulas, switches, indicadores |

### Elevación

Una sola familia de sombras derivada de un **tinte configurable**, no de negro puro:

```css
--orbe-elev-shadow-hue: 16, 24, 40;   /* = --orbe-ink, sombra "tinta" no gris sucio */
--orbe-elev-1 … --orbe-elev-4
--orbe-elev-inset                      /* borde superior lechoso: la clave del look Soft Clay */
```

Cuatro niveles bastan: `1` reposo, `2` card, `3` panel flotante, `4` modal/overlay. Cualquier sombra nueva debe usar un nivel existente.

### Movimiento (el token con más impacto)

```css
--orbe-dur-instant: 80ms    /* feedback de pulsación */
--orbe-dur-fast:   140ms    /* hover, focus */
--orbe-dur-base:   200ms    /* transición estándar de UI */
--orbe-dur-slow:   320ms    /* entrada de panel / modal */
--orbe-dur-slower: 520ms    /* transición de escena, celebraciones */

--orbe-ease-out:     cubic-bezier(0.22, 1, 0.36, 1)     /* entra: rápido y frena */
--orbe-ease-in-out:  cubic-bezier(0.4, 0, 0.2, 1)       /* mueve entre dos estados */
--orbe-ease-spring:  cubic-bezier(0.34, 1.4, 0.64, 1)   /* overshoot controlado */
--orbe-ease-exit:    cubic-bezier(0.4, 0, 1, 1)         /* sale: acelera y desaparece */

--orbe-lift: -1px           --orbe-lift-strong: -3px
--orbe-rise: 0.5rem         --orbe-scale-press: 0.985
--orbe-stagger: 40ms
```

**Vocabulario de movimiento** (regla de uso, no sugerencia):

| Gesto | Duración | Curva | Transform |
|-------|----------|-------|-----------|
| Hover de botón/card | `fast` | `ease-out` | `translateY(var(--orbe-lift))` |
| Pulsación | `instant` | `ease-out` | `scale(var(--orbe-scale-press))` |
| Aparición de panel/modal | `slow` | `ease-out` | opacidad + `translateY(var(--orbe-rise))` |
| Selección en control segmentado | `base` | `ease-spring` | desplazamiento del indicador |
| Cierre / descarte | `fast` | `ease-exit` | opacidad |
| Entrada en lista | `slow` | `ease-out` | `orbe-fade-up` + delay `--orbe-stagger × i` |

### Z-index

`base 0 · hud 10 · header 30 · backdrop 900 · panel 1000 · toast 1200 · gate 1500`.
Elimina los `z-index: 9999` competitivos. El **gate de autenticación** es deliberadamente el más alto: ningún panel puede dibujarse encima del bloqueo de acceso (doc 52).

### Tipografía, foco y densidad

`--orbe-fs-2xs` … `--orbe-fs-2xl` (los grandes con `clamp()` para fluidez), `--orbe-lh-tight|base|loose`, `--orbe-track-caps` para labels en mayúsculas, `--orbe-focus-w` / `--orbe-focus-offset` para un anillo de foco consistente, y `--orbe-row-h` / `--orbe-control-h` para densidad de listas y controles.

## 4. `prefers-reduced-motion`: un solo interruptor

El cambio de fondo más importante del sistema:

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --orbe-dur-instant: 1ms; --orbe-dur-fast: 1ms; --orbe-dur-base: 1ms;
    --orbe-dur-slow: 1ms;    --orbe-dur-slower: 1ms;
    --orbe-ease-spring: linear;    /* mata el overshoot, que marea */
    --orbe-lift: 0px; --orbe-lift-strong: 0px; --orbe-rise: 0px;
    --orbe-scale-press: 1; --orbe-stagger: 0ms;
  }
}
```

Consecuencia: **cualquier animación futura escrita con tokens respeta reduced-motion sin escribir una línea extra de media query.** No solo se acorta la duración — también se anula el overshoot del spring y el desplazamiento espacial, que son las dos causas reales de malestar vestibular. Es lo correcto para un producto cuyo argumento de venta es la accesibilidad (`docs/producto/14`, `19`, `24`).

Sigue siendo necesario un bloque `reduce` explícito para animaciones **en bucle** (el pulso del hotspot, el shimmer del skeleton): una duración de 1ms en bucle es peor que nada. Esos casos se desactivan con `animation: none`.

### Utilidades

`.orbe-anim-fade-up` y `.orbe-anim-pop-in`, con `--orbe-anim-delay` para escalonar sin JS. Keyframes compartidos: `orbe-fade-up`, `orbe-pop-in`, `orbe-shimmer`.

## 5. Decisión: anime.js — **no adoptar ahora**

Evaluado [anime.js v4](https://animejs.com) frente a CSS + tokens.

### Lo que anime.js v4 ofrece bien

API modular y moderna (`animate`, `createTimeline`, `stagger`, `createDrawable`, `morphTo`, `createMotionPath`, `createDraggable`, `createSpring`, `onScroll`, `createScope`), con pesos por módulo declarados: Timer 5.60 KB, +Animation 5.20, +Timeline 0.55, Draggable 6.41, Scroll 4.30, SVG 0.35, Spring 0.52 — **24.50 KB el bundle completo**.

### Por qué se rechaza hoy

1. **Sin bundler no hay tree-shaking.** El repo carga ES modules directamente desde el navegador. La modularidad de v4 solo paga si un empaquetador elimina lo no usado. Aquí se enviarían ~25 KB para usar el 10%.
2. **Todo lo que el producto necesita hoy ya se resuelve en CSS a 0 KB.** El inventario completo de micro-interacciones de esta iteración — elevación y pulsación de botones, spring del control segmentado, parpadeo del badge "cambios sin guardar", anillo de "listo para guardar", entrada de panel y modal, skeleton shimmer, pulso del hotspot, entrada escalonada de listas — es CSS declarativo.
3. **Reduced-motion sale gratis en CSS y hay que programarlo en JS.** Con anime.js cada llamada necesita consultar `matchMedia('(prefers-reduced-motion: reduce)')`. Es exactamente el tipo de comprobación que se olvida y degrada la accesibilidad que este producto vende.
4. **Presupuesto de rendimiento del viewer.** El visor ya carga Marzipano, panoramas equirectangulares de varios MB y audio. El presupuesto de JS debe ir a WebGL y media, no a un motor de tweens.
5. **Coste de mantenimiento.** Animación en CSS vive junto al componente y la ve cualquiera que lea el archivo; animación en JS se dispersa entre módulos y se rompe silenciosamente cuando el DOM se reconstruye (el grafo de Control Web se re-renderiza con `innerHTML` en cada selección — un timeline JS colgado de esos nodos quedaría huérfano en cada clic).

### Criterios de adopción futura (cuándo sí)

Adoptar anime.js cuando aparezca **al menos una** de estas necesidades, importando **solo** el módulo requerido:

| Necesidad | Módulo | Feature del roadmap |
|-----------|--------|---------------------|
| Trazado progresivo de líneas SVG (rutas del grafo dibujándose) | `svg` + `createDrawable` (~5.9 KB) | polilíneas / paths P3 ([46](./46-gap-editor-tours-inmersivos.md)) |
| Recorrido sobre una trayectoria (tour guiado automático) | `createMotionPath` | rutas guiadas P4 ([47](./47-estudio-motores-360-y-estrategia.md)) |
| Arrastre con física real de nodos del grafo | `createDraggable` (~6.4 KB) | editor de grafo avanzado |
| Morph entre formas de iconos de hotspot | `morphTo` | polish de viewer |

Condición previa en los cuatro casos: envolver en `createScope()` con `mediaQueries` para que reduced-motion siga siendo automático, y cargarlo **solo en la superficie que lo usa** (nunca en el viewer público si es una feature del editor).

**CSS no cubre** trazado de paths SVG, morphing de formas, seguimiento de trayectorias ni física de arrastre. Esa es la frontera: cuando el diseño cruce esa línea, anime.js es la respuesta correcta; antes, es peso muerto.

## 6. Qué se aplicó con estos tokens

| Archivo | Cambio |
|---------|--------|
| `css/design-tokens.css` | **nuevo** — la capa compartida |
| `css/base.css` | importa la capa → todo tour la hereda |
| `plataforma/tokens.css` | importa la capa |
| `control-web/admin.css` | importa la capa; eliminada regla duplicada `.btn--accent` que pintaba los CTA del editor en verde (`var(--accent, #1f7a4c)` sin `--accent` definido en ese archivo → violaba el doc 39) |
| `control-web/admin-pro.css` | **nuevo** — capa aditiva de rediseño del panel (§8 regla 4); reduced-motion en bucles; estilos `safety-tech` / `list-empty` |
| `control-web/index.html` | carga `admin-pro.css` tras `admin.css`; banner de protección del grafo colapsable; detalle técnico Convex en `<details>` anidado; copy de la barra de estado y empty del editor |
| `css/components/hotspots.css` | halo derivado de `--hotspot-accent` en lugar de `rgba(0,155,58,.55)` (verde Orbe retirado filtrándose al viewer white-label); keyframe `hotspot-pulse` con halo visible (antes `rgba(2,132,199,0)` → alpha 0, animación muerta); anillo de foco real |
| `css/components/hotspot-panel.css` | bloque aditivo: entrada con tokens preservando el centrado `translate(-50%,-50%)`, acento del header y controles de audio vía `--brand` |
| `plataforma/index.html` | hero oferta + sección `#control` (mensajes 3–4 doc 60); copy a11y sin “prototipo” |
| `plataforma/marketing.css` | estilos `.pillar-duo` |
| `convex/seedOrbeSandbox.ts` + `lib/branding.ts` | nombre visible «Espacio de pruebas Orbe» (slug `sandbox` intacto) |

**Restricción respetada:** ningún cambio toca `yaw`/`pitch`/coordenadas de hotspots. Solo apariencia, tamaño y animación. Los hotspots se anclan en `hotspotContainer().createHotspot(el, {yaw, pitch})` desde `src/hotspotManager.js`; ese código no se modificó.

## 7. Verificación

Servidor propio en puerto alternativo (`PORT=8099 node scripts/dev-server.mjs`) para no interferir con la demo en :8081. 13 rutas, todas **200**:

```text
200  /                                                        14726 B
200  /css/design-tokens.css                                    5070 B
200  /control-web/admin-pro.css                               30135 B
200  /unisimoncucuta/experienciavirtual/                       18141 B
200  /unisimoncucuta/experienciavirtual/css/design-tokens.css   5070 B   ← clave: el @import resuelve bajo prefijo de tour
200  /unisimoncucuta/experienciavirtual/control-web/           11846 B
200  /unisimoncucuta/experienciavirtual/control-web/admin-pro.css 30135 B
200  /unisimoncucuta/experienciavirtual/control-web/admin.css  21023 B
200  /plataforma/login.html · /plataforma/tokens.css
200  /unisimoncucuta/org-admin.html
200  /orbe/sandbox/ · /orbe/sandbox/control-web/
```

Verificación en navegador del tour público `/unisimoncucuta/experienciavirtual/`:

```json
{"brand":"#0a7a45","dur":"200ms","hotspots":3,"firstChipBorder":"rgba(255, 255, 255, 0.2)"}
```

Lectura: el tour conserva el **verde institucional del cliente** (`#0a7a45` desde TourBranding) y a la vez resuelve los **tokens compartidos** (`--orbe-dur-base: 200ms`). Es exactamente la separación que exige el doc 39: escalas compartidas, color del cliente.

Control Web no se pudo verificar visualmente: el gate de `auth-gate.js` redirige a login antes de pintar (comportamiento correcto del doc 52). Se validó por respuesta 200 de los CSS y revisión estática de reglas.

## 8. Reglas para quien siga

1. **No añadir color a `css/design-tokens.css`.** Si necesitas un color, decide primero si es chrome Orbe (`plataforma/tokens.css`) o branding de cliente (`tourBrandings` → `--brand*`).
2. **No escribir duraciones ni curvas a mano.** Usa `--orbe-dur-*` / `--orbe-ease-*`; así heredas reduced-motion.
3. **Animaciones en bucle** necesitan su propio `@media (prefers-reduced-motion: reduce) { animation: none }`.
4. **Control Web se modifica en `admin-pro.css`**, no en `admin.css`: la copia servida de `admin.css` contiene trabajo de otros agentes (modo invitado) y reescribirla lo destruiría.
5. **Sombras: solo `--orbe-elev-1..4`.** Si hace falta un quinto nivel, discútelo antes.
6. **anime.js requiere justificación por módulo** contra la tabla de §5.
