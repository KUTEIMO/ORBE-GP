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

echo [*] Abriendo el navegador en http://localhost:8081/...
start "" "http://localhost:8081/"

echo [*] Iniciando servidor web local Orbe360 en el puerto 8081...
node scripts/dev-server.mjs
if %errorlevel% neq 0 (
    npm start
)

pause
