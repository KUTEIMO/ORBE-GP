# ORBE360 (PEVCI) — Plataforma de Recorridos Virtuales 360° para Campus Inclusivos
### Entrega Definitiva 100% — Tercer Corte (Proyecto Final)

**Institución:** Universidad Simón Bolívar — Sede Cúcuta  
**Facultad:** Ingenierías — Programa de Ingeniería de Sistemas  
**Asignatura:** Gestión de Proyectos (Semestre 2026-2)  
**Docente Evaluadora:** Ing. Nataly Duque Páez  

---

### Integrantes del Equipo de Proyecto
1. **Eduardo José Soto Herrera** (`e_soto2@unisimon.edu.co`) — Líder General de Proyecto & Arquitecto Frontend 360°
2. **Saraic Noemí León Hernández** (`s_leon3@unisimon.edu.co`) — Líder de Calidad, Locución Humana & Accesibilidad WCAG
3. **Kevin Eduardo García Moreno** (`k_garcia8@unisimon.edu.co`) — Líder Backend & Gestión Jira Cloud
4. **Sebastián David Omaña Villamizar** (`s_omana1@unisimon.edu.co`) — Ingeniero DevSecOps & Infraestructura
5. **Jesús Omar Avendaño Avendaño** (`j_avendano4@unisimon.edu.co`) — Ingeniero de Planificación, Cronograma & PERT

---

## Despliegue en Vivo (Acceso Público Gratuito)

| Entorno | URL Pública | Infraestructura |
| :--- | :--- | :--- |
| **Portal Principal ORBE360** | [https://orbe360-unisimon.pages.dev/](https://orbe360-unisimon.pages.dev/) | Cloudflare Pages Free (HTTPS + Bundles estáticos + Edge Router) |
| **Visor 360° Sede 2 (Publicado)** | [https://orbe360-unisimon.pages.dev/unisimoncucuta/experienciavirtual/](https://orbe360-unisimon.pages.dev/unisimoncucuta/experienciavirtual/) | Marzipano WebGL · **88 escenas**, **178 hotspots**, **127 conexiones** |
| **Backend en la Nube** | `https://careful-gnu-592.convex.cloud` | Convex Cloud Free (`orbe360-unisimon`) |
| **Repositorio Curso (`ORBE-GP`)** | [https://github.com/KUTEIMO/ORBE-GP](https://github.com/KUTEIMO/ORBE-GP) | Código fuente académico + trazabilidad Jira (`KAN-1` a `KAN-63`) |
| **Repositorio Producto (`ORBE`)** | [https://github.com/KUTEIMO/prototipo-360-v1-tested](https://github.com/KUTEIMO/prototipo-360-v1-tested) | Versión maestro de software final |
| **Tablero Ágil Jira Cloud** | [https://orbe-experience360.atlassian.net/jira/software/projects/KAN/boards](https://orbe-experience360.atlassian.net/jira/software/projects/KAN/boards) | Proyecto `TeamOrbe360` (`KAN`) — Sprints 1 a 4 completados (100%) |

---

## Despliegue Local en Cualquier Equipo (Windows / macOS / Linux)

### Opción 1: Ejecución rápida en Windows (`INICIAR_PROYECTO.bat`)
1. Descargar o clonar este repositorio (`git clone https://github.com/KUTEIMO/ORBE-GP.git`).
2. Abrir la carpeta `ORBE-GP` y hacer doble clic en `INICIAR_PROYECTO.bat` (instala dependencias faltantes, inicia Convex local en `http://127.0.0.1:3210` y abre `http://127.0.0.1:8081/`).

### Opción 2: Terminal manual (Windows / macOS / Linux)
```bash
npm install
npx convex dev
```
En otra terminal:
```bash
npm start
```
Luego abrir `http://127.0.0.1:8081/` (portal), `http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/` (visor 360°) o `http://127.0.0.1:8081/plataforma/login.html` (panel multi-rol). Para poblar usuarios iniciales en entorno local efímero usar `npm run seed:allow-local` seguido de `npm run seed`. Ninguna credencial real se publica en el repositorio.

---

## Evidencia de Verificación 100% (Cierre de Proyecto)

| Validación | Resultado | Alcance Verificado |
| :--- | :---: | :--- |
| **Lint + Typecheck Convex (`npm run check:static`)** | **0 errores** | ESLint + `tsc -p convex/tsconfig.json --noEmit` |
| **Auditoría de Rutas (`npm run audit:routes`)** | **398 / 0 problemas** | Integridad de enlaces HTML/JS/CSS/Markdown |
| **Cobertura Audio Accesible (`npm run check:a11y`)** | **89/89 completas** | Voz humana Saraic Noemí + Voz Salomé (`53` audios hotspot) |
| **Pruebas Unitarias (`npm run test:unit`)** | **17 / 17** | Contraste WCAG, slugs, WebVTT, navegación espacial, checklist |
| **Autorización RBAC (`npm run qa:authz`)** | **16 / 16** | Aislamiento entre `superadmin`, `orgAdmin`, `tourEditor` y anónimo |
| **Suite QA Contratos (`npm run qa`)** | **101 / 101** | Auth, Storage, TourBranding, Sedes 1–4, rate-limit y limpieza |
| **Pruebas E2E Chromium (`npx playwright test`)** | **66 / 66** | Landing, visor 360°, accesibilidad, multi-rol, Control Web y hardening |
| **Validación Live CDN/AdBlock (Chrome/Edge/Chromium)** | **APROBADO** | Carga en 5 recursos (`viewer.bundle.*`, `portal.bundle.*`) sin bloqueos |

---

## Consolidado de Avance Académico (70% + 15% + 15% = 100%)
- **Segundo Corte (70%):** Motor WebGL base, roles en Convex, Sede 2 piloto (62 escenas, 43 hotspots), WBS de 123 tareas con 257 dependencias en GanttProject y estimación IFPUG (`400.84 PFA` / `59.40 Persona-Mes` COCOMO II).
- **Avance Tercer Corte (15% → 85%):** Locución humana real universitaria (Saraic Noemí León), Estudio de Audio Salomé en Control Web, tokens WCAG claro/oscuro, reglas UI/UX Soft Clay y habilitación multi-campus Sedes 1–4.
- **Cierre Final Tercer Corte (15% → 100%):** Incorporación de 26 panoramas en Sede 2 (total **88 escenas**, **178 hotspots**, **127 conexiones**), portadas iniciales `sede-1`, `sede-3` y `sede-4` preparadas en borrador, despliegue productivo gratuito en Cloudflare Pages + Convex Cloud, empaquetado single-bundle anti-bloqueadores y aprobación completa (`66/66` Playwright, `101/101` QA, `16/16` Authz).
