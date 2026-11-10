# 60 — Marca Orbe360 refinada: posicionamiento, voz y frontera con la marca del cliente

**Proyecto:** Orbe360
**Fecha:** 2026-09-29
**Relacionados:** [12 design system](./12-design-system-orbe360.md) · [39 identidad Orbe vs cliente](./39-identidad-orbe-vs-cliente.md) · [42 branding data-driven](./42-branding-multi-empresa-data-driven.md) · [61 design system v2](./61-design-system-orbe-v2.md)

Este doc **refina** lo ya decidido en 12 y 39; no lo reemplaza. La paleta, la tipografía y la regla de separación de identidad siguen siendo las de esos docs.

---

## 1. Diagnóstico de la marca actual

Lo que ya está bien y no debe tocarse:

- **Nombre `Orbe360`** — funciona. "Orbe" = esfera, mundo, cuerpo completo; "360" hace el producto legible sin explicación. Corto, pronunciable en español, dominio-friendly. **Mantener.**
- **Concepto "el espacio físico convertido en experiencia digital"** (doc 12) — es un buen posicionamiento de categoría, no de feature. **Mantener.**
- **Separación cromática deliberada** Orbe sky `#0284c7` vs Unisimón `#0a7a45` (doc 39). **Mantener y defender.**

Lo que está flojo:

| Problema | Evidencia | Impacto |
|----------|-----------|---------|
| El tagline **"Explora. Descubre. Conecta."** describe al visitante del tour, no al cliente que compra | doc 12 §Identidad, landing | La landing habla a la persona equivocada: quien paga es quien administra, no quien explora |
| La propuesta de valor no nombra el diferenciador real (**accesibilidad**) | landing hero: "La plataforma para tours 360 de tu empresa" | Orbe compite como "otro creador de tours 360", donde pierde por features |
| La marca no tiene **voz definida** para el producto interno | Copy real del panel: "persistir en este navegador", "sandbox", "Reset grafo campus" | El operador lee lenguaje de desarrollador, no de producto |
| El nicho no está declarado | docs 01, 12, 31 | Sin nicho, la hoja de ruta se decide por antojo |

## 2. Posicionamiento refinado

### Categoría

No "creador de tours 360". La categoría es:

> **Recorridos virtuales accesibles para instituciones que deben ser visitables por todo el mundo.**

### Nicho primario

Instituciones con **obligación o vocación de acceso universal** y espacios que la gente necesita entender *antes* de llegar: universidades y colegios, bibliotecas y museos, hospitales y centros de salud, sedes públicas.

Por qué este nicho y no "empresas en general":

1. Ya se está construyendo para él (el piloto es una biblioteca universitaria con transcripciones, subtítulos y audiodescripción — docs 14, 19, 24, 26).
2. Tiene un **presupuesto con nombre** (inclusión, admisiones, acreditación) que no depende de marketing.
3. Compra por **cumplimiento y misión**, no por novedad → ciclos más largos pero renovación estable.
4. El competidor genérico de tours 360 **no puede responder** a un pliego de accesibilidad sin rehacer su producto. Es una ventaja estructural, no una feature.

### Propuesta de valor

> **Orbe360 convierte tu sede en un recorrido que cualquiera puede visitar: con visión reducida, sin audio, con teclado, o desde un teléfono al otro lado del país.**

Y para el comprador institucional:

> **Tu equipo lo administra sin depender de un proveedor.** Escenas, enlaces, hotspots, textos y audio se editan desde el navegador. Orbe360 mantiene el motor; el contenido es tuyo.

Esta segunda frase es el diferenciador comercial que la landing hoy no dice, y es verdad verificable en el producto: el rol `orgAdmin`/`tourEditor` edita el grafo y publica, y el superadmin de Orbe **no puede** editar contenido del cliente (`userCanEditTour`, doc 52). Esa restricción técnica es un **argumento de venta**: "el proveedor no puede tocar tu contenido".

### Posicionamiento en una frase

> Orbe360 es la plataforma de recorridos virtuales 360 para instituciones que necesitan que **su espacio sea visitable por todos** — accesible por diseño, administrable por el propio equipo, con la marca del cliente al frente.

### Anti-posicionamiento (lo que Orbe no dice)

- ❌ "La mejor experiencia inmersiva" — inverificable, y Marzipano no gana en espectáculo a Matterport.
- ❌ "Tours 360 baratos / rápidos" — competir por precio en una categoría de commodity.
- ❌ "Realidad virtual" / "metaverso" — promete cascos y mundos 3D que el producto no da.
- ❌ Prometer soporte de **TalkBack/NVDA sin verificación en dispositivo** (regla vigente de `AGENTS.md`). La accesibilidad es el argumento central: exagerarla es el riesgo reputacional más grave de esta marca.

## 3. Arquitectura de marca: dos marcas, una nunca pisa a la otra

```text
ORBE360  ·  la plataforma  ·  sky #0284c7  ·  Soft Clay
├── se ve en: /  ·  login  ·  superadmin  ·  org-admin  ·  chrome de Control Web
└── voz: sistema, precisión, control

   CLIENTE (Unisimón Cúcuta)  ·  la experiencia  ·  #0a7a45 vía TourBranding
   ├── se ve en: /{org}/{tour}/  — el recorrido público completo
   └── voz: hospitalidad, orientación, lugar
```

**Regla de oro (doc 39, reafirmada):** en el recorrido público el visitante debe creer que está en un producto de **su institución**. Orbe360 aparece ahí, como máximo, en una firma discreta (`showPoweredByOrbe360`) — nunca en el color, nunca en la tipografía de marca, nunca en el chrome.

Corolario que este doc añade: **el cliente es el protagonista del caso de éxito, no del logo.** La landing de Orbe muestra el espacio de Unisimón como prueba de trabajo real (fotografía del campus), con la marca Orbe en el chrome. Eso es legítimo y es lo que hace la landing hoy. Lo ilegítimo sería lo contrario: el verde del cliente pintando el panel de Orbe.

### Frontera operativa (checklist para cualquier PR de UI)

- [ ] ¿Toqué una superficie **Orbe**? → solo `--orbe-*`. Cero `#0a7a45`.
- [ ] ¿Toqué una superficie **del tour**? → solo `--brand*` desde TourBranding. Cero `#0284c7`, cero `#009b3a`.
- [ ] ¿Escribí un color literal? → entonces probablemente rompí el onboarding de la empresa #2.

## 4. Voz y tono

Orbe360 tiene **dos registros**, y confundirlos es el error de copy más frecuente del repo.

### Registro A — Público (marketing y recorrido)

Habla de **lugares y personas**, no de sistemas.

| En vez de | Escribe |
|-----------|---------|
| "Motor de tours 360 con hotspots configurables" | "Recorre la biblioteca antes de tu primer día" |
| "Soporta TTS y subtítulos WebVTT" | "Con audio descriptivo y subtítulos en cada espacio" |
| "Nodo de navegación" | "Ir al Hall de Ingreso" |

Reglas: segunda persona, frases cortas, cero jerga técnica, cero mención de roles internos ni de limitaciones de demo (ya es regla de verificación en doc 12).

### Registro B — Producto interno (Control Web, org-admin, superadmin)

Habla de **acciones y consecuencias**, con precisión y sin condescendencia. El operador es competente; lo que necesita es saber **qué pasa si pulsa**.

Principios:

1. **Nombra la consecuencia, no la implementación.**
   - ❌ "Usa Guardar cambios para persistir en este navegador y luego exporta `tour-graph.json`."
   - ✅ "Tus ediciones quedan en un borrador local hasta que pulses Guardar cambios, que las publica en el tour."
   (Este cambio ya se aplicó: el copy anterior además **contradecía** el doc 55, donde Guardar escribe en Convex.)
2. **Los estados vacíos explican la causa y ofrecen la salida.** No "Sin resultados", sino "Ninguna escena visible · Limpia el buscador o el filtro de zona, o añade una escena al tour."
3. **Las acciones destructivas dicen qué se destruye, con número.** "Regenera ~144 aristas fantasma y sobrescribe el grafo curado" es utilizable; "Reset grafo campus" no.
4. **Sin emoji, sin exclamaciones, sin "¡Ups!".** Un error en una herramienta de trabajo se reporta, no se decora.
5. **Verbos en infinitivo para acciones, presente para estados.** "Colocar hotspot aquí" / "Cambios sin guardar".

### Prohibido en la interfaz: vocabulario de obra

El producto debe **verse terminado**. Nunca en UI visible:

| Prohibido | Por qué | Alternativa |
|-----------|---------|-------------|
| "demo", "sandbox", "prototipo", "piloto" | Dice al cliente que paga por un experimento | Nombre real del espacio de trabajo |
| "sync", "reset", "wipe", "seed", "patch" | Vocabulario de base de datos | "Sincronizar", "Restablecer", "Regenerar" con la consecuencia explícita |
| "persistir", "hardcode", "slug", "payload" | Jerga de desarrollador | "Guardar", "fijo", "dirección", "datos" |
| Nombres de funciones Convex (`tourAdmin:syncCampusSpatialGraph`) | Ruido | Solo en `<details>` de advertencia técnica o en docs |

**Caso concreto resuelto en código de seed:** la organización `orbe` + tour slug `sandbox` mantienen el slug (rutas/media/grafo). El **nombre visible** pasa a «Espacio de pruebas Orbe» / «Pruebas» vía `seedOrbeSandbox` + `ORBE_SANDBOX_BRANDING`. Hay que re-ejecutar el seed en cada entorno Convex para que los documentos existentes reciban el patch.

## 5. Sistema verbal de la marca

### Nombre y escritura

- Escritura canónica: **Orbe360** (una palabra, O mayúscula, sin espacio ni guion).
- En mayúsculas de display (logotipo, hero): `ORBE360`.
- Nunca: "Orbe 360", "orbe360", "ORBE-360", "Orbe3D".
- El motor/visor interno puede llamarse **Orbe Viewer** (ya se usa en doc 47). El editor es **Control Web**. Estos son nombres de componente, no sub-marcas: sin logo propio ni color propio.

### Tagline

Mantener **"Explora. Descubre. Conecta."** como tagline de **experiencia** (footer, recorrido, cierre de landing): funciona, ya está implementado y describe bien la visita.

Añadir un **titular de oferta** para el hero, dirigido al comprador:

> **Tu sede, visitable por todos.**

Con subtítulo que hace el trabajo de prueba:

> Recorridos 360 accesibles que tu propio equipo administra. Con tu marca, en tu dominio.

Nota: el titular de oferta y los bloques 3–4 **ya están en** `plataforma/index.html` (hero + sección `#control`).

### Jerarquía de mensajes

| Nivel | Mensaje | Dónde |
|-------|---------|-------|
| 1 · Categoría | Tu sede, visitable por todos | Hero |
| 2 · Diferenciador | Accesible por diseño: audio descriptivo, subtítulos, teclado, alto contraste | Bloque de accesibilidad |
| 3 · Control | Tu equipo edita escenas, enlaces y textos. Sin depender del proveedor | `#control` |
| 4 · White-label | Tu marca, tus colores, tu dominio | `#control` (pilar) |
| 5 · Prueba | Caso publicado: Universidad Simón Bolívar, Cúcuta | Showcase |

## 6. Acciones derivadas

Implementado en esta iteración:

- [x] Copy de la barra de estado de Control Web corregido (registro B, principio 1) — además eliminaba una contradicción con el doc 55.
- [x] Estados vacíos de escenas/conexiones/hotspots con causa + salida (registro B, principio 2).
- [x] Advertencia del grafo con la consecuencia numerada, y los nombres de función Convex confinados a un `<details>` colapsado (registro B, principios 3 y "vocabulario de obra").
- [x] Verde Orbe retirado (`#009b3a`) eliminado del chrome de Control Web y del viewer white-label (frontera §3).
- [x] Titular de oferta en el hero + bloques de mensaje 3 (control) y 4 (white-label) en la landing.
- [x] Nombre visible de `orbe/sandbox` → «Espacio de pruebas Orbe» (slug intacto).
- [x] Barrido de vocabulario de obra en copy visible de Control Web y a11y de landing.

Pendiente, ordenado por impacto:

| # | Acción | Impacto | Esfuerzo | Riesgo |
|---|--------|---------|----------|--------|
| 1 | Página de accesibilidad con alcance **verificado en dispositivo** (TalkBack/NVDA) | Medio | Alto | Requiere prueba real primero (`AGENTS.md`) |
| 2 | Re-seed Convex del workspace `orbe/sandbox` en cada entorno para aplicar títulos visibles | Bajo | Bajo | Solo mutación seed; no toca Unisimón |
| 3 | Barrido residual de “sandbox/demo” en comentarios de código y scripts de ops | Bajo | Bajo | No afecta UI |

## 7. Lo que este doc NO cambia

Para evitar que se lea como una refundación:

- La paleta Orbe (`#0284c7` / `#0369a1` / `#38bdf8`) sigue igual — doc 39.
- Sora + Outfit siguen igual — doc 12.
- Soft Clay sigue siendo el sistema del chrome de plataforma y admin — doc 38.
- El white-label del tour sigue siendo data-driven vía `tourBrandings` — doc 42.
- El nombre `Orbe360` no cambia.
