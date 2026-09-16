/**
 * Canal 1 — anuncios cortos de estado/navegación (live regions dedicadas).
 * No usar #tourApp como live region global.
 */

let sceneAnnounceTimer = null;

function updateLiveRegion(element, message) {
  if (!element) return;
  element.textContent = '';
  requestAnimationFrame(() => {
    element.textContent = message;
  });
}

/** Short scene enter announcement (title + optional one-line summary). */
export function announceScene(message) {
  const region = document.getElementById('sceneAnnouncement');
  if (sceneAnnounceTimer) {
    clearTimeout(sceneAnnounceTimer);
    sceneAnnounceTimer = null;
  }
  // Debounce rapid scene hops so SR is not flooded.
  sceneAnnounceTimer = setTimeout(() => {
    updateLiveRegion(region, message);
    sceneAnnounceTimer = null;
  }, 80);
}

export function announceHotspot(message) {
  const region = document.getElementById('hotspotAnnouncement');
  updateLiveRegion(region, message);
}

/**
 * Prefer srSummary / shortTitle; never dump longDescription into the live region.
 */
export function buildSceneAnnouncement(sceneData) {
  if (!sceneData) return 'Escena actualizada.';
  const title = sceneData.shortTitle || sceneData.title || 'Escena';
  const summary =
    sceneData.srSummary ||
    sceneData.altText ||
    null;
  if (summary && summary !== title) {
    const short = String(summary).trim();
    const clipped = short.length > 160 ? `${short.slice(0, 157)}…` : short;
    return `${title}. ${clipped}`;
  }
  return `Escena: ${title}. Usa la lista de destinos o el menú de escenas para continuar.`;
}
