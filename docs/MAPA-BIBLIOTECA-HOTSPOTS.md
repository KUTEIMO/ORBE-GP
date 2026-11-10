# Mapa de hotspots — Biblioteca (piloto denso)

Archivo de datos: `media/unisimoncucuta/experienciavirtual/biblioteca-scenes.json` (34 escenas: 78, 82 + toda la biblioteca 83–113 y 115).

## Objetivo
Recorrido **denso** (tomas cercanas incluidas) para un futuro modo guiado con transiciones ~950 ms, sensacion de avance continuo.

## Conteos
- 34 escenas configuradas
- 131 hotspots (94 navegacion `nav` + 37 informativos `info`)
- Todos los `targetFile` de nav resuelven a JPG existentes

## Como regenerar
```bash
node scripts/generate-biblioteca-scenes.mjs
```

## Como probar
1. `npm start` (o servidor en 8081 si 8080 esta ocupado)
2. Abrir: `http://127.0.0.1:8081/?scene=biblioteca-lobby`
3. Clic en flechas azules (`nav`) para saltar de escena
4. Doble clic hacia un destino tambien navega

## Backup
Copia previa a estos cambios:
`PROTOTIPO-360-CURSOR-V1-BACKUP-20260908/`
