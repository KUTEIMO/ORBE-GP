# 58 - Curso vs ORBE (Aplicativos): dónde vive cada cosa

**Fecha:** 2026-09-16  
**Tipo:** mapa obligatorio curso ↔ producto (para humanos y agentes)  
**Relacionado:** [56-handoff](./56-handoff-conversacion-y-ubicacion.md) · [57-hogar SaaS](./57-orbe-saas-home-aplicativos.md)

---

## Por qué se hizo este split

1. El workspace de **gestión de proyectos** mezcla entrega académica (charter, PF/COCOMO, sustentación) con un prototipo que ya creció a **producto SaaS real (Orbe360)**.
2. El producto **amplía deliberadamente** más allá de lo que pide el curso: multi-tenant, Convex, Control Web, sandbox Soft Clay, hardening, aspiración a **publicar**.
3. Para no contaminar la carpeta de materia ni tratar el SaaS como “solo entrega”, el **desarrollo/runtime continuo** se mueve a Aplicativos, junto a otros repos del autor, con el nombre **`ORBE`** = SaaS completo en construcción (mejorar de verdad la V1 Cursor).
4. Filosofía (autor): **lo hago por el curso y para mejorarlo de verdad**; amplío aunque el curso no lo pida todo; Orbe es un **SaaS completo**, no un mínimo académico.

**No se borra** la carpeta del curso ni el MVP legado. **No se wipea** el grafo Convex de Unisimón.

---

## Dos hogares (regla de oro)

| Rol | Path absoluto | Qué es |
|-----|---------------|--------|
| **Curso (académico + docs de entrega/gestión + referencia de conversación)** | `C:\Users\SOTO\Documents\ED\simon\2026 2\gestion de proyectos\PROTOTIPO-360-CURSOR-V1` | Copia de materia. **Docs académicos y referencia del curso: ESTA carpeta** (y el padre `gestion de proyectos` para `LEEME.md` / entregables). |
| **Padre del curso (mapa de materia)** | `C:\Users\SOTO\Documents\ED\simon\2026 2\gestion de proyectos` | `LEEME.md`, `01_CURSO_GESTION_PROYECTOS/`, etc. |
| **Producto SaaS (desarrollo / runtime Orbe360)** | `C:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE` | Hogar de `npm start`, `npx convex dev`, código que se publica. |
| **Stub archivo post-reorg** | `C:\Users\SOTO\APLICATIVOS\_archivo_duplicados\unisimon\20260916\ORBE` | Marcador; árbol reunido en UniSimón. |

### Cómo hablar de docs vs runtime

- **Cualquier charla técnica ligada al curso, handoff de conversación, entrega o “gestión de proyectos” → revisar docs en la carpeta académica** (`PROTOTIPO-360-CURSOR-V1\docs\…` y `LEEME.md` del padre).
- **Correr servidores, editar producto hacia publicación, Convex del día a día → `ORBE` en Aplicativos.**
- Las mismas notas 56–58 viven en **ambos** árboles para que ninguno quede huérfano; el significado no cambia: curso = referencia académica; ORBE = SaaS.

---

## Runtime (solo ORBE)

```text
cd "C:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE"
npm install                 # si hace falta
npx convex dev              # terminal 1 — Convex local (puertos 3210/3211 típicos)
npm start                   # terminal 2 — http://127.0.0.1:8081/
```

Si hace falta login interactivo una vez:

```bash
npx convex login
npx convex dev
```

Preferir **8081** como puerto del producto. Si está ocupado, `PORT=8082 npm start` (o el siguiente libre) y documentar el puerto usado.

---

## Checklist para el próximo agente / humano

- [ ] ¿Es pregunta de **curso / entrega / handoff académico**? → docs en path de `gestion de proyectos`.
- [ ] ¿Es **código / servers / SaaS**? → workspace `ORBE`.
- [ ] ¿Backup de grafo Unisimón antes de sync raros? → `npm run backup:unisimon-graph` **desde ORBE**.
- [ ] Nunca borrar curso ni MVP legado; nunca wipe del grafo piloto.

---

## Sesión runtime (2026-09-16)

Servicios levantados **desde ORBE** (no desde la carpeta del curso):

| Servicio | Comando | Puerto | PID (aprox.) |
|----------|---------|--------|----------------|
| Convex local | `npx convex dev --typecheck disable` | **3210** (API), **3211** (site) | shell **18300**; backend listen **12224** |
| Web Orbe360 | `npm start` | **8081** | shell **28076**; node listen **25084** |

- `npm install` ya estaba hecho en ORBE.
- Convex: deployment local `anonymous:anonymous-agent` (sin cuenta cloud). Mensaje del CLI: *No Convex account (run `npx convex login` to link to a project)* — **opcional**; para cloud/producción el usuario debe ejecutar una vez `npx convex login` y luego `npx convex dev` en ORBE.
- Verificado: `http://127.0.0.1:8081/` responde.
- Grafo local: se reutilizó `.convex` + `.env.local` copiados desde la carpeta del curso (sqlite ~55 MB) para **no wipear** Unisimón.

### Reabrir más tarde

```bash
cd "C:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE"
npx convex dev
npm start
```