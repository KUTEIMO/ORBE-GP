# 56 - Handoff: conversación, ubicaciones y continuidad

**Fecha:** 2026-09-16  
**Tipo:** handoff de producto + mapa de carpetas  
**Audiencia:** quien continúe desarrollo fuera de la carpeta del curso  
**Actualizado:** hogar SaaS = `...\APLICATIVOS\EXTRAS\repos\ORBE` (ver [57](./57-orbe-saas-home-aplicativos.md))

---

## A. Ubicaciones

| Rol | Path | Notas |
|-----|------|--------|
| **Curso / gestión de proyectos** | `C:\Users\SOTO\Documents\ED\simon\2026 2\gestion de proyectos\PROTOTIPO-360-CURSOR-V1` | Copia de materia (charter PEVCI). **Conservar**; no es el hogar permanente del producto. |
| **Desarrollo SaaS (hogar actual)** | `C:\Users\SOTO\APLICATIVOS\EXTRAS\repos\ORBE` | **Producto Orbe360** — línea SaaS a publicar. Abrir este workspace en Cursor para desarrollo continuo. |
| **Convención de repos** | `C:\Users\SOTO\APLICATIVOS\EXTRAS\repos\` | Junto a `GestionProyectos`, `LOGIKA`, `KUTEIMO`, etc. |
| **MVP Cursor V1 (legado)** | `C:\Users\SOTO\APLICATIVOS\EXTRAS\repos\PROTOTIPO-360-CURSOR-V1` | MVP viejo (http-server :8080, sin Convex multi-tenant). **No tocar / no sobrescribir.** |
| **Aplicativos (raíz)** | `C:\Users\SOTO\APLICATIVOS` | Ecosistema de repos del autor. |

### Relación curso vs producto

- **Versión curso:** path bajo `gestion de proyectos` — entregables y demo alineados al charter.
- **Producto Orbe360 (SaaS):** hogar de desarrollo = **`APLICATIVOS\EXTRAS\repos\ORBE`**. Se amplía deliberadamente más allá del alcance académico (ver [57](./57-orbe-saas-home-aplicativos.md)).
- **Regla:** carpeta de curso ≠ hogar permanente; **ORBE en Aplicativos** = desarrollo continuo y aspiración a publicar.

Mapa del workspace padre del curso: [`../../LEEME.md`](../../LEEME.md) (raíz `gestion de proyectos`), si existe.

---

## B. Qué es el producto

**Orbe360** — plataforma SaaS de tours 360° inclusivos (white-label), con piloto real **Unisimón Cúcuta** (`unisimoncucuta` / `experienciavirtual`).

| Pieza | Rol |
|-------|-----|
| **Viewer** | Marzipano (no reescribir motor; Orbe Viewer encima) |
| **Backend** | Convex (schema, authz, grafo publicado, branding) |
| **Editor** | Control Web (grafo, hotspots, snapshot admin) |
| **Routing** | Multi-tenant por URL `/{org}/{tour}/` |
| **Sandbox producto** | `orbe` / `sandbox` (Soft Clay, aislado del piloto) |

Stack y URLs: [README raíz](../../README.md) · [05-como-levantar](./05-como-levantar.md) · [32-routing](./32-routing-multi-empresa-url.md).

---

## C. Inventario de lo hecho en esta conversación (temas cronológicos)

Arco documentado en **46 → 57**. Dos docs compartían el número 54; el grafo pasó a **55**, handoff **56**, hogar SaaS **57**.

| # | Tema | Doc |
|---|------|-----|
| 1 | Gap editor/visor vs tours inmersivos tipo RealVision360 | [46](./46-gap-editor-tours-inmersivos.md) |
| 2 | Estudio de motores 360; **no** reescribir Marzipano | [47](./47-estudio-motores-360-y-estrategia.md) |
| 3 | Sandbox `orbe/sandbox` + P1 iconos/categorías/pulse + backup de grafo | [48](./48-sandbox-orbe-editor-p1.md) |
| 4 | Fuga de aislamiento (sandbox veía media Unisimón) → fix | [49](./49-aislamiento-tour-media-roles.md) |
| 5 | Media Unisimón → `media/unisimoncucuta/experienciavirtual/` | [50](./50-media-por-tour-unisimon.md) |
| 6 | Grafo vacío post-migración / wipe al Guardar → fix | [51](./51-grafo-post-migracion-media.md) |
| 7 | Control Web authz universal (cualquier cuenta + membership) | [52](./52-control-web-authz.md) |
| 8 | Inventario de **8** fugas de acceso / aislamiento | [53](./53-inventario-fugas-acceso.md) |
| 9 | Landing SVG Soft Clay + copy B2B honesto | [54](./54-landing-svg-soft-clay.md) |
| 10 | Grafo/guardado UX (draft local, vecindario, dirty state) | [55](./55-grafo-y-guardado-control-web.md) |
| 11 | Handoff (ubicaciones + continuidad) | [56](./56-handoff-conversacion-y-ubicacion.md) |
| 12 | Hogar SaaS ORBE en Aplicativos | [57](./57-orbe-saas-home-aplicativos.md) |

### Requisitos en pie (no cerrados del todo)

| Requisito | Estado |
|-----------|--------|
| A11y del motor (TalkBack en dispositivo real) | **NO VERIFICADO** en dispositivo |
| Media multi-tenant por org/tour | Hecho (49–50); mantener aislamiento |
| No wipe del grafo Unisimón | Guardas en 51 + UX Guardar en 55; **nunca** sync espacial destructivo en piloto |
| Authz por membership (no allowlist de emails) | Hecho (52); residuales en 53 (#6 legacy slug, #8 session localStorage) |

---

## D. Estado actual verificado (últimos agentes)

| Tenant / superficie | Estado |
|---------------------|--------|
| **Unisimón** | ~**62** escenas / ~**55** conexiones; branding `#0a7a45`; media bajo `media/unisimoncucuta/experienciavirtual/` |
| **Orbe sandbox** | **4** escenas; Soft Clay `#0284c7`; URLs `/orbe/sandbox/` |
| **Control Web** | Gate de auth + borrador local / Guardar explícito (dirty badge, vecindario en tours grandes) |
| **Fugas** | 8 inventariadas en [53](./53-inventario-fugas-acceso.md); residuales abiertos: #6 (legacy slug en tooling) y #8 (token en `localStorage`) |

### URLs locales típicas (`npm start` → :8081)

| URL | Uso |
|-----|-----|
| http://127.0.0.1:8081/ | Landing Orbe360 |
| http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/ | Tour público piloto |
| http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/control-web/ | Control Web Unisimón |
| http://127.0.0.1:8081/orbe/sandbox/ | Tour sandbox |
| http://127.0.0.1:8081/orbe/sandbox/control-web/ | Control Web sandbox |
| http://127.0.0.1:8081/plataforma/login.html | Login |
| http://127.0.0.1:8081/plataforma/superadmin.html | Superadmin |

---

## E. Cómo seguir (desde ORBE en Aplicativos)

1. Abrir en Cursor: `C:\Users\SOTO\APLICATIVOS\EXTRAS\repos\ORBE`
2. Terminales habituales:
   ```bash
   npm install
   npx convex dev    # terminal 1 — re-vincular deployment desde la nueva ruta
   npm start         # terminal 2 — http://127.0.0.1:8081/
   ```
3. Guía canónica: [05-como-levantar.md](./05-como-levantar.md).
4. **Hábitos de grafo**
   - Backup: `npm run backup:unisimon-graph`
   - Sync static → Convex (no wipe): `npm run sync:unisimon-graph`
   - **Nunca** `syncCampusSpatialGraph` / "Reset grafo campus" sobre el piloto Unisimón
5. QA authz: `npm run qa:authz` (o `npm run check`).
6. **Convex tras la copia a ORBE:** hace falta `npx convex dev` / login desde el path nuevo. No uses `npx convex deploy` salvo producción consciente.
7. El MVP viejo `PROTOTIPO-360-CURSOR-V1` en Aplicativos y la carpeta del curso **permanecen intactos**; no mezclarlos con ORBE.

---

## F. Índice de docs clave

| Doc | Tema |
|-----|------|
| [05](./05-como-levantar.md) | Levantar local |
| [32](./32-routing-multi-empresa-url.md) | Contrato URL multi-empresa |
| [36](./36-fix-grafo-admin-vs-publico.md) | Grafo admin vs público |
| [37](./37-proteccion-grafo-trabajo-diario.md) | Protección grafo diario |
| [46](./46-gap-editor-tours-inmersivos.md)–[55](./55-grafo-y-guardado-control-web.md) | Arco de esta conversación |
| [56](./56-handoff-conversacion-y-ubicacion.md) | Este handoff |
| [57](./57-orbe-saas-home-aplicativos.md) | Hogar SaaS ORBE |
| [58](./58-curso-vs-orbe-aplicativos.md) | Curso vs ORBE (mapa obligatorio) |
| [GUIA-COMPLETA-360.md](../GUIA-COMPLETA-360.md) | Guía larga del motor |
| [docs/README.md](../README.md) | Mapa de documentación |

Numeración: **54** = landing Soft Clay; **55** = grafo/guardado; **56** = handoff; **57** = hogar SaaS; **58** = curso vs ORBE.

---

## G. Docs del curso vs runtime del producto (obligatorio)

| Necesitas… | Ve a… |
|------------|--------|
| Docs académicos, entrega, handoff de conversación ligado a **gestión de proyectos** | **Carpeta del curso:** `C:\Users\SOTO\Documents\ED\simon\2026 2\gestion de proyectos\PROTOTIPO-360-CURSOR-V1` (y padre `LEEME.md`) — **referencia académica: ESTA ruta** |
| Desarrollo, `npm start`, `npx convex dev`, publicar Orbe360 | **`C:\Users\SOTO\APLICATIVOS\EXTRAS\repos\ORBE`** |

Detalle del split: [58-curso-vs-orbe-aplicativos.md](./58-curso-vs-orbe-aplicativos.md).

**Regla para agentes:** si el tema es documentación del curso / trail académico → leer y citar el path de ED/simon/…; si el tema es producto en marcha → operar en ORBE.