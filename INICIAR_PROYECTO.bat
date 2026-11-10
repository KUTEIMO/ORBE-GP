@echo off
chcp 65001 >nul
title ORBE360 - Despliegue Local (Gestión de Proyectos Unisimón)
echo ===============================================================================
echo  ORBE360 (PEVCI) — Recorrido Virtual 360 Institucional (70%% Evaluado)
echo  Universidad Simón Bolívar — Gestión de Proyectos (Ing. Nataly Duque Páez)
echo ===============================================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js no fue detectado en el sistema.
    echo [*] Descargando e instalando Node.js LTS oficial desde nodejs.org...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile '$env:TEMP\node.msi'; Start-Process msiexec.exe -ArgumentList '/i \"$env:TEMP\node.msi\" /qn' -Wait"
    set "PATH=%PATH%;C:\Program Files\nodejs"
)

echo [*] Verificando backend Convex local en 127.0.0.1:3210...
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:3210/version' -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
    echo [*] Iniciando servidor Convex local en ventana aparte...
    start "ORBE360 - Convex Dev" cmd /c "npx convex dev"
    timeout /t 4 /nobreak >nul
)

echo [*] Abriendo el navegador en http://127.0.0.1:8081/...
start "" "http://127.0.0.1:8081/"

echo [*] Iniciando servidor web local Orbe360 en 127.0.0.1:8081...
node scripts/dev-server.mjs
if %errorlevel% neq 0 (
    npm start
)

pause
