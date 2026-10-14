/**
 * Parser de subtítulos WebVTT (WCAG 2.1 AA / KAN-19).
 * Convierte un archivo .vtt en un array de cues con { start, end, text }.
 */
export function parseVtt(vttContent) {
  if (!vttContent || typeof vttContent !== 'string') return [];
  const cues = [];
  const lines = vttContent.replace(/\r\n/g, '\n').split('\n');
  let currentStart = null;
  let currentEnd = null;
  let currentText = [];

  const timeRegex = /(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})/;

  function parseTime(h, m, s, ms) {
    const hours = h ? parseInt(h, 10) : 0;
    const minutes = parseInt(m, 10);
    const seconds = parseInt(s, 10);
    const millis = parseInt(ms, 10);
    return hours * 3600 + minutes * 60 + seconds + millis / 1000;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Comentarios o cabecera
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE')) {
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      if (currentStart !== null && currentText.length > 0) {
        cues.push({
          start: currentStart,
          end: currentEnd,
          text: currentText.join(' ').trim()
        });
        currentText = [];
      }
      currentStart = parseTime(match[1], match[2], match[3], match[4]);
      currentEnd = parseTime(match[5], match[6], match[7], match[8]);
    } else if (currentStart !== null) {
      if (line === '') {
        if (currentText.length > 0) {
          cues.push({
            start: currentStart,
            end: currentEnd,
            text: currentText.join(' ').trim()
          });
          currentStart = null;
          currentEnd = null;
          currentText = [];
        }
      } else {
        // Ignorar números de secuencia aislados
        if (/^\d+$/.test(line) && i + 1 < lines.length && timeRegex.test(lines[i + 1])) {
          continue;
        }
        currentText.push(line);
      }
    }
  }

  if (currentStart !== null && currentText.length > 0) {
    cues.push({
      start: currentStart,
      end: currentEnd,
      text: currentText.join(' ').trim()
    });
  }

  return cues;
}
