# ORBE360 (PEVCI) — PLATAFORMA DE RECORRIDOS VIRTUALES 360° PARA CAMPUS INCLUSIVOS
### PROYECTO DE SOFTWARE — EVALUACIÓN SEGUNDO CORTE (70% DESARROLLADO)

**Institución:** Universidad Simón Bolívar — Sede Cúcuta  
**Facultad:** Ingenierías — Programa de Ingeniería de Sistemas  
**Asignatura:** Gestión de Proyectos (Semestre 2026-2)  
**Docente Evaluadora:** Ing. Nataly Duque Páez  

---

### Integrantes del Equipo de Proyecto:
1. **Eduardo José Soto Herrera** — `e_soto2@unisimon.edu.co` (Líder de Proyecto / Frontend 360°)
2. **Saraic Noemi León Hernández** — `s_leon3@unisimon.edu.co` (Líder de Calidad / Accesibilidad WCAG)
3. **Kevin Eduardo García Moreno** — `k_garcia8@unisimon.edu.co` (Líder Backend / Requerimientos Jira)
4. **Sebastián David Omaña Villamizar** — `s_omana1@unisimon.edu.co` (Ingeniero DevSecOps / Base de Datos)
5. **Jesús Omar Avendaño Avendaño** — `j_avendano4@unisimon.edu.co` (Ingeniero de Planificación / Cronograma)

---

## ⚡ DESPLIEGUE RÁPIDO EN LOCAL (OPCIONES SEGÚN SU COMPUTADOR)

Para desplegar y visualizar la plataforma en su equipo en segundos, elija una de las siguientes opciones:

### 🏆 Opción 1: Comando Universal en Windows PowerShell (1 Sola Línea — Funciona en cualquier PC)
> Instala Git y Node.js si faltan, clona el proyecto, abre el navegador y arranca el servidor local directamente con `node` (evitando bloqueos de scripts `.ps1` de PowerShell):

```powershell
winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements; winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements; $env:Path = "$([System.Environment]::GetEnvironmentVariable('Path','Machine'));$([System.Environment]::GetEnvironmentVariable('Path','User'))"; git clone https://github.com/KUTEIMO/ORBE-GP.git; cd ORBE-GP; Start-Process "http://localhost:8081/"; node scripts/dev-server.mjs
```

---

### 🚀 Opción 2: Si ya está dentro de la carpeta clonada (o si le salió error de npm.ps1)
> Si ya clonó el repositorio o le apareció `npm.ps1 está deshabilitado en este sistema`, simplemente ejecute:

```powershell
node scripts/dev-server.mjs
```
*(O si prefiere usar npm):*
```powershell
npm.cmd start
```

---

### 🖱️ Opción 3: Doble Clic (Método Sin Consola)
> Si descargó el archivo ZIP (`ORBE-GP-Software-70.zip` o desde GitHub):
1. Descomprima la carpeta.
2. Haga doble clic en el archivo **`INICIAR_PROYECTO.bat`**.
3. El sistema abrirá su navegador en `http://localhost:8081/` y levantará el servidor web local automáticamente.

---

### 🍎 Opción 4: En Mac / Linux (Terminal Bash o Zsh)
```bash
git clone https://github.com/KUTEIMO/ORBE-GP.git && cd ORBE-GP && node scripts/dev-server.mjs
```

---

## 🌐 ENLACES DE ACCESO EN EL NAVEGADOR (PUERTO 8081)

Una vez iniciado el servidor, las superficies del proyecto están disponibles en:

| Superficie del Proyecto | URL Local | Descripción |
| :--- | :--- | :--- |
| **Portal Web y Landing Page** | `http://localhost:8081/` | Página institucional con información del proyecto y catálogo de sedes. |
| **Recorrido Virtual 360° Piloto Unisimón** | `http://localhost:8081/unisimoncucuta/experienciavirtual/` | Visor interactivo WebGL con 18 escenas de la Biblioteca Anita Consuegra. |
| **Panel de Administración (CMS)** | `http://localhost:8081/unisimoncucuta/experienciavirtual/control-web/` | Interfaz de gestión de escenas, hotspots y configuración del tour. |

---

## 🔒 CONTROL DE ACCESO Y ROLES DEMO (PANEL CMS / CONTROL-WEB)

Para evaluar las rutas protegidas y la autenticación con control de acceso basado en roles (RBAC):

| Rol de Usuario | Identificador Institucional | Alcance de Permisos |
| :--- | :--- | :--- |
| **Superadmin Plataforma** | `superadmin@orbe360.local` | Gestión de clientes y organizaciones (Sin mutación de tours de sedes). |
| **Admin Sede Unisimón** | `admin@unisimon.local` | Edición y administración del tour 360° de la Biblioteca Anita Consuegra. |
| **Usuario Invitado** | `invitado@unisimon.local` | Navegación e interactividad sensorial pública de las escenas. |

> 🛡️ **Seguridad y Confidencialidad (DevSecOps):**  
> De acuerdo con las buenas prácticas de seguridad para repositorios públicos, las contraseñas de evaluación se encuentran documentadas **exclusivamente en el archivo confidencial `CUENTAS_Y_CREDENCIALES_PROYECTO.txt`** provisto en la carpeta oficial del curso en OneDrive / Teams y entregado directamente a la docente evaluadora.

---

## ♿ VERIFICACIÓN DE ACCESIBILIDAD UNIVERSAL (WCAG 2.1 AA)
* **Audiodescripción Espacial Completa:** El 100% de los puntos de interés (hotspots) y escenas cuentan con audiodescripción espacial y narración de voz. Al hacer clic o presionar Enter sobre cualquier hotspot se reproduce su explicación sonora.
* **Audio Guía de Escena (Tecla M):** Presione la tecla **`M`** en el teclado o el botón de bocina para alternar la locución de la escena completa.
* **Lengua de Señas Colombiana (LSC):** Presione **`Alt + S`** o haga clic en el icono flotante de la esquina inferior derecha.
* **Navegación por Teclado:** Utilice las teclas **`Tab`** y **`Enter`** para navegar sin ratón con anillo de foco de alto contraste (ratio 3:1).

---

## 🛠️ ARQUITECTURA TÉCNICA (NORMA IEEE 1058)
El proyecto implementa la separación de procesos técnicos del ciclo de vida del software:
* `src/`: Capa de lógica y motor frontend (Pannellum, Three.js, WebGL a 60 FPS sin frameworks pesados).
* `convex/`: Capa de datos reactiva en tiempo real (Esquema de grafos de escenas y hotspots).
* `plataforma/` y `control-web/`: Capa de presentación web responsive y CMS.
* `media/`: Panoramas 360° equirectangulares, locuciones espaciales y recursos gráficos.
* `scripts/dev-server.mjs`: Servidor local con reescritura de URLs virtuales multi-sede (`/tours/:org/:tour`).
