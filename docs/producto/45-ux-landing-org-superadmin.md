# 45 — UX multi-empresa: landing, org-admin, superadmin

**Fecha:** 2026-09-14  
**Proyecto:** Orbe360  
**Relacionados:** [38 Soft Clay](./38-soft-clay-ui.md) · [39 identidad](./39-identidad-orbe-vs-cliente.md) · [41 landing B2B](./41-landing-orbe-y-cliente-unisimon.md) · [05 cómo levantar](./05-como-levantar.md)

## Objetivo

Pasar de paneles CRUD / “muros de instrucciones” a **dashboards** que escalan a muchas empresas y tours, sin mezclar identidad Orbe (sky Soft Clay) con branding de cliente (p. ej. verde Unisimón).

## Superficies rediseñadas

| URL | Audiencia | Cambio |
|-----|-----------|--------|
| `/` | Marketing B2B | Hero Soft Clay/mesh, brand ORBE360 dominante, CTA primario al caso, Acceso solo en footer; Unisimón = caso etiquetado vía `listPublishedDemos` |
| `/{org}/org-admin.html` | Admin de empresa | Tabs Tours \| Branding \| Publicación \| Accesos; cards de tours; preview live de branding; cuota `X de Y` si hay `maxTours` |
| `/plataforma/superadmin.html` | Operador Orbe | KPIs (orgs/tours/publicados/users); tabla de empresas con cuota y patrón `/{org}/{tour}/`; crear en tab; seed en panel Avanzado |

## Cuota de tours (`maxTours`)

| Campo | Comportamiento |
|-------|----------------|
| `organizations.maxTours` | Opcional. Ausente / `null` = **ilimitado** |
| `createOrganization` | Acepta `maxTours` opcional |
| `setOrganizationMaxTours` | Superadmin ajusta o limpia cuota |
| `createTour` | Si hay cuota y `tourCount >= maxTours` → error |
| UI org-admin | Pill “X de Y tours usados” o “N tours · sin límite” |
| UI superadmin | Columna cuota + campo al crear org |

## Identidad

- Chrome de plataforma: tokens Soft Clay / sky Orbe (`#0284c7`) — `plataforma/tokens.css`.
- Tour público / preview de branding: colores del **cliente** (TourBranding), nunca copiar verde USB al chrome Orbe.
- Routing virtual sin cambios conceptuales: `/{org}/{tour}/`, `/{org}/org-admin.html`.

## Qué no se tocó

- Sync espacial / reset grafo del piloto (sigue detrás de confirmación doble en Accesos → Avanzado).
- Authz Convex (memberships, superadmin vs orgAdmin).
- Grafo `connections` del piloto.

## Verificación

```bash
npx convex dev   # schema maxTours + getPlatformStats
npm start        # :8081
npm run qa
npx playwright test
```

Checks Playwright: headline landing, org-admin tabs + branding preview, superadmin KPIs + seed avanzado, Acceso solo footer.

## Nota 2026-09-14 — SVG Soft Clay

Pase visual + shapes: ver [54-landing-svg-soft-clay.md](./54-landing-svg-soft-clay.md). IA B2B y copy honesto; a11y de marketing y motor de tour intactos.
