# 54 — Landing Soft Clay + SVG (pase visual)

**Fecha:** 2026-09-14  
**Relacionados:** [38 Soft Clay](./38-soft-clay-ui.md) · [45 UX landing](./45-ux-landing-org-superadmin.md) · [41 landing B2B](./41-landing-orbe-y-cliente-unisimon.md)

## Qué cambió

| Área | Cambio |
|------|--------|
| Shapes | `plataforma/assets/shapes/` — blobs, orb-rings, mark, iconos valor/flujo/a11y (SVG propio, sin Lucide) |
| `/` | Hero brand-first + silueta 360 decorativa; sección **Cómo funciona** (3 pasos); copy B2B honesto |
| CSS | `marketing.css` — atmósfera Soft Clay, `:focus-visible`, `prefers-reduced-motion` en blobs/orb |

## IA de página (qué sí / qué no)

1. Hero (marca + value prop + CTAs)  
2. Valor (Explora / Descubre / Conecta)  
3. Cómo funciona  
4. Caso real (cliente etiquetado)  
5. Usos posibles  
6. Accesibilidad (producto, sin certificaciones inventadas)  
7. CTA cierre · Acceso solo en footer  

**No:** dashboard CRUD, stats falsas, login en nav/hero, Unisimón como marca Orbe.

## Copy — principios

- Plataforma para crear/administrar/publicar tours 360 white-label.  
- **Evitado:** “único en el mundo”, TalkBack certificado, gratis ilimitado, bashing, filtrar fallos internos.  
- Unisimón = **Cliente · …**, no identidad Orbe.

## A11y preservada

Skip link, headings semánticos, SVG decorativos ocultos a AT, contraste CTA sky/blanco, motion reducible. Viewer tour **sin tocar**.

## Preview

`http://localhost:8081/` (tras `npm start` en el repo del prototipo).
