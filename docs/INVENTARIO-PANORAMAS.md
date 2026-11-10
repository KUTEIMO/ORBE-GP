# Inventario visual de panoramas — PEVCI

**Proyecto:** Tour 360° Universidad Simón Bolívar, sede Cúcuta  
**Carpeta:** `panoramas/`  
**Fecha de captura (en nombre de archivo):** 28/03/2025  
**Equipo/cámara (sufijo):** `YP00145909`  
**Formato:** JPG equirectangular 360°  
**Total en disco y en `config.json`:** 62  
**Huecos en la secuencia:** R0010114, R0010116, R0010122 (no existen en el set)

---

## Cómo se analizó (método)

1. **Listado técnico:** se enumeraron los archivos en `panoramas/` y se cruzaron con `config.json` (`scenes`, `sceneNames`, `zones`). Resultado: 62 escenas en config = 62 JPG en disco; ninguna huérfana.
2. **Lectura visual de cada JPG:** cada panorama se abrió con el visor de imágenes del asistente (descripción detallada de contenido equirectangular: arquitectura, letreros, mobiliario, personas, rutas posibles).
3. **Cruce con nombres actuales:** se comparó lo que *se ve* con el título en `sceneNames` y la `zone` asignada. Se marcaron errores (p. ej. “Auditorio” cuando es patio).
4. **Criterios de descripción:**
   - Lugar / función del espacio
   - Elementos identificables (letreros, murales, escaleras, PCs, etc.)
   - Utilidad para hotspots o navegación
   - Nota de accesibilidad si hay rampa, escalones, silla de ruedas visible, etc.
5. **Limitación:** las descripciones son del contenido *visible* en la foto; no sustituyen un plano arquitectónico oficial ni GPS. El nadir del trípode aparece en casi todas.

---

## Resumen por zona (conteo)

| Zona (`config`) | Cantidad | Uso real observado |
|-----------------|----------|--------------------|
| `entrada` | 11 | Accesos Bloque B / pasillos hall Sede 2 |
| `cafeteria` | 13 | Lobby cafetería, medios, ajedrez, pre-biblioteca |
| `biblioteca_p1` | 19 | Biblioteca Anita Bolívar de Consuegra — planta baja |
| `biblioteca_p2` | 13 | Mezanine / nivel superior de la biblioteca |
| `cultural` | 6 | Edificio Cultural + patio exterior (no auditorio cerrado) |

---

## Inventario escena por escena

Convención: **ID** = número Ricoh `R0010xxx`. Archivo completo = `R0010xxx_202503281…_YP00145909.JPG`.

### A. Entrada y pasillos Bloque B (`entrada`)

| # | ID | Nombre actual (config) | Qué se ve (análisis visual) | Notas / corrección |
|---|-----|------------------------|-----------------------------|--------------------|
| 1 | 60 | Entrada Principal - Acceso Sede 2 | Exterior Bloque B: letrero Universidad Simón Bolívar, guardia, acera roja, árboles, calle con vehículos; interior del hall al fondo | OK como arranque. Escalones en acceso (sin rampa visible aquí). |
| 2 | 61 | Hall de Ingreso - Recepción Central | Interior hall: cabina **SEDE 2**, sillas azules, arcos a calle izquierda/derecha, persona caminando | OK |
| 3 | 62 | Pasillo Principal - Conexión Aulas | Pasillo amplio: totem USB, punto ecológico, sillas verdes, camilla naranja, QR azul, salidas a calle | OK |
| 4 | 63 | Pasillo Primera Planta - Vistas al Computo rooms | Continuación: branding USB, sillas, puerta con monitores (lab/oficina), gente en mostrador al fondo | OK |
| 5 | 64 | Pasillo Bloque B - Zona Cómputo | Pasillo hacia arco brillante; ventanas a oficinas; sillas verdes; gente en mesa de atención | OK |
| 6 | 65 | Pasillo Bloque B - Área Multimedia | Arco a patio; banner **Matricúlate Ya**; césped artificial + puff; **silla de ruedas** contra pared; puerta LABORATORIO | Buen hito de accesibilidad |
| 7 | 66 | Zona de Descanso 1 - Planta 1 Bloque B | Nudo: arcos, lounge césped, banner posgrados, **escalera** a piso superior, pasillo derecha | OK |
| 8 | 67 | Pasillo Central Bloque B - Conexión… | Escalera frontal, casilleros, arcos, plaque, lounge USB | OK |
| 9 | 71 | Zona de Descanso 1 - Planta 1 Conexion Cafeteria | Mismo nudo desde otro ángulo: escalera, casilleros, pasillo largo, lounge, arcos a patio | Muy similar a 66–67 |
| 10 | 123 | Zonas de computo pasillo principal… | Vuelta al pasillo hall: arco a patio, sillas, mesa atención, banner Matricúlate, silla de ruedas | Zona `entrada` correcta |
| 11 | 124 | Pasillo Principal Bloque B en Av 3 | Hall hacia salida calle: sillas en curva, QR, recepción, totem digital, reciclaje | OK salida secundaria |

### B. Cafetería / lobby (`cafeteria`)

| # | ID | Nombre actual | Qué se ve | Notas |
|---|-----|---------------|-----------|-------|
| 12 | 68 | Entrada Cafetería - Muro de Medios | Pared verde **Unisimón en los medios** (TV noticias), mesas verdes, arco a casilleros/escalera | OK |
| 13 | 69 | Zona Cafetería - Pasillo Hacia bloque C | **Mural de Excelencia Académica**, pantallas posgrados, salida a patio, mesas | OK |
| 14 | 70 | Cafetería - Conexion Oficina profe física | Hub: patio al centro, oficina vidrio, bancas, pantallas verdes, escalera, casilleros | Nombre de config poco preciso; es lobby/patio |
| 15 | 72 | Pasillo Cafetería - Mesas de Comidas | Vista a patio con logo USB, mural excelencia, mesas a la izquierda | OK |
| 16 | 73 | Cafetería - Conexion Baños Femeninos | Pasillo mesas + puerta baño (señal verde) + patio con toldo | OK |
| 17 | 74 | Cafetería - Mesas / Residuos Electrónicos | Cartel “Lugar exclusivo para estudio”; caja **residuos electrónicos**; reciclaje; mesas verdes | OK |
| 18 | 75 | Pasillo Cafetería - Zona Central de Mesas | Mesas madera/plástico, reciclaje, apertura brillante a patio/escaleras | OK |
| 19 | 76 | Zona Cafetería - Estación Ajedrez | Arco con letrero **BIBLIOTECA**; **ajedrez gigante de piso**; caseta bebidas | Hito fuerte de navegación a biblioteca |
| 20 | 77 | Cafetería - Caseta comidas | Caseta refrigerada + mostrador vidrio (atención) + mesas verdes + reja/salida | OK |
| 21 | 78 | Pasillo - registro conexion biblioteca | Mostrador **CONTROL DE INGRESO BIBLIOTECA ANITA CONSUEGRA**; mesas; máquinas vending al fondo | **Hito clave del piloto** |
| 22 | 79 | zona Cafetería - conexion Bloque Cultural | Portón metal; letrero **EDIFICIO CULTURAL Anita Consuegra**; guardia; casilleros de bolsos | Zona cafeteria OK; es umbral cultural |
| 23 | 80 | Cafetería - Entrada Secundaria calle 14 | Exterior: acera, árboles, entrada con rejas blancas, guardia, escalones | En config está en `entrada` — correcto funcionalmente |
| 24 | 82 | Cafetería - puertas empuje biblioteca | Frente a puertas **BIBLIOTECA**, rampa corta, plantas, mostrador con mascota | Pre-entrada biblioteca |

### C. Biblioteca planta baja (`biblioteca_p1`)

Nombre oficial en muro: **BIBLIOTECA ANITA BOLÍVAR DE CONSUEGRA** (variantes en carteles: Anita Consuegra).

| # | ID | Nombre actual | Qué se ve | Notas |
|---|-----|---------------|-----------|-------|
| 25 | 83 | Lobby de Préstamos | Justo dentro: puertas vidrio, arco con franja amarillo/azul/rojo, mostrador, mesas, mezanine, letrero biblioteca | Escena ancla accesible en config |
| 26 | 84 | Sección Libros A–E | Lobby amplio: mural colorido en arco, PCs a la derecha, mesas izquierda, escalera mezanine | No se leen letras A–E; mejor “Lobby / mural / PCs” |
| 27 | 85 | Sección Libros F–J | Misma zona desde otro ángulo (mural + PCs + mesas) | Casi duplicado de 84 |
| 28 | 86 | Salas de Lectura | Pasillo central: mesas curvas, estantería baja, PCs bajo letrero, mural al fondo | OK lectura/estudio |
| 29 | 87 | Conexión de Pasillos | Cubículos arqueados bajo mezanine, PCs, mesas | Mejor: “Cubículos / estudio” |
| 30 | 88 | Cubículos Grupales | Primer plano a booths arqueados verdes/azules; arco a estantería | OK |
| 31 | 89 | Zona Silenciosa | **Dentro** de un cubículo de madera; vista a sala con estantes y mesas | Escena “desde el booth” |
| 32 | 90 | Sección de Revistas | Vista abierta: mesas curvas, PCs al fondo, mezanine, mural lateral | No es solo revistas |
| 33 | 91 | Pasillo Lectura Individual | Mesas, estantes, PCs con letrero, escalera, kiosco verde | OK |
| 34 | 92 | Punto de Uso de computadores | Mesas curvas + salones de vidrio al centro; PCs a un lado | OK hub |
| 35 | 93 | Sala Estudio Colaborativo | Estantería **GENERAL**, salones vidrio (García Márquez), mesas | OK |
| 36 | 94 | Acceso Pasarela Norte | Pasillos entre estantería blanca alta y mesas verdes | Más “estantería / stacks” |
| 37 | 95 | Zona pasarela norte de Libros | Mesa curva con tomacorrientes, estantería alrededor, vidrio al fondo | OK |
| 38 | 96 | Cubículos De Usar Portatiles | Mesa en U + salones vidrio + murales | OK |
| 39 | 97 | Salón de Proyectos 1 | Frente a salones de vidrio + **escalera** + mural paisaje | Conexión vertical |
| 40 | 98 | Salón de Proyectos 2 | Dos salones vidrio con citas (Irene Vallejo…); mesas a ambos lados | OK |
| 41 | 99 | Salón de Proyectos 3 | Salones con temática **Isabel Allende / Eva Luna**; mesas con tomas | OK |
| 42 | 100 | Escaleras a P2 zona sur | Escalera central + mural río/montaña + display libros | Puente a mezanine |
| 43 | 115 | Computadores de Proyectos - Sector A | Otra toma del lobby/PCs/mezanine (vuelve a planta baja) | Zona p1 correcta |

### D. Biblioteca mezanine (`biblioteca_p2`)

| # | ID | Nombre actual | Qué se ve | Notas |
|---|-----|---------------|-----------|-------|
| 44 | 101 | Vista desde Escaleras | Descanso: baja a P1 / sube a mezanine; mural montaña; pods verdes arriba | OK |
| 45 | 102 | Vista desde Escaleras | Casi igual a 101 (ángulo muy cercano) | Candidata a no usar en piloto |
| 46 | 103 | Pasillo Superior 1 | Llegada mezanine: lounge sofás verdes, pods, pasillo estantería verde | OK |
| 47 | 104 | Pasillo estantes libros | Aisle denso; letrero **GENERAL**; textos de Derecho visibles | OK |
| 48 | 105 | Pasillo estantes 2 | Aisle estrecho; etiqueta SECCION; mesas al fondo | OK |
| 49 | 106 | Pasillo estantes 3 | Boca de aisle + mesas estudio + pods; letrero tipo ECONOMÍA | OK |
| 50 | 107 | Zona Trabajo en Grupo a | Pasillo: pods izquierda, mesas redondas + taburetes, estantería, escalera | OK |
| 51 | 108 | Zona Trabajo en Grupo b | Mezanine abierta: booths verdes, mesas circulares, estantería, vista a piso inferior | OK |
| 52 | 109 | Cubiculos amoblados | Pods + mesas redondas + estantería verde | Similar a 107–108 |
| 53 | 110 | Pasillo Mesas de trabajo | Señal colgante **HEMEROTECA**; mesas; barandal a vacío | Hito hemeroteca |
| 54 | 111 | Mesas Vista a piso 1 | Balcón: mesas verdes, estantería, vista a planta baja + mural + letrero | OK |
| 55 | 112 | Mesas con libreria | Similar balcón, otro ángulo | Casi duplicado 111 |
| 56 | 113 | Mesas Estantes libreria | Mezanine; estante **PSICOLOGÍA**; vista abajo | OK |

### E. Cultural / patio (`cultural`)

| # | ID | Nombre actual | Qué se ve | Notas / corrección |
|---|-----|---------------|-----------|--------------------|
| 57 | 81 | Pasillo Entrada Edificio Cultural | Interior: mural musical, vitrinas, arco, foto grupal USB | OK cultural interior |
| 58 | 117 | Auditorio - Entrada Principal | **Patio** crepuscular: mesas bajo cubierta, cancha, escalera **BLOQUE C** | **Incorrecto:** no es auditorio |
| 59 | 118 | Escenario y Gradas… | Patio / pasarela con baranda, toldo curvo, banner USB, cancha | **Incorrecto:** no es escenario/gradas |
| 60 | 119 | Rampa a Vista General | Patio rojo; rampa con pasamanos; banner USB; aro básquet | Mejor: patio + rampa |
| 61 | 120 | Zona Abierta - Vista Frontal | Centro del patio con banners y aros | OK |
| 62 | 121 | Centro Zona abierta - Bloque D | Patio hacia edificio curvo, bicicletas bajo cubierta, aros | OK aproximado |

---

## Errores detectados (para corregir en config)

| Prioridad | Problema | Acción |
|-----------|----------|--------|
| Alta | 117 y 118 nombrados como Auditorio / Escenario | **Corregido** en `config.json` (patio / Bloque C) |
| Media | 84–85 “Libros A–E / F–J” no verificable en imagen | **Corregido** → lobby mural/PCs |
| Media | 70 nombre “profe de física” no visible | **Corregido** → lobby/patio |
| Baja | Duplicados fuertes: 84≈85, 101≈102, 111≈112 | Mantener archivos; marcar en piloto qué omitir |
| Info | Nombre biblioteca unificado | **Actualizado** en zones + `accessibleScenes` |

---

## Ruta sugerida para demo (sin borrar archivos)

Camino corto de alto impacto (~10–12 escenas):

1. **60** Entrada Bloque B  
2. **65** o **66** Hall / descanso  
3. **76** Ajedrez + letrero Biblioteca  
4. **78** Control de ingreso  
5. **82** Puertas biblioteca  
6. **83** Lobby interior  
7. **87** Cubículos  
8. **93** Colección GENERAL / salones  
9. **100** Escaleras  
10. **103** o **110** Mezanine / Hemeroteca  
11. (opcional) **117** Patio Bloque C  

Las demás quedan disponibles en menú completo o para expansión.

---

## Artefactos técnicos comunes

- **Nadir:** base negra del trípode en casi todas → candidato a parche con logo USB.  
- **Iluminación:** interiores muy blancos → UI de hotspots necesita contraste alto.  
- **Personas:** hay estudiantes/staff en muchas tomas (considerar aviso de privacidad institucional si se publica amplio).

---

*Documento generado en la fase de desarrollo post-parcial (paso 1–2 de handoff PEVCI).*
