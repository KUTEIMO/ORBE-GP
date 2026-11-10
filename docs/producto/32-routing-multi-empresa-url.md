# 32 — Routing multi-empresa: esquema URL canónico

**Proyecto:** `PROTOTIPO-360-CURSOR-V1`  
**Fecha:** 2026-09-11  
**Tipo:** Decisión de arquitectura + contrato de producto (**documentación**; sin implementar routing en este pase)  
**Estado:** **Canónico** — sustituye el patrón provisional `/t/:org/:tour` del doc 31.  
**Relacionados:** [31 visión routing](./31-vision-producto-routing-diseno.md) · [20 white-label](./20-fase4-white-label-branding.md) · [21 portabilidad](./21-fase5-limpieza-y-portabilidad.md) · `src/tourSlug.js` · `convex/schema.ts` · `convex/media.ts`

---

## Resumen ejecutivo

Cada empresa + tour público vive bajo un **prefijo de path**:

```text
/{orgSlug}/{tourSlug}/
```

Ejemplo Unisimón (objetivo de producto):

```text
/unisimoncucuta/experienciavirtual/?scene=entrada-principal
```

Todo lo de ese tour (viewer, admin de org/tour, Control Web, assets lógicos) se **direcciona** bajo ese prefijo.  
**No** se copian físicamente `index.html`, `plataforma/` ni `control-web/` a una carpeta real por tour.

| Capa | Mecanismo |
|------|-----------|
| **URL** | Routing virtual: un solo codebase; el path fija el contexto |
| **Datos** | Convex scoped por `organizationId` / `tourId` |
| **Media** | `objectKey` = `orgs/{orgId}/tours/{tourId}/…` (ya en código) |
| **CDN (opcional, luego)** | Espejo de paths solo para media, no del motor |

---

## ADR — Carpetas virtuales vs físicas

### Decisión

**Adoptar routing virtual (rewrites / parse de path en SPA + static server).**  
**Rechazar** N copias del motor en el filesystem por tour.

### Contexto

La intuición comercial es “cada tour tiene su carpeta”. Eso es correcto desde la **POV del cliente** (URL estable, aislamiento de datos/assets, admin propio). Es incorrecto e inmantenible si se interpreta como copiar el HTML/JS del viewer a `unisimoncucuta/experienciavirtual/index.html` en disco por cada cliente.

Hoy `npm start` → `http-server` en la **raíz del repo** (puerto 8081): un solo `index.html`, una sola `plataforma/`, un solo `control-web/`. El contexto de tour se resuelve con `?slug=` (`src/tourSlug.js`).

### Consecuencias

| | Virtual (elegido) | Físico (rechazado) |
|--|-------------------|---------------------|
| Actualizar Marzipano / a11y / Control Web | 1 deploy | N carpetas a parchear |
| Branding / escenas / conexiones | Convex + branding por tour | Mezcla de estáticos y datos |
| “Se siente como carpeta” | Sí: URL + datos + media aislados | Sí, pero deuda explosiva |
| Local `http-server` | Necesita rewrite o parse en cliente + fallback | Funciona “por accidente” |

### Cómo se siente “una carpeta por tour” sin N motores

1. **URL:** todo bajo `/{orgSlug}/{tourSlug}/…`.
2. **Datos:** escenas, hotspots, connections, branding solo de ese `tourId`.
3. **Media:** claves lógicas `orgs/{orgId}/tours/{tourId}/panoramas/…` (y futuro CDN bajo prefijo equivalente).
4. **Admin / Control Web:** mismas apps compartidas; el path (o rewrite) inyecta org+tour; authz impide cruzar tenants.

El cliente ve “su estructura”. Orbe mantiene **un** motor.

---

## Mapa URL canónico

**Dominio de producto** (ej. `orbe.com` o el host del deploy).  
Slugs: minúsculas, `[a-z0-9]+` con guiones opcionales (`unisimoncucuta`, `experienciavirtual`).

### Público / marca Orbe

| Path | Superficie | Notas |
|------|------------|--------|
| `/` | Landing Orbe360 | Hoy `plataforma/index.html` → objetivo: raíz = marca |
| `/experiencias`, anclas marketing | Demos / soluciones | No bajo prefijo de empresa |
| `/plataforma/login.html` · `/acceso` | Login plataforma | Global Orbe; no scoped a un tour |
| `/plataforma/superadmin.html` | Superadmin | Crea org/tour/usuarios; **no** edita contenido de tour |

### Por organización (admin)

| Path | Superficie | Resolución |
|------|------------|------------|
| `/{org}/org-admin.html` | Admin de **organización** (todos los tours) | Rewrite → `plataforma/org-admin.html` + contexto org en path |

### Por tour (prefijo obligatorio)

Base: `/{orgSlug}/{tourSlug}/`

| Path | Superficie | Resolución |
|------|------------|------------|
| `/{org}/{tour}/` | Viewer público | Sirve el mismo `index.html` del motor; contexto = path |
| `/{org}/{tour}/?scene={sceneKey}` | Deep link escena | Query `scene` se conserva (hoy ya existe) |
| `/{org}/{tour}/control-web/` · `…/control-web/index.html` | Control Web | **Slug derivado del path**; `?slug=` opcional (compat) |

### Compatibilidad (deprecación)

| Hoy / legacy | Destino |
|--------------|---------|
| `/?slug=unisimon-campus` | → `/{orgSlug}/{tourSlug}/` |
| `/control-web/?slug=…` | → `/{org}/{tour}/control-web/` |
| `/{org}/{tour}/org-admin.html` | → **302** `/{org}/org-admin.html` |
| `/{org}/{tour}/plataforma/org-admin.html` | → **302** `/{org}/org-admin.html` |
| `/plataforma/org-admin.html` sin path | Redirect a `/{org}/org-admin.html` de la primera org de la sesión |

### Admin path — decisión única

**Canónico:** `/{orgSlug}/org-admin.html`  
Nivel **organización** (gestiona todos los tours). Tour-specific tools (viewer, Control Web) permanecen bajo `/{org}/{tour}/…`.  
El rewrite virtual apunta al HTML real en `plataforma/org-admin.html`.

---

## Ejemplo concreto: Unisimón

| Concepto | Valor objetivo |
|----------|----------------|
| Empresa (`organizations.slug`) | `unisimoncucuta` |
| Tour (`tours.slug`) | `experienciavirtual` |
| Viewer | `/unisimoncucuta/experienciavirtual/` |
| Escena | `/unisimoncucuta/experienciavirtual/?scene=entrada-principal` |
| Org-admin | `/unisimoncucuta/org-admin.html` |
| Control Web | `/unisimoncucuta/experienciavirtual/control-web/` |

**Hoy en seed (gap de naming):** org `unisimon-cucuta`, tour `unisimon-campus`, viewer `/?slug=unisimon-campus`.  
La migración de slugs a `unisimoncucuta` / `experienciavirtual` es parte de P1 (datos + redirects), no bloquea el diseño de path.

**Varias tours por empresa:** cada una con su segmento:

```text
/unisimoncucuta/experienciavirtual/
/unisimoncucuta/laboratorio-a/
```

Cada una: grafo, branding, media y admin/Control Web propios bajo su prefijo.

---

## Patrón para nuevas empresas

Cuando el **superadmin** crea org + tour + branding:

1. Elige `orgSlug` único global (ej. `acme-norte`).
2. Elige `tourSlug` único **dentro de la org** (ej. `recorrido-sede`).
3. URLs quedan fijas:

```text
/{orgSlug}/{tourSlug}/
/{orgSlug}/org-admin.html
/{orgSlug}/{tourSlug}/control-web/
```

4. Publish: solo si `tours.published === true` el path público resuelve el grafo; draft → 404/null (comportamiento ya alineado con `getTourGraph`).
5. Asigna memberships (`orgAdmin` / `tourEditor`). Superadmin **no** edita contenido del tour (`userCanEditTour` ya lo impide).

---

## Soporte en DB: hoy vs gaps

### Campos requeridos (contrato)

| Campo | Ejemplo | Rol |
|-------|---------|-----|
| `organizations.slug` | `unisimoncucuta` | Segmento 1 de la URL pública |
| `tours.slug` | `experienciavirtual` | Segmento 2 |
| `tours.organizationId` | Id Convex | Scope tenant |
| `tours.published` | `true`/`false` | Gate del path público |
| Unicidad `(organizationId, slug)` | índice compuesto | Varias orgs pueden reutilizar el mismo tour slug |
| Unicidad de path público `(orgSlug, tourSlug)` | org slug global + compuesto tour | Path `/{org}/{tour}` único |

### Qué existe hoy (`convex/schema.ts`)

| Item | Estado |
|------|--------|
| `organizations.slug` + índice `by_slug` | ✅ |
| `tours.slug` + `organizationId` + `published` | ✅ |
| Índice `tours.by_slug` (slug **global**) | ⚠️ Insuficiente para multi-tenant real |
| Índice `tours.by_org` | ✅ |
| `getTourGraph({ slug })` solo por tour slug; exige `published` | ✅ gate publish; ❌ no usa orgSlug |
| `createTour` rechaza slug si existe **en cualquier** org | ⚠️ Demasiado estricto / mal scoped |
| Media `objectKey` `orgs/{orgId}/tours/{tourId}/…` | ✅ dirección correcta |
| Authz: org admin edita; superadmin no contenido | ✅ `userCanEditTour` |

### Deltas de schema / API (futuro, no en este pase)

```text
tours:
  + index by_org_and_slug: ["organizationId", "slug"]
  - dejar de tratar by_slug como único global (migración: uniqueness app-level → compuesto)
  opcional: mantener by_slug solo para lookup legacy durante deprecación

API:
  + resolvePublicTour({ orgSlug, tourSlug }) → tour | null (solo published)
  + getTourGraph({ orgSlug, tourSlug }) o ampliar args
  createOrganization / createTour: validar formato slug URL-safe
  createTour: unicidad solo dentro de organizationId
```

### Publish gate y authz

- **Público:** path `/{org}/{tour}/` solo carga datos si el tour está `published` (igual que hoy `getTourGraph` → `null` si draft).
- **Org-admin / Control Web:** requieren sesión + membership en esa org; contexto del path debe coincidir con el tour autorizado.
- **Superadmin:** crea org/tour, asigna usuarios, seed/ops; **no** sustituye al editor de contenido del cliente.

---

## Embed (sitio del cliente → Orbe)

El cliente **no** hospeda el motor. Desde `origen.com`:

| Modo | Ejemplo |
|------|---------|
| Deep link | `https://orbe.com/unisimoncucuta/experienciavirtual/` |
| Escena | `…/experienciavirtual/?scene=entrada-principal` |
| iframe | `<iframe src="https://orbe.com/unisimoncucuta/experienciavirtual/" allowfullscreen>` |

Misma URL canónica; no hace falta `/embed/…` en P0–P1 (opcional después para chrome mínimo).  
CSP `frame-ancestors` por org = hosting real (doc 31); fuera del static local.

---

## Estado del static server hoy

- `package.json`: `"start"` / `"dev:web"` → `http-server` en `.` puerto **8081**.
- Sin rewrites: solo paths de archivos reales.
- Viewer en `/`; marketing en `/plataforma/`; Control Web en `/control-web/?slug=`.
- `src/tourSlug.js`: resuelve `?slug=` → inject → default `unisimon-campus`; helpers `publicTourHref` / `controlWebHref` aún generan query strings.

Pretty multi-segment **requiere** (en implementación futura): rewrite (Caddy/Nginx/Express) **o** parse de `location.pathname` en el cliente sirviendo siempre los mismos HTML, más API `orgSlug+tourSlug`.

---

## Implementación por fases

| Fase | Qué | Valor |
|------|-----|--------|
| **P0** | Parse path `/{org}/{tour}/…` en viewer/Control Web/org-admin; rewrite o fallback que sirve **las mismas** apps; `/` → marketing Orbe; compat `?slug=` | URL vendible sin N carpetas |
| **P1** | Superadmin create org/tour fija slugs URL-safe; índice `by_org_and_slug`; `resolvePublicTour` / `getTourGraph` con ambos slugs; migrar piloto a `unisimoncucuta`/`experienciavirtual` + redirects | Contrato DB = URL |
| **P2** | Media URLs / CDN alineadas a ownership (`objectKey`); opcional espejo path público solo para assets | Escala media |
| **P3** | Pretty admin paths estables (`…/org-admin.html`, `…/control-web/` sin query); deprecar `?slug=` | UX admin = mismo prefijo |

### Next implement slice (recomendado)

Cuando se diga **implementar**, hacer **solo P0 de routing virtual**:

1. Mover marketing a `/` (viewer deja de ser raíz).
2. Introducir resolución de contexto desde pathname `/{orgSlug}/{tourSlug}` (y rewrite mínimo local si hace falta).
3. Seguir sirviendo un solo `index.html` / `control-web` / `plataforma/org-admin.html`.
4. Mantener `?slug=` como compat.
5. **No** copiar carpetas por tour; **no** aún migrar slugs Unisimón ni índice compuesto (eso es P1).

**Done:**  
`http://host/unisimoncucuta/experienciavirtual/?scene=…` (o slugs actuales mapeados) abre el mismo motor; `/` muestra Orbe360; cero duplicados del codebase.

---

## Checklist de aceptación (producto)

- [ ] Docs 31 apuntan a este esquema (sin `/t/` como canónico).
- [ ] Unisimón documentado con URL exacta objetivo.
- [ ] Decisión virtual vs físico explícita y rechazada la copia N.
- [ ] Gaps DB (`by_org_and_slug`, resolve dual-slug) listados.
- [ ] Embed = deep link / iframe al prefijo canónico.
- [ ] Roles superadmin vs tour admin sin cambio de política.

---

*ADR + contrato URL — 2026-09-11. Sin cambios de código de routing en este pase.*
