# 57 - ORBE: hogar SaaS en Aplicativos

**Fecha:** 2026-09-16  
**Tipo:** nota de ubicación + filosofía de producto  
**Relacionado:** [56-handoff](./56-handoff-conversacion-y-ubicacion.md)

---

## Por qué existe `ORBE`

El autor mantiene el prototipo como **proyecto de curso en gestión de proyectos**, pero lo **amplía deliberadamente más allá del alcance académico** para construir un **SaaS real publicable (Orbe360)**, mejorando la V1 de Cursor.

| Carpeta | Rol |
|---------|-----|
| `...\gestion de proyectos\PROTOTIPO-360-CURSOR-V1` | Copia de **curso** / materia — entregables, demo, trazabilidad académica. **No borrar.** |
| `...\APLICATIVOS\proyectos unisimon\ORBE` | **Hogar de desarrollo del producto** — línea SaaS Orbe360 (multi-tenant, Convex, Control Web, piloto Unisimón). |
| `...\APLICATIVOS\_archivo_duplicados\unisimon\20260916\ORBE` | Stub post-reorg (árbol reunido en UniSimón). |

---

## Curso vs producto

- **Curso:** cumplir y documentar lo que pide la materia (gestión de proyectos / PEVCI).
- **Producto:** misma base técnica, pero roadmap, hardening, multi-empresa y UX orientados a **publicar** Orbe360 de verdad.
- Ambición: curso **y** mejora real — no quedarse en el mínimo académico.

---

## Qué hacer al abrir ORBE

1. Abrir `C:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE` en Cursor.
2. `npm install`
3. `npx convex dev` (re-vincular deployment desde la ruta nueva)
4. `npm start` → http://127.0.0.1:8081/

Detalle: [05-como-levantar.md](./05-como-levantar.md) · handoff [56](./56-handoff-conversacion-y-ubicacion.md).

---

## Docs académicos vs este repo

- **Docs del curso / gestión de proyectos / handoff académico:** revisar siempre la carpeta académica  
  `C:\Users\SOTO\Documents\ED\simon\2026 2\gestion de proyectos\PROTOTIPO-360-CURSOR-V1`  
  (padre: `...\gestion de proyectos\LEEME.md`). Ahí vive la **referencia del curso**.
- **Este repo `ORBE`:** solo el **SaaS** (código + runtime). Las copias de docs aquí apuntan de vuelta al curso para no dejar huérfano el producto.
- Mapa explícito: [58-curso-vs-orbe-aplicativos.md](./58-curso-vs-orbe-aplicativos.md).

Filosofía en una frase: *por el curso y para mejorarlo de verdad; Orbe es SaaS completo aunque el curso no pida todo.*