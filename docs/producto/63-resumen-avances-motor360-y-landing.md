# 63 — Resumen de avances: Motor 360, Modo Claro/Oscuro, Dinamismo y Landing

**Proyecto:** Orbe360  
**Fecha:** 2026-10-13  
**Estado:** Implementado y Verificado  
**Relacionados:** [62 landing dinámica stack](./62-landing-dinamica-stack.md) · [61 design system v2](./61-design-system-orbe-v2.md) · [32 routing multi-empresa](./32-routing-multi-empresa-url.md) · [12 design system](./12-design-system-orbe360.md)

---

## 1. Resumen Ejecutivo

Durante este ciclo de trabajo se abordaron incidentes críticos de estabilidad en el visor 360, optimizaciones de rendimiento y ancho de banda en la carga de panoramas, unificación de temas (claro/oscuro) e idioma, y un rediseño de interfaz en la plataforma de marketing inspirado en referencias modernas (Mobbin, Linear, Framer).

---

## 2. Detalle de Incidencias y Mejoras Implementadas

### 2.1. Restauración y Estabilidad del Motor 360 (`src/viewer.js`, `src/configLoader.js`)
* **Problema:** El visor 360 no cargaba escenas, bloqueando la experiencia del tour (`EL 360 NO ESTA FUNCIONANDO`).
* **Causa raíz:** En ciertas configuraciones y datos provenientes de Convex o JSON local, las propiedades de `initialView` (`yaw`, `pitch`, `fov`) carecían de valores numéricos válidos o venían incompletas, generando llamadas con `NaN`/`undefined` que provocaban excepciones en Marzipano.
* **Solución aplicada:**
  - Implementación de `resolveInitialView(sceneData)` con `DEFAULT_INITIAL_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 2 }` como salvaguarda estricta.
  - Creación de `applySceneView(view, sceneData)` que sanitiza y aplica los parámetros de orientación de cámara sin romper el ciclo de vida del visor.
  - Robustecimiento del cargador de configuración (`configLoader.js`) para manejar fallbacks ante diferencias entre el grafo estático y el grafo dinámico de Convex.

### 2.2. Carga Inteligente de Imágenes Aledañas sin Retardo (`preloadNeighbors`)
* **Problema:** La precarga de todas las imágenes panorámicas de alta resolución al arrancar saturaba la red y la memoria del navegador. Sin embargo, no precargar generaba un retraso ("delay") perceptible al navegar de una escena a otra.
* **Solución aplicada:**
  - **Precarga selectiva por adyacencia:** Se eliminó la precarga global masiva. Al cargar la escena inicial, solo se precarga dicha escena y las escenas vecinas directas conectadas mediante hotspots (`preloadNeighbors(scenes, initialSceneId)`).
  - **Actualización dinámica en tránsito:** Cada vez que el usuario cambia de escena (`onSceneChange`), se invoca de inmediato `preloadNeighbors(scenes, sceneId)` para precargar en segundo plano las conexiones adyacentes del nuevo nodo.
  - **Reducción de latencia de transición:** Se ajustó la duración de transición (`DEFAULT_TRANSITION = 110ms`) para brindar una respuesta inmediata al clic sin mareos ni saltos bruscos.

### 2.3. Sincronización y Corrección de Modo Oscuro / Claro
* **Problema:** En modo claro, varias secciones mantenían fondos oscuros quemados (`#0b1220`) y múltiples textos (subtítulos, botones secundarios, métricas) desaparecían al tener colores forzados en blanco (`rgba(255, 255, 255, 0.8)` sobre fondo blanco).
* **Solución aplicada:**
  - Limpieza de estilos fijos en `plataforma/marketing.css`.
  - Migración a tokens semánticos: uso de `var(--orbe-clay-depth)`, `var(--orbe-ink)` y `var(--orbe-muted)`.
  - El `.hero`, `.hero__mesh`, `.hero-metrics`, y las tarjetas de producto ahora adaptan fondo, bordes, sombras y tipografías con contraste WCAG AA tanto en `[data-theme="light"]` como en `[data-theme="dark"]`.
  - Persistencia del estado mediante `localStorage.orbe_theme`.

### 2.4. Integración UI/UX con Mobbin MCP y Dinamismo Visual
* **Inspiración y benchmarking:** Se integró el servidor MCP de Mobbin para estudiar patrones interactivos de diseño SaaS moderno (Linear, Framer, Vercel).
* **Acordeón Interactivo de Sedes (`.sedes-accordion`):**
  - Reemplazo de la cuadrícula estática por un componente dinámico tipo acordeón.
  - En desktop y tablet, pasar el cursor (o foco de teclado) expande suavemente la tarjeta seleccionada con transición elástica mientras comprime las demás de forma proporcional.
  - En móvil, se degrada limpiamente a tarjetas apiladas verticales sin romper el layout.
* **Fondo Global Dinámico (`.page-bg`):**
  - Adición de un contenedor ambiental de fondo con blobs de gradientes suaves, malla translúcida y aceleración por GPU.
  - Aporta profundidad visual viva y fluida tanto en modo claro como oscuro sin recargar el DOM ni afectar el scroll.

### 2.5. Corrección de Distribución y Bento Grid (Espacio Perdido)
* **Problema:** En la sección Bento Grid se generaba un espacio vacío ("espacio perdido") en la segunda fila debido a un descuadre en el sistema de 3 columnas (una tarjeta simple y una de ancho completo forzaban un salto de línea prematuro).
* **Solución aplicada:**
  - Reestructuración de clases en `plataforma/index.html`.
  - La tarjeta "Motor de Accesibilidad" se configuró con `bento-card--large` (2 columnas), y "Routing Multi-Empresa" toma la columna restante (1 columna), cerrando la cuadrícula en un bloque balanceado de 3 columnas sin huecos.

---

## 3. Matriz de Archivos Modificados

| Archivo | Ámbito | Cambios Principales |
|---------|--------|---------------------|
| `src/viewer.js` | Motor 360 | `preloadNeighbors`, `DEFAULT_TRANSITION: 110ms`, control de vistas seguras (`resolveInitialView`), sanitización de Marzipano |
| `src/configLoader.js` | Configuración | Fallback resiliente de grafo, normalización de escenas y hotspots dinámicos |
| `plataforma/index.html` | UI Landing | Acordeón de sedes (`sedes-accordion`), fondo dinámico (`page-bg`), corrección de cuadrícula Bento |
| `plataforma/marketing.css` | Estilos Landing | Tokens de modo claro/oscuro en hero y métricas, animaciones del acordeón, estilos de fondo ambiental |
| `plataforma/marketing-motion.js` | Interacción | Ajustes de reveals, persistencia de temas e i18n |
| `index.html` | Visor Principal | Accesibilidad WAI-ARIA, corrección de atributos en navegación y controles |

---

## 4. Estado Actual y Próximos Pasos

* **Estado de ejecución:**
  - Servidor web local: `npm start` (vía `scripts/dev-server.mjs`).
  - Motor 360 y precarga de adyacentes: 100% operativo y sin retraso.
  - Modos claro/oscuro: consistentes en Hero, Bento, Acordeón y Footer.
* **Próximos pasos sugeridos:**
  1. Completar la extracción de textos restantes al diccionario bilingüe en `plataforma/marketing-i18n.js` (español/inglés).
  2. Ejecutar suite de pruebas de humo y regresión en Playwright (`npm test` o `npx playwright test`).
