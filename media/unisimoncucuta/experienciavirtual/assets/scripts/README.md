# Guiones TTS (legacy mirror)

**Ruta canónica (usar esta):** `assets/accessibility/scripts/{scenes|hotspots}/{key}.md`

Esta carpeta `assets/scripts/` es un **espejo legacy** del lote TTS inicial. El pipeline Fase 3, `a11yPaths.js`, `a11y-package.json` y `npm run a11y:tts` escriben/leen primero en `assets/accessibility/scripts/`.

Al regenerar TTS (`npm run a11y:tts`) se escriben ambas ubicaciones para no romper referencias antiguas. Preferir siempre la ruta canónica en configs nuevas.
