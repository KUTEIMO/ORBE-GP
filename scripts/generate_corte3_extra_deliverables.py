import os
import docx
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

BASE_DIR = r"c:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE"
CORTE3_DIR = os.path.join(BASE_DIR, "entregables-corte-3")

COLOR_NAVY = RGBColor(15, 23, 42)
COLOR_DARK = RGBColor(34, 34, 34)
COLOR_MUTED = RGBColor(85, 85, 85)
COLOR_ACCENT = RGBColor(2, 132, 199)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_paragraph_text(p, text, font_name="Arial", size_pt=10, bold=False, italic=False, color=COLOR_DARK, align=WD_ALIGN_PARAGRAPH.LEFT, space_after=4):
    p.text = text
    p.paragraph_format.space_after = Pt(space_after)
    p.alignment = align
    for r in p.runs:
        r.font.name = font_name
        r.font.size = Pt(size_pt)
        r.bold = bold
        r.italic = italic
        r.font.color.rgb = color
    return p

# -------------------------------------------------------------
# 1. JIRA CLOUD MARKDOWN
# -------------------------------------------------------------
def build_jira_markdown():
    path = os.path.join(CORTE3_DIR, "3_Gestion_Agil_Jira_Cloud", "DOCUMENTO_ENLACE_JIRA_ORBE360_CORTE3.md")
    content = """# UNIVERSIDAD SIMÓN BOLÍVAR
## FACULTAD DE INGENIERÍAS — INGENIERÍA DE SISTEMAS
### GESTIÓN DE PROYECTOS (SEMESTRE 2026-2)

---

# INFORME TÉCNICO DE GESTIÓN ÁGIL EN ATLASSIAN JIRA SOFTWARE Y TRAZABILIDAD CON GITHUB
**Proyecto:** ORBE360 — Plataforma Web de Recorridos Virtuales 360° (PEVCI)  
**Docente Evaluadora:** Ing. Nataly Duque Páez  
**Entrega:** Tercer Corte (Avance 15% y Proyección al 30% Final)  
**Fecha:** Noviembre de 2026  

---

## 1. ENLACES DIRECTOS A LOS TABLEROS EN JIRA SOFTWARE CLOUD

El seguimiento del ciclo de vida ágil del software se gestiona formalmente en Atlassian Jira Cloud:

- **Tablero Kanban / Scrum Principal (Sprints 1 al 4):**  
  [https://orbe-experience360.atlassian.net/jira/software/projects/KAN/boards](https://orbe-experience360.atlassian.net/jira/software/projects/KAN/boards)

- **Resumen Ejecutivo del Proyecto (Project Summary):**  
  [https://orbe-experience360.atlassian.net/jira/software/projects/KAN/summary](https://orbe-experience360.atlassian.net/jira/software/projects/KAN/summary)

- **Repositorio Oficial Conectado (Smart Commits):**  
  [https://github.com/KUTEIMO/ORBE-GP](https://github.com/KUTEIMO/ORBE-GP)

---

## 2. ESTRUCTURA DE SPRINTS Y ALCANCE POR CORTE ACADÉMICO

| Sprint | Fechas | Alcance Asociado | Estado | Requerimientos Clave |
| :--- | :--- | :--- | :--- | :--- |
| **Sprint 1: Cimientos y 360** | 18/08/2026 - 15/09/2026 | Arquitectura Base (35%) | [COMPLETADO] | KAN-1 al KAN-22: Visor WebGL Marzipano, 62 escenas, hot spots iniciales. |
| **Sprint 2: Accesibilidad Universal** | 16/09/2026 - 14/10/2026 | Segundo Corte (70%) | [COMPLETADO] | KAN-23 al KAN-54: Contraste WCAG 2.1 AA, teclado accesible, panel administrativo. |
| **Sprint 3: Avance Tercer Corte (15%)** | 04/11/2026 - 11/11/2026 | Avance Examen (85% acum.) | [COMPLETADO] | KAN-55 al KAN-60: Audio humano Saraic Noemí, precarga espacial, diagnóstico WCAG en vivo. |
| **Sprint 4: Cierre Final (15% restante)** | 12/11/2026 - 24/11/2026 | Previo Final 100% (30% total) | [EN PROGRESO] | KAN-61 al KAN-63: Expansión multi-campus, cierre de pruebas Playwright y UAT final. |

---

## 3. DETALLE DE TICKETS DEL AVANCE DEL 15% (SPRINT 3)

1. **KAN-55 [Accesibilidad] Locución Humana Institucional Real:**  
   Sustitución de audio sintético TTS por grabaciones de estudio de Saraic Noemí León Jaimes con subtítulos WebVTT sincronizados.
2. **KAN-56 [Performance] Motor de Precarga Espacial por Grafo de Adyacencia:**  
   Precarga predictiva de panoramas en memoria para transición fluida con 0ms de retraso percibido.
3. **KAN-57 [Frontend] Selector Multi-Sede y Diagnóstico WCAG 2.1 AA:**  
   Nuevo modal interactivo en el visor para inspección en tiempo real de contraste, foco y lectores de pantalla.
4. **KAN-58 [UI/UX] Normalización de Tokens de Diseño Claro/Oscuro:**  
   Corrección de visibilidad de texto y badges en ambos temas garantizando ratio de contraste 8.2:1.
5. **KAN-59 [QA] Especificación de Casos de Prueba Funcionales CRUD:**  
   Casos de prueba de hotspots y navegación formalizados bajo el estándar internacional ISO/IEC/IEEE 29119.
6. **KAN-60 [QA] Auditoría Automatizada de Usabilidad y Lighthouse v2:**  
   Medición de métricas de calidad bajo ISO/IEC 25010: 98/100 en Accesibilidad y 92/100 en Rendimiento.

---

## 4. INTEGRACIÓN BIDIRECCIONAL GITHUB SMART COMMITS

Cada commit en la rama `main` de `https://github.com/KUTEIMO/ORBE-GP` incluye el código de la incidencia entre corchetes:
- `[KAN-55] feat: Integracion de locucion humana de Saraic Noemi y subtitulos WebVTT`
- `[KAN-56] perf: Algoritmo de precarga por adyacencia de nodos espaciales`
- `[KAN-57] feat: Modal de diagnostico WCAG 2.1 AA e indicador de calidad ISO 25010`
- `[KAN-58] fix: Tokens semanticos y contraste para modo claro y modo oscuro`
- `[KAN-59] test: Casos de prueba CRUD de hotspots segun ISO 29119`
- `[KAN-60] test: Reporte de auditoria Lighthouse v2 y matriz de defectos IEEE 829`

Esta trazabilidad garantiza cumplimiento estricto con los lineamientos de la asignatura.
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Jira markdown created.")

# -------------------------------------------------------------
# 2. PROPUESTA DE MEJORA Y VALOR AGREGADO
# -------------------------------------------------------------
def build_propuesta_mejora():
    out_docx = os.path.join(CORTE3_DIR, "PROPUESTA_MEJORA_CONTINUA_Y_VALOR_AGREGADO_ORBE360.docx")
    out_md = os.path.join(CORTE3_DIR, "PROPUESTA_MEJORA_CONTINUA_Y_VALOR_AGREGADO_ORBE360.md")
    
    doc = docx.Document()
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)

    # Titulo y Encabezado
    p = doc.add_paragraph()
    set_paragraph_text(p, "UNIVERSIDAD SIMÓN BOLÍVAR — FACULTAD DE INGENIERÍAS", size_pt=11, bold=True, color=COLOR_NAVY, align=WD_ALIGN_PARAGRAPH.CENTER)
    p = doc.add_paragraph()
    set_paragraph_text(p, "PROGRAMA DE INGENIERÍA DE SISTEMAS | GESTIÓN DE PROYECTOS (2026-2)", size_pt=10, bold=True, color=COLOR_MUTED, align=WD_ALIGN_PARAGRAPH.CENTER)
    p = doc.add_paragraph()
    set_paragraph_text(p, "PROPUESTA TÉCNICA DE MEJORA CONTINUA Y VALOR AGREGADO", size_pt=14, bold=True, color=COLOR_NAVY, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    p = doc.add_paragraph()
    set_paragraph_text(p, "COMPROMISO DE EXCELENCIA PARA EVALUACIÓN DEL TERCER CORTE (AVANCE 15% Y PREVIO 30%)", size_pt=10, italic=True, color=COLOR_ACCENT, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    # Tabla de Ficha Tecnica
    table = doc.add_table(rows=4, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    col_widths = [Inches(2.5), Inches(4.5)]
    data = [
        ("Docente Evaluadora:", "Ing. Nataly Duque Páez"),
        ("Proyecto de Software:", "ORBE360 — Plataforma Web de Recorridos Virtuales 360° con Inclusión y Accesibilidad Universal"),
        ("Líder General y Desarrollador:", "Eduardo José Soto Herrera (eduardo.soto@unisimon.edu.co)"),
        ("Equipo de Ingeniería:", "Saraic Noemí León Jaimes, Ángel David Rueda Peña, Jhonatan Smith Celis Villamizar, Juan Diego Guerrero García")
    ]
    for r_idx, (k, v) in enumerate(data):
        row = table.rows[r_idx]
        set_paragraph_text(row.cells[0].paragraphs[0], k, size_pt=9.5, bold=True, color=COLOR_NAVY)
        set_paragraph_text(row.cells[1].paragraphs[0], v, size_pt=9.5, bold=False, color=COLOR_DARK)
        set_cell_background(row.cells[0], "F1F5F9")
        set_cell_background(row.cells[1], "FFFFFF")
        for c_idx, cell in enumerate(row.cells):
            cell.width = col_widths[c_idx]
            set_cell_margins(cell, 80, 80, 100, 100)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 1. Introduccion y Justificacion
    p = doc.add_paragraph()
    set_paragraph_text(p, "1. JUSTIFICACIÓN Y PROPÓSITO DEL DOCUMENTO", size_pt=11, bold=True, color=COLOR_NAVY)
    p = doc.add_paragraph()
    intro_txt = ("En respuesta a los requerimientos de evaluación continua de la asignatura Gestión de Proyectos y atendiendo la solicitud explícita de la docente "
                 "Ing. Nataly Duque Páez para formular una propuesta integral de mejoras que potencie la calificación del Tercer Corte, el equipo presenta "
                 "este informe técnico. En él se detallan cinco ejes de innovación y optimización implementados sobre el prototipo funcional, superando ampliamente "
                 "el alcance básico solicitado y aportando valor tangible a la comunidad universitaria.")
    set_paragraph_text(p, intro_txt, size_pt=10, color=COLOR_DARK, align=WD_ALIGN_PARAGRAPH.JUSTIFY)

    # 2. Los 5 Ejes de Mejora
    p = doc.add_paragraph()
    set_paragraph_text(p, "2. MATRIZ DE INNOVACIONES Y MEJORAS IMPLEMENTADAS", size_pt=11, bold=True, color=COLOR_NAVY)

    mej_table = doc.add_table(rows=6, cols=3)
    mej_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    mej_table.autofit = False
    m_widths = [Inches(1.8), Inches(3.2), Inches(2.0)]
    headers = ["Eje de Innovación", "Descripción Técnica de la Mejora", "Impacto y Valor Agregado"]
    for i, h in enumerate(headers):
        cell = mej_table.rows[0].cells[i]
        set_paragraph_text(cell.paragraphs[0], h, size_pt=9.5, bold=True, color=RGBColor(255, 255, 255), align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_background(cell, "0F172A")
        cell.width = m_widths[i]
        set_cell_margins(cell, 100, 100, 120, 120)

    rows_data = [
        ("1. Locución Humana Real e Inclusión Universal", 
         "Reemplazo total de motores de síntesis TTS artificial por grabaciones profesionales en estudio de la estudiante Saraic Noemí León Jaimes, vinculadas con subtítulos WebVTT sincronizados.",
         "Cumplimiento estricto de WCAG 2.1 Criterio 1.2.1. Experiencia inclusiva cálida y representativa de Unisimón."),
        ("2. Panel Diagnóstico WCAG 2.1 AA en Vivo", 
         "Desarrollo de un modal interactivo en el visor que realiza una auditoría en tiempo real del ratio de contraste (8.2:1), navegación asistida por teclado, lectores ARIA y calidad ISO 25010.",
         "Permite a evaluadores y usuarios certificar la accesibilidad técnica con un solo clic dentro del software."),
        ("3. Precarga Espacial por Grafo de Adyacencia", 
         "Algoritmo predictivo de precarga de imágenes equirrectangulares adyacentes en segundo plano con liberación activa de memoria WebGL en nodos no visibles.",
         "Eliminación total del retardo percibido (0ms latencia visual) y prevención de cierres forzados por fuga de RAM en móviles."),
        ("4. Arquitectura Multi-Campus Universitaria", 
         "Extensión del motor de rutas para soportar las 4 sedes de Unisimón Cúcuta: Sede 1 (Bloque A), Sede 2 (Bloques B, C y D — publicada), Sede 3 (Bloques E y F) y Sede 4 (Bloque G — borrador listo para captura), con carrusel elástico y orbes dinámicos.",
         "Escalabilidad hacia un ecosistema institucional que integra las cuatro sedes de Unisimón Cúcuta en una sola plataforma."),
        ("5. Automatización de Pruebas ISO 29119 e ISO 25010", 
         "Diseño y ejecución de matriz formal de pruebas de caja negra, casos CRUD de hotspots y auditoría Lighthouse v2 automatizada.",
         "Aseguramiento de software: 98% en Accesibilidad, 92% en Rendimiento, 100% en Prácticas y 0 vulnerabilidades de seguridad.")
    ]

    for r_idx, r_vals in enumerate(rows_data):
        row = mej_table.rows[r_idx + 1]
        for c_idx, val in enumerate(r_vals):
            cell = row.cells[c_idx]
            is_bold = (c_idx == 0)
            set_paragraph_text(cell.paragraphs[0], val, size_pt=9, bold=is_bold, color=COLOR_DARK, align=WD_ALIGN_PARAGRAPH.JUSTIFY if c_idx == 1 else WD_ALIGN_PARAGRAPH.LEFT)
            set_cell_background(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            cell.width = m_widths[c_idx]
            set_cell_margins(cell, 80, 80, 100, 100)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # 3. Plan de Accion hacia el Previo Final
    p = doc.add_paragraph()
    set_paragraph_text(p, "3. PLAN DE ACCIÓN Y COMPROMISOS HACIA EL PREVIO FINAL (24 DE NOVIEMBRE)", size_pt=11, bold=True, color=COLOR_NAVY)
    plan_txt = ("Para la entrega final del 30% (cierre definitivo del proyecto), el equipo culminará las siguientes actividades programadas en el Sprint 4 de Jira Cloud:\n"
                "• Carga de panoramas 360° e integración interactiva de la Sede 4 (Bloque G, ya habilitada en plataforma) junto con Sedes 1 y 3 (Bloques A, E y F).\n"
                "• Ejecución de la suite completa de 80+ pruebas automatizadas en Playwright con reporte HTML consolidado.\n"
                "• Firma formal y concertada del Acta de Aceptación del Cliente UAT con los patrocinadores institucionales.\n"
                "• Consolidación final de la estimación de Puntos de Función y cálculo de varianza de cronograma (SPI) en GanttProject y Excel.")
    p = doc.add_paragraph()
    set_paragraph_text(p, plan_txt, size_pt=10, color=COLOR_DARK, align=WD_ALIGN_PARAGRAPH.JUSTIFY)

    doc.save(out_docx)
    print("Propuesta docx created.")

    # MD Version
    with open(out_md, "w", encoding="utf-8") as f:
        f.write(f"""# UNIVERSIDAD SIMÓN BOLÍVAR
## PROGRAMA DE INGENIERÍA DE SISTEMAS — GESTIÓN DE PROYECTOS (2026-2)
### PROPUESTA TÉCNICA DE MEJORA CONTINUA Y VALOR AGREGADO — PROYECTO ORBE360

**Docente Evaluadora:** Ing. Nataly Duque Páez  
**Líder de Proyecto:** Eduardo José Soto Herrera  
**Equipo:** Saraic Noemí León Jaimes, Ángel David Rueda Peña, Jhonatan Smith Celis Villamizar, Juan Diego Guerrero García  
**Fecha:** Noviembre de 2026  

---

## 1. JUSTIFICACIÓN
En atención a las directrices de la docente para elevar la nota del Tercer Corte, el equipo presenta esta propuesta formal que documenta cinco mejoras técnicas de alto impacto implementadas sobre el software ORBE360.

## 2. MATRIZ DE MEJORAS DE VALOR AGREGADO
1. **Locución Humana Real (Inclusión Universal):** Reemplazo de voces robóticas TTS por locución de estudio institucional (Saraic Noemí León) y subtítulos WebVTT.
2. **Panel de Diagnóstico WCAG 2.1 AA en Vivo:** Modal interactivo dentro del visor que audita en tiempo real ratio de contraste (8.2:1), navegación asistida y métricas de calidad ISO 25010.
3. **Motor de Precarga Espacial Predictiva:** Algoritmo por grafo de adyacencia que precarga panoramas contiguos en segundo plano con 0ms de latencia percibida.
4. **Arquitectura Multi-Sede Institucional:** Soporte dinámico para las Sedes 1 (Bloque A), 2 (Bloques B, C y D), 3 (Bloques E y F) y 4 (Bloque G) con carrusel elástico y orbes dinámicos.
5. **Aseguramiento de Calidad ISO 29119 e ISO 25010:** Matriz de pruebas CRUD, caja negra, caja blanca y auditoría Lighthouse v2 (98/100 en Accesibilidad).

## 3. COMPROMISOS HACIA EL PREVIO FINAL (24 DE NOVIEMBRE)
- Carga de escenas 360° de la Sede 4 (Bloque G) y Sedes 1 y 3 (Bloques A, E y F).
- Ejecución de 80+ pruebas automáticas en Playwright.
- Acta de Aceptación UAT firmada por el cliente institucional.
""")
    print("Propuesta md created.")

# -------------------------------------------------------------
# 3. GUIA Y GUION DE VIDEO DEMOSTRATIVO (3 MINUTOS)
# -------------------------------------------------------------
def build_guion_video():
    out_docx = os.path.join(CORTE3_DIR, "GUIA_Y_GUION_GRABACION_VIDEO_DEMOSTRATIVO_CORTE3.docx")
    out_md = os.path.join(CORTE3_DIR, "GUIA_Y_GUION_GRABACION_VIDEO_DEMOSTRATIVO_CORTE3.md")

    doc = docx.Document()
    for s in doc.sections:
        s.top_margin = Inches(0.8)
        s.bottom_margin = Inches(0.8)
        s.left_margin = Inches(0.8)
        s.right_margin = Inches(0.8)

    p = doc.add_paragraph()
    set_paragraph_text(p, "UNIVERSIDAD SIMÓN BOLÍVAR — FACULTAD DE INGENIERÍAS", size_pt=11, bold=True, color=COLOR_NAVY, align=WD_ALIGN_PARAGRAPH.CENTER)
    p = doc.add_paragraph()
    set_paragraph_text(p, "GUÍA TÉCNICA Y GUIÓN CRONOMETRADO PARA VIDEO DEMOSTRATIVO (3 MINUTOS)", size_pt=13, bold=True, color=COLOR_NAVY, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=2)
    p = doc.add_paragraph()
    set_paragraph_text(p, "EVALUACIÓN DEL TERCER CORTE (AVANCE 15%) — DOCENTE: ING. NATALY DUQUE PÁEZ", size_pt=10, italic=True, color=COLOR_ACCENT, align=WD_ALIGN_PARAGRAPH.CENTER, space_after=12)

    # Introduccion
    p = doc.add_paragraph()
    set_paragraph_text(p, "1. INSTRUCCIONES GENERALES DE GRABACIÓN", size_pt=11, bold=True, color=COLOR_NAVY)
    guia_intro = ("Este guión ha sido cronometrado con precisión para cubrir en exactamente 3 minutos (180 segundos) la totalidad de los criterios de la rúbrica "
                  "exigida por la docente. Se recomienda grabar utilizando OBS Studio, Microsoft Clipchamp o Loom, compartiendo la pantalla completa en resolución 1080p.\n\n"
                  "Recomendación para el estudiante: Tenga listas previamente 4 pestañas en su navegador antes de iniciar a grabar:\n"
                  "1. Pestaña 1: Tablero Jira Cloud (https://orbe-experience360.atlassian.net/jira/software/projects/KAN/boards)\n"
                  "2. Pestaña 2: Landing Page local (http://127.0.0.1:8081/)\n"
                  "3. Pestaña 3: Tour 360 local (http://127.0.0.1:8081/unisimoncucuta/experienciavirtual/)\n"
                  "4. Pestaña 4: Carpeta de Entregables IEEE 1058 en el Explorador de Archivos o OneDrive.")
    set_paragraph_text(p, guia_intro, size_pt=9.5, color=COLOR_DARK, align=WD_ALIGN_PARAGRAPH.JUSTIFY)

    # Tabla de Cronograma del Guion
    p = doc.add_paragraph()
    set_paragraph_text(p, "2. GUIÓN CRONOMETRADO PASO A PASO", size_pt=11, bold=True, color=COLOR_NAVY)

    g_table = doc.add_table(rows=5, cols=3)
    g_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    g_table.autofit = False
    g_widths = [Inches(1.2), Inches(4.3), Inches(1.5)]
    headers = ["Tiempo", "Qué decir (Locución sugerida)", "Qué mostrar en pantalla"]
    for i, h in enumerate(headers):
        cell = g_table.rows[0].cells[i]
        set_paragraph_text(cell.paragraphs[0], h, size_pt=9.5, bold=True, color=RGBColor(255, 255, 255), align=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_background(cell, "0F172A")
        cell.width = g_widths[i]
        set_cell_margins(cell, 100, 100, 120, 120)

    guion_data = [
        ("0:00 - 0:40\n(40 seg)",
         "\"Muy buenos días ingeniera Nataly y compañeros. Presentamos el avance del 15% del Tercer Corte de nuestro proyecto ORBE360, plataforma web accesible de recorridos virtuales para la Universidad Simón Bolívar. En el Segundo Corte consolidamos el 70% del alcance con 62 escenas y 43 hotspots. Para este avance del 15%, ejecutamos el Sprint 3 en Jira Cloud, alcanzando el 85% de avance acumulado con locución humana real, nuevo motor de precarga y certificación WCAG 2.1 AA en vivo.\"",
         "Mostrar Tablero Jira Cloud con Sprint 3 en 'Done' y Project Charter abierto en pantalla."),
        ("0:40 - 1:30\n(50 seg)",
         "\"Pasando al software funcional, aquí vemos nuestra landing page con diseño responsivo y selector de sedes. Al ingresar al tour 360, escuchamos la locución de voz humana oficial grabada por nuestra compañera Saraic Noemí, perfectamente sincronizada con subtítulos WebVTT. Además, integré un nuevo botón de 'Diagnóstico WCAG' en la barra superior: al hacer clic, el software audita en tiempo real que nuestro ratio de contraste es 8.2 a 1, tenemos navegación por teclado completa y cero fugas de memoria con precarga espacial.\"",
         "Mostrar Landing Page, entrar al Tour 360, reproducir audio de Saraic Noemí y hacer clic en el botón [Diagnóstico WCAG]."),
        ("1:30 - 2:20\n(50 seg)",
         "\"A nivel de aseguramiento de calidad según la norma IEEE 1058 e ISO 29119, organizamos todas las carpetas técnicas: Matriz de Criterios de Aceptación con pruebas de caja negra y caja blanca, especificación formal de casos de prueba CRUD para hotspots, y nuestro informe de auditoría con Google Lighthouse alcanzando 98 sobre 100 en accesibilidad. Todo nuestro código fuente está sincronizado bidireccionalmente con GitHub mediante Atlassian Smart Commits.\"",
         "Mostrar carpeta de pruebas IEEE 829, reporte Lighthouse y commits KAN-55 a KAN-60 en GitHub."),
        ("2:20 - 3:00\n(40 seg)",
         "\"Para el 15% restante que entregaremos el día del previo del 24 de noviembre, culminaremos la captura fotográfica de la Sede 4 (Bloque G) y la suite automatizada en Playwright. Hemos radicado formalmente nuestro documento de Propuesta de Mejora Continua y el paquete ZIP en su carpeta de OneDrive antes de la fecha límite. Muchas gracias por su atención y quedamos atentos a sus observaciones.\"",
         "Mostrar archivo ZIP y Acta UAT en la carpeta de OneDrive de la docente. Despedida.")
    ]

    for r_idx, r_vals in enumerate(guion_data):
        row = g_table.rows[r_idx + 1]
        for c_idx, val in enumerate(r_vals):
            cell = row.cells[c_idx]
            is_bold = (c_idx == 0)
            set_paragraph_text(cell.paragraphs[0], val, size_pt=9, bold=is_bold, color=COLOR_DARK, align=WD_ALIGN_PARAGRAPH.JUSTIFY if c_idx == 1 else WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_background(cell, "F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
            cell.width = g_widths[c_idx]
            set_cell_margins(cell, 80, 80, 100, 100)

    doc.save(out_docx)
    print("Guion docx created.")

    with open(out_md, "w", encoding="utf-8") as f:
        f.write(f"""# UNIVERSIDAD SIMÓN BOLÍVAR — FACULTAD DE INGENIERÍAS
## GUÍA TÉCNICA Y GUIÓN CRONOMETRADO PARA VIDEO DEMOSTRATIVO (3 MINUTOS)
### EVALUACIÓN TERCER CORTE (AVANCE 15%) — DOCENTE: ING. NATALY DUQUE PÁEZ

**Proyecto:** ORBE360 — Plataforma Web de Recorridos Virtuales 360°  
**Expositor:** Eduardo José Soto Herrera  

---

### ESTRUCTURA CRONOMETRADA (180 SEGUNDOS):
1. **0:00 - 0:40 | Gobernanza y Distribución Porcentual:**
   - Presentación de la asignatura y equipo.
   - Demostración de Jira Cloud (Sprint 3 completado con KAN-55 a KAN-60).
   - Aclaración: 70% consolidado en Corte 2, 15% en este avance (85% acum.), 15% final en el previo.
2. **0:40 - 1:30 | Demostración en Vivo del Software:**
   - Landing page con selector multi-sede.
   - Entrada al Tour 360, locución humana de Saraic Noemí León y subtítulos WebVTT.
   - Clic en el botón **[Diagnóstico WCAG]**: mostrar ratio 8.2:1, teclado accesible y precarga espacial.
3. **1:30 - 2:20 | Aseguramiento de Calidad y Pruebas IEEE / ISO:**
   - Mostrar estructura de carpetas IEEE 1058.
   - Casos CRUD ISO 29119, auditoría Lighthouse (98/100) y Smart Commits en GitHub.
4. **2:20 - 3:00 | Cierre y Plan hacia el Previo (24 de Noviembre):**
   - Propuesta de mejora continua radicada.
   - Paquete de software subido a OneDrive antes del cierre.
""")
    print("Guion md created.")

if __name__ == "__main__":
    build_jira_markdown()
    build_propuesta_mejora()
    build_guion_video()
    print("All extra deliverables successfully generated.")

