# 33 — Épicas e historias de usuario

**Proyecto:** Orbe360  
**Fecha:** 2026-09-11  
**Prioridades:** P0 (ahora) · P1 (próximo) · P2 · P3 · P4 (billing — fuera de alcance cercano)

---

## Épica A — Plataforma Orbe360 (marca)

| ID | Historia | Prioridad |
|----|----------|-----------|
| A1 | Como visitante, veo la landing Orbe360 en `/`, no un tour de cliente | **P0** |
| A2 | Como visitante, exploró demos publicadas sin ver roles admin | P0 |
| A3 | Como visitante, el chrome de plataforma usa Soft Clay / design system Orbe | P0–P1 |
| A4 | Como marketing, no se mezclan verdes Orbe vs cliente (Unisimón) | P0 |

## Épica B — Multi-tenant URL

| ID | Historia | Prioridad |
|----|----------|-----------|
| B1 | Como cliente, mi tour vive en `/{orgSlug}/{tourSlug}/` | **P0** |
| B2 | Como visitante, `?scene=` funciona bajo el prefijo | **P0** |
| B3 | Como admin, abro `…/org-admin.html` y `…/control-web/` bajo el mismo prefijo | **P0** |
| B4 | Como ops, `?slug=` legacy redirige al path canónico | **P0** |
| B5 | Como superadmin, creo org/tour con slugs URL-safe únicos por org | P1 |
| B6 | Como sistema, `by_org_and_slug` evita colisiones entre orgs | **P0** (índice) / P1 (hardening) |

## Épica C — Visitante del tour

| ID | Historia | Prioridad |
|----|----------|-----------|
| C1 | Como visitante, recorro escenas 360 con teclado y menú | P0 (existe) |
| C2 | Como visitante, escucho narración / leo transcript cuando hay audio | P0 (existe) |
| C3 | Como visitante, veo branding del **cliente**, no Orbe como marca del tour | P0 (existe) |
| C4 | Como visitante, un tour draft no es accesible públicamente | P0 (existe) |

## Épica D — Admin de tour / org

| ID | Historia | Prioridad |
|----|----------|-----------|
| D1 | Como orgAdmin, edito hotspots/conexiones en Control Web sin perder el grafo | P0 (existe) |
| D2 | Como orgAdmin, publico / despublico con checklist a11y | P0 (existe) |
| D3 | Como orgAdmin, edito TourBranding (URL logo; upload = P3) | P1–P3 |
| D4 | Como orgAdmin, elijo tour activo si la org tiene varios | P2 |

## Épica E — Superadmin

| ID | Historia | Prioridad |
|----|----------|-----------|
| E1 | Como superadmin, creo organizaciones, tours y usuarios | P0 (existe) |
| E2 | Como superadmin, **no** puedo editar contenido espacial del tour | P0 (existe) |
| E3 | Como superadmin, ejecuto seed/ops sin membership de editor | P0 (existe) |

## Épica F — Accesibilidad

| ID | Historia | Prioridad |
|----|----------|-----------|
| F1 | Como visitante AT, el motor anuncia escenas y destinos | P0 (parcial; AT device NO VERIFICADO) |
| F2 | Como editor, sincronizo paquete TTS campus a Convex | P0 (existe) |
| F3 | Como producto, **no** se afirma soporte TalkBack/NVDA sin evidencia | P0 (política) |
| F4 | Como visitante, locución humana reemplaza placeholders TTS | P2 |

## Épica G — Publish & embed

| ID | Historia | Prioridad |
|----|----------|-----------|
| G1 | Como cliente, enlazo `https://orbe…/{org}/{tour}/` desde mi sitio | **P0** |
| G2 | Como cliente, embebo el tour en iframe con allowfullscreen | P1 |
| G3 | Como ops, CSP `frame-ancestors` por org | P2 (hosting) |

## Épica H — Media & hosting

| ID | Historia | Prioridad |
|----|----------|-----------|
| H1 | Media con `objectKey` orgs/…/tours/… | P0 (convención) / P2 (CDN) |
| H2 | Object storage + TLS + IdP | P2–P3 |
| H3 | Billing / planes | **P4 — no ahora** |

---

*Alineado a docs 31–32 y estado consolidado 22.*
