import os
import shutil
import subprocess
import zipfile
import hashlib

ORBE_DIR = r"c:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE"
GP_DIR = r"c:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE-GP"
ENTREGA_C3_DIR = r"c:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE360_ENTREGA_TERCER_CORTE_15"
ENTREGA_C2_70 = r"c:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE360_ENTREGA_SEGUNDO_CORTE_70"
ENTREGA_C2_ED = r"c:\Users\SOTO\APLICATIVOS\proyectos unisimon\ORBE360_ENTREGA_SEGUNDO_CORTE_EDICION"

SYNC_DIRS = ["src", "css", "plataforma", "control-web", "convex", "scripts", "media", "vendors", "docs", "tests"]
SYNC_FILES = [
    "index.html",
    "package.json",
    "package-lock.json",
    "orbe-config.js",
    "config.json",
    "convex.json",
    "AGENTS.md",
    "eslint.config.mjs",
    "playwright.config.js",
    ".gitignore",
    "INICIAR_PROYECTO.bat",
    "README.md",
]

EXCLUDED_DIRS = {
    ".git",
    ".convex",
    "node_modules",
    "temp",
    "tmp",
    ".cache",
    "__pycache__",
    "backups",
    "_restos_exras_bloqueados",
    "test-results",
    "playwright-report",
}

def should_skip_file(filename):
    if filename.endswith((".pyc", ".tmp")):
        return True
    if filename == "test_audio.mp3":
        return True
    if (filename == ".env" or filename.startswith(".env.")) and not filename.endswith(".example"):
        return True
    if filename in {"config.local.js", "orbe-config.local.js", "plataforma/config.local.js"}:
        return True
    return False

def copy_tree_filtered(src_dir, dst_dir):
    os.makedirs(dst_dir, exist_ok=True)
    for root, dirs, files in os.walk(src_dir):
        # Excluir carpetas irrelevantes, estado local de Convex o respaldos
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        rel = os.path.relpath(root, src_dir)
        target_root = os.path.join(dst_dir, rel) if rel != "." else dst_dir
        os.makedirs(target_root, exist_ok=True)
        for f in files:
            if should_skip_file(f):
                continue
            s = os.path.join(root, f)
            d = os.path.join(target_root, f)
            # Copiar si no existe, es mas reciente o cambio el tamanio
            if (
                not os.path.exists(d)
                or os.path.getmtime(s) > os.path.getmtime(d)
                or os.path.getsize(s) != os.path.getsize(d)
            ):
                shutil.copy2(s, d)

print("================================================================================")
print("INICIANDO SINCRONIZACION MAESTRA DE TODAS LAS COPIAS Y ENTREGABLES (TERCER CORTE)")
print("================================================================================")

# 1. Sincronizar ORBE -> ORBE-GP
print("\n[1/5] Sincronizando codigo fuente desde ORBE hacia ORBE-GP...")
for d in SYNC_DIRS:
    s = os.path.join(ORBE_DIR, d)
    t = os.path.join(GP_DIR, d)
    if os.path.exists(s):
        print(f"  -> Sincronizando directorio: {d}")
        copy_tree_filtered(s, t)

for f in SYNC_FILES:
    s = os.path.join(ORBE_DIR, f)
    t = os.path.join(GP_DIR, f)
    if os.path.exists(s):
        shutil.copy2(s, t)
print("  -> Archivos raiz copiados a ORBE-GP.")

# 2. Sincronizar copias de corte 2 (para prevenir drift en copias editables/GP)
print("\n[2/5] Sincronizando mejoras comunes hacia carpetas de edicion y respaldo...")
for base_c2 in [ENTREGA_C2_70, ENTREGA_C2_ED]:
    target_gp = os.path.join(base_c2, "01_Software_Desarrollado_70_Porciento", "ORBE-GP")
    if os.path.exists(target_gp):
        print(f"  -> Actualizando {base_c2}...")
        for d in ["src", "css", "plataforma", "control-web", "convex", "scripts"]:
            s = os.path.join(ORBE_DIR, d)
            t = os.path.join(target_gp, d)
            if os.path.exists(s):
                copy_tree_filtered(s, t)
        for f in ["index.html", "package.json", "orbe-config.js", "config.json", "convex.json", "INICIAR_PROYECTO.bat", ".gitignore"]:
            s = os.path.join(ORBE_DIR, f)
            t = os.path.join(target_gp, f)
            if os.path.exists(s):
                shutil.copy2(s, t)

# 3. Crear y poblar carpeta de entrega oficial del Tercer Corte: ORBE360_ENTREGA_TERCER_CORTE_15
print(f"\n[3/5] Construyendo carpeta maestra externa: {ENTREGA_C3_DIR}...")
c3_sw_dir = os.path.join(ENTREGA_C3_DIR, "01_Software_Desarrollado_Avance_15_Porciento")
c3_sw_gp = os.path.join(c3_sw_dir, "ORBE-GP")
c3_docs_dir = os.path.join(ENTREGA_C3_DIR, "02_Documentacion_y_Entregables_IEEE_1058")
c3_prop_dir = os.path.join(ENTREGA_C3_DIR, "03_Propuesta_Mejora_Continua_y_Guion_Video")

os.makedirs(c3_sw_gp, exist_ok=True)
os.makedirs(c3_docs_dir, exist_ok=True)
os.makedirs(c3_prop_dir, exist_ok=True)

# Copiar codigo fuente a 01_Software_Desarrollado_Avance_15_Porciento/ORBE-GP
print("  -> Copiando software funcional a carpeta descomprimida...")
copy_tree_filtered(GP_DIR, c3_sw_gp)

# Copiar documentacion IEEE 1058
print("  -> Copiando entregables estructurados bajo IEEE 1058...")
copy_tree_filtered(os.path.join(ORBE_DIR, "entregables-corte-3"), c3_docs_dir)

# Copiar propuesta y guion a carpeta destacada
print("  -> Copiando Propuesta de Mejora y Guión de Video...")
for fname in [
    "PROPUESTA_MEJORA_CONTINUA_Y_VALOR_AGREGADO_ORBE360.docx",
    "PROPUESTA_MEJORA_CONTINUA_Y_VALOR_AGREGADO_ORBE360.md",
    "GUIA_Y_GUION_GRABACION_VIDEO_DEMOSTRATIVO_CORTE3.docx",
    "GUIA_Y_GUION_GRABACION_VIDEO_DEMOSTRATIVO_CORTE3.md"
]:
    s = os.path.join(ORBE_DIR, "entregables-corte-3", fname)
    if os.path.exists(s):
        shutil.copy2(s, os.path.join(c3_prop_dir, fname))

# Crear GUIA_Y_ENLACES_DEL_SOFTWARE.txt en 01_Software
guia_txt = f"""================================================================================
ORBE360 — SOFTWARE DESARROLLADO AVANCE 15% (TERCER CORTE PARCIAL)
UNIVERSIDAD SIMON BOLIVAR — GESTION DE PROYECTOS (2026-2)
DOCENTE EVALUADORA: ING. NATALY DUQUE PAEZ
================================================================================

CONTENIDO DE ESTA CARPETA:
1. ORBE-GP/ (Carpeta Descomprimida):
   Codigo fuente completo con avance del 15% (85% acumulado):
   - 62 escenas 360 interactivas con Marzipano WebGL (Sede 2: Bloques B, C y D) y borrador preparado para Sede 4 (Bloque G).
   - 43 hotspots informativos con locucion accesible (Saraic Noemi Leon) y Estudio de Audio en Control Web (Voz Salome TTS, microfono y carga de audio).
   - Subtitulos WebVTT sincronizados, contraste dinamico WCAG 2.1 AA (--brand-ink) y diagnostico de calidad.
   - Autenticacion multi-rol contra Convex (127.0.0.1:3210), navegacion adaptativa por rol y rediseno UI/UX Soft Clay sin controles destructivos.
   - Archivo ejecutable 'INICIAR_PROYECTO.bat' y documentacion tecnica (docs/producto/66-reglas-diseno-ui-ux-y-flujos-orbe360.md).

2. ORBE-GP-Software-Avance-15.zip (Archivo Comprimido):
   Paquete ZIP autonomo para descarga o subida directa a OneDrive.

--------------------------------------------------------------------------------
ENLACES OFICIALES DEL PROYECTO:
--------------------------------------------------------------------------------
* Repositorio Oficial en GitHub:
  https://github.com/KUTEIMO/ORBE-GP

* Tablero Kanban / Scrum en Jira Software Cloud:
  https://orbe-experience360.atlassian.net/jira/software/projects/KAN/boards

* Resumen Ejecutivo del Proyecto en Jira Cloud:
  https://orbe-experience360.atlassian.net/jira/software/projects/KAN/summary

* Carpeta Oficial de Entrega Tercer Corte en OneDrive de la Docente:
  https://unisimonedu-my.sharepoint.com/:f:/g/personal/nataly_duquep_unisimon_edu_co/IgAg3c5VF8G2TIOVUb4eRKfzAWbakYrcJk31GGgSgV0L8nE?e=iEbVog

--------------------------------------------------------------------------------
INSTRUCCIONES DE EJECUCION:
--------------------------------------------------------------------------------
Opcion 1 (Doble Clic Local):
  Abra la carpeta 'ORBE-GP' y haga doble clic en 'INICIAR_PROYECTO.bat'.
  El script verificara Node.js y el servidor Convex local (127.0.0.1:3210),
  abrira el navegador en http://127.0.0.1:8081/ e iniciara el servidor web.

Opcion 2 (Terminal):
  npx convex dev
  npm start
  Abrir navegador en: http://127.0.0.1:8081/
"""
with open(os.path.join(c3_sw_dir, "GUIA_Y_ENLACES_DEL_SOFTWARE.txt"), "w", encoding="utf-8") as f:
    f.write(guia_txt)

# Crear LEAME_PRIMERO_ENTREGA_CORTE_3.txt en la raiz de ENTREGA_C3_DIR
leame_raiz = f"""================================================================================
PAQUETE MAESTRO DE ENTREGA — TERCER CORTE (AVANCE 15% PROYECTO FINAL)
UNIVERSIDAD SIMON BOLIVAR — GESTION DE PROYECTOS (SEMESTRE 2026-2)
DOCENTE EVALUADORA: ING. NATALY DUQUE PAEZ
LIDER DE PROYECTO: EDUARDO JOSE SOTO HERRERA
================================================================================

ESTRUCTURA DE CARPETAS ORGANIZADAS BAJO LA NORMA IEEE 1058:

01_Software_Desarrollado_Avance_15_Porciento/
   - ORBE-GP/ (Carpeta completa del codigo fuente)
   - ORBE-GP-Software-Avance-15.zip (Paquete comprimido autonomo)
   - GUIA_Y_ENLACES_DEL_SOFTWARE.txt

02_Documentacion_y_Entregables_IEEE_1058/
   - 1_Inicio_y_Project_Charter/
     (Acta Constitucion con definicion 70% vs 15% vs 15% y Mockups 8.1 a 8.3)
   - 2_Aceptacion_del_Cliente_UAT/
     (Acta de Aceptacion del Cliente UAT evaluada en 5 modulos)
   - 3_Gestion_Agil_Jira_Cloud/
     (Informe tecnico con enlaces y tickets KAN-1 al KAN-63 en Sprints 1 a 4)
   - 4_Metricas_WBS_Gantt_y_PERT/
     (GanttProject .gan con antecesores y recursos + Excel Puntos de Funcion y PERT)
   - 5_Aseguramiento_Calidad_y_Pruebas_Software_IEEE829/
     (1. Matriz Caja Negra/Blanca, 2. Casos Prueba CRUD ISO 29119, 3. Informe Lighthouse ISO 25010)
   - 6_Proyecto_Software_Avance_15_Porciento/
     (Documento con enlaces oficiales Drive, GitHub, Despliegue y Checksum)

03_Propuesta_Mejora_Continua_y_Guion_Video/
   - PROPUESTA_MEJORA_CONTINUA_Y_VALOR_AGREGADO_ORBE360.docx (y .md)
   - GUIA_Y_GUION_GRABACION_VIDEO_DEMOSTRATIVO_CORTE3.docx (y .md)

--------------------------------------------------------------------------------
ENLACE ONEDRIVE DOCENTE:
https://unisimonedu-my.sharepoint.com/:f:/g/personal/nataly_duquep_unisimon_edu_co/IgAg3c5VF8G2TIOVUb4eRKfzAWbakYrcJk31GGgSgV0L8nE?e=iEbVog
--------------------------------------------------------------------------------
"""
with open(os.path.join(ENTREGA_C3_DIR, "LEAME_PRIMERO_ENTREGA_CORTE_3.txt"), "w", encoding="utf-8") as f:
    f.write(leame_raiz)
print("  -> Archivos guia y LEAME creados en carpeta maestra de entrega.")

# 4. Empaquetar y actualizar ZIP
print("\n[4/5] Regenerando ORBE-GP-Software-Avance-15.zip con los ultimos cambios...")
zip_target_orbe = os.path.join(ORBE_DIR, "entregables-corte-3", "6_Proyecto_Software_Avance_15_Porciento", "ORBE-GP-Software-Avance-15.zip")
zip_target_c3 = os.path.join(c3_sw_dir, "ORBE-GP-Software-Avance-15.zip")

with zipfile.ZipFile(zip_target_orbe, "w", zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(c3_sw_gp):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for file in files:
            if should_skip_file(file):
                continue
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, c3_sw_dir)
            zipf.write(file_path, arcname)

shutil.copy2(zip_target_orbe, zip_target_c3)

h = hashlib.sha256()
with open(zip_target_orbe, "rb") as f:
    while chunk := f.read(8192):
        h.update(chunk)
sha256_hash = h.hexdigest().upper()
zip_size = os.path.getsize(zip_target_orbe)
print(f"  -> ZIP generado exitosamente: {zip_target_orbe}")
print(f"  -> Tamanio: {zip_size:,} bytes ({zip_size / (1024 * 1024):.2f} MB)")
print(f"  -> SHA-256: {sha256_hash}")

# 5. Git Commit y Push en ORBE-GP
print("\n[5/5] Realizando Git commit y push en ORBE-GP hacia GitHub...")
try:
    subprocess.run(["git", "add", "-A"], cwd=GP_DIR, check=True)
    status_out = subprocess.run(["git", "status", "--porcelain"], cwd=GP_DIR, capture_output=True, text=True).stdout
    if status_out.strip():
        commit_msg = "[KAN-55][KAN-56][KAN-57][KAN-58] feat: Avance 15% Tercer Corte - Flujos multi-rol Convex, Audio Studio Salome, Sedes 1-4 Unisimon y reglas UI/UX Soft Clay"
        subprocess.run(["git", "commit", "-m", commit_msg], cwd=GP_DIR, check=True)
        print("  -> Commit en ORBE-GP realizado con exito.")
    else:
        print("  -> ORBE-GP al dia, sin cambios pendientes para commit.")
    
    print("  -> Haciendo git push origin main...")
    push_res = subprocess.run(["git", "push", "origin", "main"], cwd=GP_DIR, capture_output=True, text=True)
    print("  -> Git Push stdout:", push_res.stdout.strip())
    if push_res.stderr:
        print("  -> Git Push stderr/info:", push_res.stderr.strip())
except Exception as e:
    print(f"  -> Error durante Git en ORBE-GP: {e}")

print("\n================================================================================")
print("PROCESO DE SINCRONIZACION Y DESPLIEGUE FINALIZADO EXITOSAMENTE")
print("================================================================================")

