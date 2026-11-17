import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
import os

mockups = [
    {
        "file": "mockups_finales/01_landing_orbe360.png",
        "title": "Mockup 1 — Portal B2B y Página de Aterrizaje Orbe360",
        "desc": "Vista principal en producción (https://orbe360-unisimon.pages.dev/). Presenta la propuesta de valor B2B para instituciones, diseño Soft Clay accesible, visor 360° incrustado en el Hero, selector dinámico de tema claro/oscuro e idioma (Español/Inglés) y Bento Grid de funcionalidades."
    },
    {
        "file": "mockups_finales/02_visor_360_sede2.png",
        "title": "Mockup 2 — Motor de Recorridos 360° Interactivo (Sede 2 — Campus Cúcuta)",
        "desc": "Escena de Entrada Principal y Hall de Ingreso con 88 escenas esféricas interconectadas, 178 hotspots de navegación y puntos de información institucional, barra de audioguía descriptiva sincronizada y controles de perspectiva espacial."
    },
    {
        "file": "mockups_finales/03_visor_menu_escenas.png",
        "title": "Mockup 3 — Menú Lateral Accesible y Filtro Multi-Sede / Multi-Bloque",
        "desc": "Panel lateral de navegación con búsqueda instantánea de espacios, categorización por sedes y bloques (Sedes 1 a 4), navegación por teclado y lector de pantalla con estados ARIA polite."
    },
    {
        "file": "mockups_finales/04_panel_accesibilidad.png",
        "title": "Mockup 4 — Panel de Accesibilidad Universal y Diagnóstico WCAG 2.1 AA",
        "desc": "Controles integrados de accesibilidad: modo de alto contraste para baja visión, texto ampliado, reducción de movimiento para usuarios con sensibilidad vestibular, activación de audioguía descriptiva y modal de diagnóstico técnico WCAG en tiempo real."
    },
    {
        "file": "mockups_finales/05_login_plataforma.png",
        "title": "Mockup 5 — Autenticación Segura y Acceso Administrativo Multi-Rol",
        "desc": "Portal de inicio de sesión institucional (https://orbe360-unisimon.pages.dev/plataforma/login.html) con control de acceso basado en roles (Superadmin de plataforma vs. Administrador de Organización), sesiones seguras en Convex Cloud y formulario fail-open compatible con cualquier navegador."
    },
    {
        "file": "mockups_finales/06_control_web_editor.png",
        "title": "Mockup 6 — Orbe360 Control Web (Estudio de Autoría de Escenas y Hotspots)",
        "desc": "Estudio de gestión de contenidos espaciales para administradores autorizados. Permite la edición interactiva de coordenadas yaw/pitch de hotspots, conexión de grafos de navegación, gestión de metadatos y asignación de pistas de audioguía."
    }
]

targets = [
    r"..\ORBE360_ENTREGA_TERCER_CORTE_100\02_Documentacion_y_Entregables_IEEE_1058\1_Inicio_y_Project_Charter\ACTA_CONSTITUCION_PROJECT_CHARTER_FINAL_100.docx",
    r"..\ORBE360_ENTREGA_TERCER_CORTE_100_EDICION\02_Documentacion_y_Entregables_IEEE_1058\1_Inicio_y_Project_Charter\ACTA_CONSTITUCION_PROJECT_CHARTER_FINAL_100.docx"
]

for target in targets:
    if not os.path.exists(target):
        print(f"Skipping non-existent: {target}")
        continue
    
    print(f"Processing: {target}")
    doc = docx.Document(target)
    
    # Check if section 10 already exists
    has_sec10 = any("10. MOCKUPS Y CAPTURAS DEL SISTEMA FINAL" in p.text for p in doc.paragraphs)
    if has_sec10:
        print("  Section 10 already exists in doc, skipping append.")
        continue
    
    # Add Section 10 Heading
    p_h = doc.add_paragraph()
    p_h.paragraph_format.space_before = Pt(18)
    p_h.paragraph_format.space_after = Pt(8)
    run_h = p_h.add_run("10. MOCKUPS Y CAPTURAS DEL SISTEMA FINAL (100% DESARROLLADO Y DESPLEGADO)")
    run_h.bold = True
    run_h.font.size = Pt(14)
    run_h.font.color.rgb = RGBColor(2, 132, 199) # Orbe blue
    
    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(12)
    p_intro.add_run(
        "A continuación se presentan los mockups y evidencias visuales de la aplicación operativa en su versión final 100% "
        "(desplegada en producción en https://orbe360-unisimon.pages.dev/ y con backend reactivo en https://careful-gnu-592.convex.cloud), "
        "demostrando la implementación integral de los componentes de cara al usuario final, accesibilidad universal y administración:"
    )
    
    for item in mockups:
        if not os.path.exists(item["file"]):
            print(f"  Warning: image not found: {item['file']}")
            continue
            
        # Add Subheading
        p_sub = doc.add_paragraph()
        p_sub.paragraph_format.space_before = Pt(12)
        p_sub.paragraph_format.space_after = Pt(4)
        run_sub = p_sub.add_run(item["title"])
        run_sub.bold = True
        run_sub.font.size = Pt(11)
        run_sub.font.color.rgb = RGBColor(15, 23, 42)
        
        # Add Image
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_after = Pt(4)
        run_img = p_img.add_run()
        run_img.add_picture(item["file"], width=Inches(6.0))
        
        # Add Caption / Description
        p_cap = doc.add_paragraph()
        p_cap.paragraph_format.space_after = Pt(12)
        run_cap = p_cap.add_run(item["desc"])
        run_cap.font.size = Pt(9.5)
        run_cap.font.italic = True
        run_cap.font.color.rgb = RGBColor(71, 85, 105)
    
    doc.save(target)
    print(f"  Successfully saved {target} with mockups!")

print("All done!")
