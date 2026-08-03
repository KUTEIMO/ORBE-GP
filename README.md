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

## ⚡ DESPLIEGUE RÁPIDO EN LOCAL (1 SOLA LÍNEA DE COMANDOS)

Para desplegar y visualizar la plataforma en su computador en segundos, copie y pegue **una sola línea** según su terminal:

### Opción A: En Windows (PowerShell)
> Clona el repositorio, instala dependencias, abre el navegador automáticamente e inicia el servidor web local en el puerto 8081:

```powershell
git clone https://github.com/KUTEIMO/ORBE-GP.git; cd ORBE-GP; npm install; Start-Process "http://localhost:8081/"; npm start
```

*(Si ya descargó el archivo ZIP y abrió la terminal dentro de la carpeta del proyecto):*
```powershell
npm install; Start-Process "http://localhost:8081/"; npm start
```

---

### Opción B: En Mac / Linux (Terminal Bash / Zsh)
```bash
git clone https://github.com/KUTEIMO/ORBE-GP.git && cd ORBE-GP && npm install && npm start
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

## 🔐 CONTROL DE ACCESO BASADO EN ROLES (RBAC) Y SEGURIDAD

> 🛡️ **Aviso de Seguridad en Repositorio Público:**  
> Por directrices de seguridad de la información y buenas prácticas de ingeniería de software, las credenciales institucionales y contraseñas de las cuentas de prueba para evaluar las rutas protegidas del panel administrativo (`/control-web/`) **se suministran de forma confidencial a la docente evaluadora a través de los canales privados oficiales de la Universidad** (carpeta privada de SharePoint / OneDrive Unisimón y en el documento técnico formal de entrega).

### Perfiles de Seguridad Implementados:
* **Superadministrador de Plataforma:** Gestión global de sedes, organizaciones y políticas de acceso multi-inquilino.
* **Administrador de Sede Unisimón:** Gestión de contenido 360°, vinculación de hotspots y audios en la Biblioteca Anita Consuegra.
* **Usuario Visitante / Estudiante:** Acceso público inmediato a la experiencia inmersiva sensorial y navegación accesible (sin necesidad de credenciales).

---

## ♿ VERIFICACIÓN DE ACCESIBILIDAD UNIVERSAL (WCAG 2.1 AA)
* **Audio Guía Descriptiva:** Presione la tecla **`M`** en el teclado para silenciar o activar la narración espacial de la escena.
* **Lengua de Señas Colombiana (LSC):** Presione **`Alt + S`** o haga clic en el icono flotante de la esquina inferior derecha.
* **Navegación por Teclado:** Utilice las teclas **`Tab`** y **`Enter`** para navegar sin ratón, observando el anillo visual de foco de alto contraste (ratio 3:1).
* **Panel de Opciones Accesibles:** Presione **`Alt + A`** para abrir el menú de personalización de alto contraste y tamaño tipográfico.

---

## 🛠️ ARQUITECTURA TÉCNICA (NORMA IEEE 1058)
El proyecto implementa la separación de procesos técnicos del ciclo de vida del software:
* `src/`: Capa de lógica y motor frontend (Pannellum, Three.js, WebGL a 60 FPS sin dependencias externas pesadas).
* `convex/`: Capa de datos reactiva en tiempo real (Esquema de grafos de escenas y hotspots).
* `plataforma/` y `control-web/`: Capa de presentación web responsive y CMS.
* `media/`: Panoramas 360° equirectangulares, locuciones espaciales y recursos gráficos.
* `scripts/dev-server.mjs`: Servidor local autónomo con reescritura de URLs virtuales multi-sede (`/tours/:org/:tour`).
