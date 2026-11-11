@echo off
chcp 65001 >nul
title ORBE360 - Despliegue Local (Desarrollo Multi-Tenant)
echo ===============================================================================
echo  ORBE360 — Plataforma Multi-Tenant de Recorridos Virtuales 360° Accesibles
echo  Entorno de Desarrollo Local (Convex + Servidor Web Virtual)
echo ===============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js no fue detectado en el sistema.
    echo [*] Descargando e instalando Node.js LTS oficial desde nodejs.org...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '$env:TEMP\node.msi'; Start-Process msiexec.exe -ArgumentList '/i \"$env:TEMP\node.msi\" /qn' -Wait"
    set "PATH=%PATH%;C:\Program Files\nodejs"
)

if not exist "node_modules\" (
    echo [*] Instalando dependencias del proyecto ^(primera ejecucion^)...
    call npm install
)

echo [*] Verificando backend Convex local en 127.0.0.1:3210...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3210/version' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo [*] Iniciando servidor Convex local en ventana aparte...
    echo [i] Si es tu primera ejecucion en este equipo, revisa la nueva ventana por si Convex requiere iniciar sesion y ejecuta despues el seed inicial indicado en README.md.
    start "ORBE360 - Convex Dev" cmd /k "npx convex dev"
    timeout /t 5 /nobreak >nul
)

echo [*] Abriendo el navegador en http://127.0.0.1:8081/...
start "" "http://127.0.0.1:8081/"

echo [*] Iniciando servidor web local Orbe360 en 127.0.0.1:8081...
node scripts/dev-server.mjs
if %errorlevel% neq 0 (
    npm start
)

pause
