# 65 — Entregables Oficiales Tercer Corte: Avance 15% (IEEE 1058 y QA)

**Proyecto:** Orbe360 (PEVCI) — Universidad Simón Bolívar (Sede Cúcuta)  
**Fecha:** 2026-11-09  
**Docente Evaluadora:** Ing. Nataly Duque Páez  
**Asignatura:** Gestión de Proyectos — Facultad de Ingenierías  
**Relacionados:** [63 resumen de avances](./63-resumen-avances-motor360-y-landing.md) · [64 criterios rediseño motion](./64-criterios-redisenio-motion-landing-guia-maestra.md) · [LEEME IEEE 1058 Corte 3](../../entregables-corte-3/LEEME_ESTRUCTURA_IEEE_1058_CORTE_3.md)

---

## 1. Contexto Académico y Estructura de Evaluación

La docente evaluadora estableció la división formal de la calificación del **30% (Proyecto Final / Examen del Tercer Corte)**:
1. **Avance del 15% (Cierre: Miércoles 11 de Noviembre de 2026, 00:00):** Entrega del incremento de software, optimizaciones del motor 360, locución humana universitaria real (grabada por la estudiante Saraic Noemí León), rediseño accesible de landing page y especificación formal de pruebas de software bajo estándares internacionales.
2. **Cierre Definitivo del 15% restante (Cierre: Martes 24 de Noviembre de 2026, 10:00 — Previo Final):** Entrega del 100% del software ('todo el sogo') desplegado en producción, certificación del banco de 80+ pruebas en Playwright, fotos 360° de una segunda sede universitaria y firma del Acta de Aceptación UAT.

---

## 2. Matriz de Cumplimiento de Entregables (Aula Extendida y OneDrive)

| Requerimiento Exigido por la Docente | Ubicación Oficial en `entregables-corte-3/` | Archivo Generado | Estado |
| :--- | :--- | :--- | :---: |
| **1. Link para subir al Drive el software** | `6_Proyecto_Software_Avance_15_Porciento/` | `ENLACES_OFICIALES_DRIVE_GITHUB_Y_DESPLIEGUE.docx` y `.md` | ✅ Completado |
| **2. Link del despliegue en vivo** | `6_Proyecto_Software_Avance_15_Porciento/` | `ENLACES_OFICIALES_DRIVE_GITHUB_Y_DESPLIEGUE.docx` y `.md` | ✅ Completado |
| **3. Gantt Project (con antecesores y recursos)** | `4_Metricas_WBS_Gantt_y_PERT/` | `GANTT_ORBE360_CORTE_3_AVANCE_15.gan` | ✅ Completado |
| **4. Excel con Puntos de Función y PERT** | `4_Metricas_WBS_Gantt_y_PERT/` | `Gestion de proyectos 222 nuevo.xlsx` | ✅ Completado |
| **5. Acta Constitución Charter (70% vs 15% vs 15% + Mockups)** | `1_Inicio_y_Project_Charter/` | `ACTA_CONSTITUCION_PROJECT_CHARTER_CORTE3.docx` y `.md` | ✅ Completado |
| **6. Proyecto Desarrollado (Software funcional)** | `6_Proyecto_Software_Avance_15_Porciento/` | `ORBE-GP-Software-Avance-15.zip` (~288 MB) | ✅ Congelado |
| **7. Pruebas Funcionales y No Funcionales 100%** | `5_Aseguramiento_Calidad_y_Pruebas_Software_IEEE829/` | 3 Documentos Oficiales (Matriz, CRUD ISO 29119, Lighthouse ISO 25010) | ✅ Completado |
| **8. Acta de Aceptación del Cliente UAT** | `2_Aceptacion_del_Cliente_UAT/` | `ACTA_ACEPTACION_CLIENTE_UAT_ORBE360.docx` y `.md` | ✅ Completado |
| **9. Link de Jira en un doc Word** | `3_Gestion_Agil_Jira_Cloud/` | `DOCUMENTO_ENLACE_JIRA_ORBE360_CORTE3.docx` y `.md` | ✅ Completado |
| **10. Organización según Norma IEEE 1058** | Raíz de `entregables-corte-3/` | 6 Carpetas estructuradas | ✅ Normalizado |

---

## 3. Integridad Criptográfica del Software (Anti-Modificación Posterior)

En estricta atención a la advertencia docente (*"el software se debe subir antes que se cierre aquí en el aula extendida el tiempo de la entrega del parcial, si me aparece en el drive que entraron después a modificar algo, se les coloca nota cero"*), el archivo zip autónomo ha sido generado y sellado criptográficamente:

* **Archivo:** `entregables-corte-3/6_Proyecto_Software_Avance_15_Porciento/ORBE-GP-Software-Avance-15.zip`
* **Construcción y verificación:** Regenerado mediante `python scripts/sync_all_corte3.py` (sincroniza `ORBE` → `ORBE-GP`, copias de respaldo y paquete IEEE 1058 excluyendo `.git`, `.convex`, `node_modules` y `.env*`). El tamaño exacto y su hash `SHA-256` vigente se registran en [`ENLACES_OFICIALES_DRIVE_GITHUB_Y_DESPLIEGUE.md`](../../entregables-corte-3/6_Proyecto_Software_Avance_15_Porciento/ENLACES_OFICIALES_DRIVE_GITHUB_Y_DESPLIEGUE.md).

---

## 4. Mejoras Técnicas Implementadas en el Software

1. **Reconocimiento y Crédito en Vivo a la Locución Humana (Saraic Noemí León):**  
   En `src/hotspotPanel.js`, el reproductor de audiodescripción ahora detecta la narración y despliega en tiempo real el indicador visual accesible:  
   `🎙️ Locución con voz humana (Saraic Noemí León) lista para reproducirse.`  
   y al reproducir:  
   `🎙️ Reproduciendo audiodescripción con voz humana (Saraic Noemí León).`
2. **Navegación Flexible por Parámetro de Sede (`?sede=1`, `?sede=2`, `?sede=3`):**  
   En `src/viewer.js`, la función `resolveInitialScene` fue enriquecida para admitir directamente la navegación proveniente de las tarjetas del acordeón dinámico de la landing page.
3. **Auditoría de Usabilidad y Calidad UI/UX (Google Lighthouse v2 / ISO 25010):**  
   - Performance: 92/100
   - Accessibility: 98/100 (WCAG 2.1 AA)
   - Best Practices: 100/100
   - SEO: 100/100

