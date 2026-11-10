# 62 — Auditoría de la documentación: errores, contradicciones, riesgos de lectura y huecos

**Proyecto:** Orbe360 (repo `ORBE`, `APLICATIVOS\proyectos unisimon\ORBE`)
**Fecha:** 2026-09-29
**Alcance:** los 61 docs de `docs/producto/`, `docs/arquitectura/`, `docs/*.md`, `AGENTS.md`, `README.md`
**Método:** lectura + verificación cruzada contra el código y contra respuestas HTTP reales. Cada hallazgo cita archivo y línea.

---

## 0. Veredicto

La documentación de este producto es **inusualmente buena en sustancia** y **frágil en mantenimiento**. Las decisiones están argumentadas, las auditorías tienen evidencia y la disciplina sobre lo no verificado es ejemplar (§5). El problema es otro: **hay documentos que quedaron congelados y ahora afirman cosas falsas con la misma autoridad que los correctos**, y un lector nuevo no tiene forma de saber cuál es cuál.

Riesgo dominante: no es la falta de documentación, es la **documentación desactualizada que parece vigente**.

---

## 1. Contradicciones factuales

### 1.1 El verde retirado `#009b3a` sigue documentado como identidad Orbe · **Alta**

| Doc | Línea | Qué dice |
|-----|-------|----------|
| [39](./39-identidad-orbe-vs-cliente.md) | 47 | "**Retirada:** el verde producto anterior `#009b3a` / `#007a2e` ya no es la identidad Orbe" ✅ |
| [12](./12-design-system-orbe360.md) | 79 | `tokens.css ← marca Orbe360 (#009b3a) — NO es Unisimón` ❌ |
| [31](./31-vision-producto-routing-diseno.md) | 49 | "El verde `#009b3a` funciona como **arcilla pigmentada** (CTA, nodos activos, focus)" ❌ |
| [20](./20-fase4-white-label-branding.md) | 15, 25 | "`plataforma/tokens.css`, `--orbe-green #009b3a`" presentado como token vigente ❌ |

**Por qué importa, con consecuencia medida:** un diseñador que lea el doc 12 o el 31 (que son precisamente los docs de diseño, los primeros que abriría) repinta el chrome con un color retirado. No es hipotético: **encontré esa fuga ya materializada en el código**:

- `control-web/admin.css` tenía una regla duplicada `.btn--accent { background: var(--accent, #1f7a4c) }` que, al no estar `--accent` definido en ese archivo, pintaba los CTA del editor ("Subir panorama", "Conectar") **en verde**, ganando por orden de cascada al azul Orbe declarado antes.
- `css/components/hotspots.css` usaba `rgba(0, 155, 58, 0.55)` — que es exactamente `#009b3a` — para el borde de hover de los chips de hotspot, es decir **el verde retirado de Orbe filtrándose al viewer white-label del cliente**, contra la regla explícita del doc 39.

Ambas corregidas en este pase (ver [61](./61-design-system-orbe-v2.md) §6). La causa raíz, sin embargo, es documental: mientras 12/31/20 digan eso, la fuga vuelve.

**Corrección:** aplicada nota fechada en 12, 31 y 20 apuntando a 39 como fuente única de color de plataforma.

### 1.2 El mismo documento da dos cifras distintas para el grafo de campus · **Media**

En [05-como-levantar.md](./05-como-levantar.md):

- Línea 34: "salvo reset consciente (**~161 aristas** del paquete campus y se pierde el trabajo admin)"
- Línea 61: "`tourAdmin:syncCampusSpatialGraph` — **borra** el grafo curado y restaura **~144 aristas** campus"

Los docs [36](./36-fix-grafo-admin-vs-publico.md) (línea 25) y [37](./37-proteccion-grafo-trabajo-diario.md) (línea 33) dicen **144**. El `161` de la línea 34 es el valor huérfano.

**Por qué importa:** esa advertencia es la que protege el activo más frágil del producto (el grafo curado, cuya pérdida ya ocurrió antes — docs 36/51). Una advertencia que se contradice consigo misma a 27 líneas de distancia pierde autoridad justo donde más la necesita.

**Corrección:** aplicada — línea 34 unificada a ~144 con referencia a 37.

### 1.3 Rutas de audio/transcripciones/subtítulos que hoy devuelven 410 · **Alta para quien crea contenido**

`assets/DEPRECATED.md` (en la raíz de `assets/`) declara:

> Canonical: `media/unisimoncucuta/experienciavirtual/assets/` · Absolute URLs: `/media/unisimoncucuta/experienciavirtual/assets/…`

Y el doc [50](./50-media-por-tour-unisimon.md) confirma que la raíz compartida está deprecada (**410**). Pero siguen documentando rutas raíz como si fueran válidas:

| Doc | Líneas | Rutas obsoletas |
|-----|--------|-----------------|
| [19-tts-accesibilidad.md](./19-tts-accesibilidad.md) | 38–46, 108, 118 | `assets/audio/scenes/{sceneKey}.mp3`, `assets/transcripts/scenes/…`, `assets/captions/scenes/…` |
| [GUIA-COMPLETA-360.md](../GUIA-COMPLETA-360.md) | 100–102, 111–113, 136 | `"narration": "assets/audio/placeholder.mp3"`, `"captionFile": "assets/captions/laboratorio.vtt"` |
| [14-backlog-accesibilidad-tours.md](./14-backlog-accesibilidad-tours.md) | 71, 90, 145–147, 291 | `assets/audio/`, `assets/captions/*.vtt`, `assets/transcripts/*.txt` |

Además, los archivos citados **ya no existen en el árbol** (`assets/captions/*.vtt`, `assets/transcripts/*.txt` y `assets/audio/placeholder.mp3` fueron eliminados al migrar a media por tenant).

**Por qué importa:** `GUIA-COMPLETA-360.md` es el doc que alguien usaría para **montar un tour nuevo**. Copiar ese JSON produce un tour con narración y subtítulos apuntando a 410 — y el fallo es silencioso: el panorama carga, el audio simplemente no suena. Es el peor tipo de error de documentación, porque no explota, degrada.

**Estado:** no corregido en este pase. Requiere reescribir ejemplos de contenido, no diseño; lo dejo como acción priorizada (§6) para no invadir docs de accesibilidad que otro agente puede estar tocando.

### 1.4 El doc de diseño insinúa que el login revela contraseñas · **Media**

[12](./12-design-system-orbe360.md) línea 112: "Credenciales demo solo con `?demo=1`".
Frente a [05](./05-como-levantar.md) línea 77: "Login con `?demo=1` solo indica que existe modo demo; **no muestra passwords**" y [53](./53-inventario-fugas-acceso.md) fuga #7: **Fixed**.

El doc 12 describe un comportamiento **ya eliminado por seguridad**. Leído solo, sugiere que existe una forma de hacer que la UI escupa credenciales.

**Corrección:** aplicada nota en el doc 12.

---

## 2. Lo que puede hacer entender algo equivocado

### 2.1 Veinte documentos dicen que el proyecto es `PROTOTIPO-360-CURSOR-V1` · **Alta**

`docs/README.md` línea 3 abre con:

> Mapa de la documentación del repo `PROTOTIPO-360-CURSOR-V1`.

Y ~20 docs llevan la cabecera `**Proyecto:** PROTOTIPO-360-CURSOR-V1` (13, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26, 27, 31, 32, 34, 46, 47, y `arquitectura/00-overview.md`).

Esto **era** correcto cuando el repo se llamaba así. Hoy es activamente engañoso, porque `PROTOTIPO-360-CURSOR-V1` ya no es "el nombre viejo de esto": es **otro árbol que existe simultáneamente y que sirve la demo pública** (puerto 8081 + cloudflared), auditado como repo separado en [59](./59-auditoria-seguridad-demo-publica.md), y además hay una **tercera** copia legacy en `APLICATIVOS\EXTRAS\repos\` ([56](./56-handoff-conversacion-y-ubicacion.md) línea 17).

**Por qué importa:** un agente o un compañero que lea "Proyecto: PROTOTIPO-360-CURSOR-V1" en la cabecera de un doc de este repo puede concluir que debe ir a editar la otra carpeta — que es la que está sirviendo la demo en vivo. La confusión entre árboles es exactamente el problema que obligó a escribir tres documentos (56, 57, 58) para desambiguar. Dejar la cabecera vieja lo reintroduce doc a doc.

**Corrección:** aplicada en `docs/README.md` (encabezado + nota de convención). Las 20 cabeceras individuales quedan como acción de barrido (§6): son un `sed` de una línea, pero toca 20 archivos que otros agentes pueden tener abiertos.

### 2.2 Doc 05 manda levantar en el puerto 8081, que es el de la demo pública · **Alta (operativa)**

[05](./05-como-levantar.md) §3 dice `npm start` → "Puerto **8081**", y las 9 URLs de la tabla son `http://127.0.0.1:8081/...`.

Lo que el doc no dice: **8081 lo está ocupando la otra copia** (`PROTOTIPO-360-CURSOR-V1`, vía `scripts/start-demo.mjs`) para servir la demo pública por túnel. Consecuencias reales de seguir el doc al pie de la letra desde `ORBE`:

1. Si la demo está arriba → el bind falla, o peor, el desarrollador cree estar viendo sus cambios cuando está viendo la otra copia.
2. Si la demo no está arriba → se sirve `ORBE` en el puerto que el túnel expone. Antes de las correcciones del doc 59, eso publicaba `.env.local`, `docs/`, `backups/` y `convex/*.ts` a Internet (hallazgo #4 de esa auditoría).

**Por qué importa:** es el doc canónico de arranque. Un doc de arranque que colisiona con la demo en producción y no lo advierte es un incidente esperando ocurrir. (En este pase usé `PORT=8099` precisamente para evitarlo.)

**Corrección:** aplicada advertencia en el doc 05 §3.

### 2.3 Dos contraseñas reales en claro en la documentación · **Alta**

[05](./05-como-levantar.md) líneas 72–75 tabulan `superadmin@orbe360.local / OrbeSuper2026!` y `admin@unisimon.local / UnisimonAdmin2026!`, con el epígrafe "solo docs / CLI — no en HTML público".

Ese epígrafe asumía que `docs/` no se sirve. La auditoría [59](./59-auditoria-seguridad-demo-publica.md) (hallazgo #4) verificó que `ORBE/scripts/dev-server.mjs` **sí servía `docs/`** hasta que se añadió la blocklist. Es decir: durante un tiempo, las credenciales de superadmin estuvieron a una URL de distancia.

Añádase que son las contraseñas **reales del seed** y que quedan en el historial de git (hallazgo #9 del doc 59).

**Recomendación:** sustituir la tabla por los **nombres de las variables de entorno** (`SEED_SUPERADMIN_PASSWORD`, `SEED_ORGADMIN_PASSWORD`) y rotar. No lo cambio yo: rotar credenciales es del dominio del agente de seguridad y una edición a medias (quitar de docs pero no rotar) da falsa tranquilidad.

### 2.4 "Piloto", "entregable de curso", "sandbox": vocabulario correcto en interno, tóxico si se filtra · **Media**

[39](./39-identidad-orbe-vs-cliente.md) línea 16: "Unisimón Cúcuta es un **caso piloto / entregable de curso**, no la marca de la plataforma."

Internamente es exacto y necesario. El riesgo es de **frontera**: si esa formulación cruza a un artefacto que ve el cliente (una propuesta, un pie de página, un título de panel, un `<title>`), el mensaje que recibe la institución es "tú eres nuestro trabajo de clase". Lo mismo con el nombre visible de la organización `orbe/sandbox`, que hoy es alcanzable públicamente (hallazgo #15 del doc 59: `graph:listPublishedDemos` lo expone).

No es un error del doc 39 — es una regla que falta escribir: **el vocabulario de obra no sale de `docs/`**. Escrita ahora en [60](./60-marca-orbe-refinada.md) §4.

---

## 3. Lo que está mal escrito (claridad, no veracidad)

| Doc | Problema | Efecto |
|-----|----------|--------|
| [05](./05-como-levantar.md) | Un solo documento mezcla: arranque, seed, protección del grafo, matriz de URLs, identidad, QA y limpieza. 156 líneas con 7 temas. | Es el doc de entrada y es el más difícil de leer. Lo crítico (la advertencia del grafo) va en un blockquote a la línea 33, antes de que el lector sepa qué es un grafo. |
| [14](./14-backlog-accesibilidad-tours.md) | ~290 líneas con IDs `T-P0-1…T-P1-9`, matrices de dispositivos y tablas de inventario en el mismo archivo. | El contenido es excelente y casi nadie lo leerá entero. Debería partirse en política + backlog + matriz de verificación. |
| [12](./12-design-system-orbe360.md) | Título `# Design System Orbe360` sin número, a diferencia de todos los demás. | Rompe el patrón de referencia cruzada (`[12 design system]` apunta a un doc que no se identifica como 12). |
| Cabeceras en general | Unos docs traen `**Proyecto:** / **Fecha:** / **Relacionados:**`, otros nada. | No se puede saber la antigüedad de una afirmación, que es justo lo que hace falta para detectar los casos de §1. |
| [decisiones/README.md](../decisiones/README.md) | Se llama "Índice ADR" pero es una tabla que apunta a docs 29–34; no hay ADRs. | Promete un registro de decisiones que no existe; las decisiones reales están dispersas en docs de producto. |

**Recomendación transversal de formato:** cabecera obligatoria con `Fecha` y `Estado` (`vigente` / `histórico` / `superado por N`) en todo doc nuevo, y marcar como `histórico` los que describen fases cerradas (15–27). Un doc marcado `histórico` puede contener información obsoleta sin engañar a nadie; hoy no hay forma de marcarlo.

---

## 4. Documentación que falta

Ordenada por lo que costó no tenerla en este pase:

| # | Falta | Coste real observado |
|---|-------|----------------------|
| 1 | **Inventario de UI de Control Web**: qué IDs existen, cuáles usa `admin.js`, qué se re-renderiza y cómo | Tuve que leer `control-web/admin.js` completo para descubrir que el SVG del grafo se reconstruye con `innerHTML` en cada selección (por eso **no** puse animaciones de entrada en los nodos: harían flash en cada clic), y que `#editorEmpty`, `#statusBar`, `#dirtyBadge`, `#saveProgress`, `#graphStats` son los puntos de anclaje. Cualquier rediseño futuro repite esa arqueología. → propongo `docs/arquitectura/02-inventario-ui-control-web.md` |
| 2 | **Contrato de `css/` como superficie compartida**: qué CSS es del motor y qué es por tenant, y el hecho de que `css/` **atraviesa** el aislamiento de media del routing virtual | Tuve que leer `scripts/dev-server.mjs` y verificar con 200 en `/{org}/{tour}/css/design-tokens.css` que un `@import` nuevo resuelve bajo prefijo de tour. Sin eso, nadie se atreve a añadir un archivo CSS compartido. → escrito ahora en [61](./61-design-system-orbe-v2.md) §2 |
| 3 | **Sistema de diseño del producto interno** (Control Web / org-admin). El doc 12 cubre marketing y plataforma; el 38 cubre Soft Clay. El panel de operador no tenía sistema | Radios, sombras y duraciones inventadas caso por caso; `prefers-reduced-motion` a parches. → [61](./61-design-system-orbe-v2.md) |
| 4 | **Marca, voz y microcopy** | El copy del panel decía "persistir en este navegador" y **contradecía** el doc 55 sobre qué hace Guardar. Sin guía de voz, cada agente inventa registro. → [60](./60-marca-orbe-refinada.md) |
| 5 | **Decisión sobre librerías de animación** | Pregunta recurrente sin respuesta escrita. → [61](./61-design-system-orbe-v2.md) §5 (anime.js: no ahora, con criterios de adopción) |
| 6 | **Guía de contenido vigente para montar un tour nuevo** | `GUIA-COMPLETA-360.md` es el candidato natural pero sus rutas están obsoletas (§1.3). Hoy no existe un documento correcto de "cómo creo un tour desde cero con media por tenant". **Este es el hueco más caro que queda**: es el paso 1 del onboarding de la empresa #2, que es la tesis comercial del producto. |
| 7 | **Índice completo** | `docs/README.md` lista ~30 de 61 docs de producto. Faltan 13–19, 21, 23–30, 35–37, 40–42, 57, 58 y los nuevos. Un mapa que no mapea obliga a `ls docs/producto`, que es lo que el mapa debía evitar. → corregido parcialmente |

---

## 5. Lo que está bien y no hay que "arreglar"

Vale decirlo porque es lo primero que un refactor documental destruiría:

1. **Disciplina sobre lo no verificado.** Docs 17, 18, 20, 22, 25 y 34 marcan NVDA/TalkBack como **NO VERIFICADO** de forma consistente, y el doc 33 (línea 61) lo eleva a política P0: "no se afirma soporte TalkBack/NVDA sin evidencia". Para un producto cuyo argumento es la accesibilidad, esta honestidad es el activo reputacional más valioso del repo. **No relajarla nunca.**
2. **Doc 39 es un buen doc de identidad**: tiene tabla de superficies, paleta con uso por token y checklist de no-regresión accionable. Es el modelo a imitar.
3. **La advertencia del grafo se repite en 05, 36, 37 y 51.** Redundancia deliberada y correcta: protege un activo que ya se perdió una vez.
4. **Las auditorías traen evidencia** (peticiones reales, archivo:línea). El doc 59 es ejemplar en esto.
5. **`AGENTS.md` es corto, imperativo y cierto.** Siete reglas, todas verificables. No engordarlo.

---

## 6. Acciones priorizadas

Aplicado en este pase:

- [x] Nota fechada en 12, 31 y 20 sobre `#009b3a` retirado → 39 como fuente única
- [x] Nota en 12 sobre `?demo=1` (ya no revela credenciales)
- [x] Unificado ~144 aristas en doc 05
- [x] Advertencia de colisión de puerto 8081 en doc 05
- [x] `docs/README.md`: repo correcto + convención de nombres + índice ampliado
- [x] Docs nuevos: [60 marca](./60-marca-orbe-refinada.md), [61 design system v2](./61-design-system-orbe-v2.md), este

Pendiente, por impacto/esfuerzo:

| Prioridad | Acción | Impacto | Esfuerzo | Dueño sugerido |
|-----------|--------|---------|----------|----------------|
| **P0** | Reescribir rutas `assets/` en 19, 14 y `GUIA-COMPLETA-360.md` a `media/{org}/{tour}/assets/` (§1.3) | Alto — hoy produce tours con audio roto en silencio | Bajo | contenido / a11y |
| **P0** | Quitar las dos contraseñas del doc 05 y rotarlas (§2.3) | Alto | Bajo | seguridad |
| **P1** | Guía vigente "crear un tour desde cero" con media por tenant (§4.6) | Alto — es el onboarding del cliente #2 | Medio | producto |
| **P1** | Barrido de las ~20 cabeceras `Proyecto: PROTOTIPO-360-CURSOR-V1` (§2.1) | Medio-alto | Bajo (toca 20 archivos) | cualquiera, en un solo commit |
| **P2** | `docs/arquitectura/02-inventario-ui-control-web.md` (§4.1) | Medio | Medio | quien toque Control Web |
| **P2** | Cabecera con `Estado: vigente/histórico/superado por N`; marcar 15–27 como histórico | Medio — desactiva las trampas de §1 de raíz | Medio | — |
| **P3** | Partir doc 05 (arranque / grafo / URLs) y doc 14 (política / backlog / matriz) | Medio | Medio | — |
| **P3** | ADRs reales en `docs/decisiones/` o renombrar la carpeta a lo que es | Bajo | Bajo | — |
