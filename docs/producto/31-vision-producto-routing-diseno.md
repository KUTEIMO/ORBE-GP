# 31 — Visión de producto: routing, diseño y multi-tenant SaaS

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-11  
**Tipo:** Plan de producto + UX + arquitectura (**solo documentación**; sin implementación en este pase)  
**Entradas:** docs 12, 13, 20–22; `plataforma/index.html`; routing actual (`npm start` → `:8081`); captura Control Web «Grafo de conexiones»; visión multi-empresa del usuario.

**Relacionados:** [12 design system](./12-design-system-orbe360.md) · [13 infra](./13-auditoria-infraestructura.md) · [20 white-label](./20-fase4-white-label-branding.md) · [21 portabilidad](./21-fase5-limpieza-y-portabilidad.md) · [22 estado](./22-estado-producto-consolidado.md) · [01 visión](./01-vision.md) · **[32 routing multi-empresa URL (canónico)](./32-routing-multi-empresa-url.md)**

---

## Resumen ejecutivo

Orbe360 ya es un **piloto multi-org operable** (authz, publish, TourBranding, grafo en Convex, Control Web). Para madurar como producto comercial hace falta:

1. **Una dirección visual clara** para la plataforma (sin confundirla con el white-label del tour cliente).
2. **`/` = marca Orbe360**; el viewer deja de ser la raíz.
3. **URLs públicas legibles** `/{orgSlug}/{tourSlug}/` listas para embed (esquema canónico en **doc 32**).
4. **Roadmap honesto** de self-serve / media / billing, sin vender lo que aún no existe.

**Decisión de diseño (primaria):** *Soft Clay* (claymorphism contenido) para chrome de plataforma + admin; marketing sigue **editorial-immersivo** (foto full-bleed). El tour publicado permanece **white-label del cliente**.

> **Estado visual:** Soft Clay P0 aplicado — ver [38-soft-clay-ui.md](./38-soft-clay-ui.md).  
> En el pase del doc 31 solo se documentó; el routing (32–35) se priorizó primero.

**Decisión de routing (objetivo):** `/` → marketing Orbe360; viewer y apps del tour bajo `/{orgSlug}/{tourSlug}/…` con **routing virtual** (un solo codebase; sin copiar carpetas por tour). Detalle, ejemplo Unisimón, DB y fases: **[doc 32](./32-routing-multi-empresa-url.md)**. El patrón provisional `/t/:org/:tour` queda **obsoleto**.

---

## A. Design morphism — recomendación

### A.1 Comparativa para *este* producto

| Dirección | Encaje con Orbe360 | Pros | Contras | Veredicto |
|-----------|-------------------|------|---------|-----------|
| **Neomorphism** | Medio | Sensación táctil; paneles embossed | Contraste débil; se ve datado (2019); mala densidad SaaS; sombras “luz/sombra” rompen sobre foto | Descartar como sistema primario |
| **Claymorphism clásico** | Alto (metáfora orb/esfera) | Nodos redondos, soft 3D, amigable; diferencia de SaaS flat | Riesgo “juguete” / pasteles genéricos si se exagera | Base buena si se **restringe** |
| **Soft UI genérico** | Medio | Seguro, limpio | Fácil de caer en look IA (purple glow, cards everywhere) | Útil como vocabulario, no como marca |
| **Editorial-immersivo** | Muy alto en público | Foto protagonista; ya documentado en doc 12; marca = experiencia | No escala solo a admin denso (grafo, tablas) | **Mantener en landing / marketing** |
| **Soft Clay (recomendado)** | Alto | Une orb + verde Orbe + densidad admin; nodos del grafo ganan presencia sin spoiler de datos | Requiere disciplina (pocas elevaciones) | **Sistema primario de plataforma** |

### A.2 Elección: Soft Clay (claymorphism contenido)

**Una dirección primaria para plataforma:** Soft Clay.

**Por qué:**

- Orbe360 vende **espacio inmersivo**; volúmenes suaves y nodos “orb” refuerzan la metáfora sin competir con la fotografía.
- El acento de marca funciona como **arcilla pigmentada** (CTA, nodos activos, focus), no como fondo de página. *(Corrección 2026-09-29: cuando se escribió esto el acento era el verde `#009b3a`, hoy **retirado**; el acento Orbe vigente es el sky `#0284c7` — ver [39](./39-identidad-orbe-vs-cliente.md).)*
- En Control Web el grafo actual es plano (círculos blancos + líneas azules); Soft Clay da lift de marca **sin cambiar el modelo de interacción** (drag nodo→nodo).
- Evita neomorphism (a11y/contraste) y evita looks IA vetados (purple gradients, cream+serif terracotta, broadsheet).

**Capa marketing:** sigue el design system existente (**editorial-immersivo** + Sora/Outfit + hero full-bleed). Soft Clay solo en **controles interactivos** (botones, chips, showcase CTA), no en cards decorativas ni overlays sobre hero.

**Capa tour (visitante):** **no** adopta Soft Clay de plataforma. Sigue chrome neutro + `TourBranding` (white-label). Orbe solo como “Powered by” cuando el cliente lo permita.

### A.3 Tokens / componentes a restylear primero

Extender `plataforma/tokens.css` (y un futuro `--cw-clay-*` en Control Web) **sin** romper `--orbe-green` / separación USB:

| Token propuesto | Intención |
|-----------------|-----------|
| `--orbe-clay-surface` | Superficie elevada suave (blanco → paper) |
| `--orbe-clay-shadow` | Sombra difusa corta (1 elevación, no stacks) |
| `--orbe-clay-inset` | Highlight superior sutil (no bisel neo agresivo) |
| `--orbe-clay-radius` | `16–20px` marketing; `12px` admin; nodos grafo `999px` |
| `--orbe-clay-node` | Relleno nodo + borde pigmentado verde |
| `--orbe-clay-edge` | Arista: trazo semitransparente + flecha limpia |

**Orden de restyle (máximo brand lift → menor):**

1. **Landing** (`plataforma/index.html` → futuro `/`) — hero ya fuerte; polish CTAs Soft Clay + ritmo.
2. **Login** — primer contacto admin; clay suave + copy “Administración Orbe360”.
3. **Admin shell** (org-admin / superadmin) — densidad SaaS; clay solo en botones, tabs, paneles primarios.
4. **Control Web grafo** — nodos/edges Soft Clay; grid más atmosférico; **datos intactos**.
5. **Tour chrome** — pase ligero (header/powered-by); sin rediseñar Marzipano.

### A.4 Qué NO hacer

- Over-skeuomorphism (botones “plásticos” 3D, texturas de barro literales).
- Sombras pesadas en **todo** (solo superficies interactivas / nodos).
- Clay sobre fotografía hero (rompe contraste y la regla “foto protagonista”).
- Unificar verde Orbe con verde Unisimón.
- Purple glow, glassmorphism excesivo, pills rounded-full en masa.
- Cards por defecto en marketing (doc 12: cards solo donde hay interacción).

---

## B. Information architecture & routing

> **Canónico:** [32 — Routing multi-empresa URL](./32-routing-multi-empresa-url.md).  
> Prefijo público: `/{orgSlug}/{tourSlug}/` (ej. `/unisimoncucuta/experienciavirtual/`).  
> **No** usar `/t/:org/:tour` como objetivo. **No** copiar el motor a carpetas físicas por tour.

### B.1 Estado actual (local)

`npm start` / `dev:web` → `http-server` en **raíz del repo**, puerto **8081**:

| URL hoy | Superficie |
|---------|------------|
| `http://127.0.0.1:8081/` | **Viewer** (`index.html` tour) — default slug piloto |
| `/?slug=` · `/?scene=` | Tour por slug / escena |
| `/plataforma/` | Marketing Orbe360 |
| `/plataforma/login.html` | Login |
| `/plataforma/org-admin.html` · `superadmin.html` | Admin |
| `/control-web/?slug=` | Editor espacial + grafo |

Problema de producto: la **raíz del dominio es el tour**, no la marca. El usuario quiere lo contrario.

### B.2 Mapa URL objetivo (resumen; detalle en doc 32)

```text
/                                    → Marketing Orbe360
/experiencias · anclas marketing     → Demos / soluciones Orbe

/{orgSlug}/{tourSlug}/              → Viewer público (mismo index.html; contexto = path)
/{orgSlug}/{tourSlug}/?scene=       → Deep link escena
/{orgSlug}/{tourSlug}/org-admin.html → Admin tour/org (canónico; rewrite → plataforma/)
/{orgSlug}/{tourSlug}/control-web/  → Control Web (slug desde path; ?slug= opcional)

/plataforma/login.html · /acceso     → Login plataforma
/plataforma/superadmin.html          → Superadmin (no scoped a un tour)

# Compatibilidad (deprecación gradual)
/?slug=                              → redirect/rewrite → /{org}/{tour}/
/control-web/?slug=                  → /{org}/{tour}/control-web/
```

**Patrón público canónico:** `/{orgSlug}/{tourSlug}/` — ver doc 32 (Unisimón, ADR virtual vs físico, DB, fases).

### B.3 Migración desde `/?slug=` y `/?scene=`

| Fase | Comportamiento |
|------|----------------|
| **P0** | `/` = marketing; parse/rewrite virtual `/{org}/{tour}/` sirve el **mismo** viewer; compat `?slug=`. Ver doc 32. |
| **P1** | Create org/tour fija slugs; `by_org_and_slug` + resolve dual-slug; migrar piloto Unisimón. |
| **P2** | Media/CDN alineado a `objectKey`; embed kit documentado sobre la URL canónica. |
| **P3** | Pretty admin paths sin query; deprecar `?slug=`. |
| Legacy | `?scene=` se preserva como query bajo el prefijo del tour. |

**Local (`http-server`):** no hace rewrites. Opciones realistas (doc 32):

1. **Parse de pathname en JS** + servir siempre los mismos HTML (mínimo tooling).
2. **Static-server** liviano (Express/Caddy) con rewrite `/{org}/{tour}/*` → apps compartidas.
3. **Prod:** Nginx/Caddy rewrite al viewer/admin/control-web únicos + contexto en path.

**Prohibido:** copiar `index.html` / `plataforma/` / `control-web/` a una carpeta real por empresa/tour.

### B.4 Embed strategies

| Modo | Uso | Notas |
|------|-----|-------|
| **Deep link** | “Abrir recorrido” en sitio del cliente | `origen.com` → `orbe.com/{org}/{tour}/` |
| **iframe** | Incrustar en página institucional | `src=https://orbe.com/{org}/{tour}/`; `allowfullscreen` |
| **JS snippet** | Orbe inserta iframe + resize | Facilita clientes no técnicos; versionar snippet |

**Seguridad / UX embed:**

- `Content-Security-Policy` `frame-ancestors` configurable por org (allowlist de dominios del cliente) — **requiere hosting**, no solo estático ciego.
- Clickjacking: en path público del tour permitir embed selectivo; admin **nunca** en iframe de terceros.
- Responsive height: `min-height: 70vh` o postMessage resize desde viewer.
- No filtrar tokens de sesión en URLs de embed.

---

## C. Multi-tenant — factibilidad

### C.1 Qué ya existe

| Capacidad | Estado |
|-----------|--------|
| `organizations` + `slug` | Sí |
| `memberships` (orgAdmin / tourEditor) + superadmin | Sí |
| `tours` + `slug` + `published` | Sí |
| Publish / unpublish UI (org-admin) | Sí (fases 7–8) |
| TourBranding white-label | Sí (fase 4) |
| Grafo Convex + Control Web sync | Sí |
| Media `objectKey` ≈ `orgs/{org}/tours/{tour}/…` | Convención lista |
| Público solo `published` (`getTourGraph`) | Sí |
| Multi-tour `?slug=` | Sí (fase 6) |
| Separación Superadmin vs tour/org admin | Sí — **mantener** |

### C.2 Gaps vs visión “cada empresa compra el motor”

| Gap | Hoy | Necesidad |
|-----|-----|-----------|
| Pretty URL org+tour | Solo `?slug=` global | `/{orgSlug}/{tourSlug}/` + índice `by_org_and_slug` (doc 32) |
| Slug tour global | `tours.by_slug` único | Compuesto `(organizationId, slug)` |
| Self-serve signup | Seed / superadmin crea orgs | Onboarding guiado (P3); no obligatorio P0 |
| Object storage / CDN | Panoramas en git + Convex File Storage parcial | Escala media real (Linux + R2/S3) |
| Guided self-build | Control Web + org-admin (experto) | Wizard “primera escena → conexiones → publish” |
| Embed kit documentado | No | Snippets + CSP |
| Billing / planes | No | **Fuera de alcance cercano** (P4) |
| IdP / TLS / cookies HttpOnly | Local token `localStorage` | Hosting productivo |
| Selector multi-tour en Control Web | Default inject / `?slug=` | UI por org |

### C.3 Local vs Linux hosting

| Realista **ahora en local** | Requiere **Linux / hosting** |
|----------------------------|------------------------------|
| Reordenar `/` marketing vs `/tour/` | Dominio, TLS, rewrite pretty URLs |
| Soft Clay en CSS plataforma / Control Web | `frame-ancestors` / CSP por org |
| Compat `?slug=` + docs de migrate | Object storage + CDN panoramas |
| Resolver org+tour en Convex (API) | Billing, IdP, backups formales |
| Wizard onboarding UI (sin cobro) | Egreso de media a escala |

**Veredicto:** la visión multi-empresa es **arquitecturalmente alineada** con el schema actual; el cuello no es “falta de idea de producto”, sino **routing público + media + ops**. No hace falta reescribir Marzipano ni Convex para P0–P2.

### C.4 Roadmap por fases

| Fase | Entrega | Valor |
|------|---------|-------|
| **P0** | `/` = marketing; routing virtual `/{org}/{tour}/` (mismo motor); Soft Clay + landing/login/shell; grafo visual **sin** migrar datos | Marca + URL vendible |
| **P1** | Slugs en create org/tour; `by_org_and_slug`; resolve dual-slug; redirect desde `?slug=`; migrar Unisimón | DB = path público |
| **P2** | Media/CDN + embed kit (iframe/snippet sobre URL canónica) | Integración cliente + escala media |
| **P3** | Pretty admin bajo prefijo; onboarding guiado; upload logo branding | Self-build serio |
| **P4** | Billing / planes (Stripe u otro) | Comercialización — **no ahora** |

---

## D. Control Web — grafo de conexiones (UX)

### D.1 Principio no negociable

El usuario ya configuró conexiones con cuidado. **Cualquier rediseño es cosmético/presentación** hasta que exista un plan de migración explícito.

- Fuente de verdad: Convex snapshot (`connections`, escenas) + persistencia actual (`saveTourSnapshot` / local draft).
- **No** resetear `tour-graph`, **no** cambiar IDs de escena/fileKey, **no** alterar semántica ida/vuelta del modo hotspots.
- Regresión obligatoria: mismo número de aristas tras restyle; QA visual + `npm run qa` snapshot paths.

### D.2 Upgrade visual (sin cambiar interacción aún)

Estado capturado: grid claro, nodos círculo borde verde, selección azul, aristas azul con solapamiento (“spaghetti”) en zonas densas.

**Plan Soft Clay (solo render SVG/CSS):**

1. **Nodos:** relleno clay, sombra corta, borde `--orbe-green`; seleccionado = elevación + anillo focus accesible (no solo azul plano).
2. **Labels:** tipografía Outfit; contraste sobre grid; opcional pill clay detrás del texto.
3. **Edges:** stroke más fino, opacidad por zoom/densidad; flechas bidireccionales más legibles; evitar glow.
4. **Canvas:** grid sutil con tinte paper/ink; no textura ruidosa.
5. **Densidad:** más adelante (no P0) — bundling visual de aristas o highlight al hover de nodo (atenúa el resto) **sin** borrar links.
6. **Lista inferior** de enlaces: mantener como herramienta de limpieza (ya documentada en UI).

**Fuera de este rediseño visual:** force-directed layout, pan/zoom canvas, undo stack — backlog separado; no mezclar con P0 de marca.

---

## E. Riesgos honestos y recomendaciones

| Riesgo | Recomendación |
|--------|----------------|
| Confundir marca Orbe con Unisimón | Mantener tokens separados; Unisimón = caso en demos, no chrome |
| Implementar billing pronto | **No**; P4 solo cuando haya ≥2 orgs reales y media estable |
| Romper grafo en restyle | CSS/SVG only; tests de conteo de connections |
| Pretty URLs sin índice compuesto | Colisiones de slug entre orgs; hacer `by_org_and_slug` en P1 (doc 32) |
| Self-serve sin storage | Onboarding vacío frustra; P3 acoplado a media |
| Mezclar Superadmin y org admin en UX | Mantener superficies y roles actuales |
| `http-server` sin rewrites | P0 = parse path + rewrite virtual; **no** N carpetas físicas (doc 32) |
| Deuda seguridad doc 13 (listTours, hashing, localStorage) | No olvidar en paralelo a UI; crítico antes de SaaS público |

### Estimaciones de esfuerzo (orden de magnitud, 1 dev familiarizado)

| Slice | Esfuerzo |
|-------|----------|
| P0 `/` marketing + routing virtual `/{org}/{tour}/` (mismo motor) | 1–2 días |
| Soft Clay tokens + landing + login + admin shell | 1–2 días |
| Grafo Soft Clay (SVG/CSS, sin lógica) | 0.5–1 día |
| P1 slugs + `by_org_and_slug` + resolve dual-slug + redirects | 2–4 días |
| P2 media/CDN + embed kit + CSP notes | 1–3 días |
| P3 pretty admin + wizard onboarding | 1–3 semanas (según proveedor) |
| P4 billing | 2+ semanas + legal/ops |

---

## Recommended next implementation slice

Cuando el usuario diga **«implementa»**, alinear con **doc 32 P0** (routing virtual) + marca:

1. **Raíz = marketing:** servir la landing Orbe360 en `/`; el viewer deja de ser la raíz.
2. **Prefijo virtual:** resolver `/{orgSlug}/{tourSlug}/` hacia el **mismo** `index.html` / Control Web / org-admin (rewrite o parse pathname); **cero** copias físicas por tour.
3. **Compat:** `/?slug=` sigue funcionando; deprecación hacia `/{org}/{tour}/` (no hacia `/t/...`).
4. **Soft Clay v1:** tokens en `plataforma/tokens.css` + landing CTAs, login y admin-shell (sin tocar datos Convex ni grafo logic).
5. **Grafo (opcional):** restyle SVG Soft Clay **sin** cambiar data path.

**Fuera de ese slice:** índice compuesto / migración slugs Unisimón (P1), embed kit completo, billing, object storage, wizard self-serve.

**Criterio de done del slice:**  
`http://127.0.0.1:8081/` muestra Orbe360 marketing; el tour abre bajo `/{org}/{tour}/` (o compat slug) con el motor compartido; Unisimón es caso, no marca; conexiones del campus intactas.

---

*Documento de visión — 2026-09-11. No implementa código; alinea producto con docs 12–22 y el contrato URL canónico en [doc 32](./32-routing-multi-empresa-url.md).*
