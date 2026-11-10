# Tour Virtual Accesible ÔÇô Sede 2 (MVP)

Recorrido virtual 360┬░ basado en [Marzipano](https://www.marzipano.net/) con ├®nfasis en accesibilidad conforme a WCAG 2.1/3.0 y la Resoluci├│n MinTIC 1519 de 2020.

## Requisitos previos

- Node.js ÔëÑ 18
- Navegador moderno con soporte WebGL
- El archivo `vendors/marzipano.min.js` (incluido en el repo) se carga de forma local para evitar fallos de red

## Puesta en marcha

```bash
npm install
npm run start
```

El servidor local (http-server) queda disponible en `http://localhost:8080`.

## Auditor├¡a y pruebas automatizadas

- Ejecutar auditor├¡a inicial (JSON + HTML):

```bash
npm run audit
```

El resultado queda en `reports/audit-report.{json,html}`.

- Probar navegaci├│n por teclado (Playwright):

```bash
npm test
```

Los tests validan que los hotspots reciban foco mediante tabulaci├│n y que el panel accesible se muestre correctamente.
> Nota: ejecuta `npm run start` en otra terminal (o define `BASE_URL` apuntando a tu servidor) antes de lanzar `npm test`.

## Atajos de teclado relevantes

- Flechas ÔåÉ ÔåÆ: rotaci├│n horizontal
- Flechas Ôåæ Ôåô: inclinaci├│n vertical
- `+` / `-`: zoom
- `Q` / `E`: balance vertical
- `Tab`: recorre controles, hotspots y men├║
- `Ctrl + Shift + H`: activa/desactiva modo de edici├│n de hotspots
- `Ctrl + Shift + E`: exporta en consola las posiciones ajustadas de la escena activa
- `Shift + /`: abre el di├ílogo de ayuda (tambi├®n disponible desde el bot├│n de ayuda)

## Navegaci├│n y rendimiento

- El visor 360┬░ usa Marzipano precargado localmente para evitar pantallas en negro si la conexi├│n falla.
- Las escenas se precargan de forma diferida para reducir los bloqueos al cambiar de panorama.
- Navegaci├│n alterna tipo Street View: mueve el cursor para ver la direcci├│n sugerida y haz doble clic para saltar a la escena m├ís cercana; los botones laterales originales siguen disponibles.
- La banda inferior muestra accesos r├ípidos a tres zonas clave (Entrada, Cafeter├¡a, Biblioteca) para saltar inmediatamente entre ├íreas.

## Estructura principal

```
Ôö£ÔöÇÔöÇ index.html                 # P├ígina principal con skip-links y fallback sin JS
Ôö£ÔöÇÔöÇ demo.html                  # Gu├¡a r├ípida de demo y accesos directos
Ôö£ÔöÇÔöÇ config.json                # Declaraci├│n de escenas, hotspots y recursos
Ôö£ÔöÇÔöÇ src/                       # C├│digo JavaScript modular
Ôöé   Ôö£ÔöÇÔöÇ main.js                # Punto de entrada
Ôöé   Ôö£ÔöÇÔöÇ viewer.js              # Inicializaci├│n Marzipano
Ôöé   Ôö£ÔöÇÔöÇ hotspotManager.js      # Hotspots accesibles
Ôöé   Ôö£ÔöÇÔöÇ hotspotPanel.js        # Panel de detalle con audio/subt├¡tulos
Ôöé   Ôö£ÔöÇÔöÇ accessibility.js       # Controles de accesibilidad y di├ílogos
Ôöé   Ôö£ÔöÇÔöÇ keyboardControls.js    # Navegaci├│n por teclado
Ôöé   Ôö£ÔöÇÔöÇ navigation.js          # Botones anterior/siguiente
Ôöé   Ôö£ÔöÇÔöÇ menu.js                # Men├║ lateral accesible
Ôöé   Ôö£ÔöÇÔöÇ announcer.js, state.js, fallback.js, configLoader.js
Ôö£ÔöÇÔöÇ assets/
Ôöé   Ôö£ÔöÇÔöÇ audio/placeholder.mp3          # Audiodescripci├│n de muestra
Ôöé   Ôö£ÔöÇÔöÇ captions/*.vtt                # Subt├¡tulos cerrados
Ôöé   ÔööÔöÇÔöÇ transcripts/*.txt             # Transcripciones descargables
Ôö£ÔöÇÔöÇ reports/                          # (se crea al ejecutar auditor├¡a)
Ôö£ÔöÇÔöÇ tests/
Ôöé   ÔööÔöÇÔöÇ keyboard-navigation.spec.ts   # Validaci├│n autom├ítica (Playwright)
Ôö£ÔöÇÔöÇ audit-runner.js           # Script de auditor├¡a WCAG/MinTIC
Ôö£ÔöÇÔöÇ instrumento_auditoria_v1.json
Ôö£ÔöÇÔöÇ backlog.md                # Lista de tareas priorizadas
ÔööÔöÇÔöÇ CHANGELOG.md
```

## A├▒adir nuevas escenas y hotspots

1. Copia tu imagen equirectangular a `panoramas/`.
2. Declara la escena en `config.json` con los campos obligatorios:

```jsonc
{
  "id": "laboratorio-innovacion",
  "title": "Laboratorio de Innovaci├│n",
  "file": "laboratorio.jpg",
  "zone": "laboratorios",
  "order": 3,
  "altText": "Descripci├│n corta de la escena.",
  "longDescription": "Descripci├│n larga anunciada por lectores de pantalla.",
  "narration": "assets/audio/placeholder.mp3",
  "transcript": "assets/transcripts/laboratorio.txt",
  "captionFile": "assets/captions/laboratorio.vtt",
  "hotspots": [
    {
      "id": "estacion-robotica",
      "title": "Estaci├│n rob├│tica",
      "yaw": 0.8,
      "pitch": 0.1,
      "altText": "Brazo rob├│tico interactivo sobre mesa.",
      "description": "Explica la funcionalidad del punto de inter├®s.",
      "narration": "assets/audio/placeholder.mp3",
      "transcript": "assets/transcripts/hotspot-estacion-robotica.txt",
      "captionFile": "assets/captions/hotspot-estacion-robotica.vtt",
      "icon": "­ƒñû"
    }
  ]
}
```

3. Crea los archivos de audio (MP3), transcripci├│n (TXT) y subt├¡tulos (VTT). Los placeholders actuales facilitan la integraci├│n inicial.
4. Si la escena pertenece a una nueva zona, declara el r├│tulo accesible en `config.zones`.
5. Ejecuta `npm run audit` para confirmar el cumplimiento.

## Modo edici├│n de hotspots

1. Activa el modo con `Ctrl + Shift + H`. Los hotspots mostrar├ín un contorno amarillo y el cursor cambiar├í a ÔÇ£dragÔÇØ.
2. Mientras el modo est├í activo, el panorama queda bloqueado al rat├│n para evitar giros accidentales; utiliza las flechas del teclado (y `+` / `-` para zoom) para ajustar el encuadre antes de mover un punto.
3. Arrastra el hotspot sobre la imagen para reubicarlo. Al soltar, la nueva posici├│n se guarda en `localStorage`.
4. Presiona `Ctrl + Shift + E` para descargar `hotspot-overrides.json` (contiene **todas** las escenas editadas). Coloca este archivo en la ra├¡z del proyecto para que se cargue autom├íticamente en cualquier navegador.
5. Desactiva el modo edici├│n con la misma combinaci├│n (`Ctrl + Shift + H`).

## Sustituir audios y subt├¡tulos

- Reemplaza narraciones placeholder por grabaciones reales bajo `media/unisimoncucuta/experienciavirtual/assets/audio/…` (o actualiza las rutas en el config del tour).
- Genera subt├¡tulos `.vtt` con al menos dos l├¡neas de tiempo.
- Actualiza las transcripciones en `assets/transcripts/`.
- Para personalizar ubicaciones de hotspots sin tocar `config.json`, edita en el navegador y sobrescribe `hotspot-overrides.json` con el archivo descargado (mant├®n el nombre para que se cargue autom├íticamente).

## Demo y reporte

- `demo.html` contiene pasos guiados para la demostraci├│n r├ípida y accesos directos relevantes.
- `reports/audit-report.html` muestra el consolidado de criterios AÔÇôH con sem├íforos.

## Notas sobre accesibilidad

- La interfaz implementa los principios POUR: perceivable (descripciones y subt├¡tulos), operable (teclado y skip-links), understandable (mensajes claros) y robust (roles ARIA, live regions).
- El modo de alto contraste y el ajuste de fuente usan variables CSS para evitar p├®rdida de informaci├│n.
- El fallback sin JavaScript incluye imagen est├ítica, figcaption y enlace directo a transcripci├│n.
- Cuando un audio no est├í disponible, el sistema genera autom├íticamente una audiodescripci├│n mediante s├¡ntesis de voz en espa├▒ol.

## Pr├│ximos pasos sugeridos

Revisa `backlog.md` para conocer tareas de mayor impacto: sustituci├│n de audios reales, ampliaci├│n de pruebas autom├íticas con lectores de pantalla y soporte m├│vil avanzado.

