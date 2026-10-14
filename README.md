# ORBE360 (PEVCI) — Plataforma de Recorridos Virtuales 360° para Campus Inclusivos
### Proyecto de Software — Evaluación Segundo Corte (70%)

**Institución:** Universidad Simón Bolívar — Sede Cúcuta  
**Facultad:** Ingenierías — Programa de Ingeniería de Sistemas  
**Asignatura:** Gestión de Proyectos (Semestre 2026-2)  
**Docente:** Ing. Nataly Duque Páez  

---

### Integrantes del Equipo de Proyecto:
1. **Eduardo José Soto Herrera** — `e_soto2@unisimon.edu.co`
2. **Saraic Noemi León Hernández** — `s_leon3@unisimon.edu.co`
3. **Kevin Eduardo García Moreno** — `k_garcia8@unisimon.edu.co`
4. **Sebastián David Omaña Villamizar** — `s_omana1@unisimon.edu.co`
5. **Jesús Omar Avendaño Avendaño** — `j_avendano4@unisimon.edu.co`

---

## Despliegue en 1 línea (Windows PowerShell)

### Opción A: Primera vez (descarga y ejecución automática)
Copie y pegue en Windows PowerShell y presione Enter. Configura Node.js si no existe, descarga el proyecto, abre el navegador e inicia el servidor en el puerto 8081:

```powershell
cd $HOME; if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "Configurando Node.js oficial..."; try { winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements } catch {} ; if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -OutFile "$env:TEMP\node.msi"; Start-Process msiexec.exe -ArgumentList "/i `"$env:TEMP\node.msi`" /qn" -Wait }; $env:Path += ";C:\Program Files\nodejs" }; if (-not (Test-Path "ORBE-GP")) { if (Get-Command git -ErrorAction SilentlyContinue) { git clone https://github.com/KUTEIMO/ORBE-GP.git } else { Invoke-WebRequest -Uri "https://github.com/KUTEIMO/ORBE-GP/archive/refs/heads/main.zip" -OutFile "ORBE-GP.zip"; Expand-Archive -Path "ORBE-GP.zip" -DestinationPath "." -Force; Rename-Item -Path "ORBE-GP-main" -NewName "ORBE-GP" -Force } }; cd ORBE-GP; Start-Process "http://localhost:8081/"; node scripts/dev-server.mjs
```

### Opción B: Si ya está descargado (iniciar directamente)
Si el proyecto ya está descargado en el equipo, no vuelve a descargar nada. Ejecute en PowerShell para iniciar el servidor y abrir el navegador:

```powershell
cd $HOME\ORBE-GP; Start-Process "http://localhost:8081/"; node scripts/dev-server.mjs
```

### Opción C: Actualizar cambios en equipo ya descargado (sincronizar y ejecutar)
Si ya tiene el proyecto descargado en el computador y desea actualizarlo con los últimos cambios publicados (sin tener que volver a descomprimir ni reconfigurar nada), copie y pegue en Windows PowerShell y presione Enter:

```powershell
cd $HOME\ORBE-GP; if (Test-Path .git) { git pull } else { Invoke-WebRequest -Uri "https://github.com/KUTEIMO/ORBE-GP/archive/refs/heads/main.zip" -OutFile "$HOME\update.zip"; Expand-Archive -Path "$HOME\update.zip" -DestinationPath "$HOME\temp_update" -Force; Copy-Item -Path "$HOME\temp_update\ORBE-GP-main\*" -Destination "$HOME\ORBE-GP" -Recurse -Force; Remove-Item "$HOME\update.zip", "$HOME\temp_update" -Recurse -Force }; Start-Process "http://localhost:8081/"; node scripts/dev-server.mjs
```

---



---

### Ejecución sin consola (archivo .bat)
1. Ingrese a la carpeta `ORBE-GP`.
2. Haga doble clic en el archivo `INICIAR_PROYECTO.bat`.

---

### Mac / Linux (Terminal Bash o Zsh)
```bash
git clone https://github.com/KUTEIMO/ORBE-GP.git && cd ORBE-GP && node scripts/dev-server.mjs
```

---

## Enlaces de acceso local (puerto 8081)

Una vez iniciado el servidor:

| Sección | URL Local | Descripción |
| :--- | :--- | :--- |
| **Portal Web** | `http://localhost:8081/` | Página de inicio y catálogo del campus. |
| **Recorrido Virtual 360°** | `http://localhost:8081/unisimoncucuta/experienciavirtual/` | Visor interactivo 360° con escenas, hotspots y subtítulos. |
| **Panel de Administración (CMS)** | `http://localhost:8081/unisimoncucuta/experienciavirtual/control-web/` | Gestión de escenas, hotspots y configuración. |

---

## Control de acceso y cuentas demo (Panel CMS)

| Rol | Correo Demo | Alcance |
| :--- | :--- | :--- |
| **Superadmin** | `superadmin@orbe360.local` | Gestión de organizaciones. |
| **Admin Sede** | `admin@unisimon.local` | Edición del tour 360° y puntos de interés. |
| **Invitado** | `invitado@unisimon.local` | Navegación pública. |

> Las credenciales de acceso se encuentran en el archivo `CUENTAS_Y_CREDENCIALES_PROYECTO.txt`.

---

## Accesibilidad (WCAG 2.1 AA)
* **Audiodescripción y subtítulos en hotspots:** Los puntos de interés cuentan con narración de voz (Salomé) y subtítulos sincronizados.
* **Audio guía de escena (Tecla M):** Con la tecla M o el botón de audio se reproduce la descripción general de la escena con subtítulos en vivo.
* **Lengua de Señas Colombiana (LSC):** Atajo `Alt + S` o botón flotante inferior.
* **Navegación por teclado:** Soporte de navegación secuencial con `Tab`, `Enter` y anillo de foco visible.

---

## Arquitectura técnica
* `src/`: Lógica del visor 360° y módulos de accesibilidad.
* `convex/`: Esquema de datos para persistencia de escenas y hotspots.
* `plataforma/` y `control-web/`: Interfaz web y panel administrativo.
* `media/`: Panoramas 360°, archivos de audio MP3 y subtítulos VTT.
* `scripts/dev-server.mjs`: Servidor local para reescritura de rutas multi-sede.
