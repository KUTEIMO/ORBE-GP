/**
 * Shared stop hook for audio / speechSynthesis so Escape, backdrop,
 * scene changes and the hotspot panel share one close path.
 */

let stopHandler = null;

export function registerMediaSessionStop(handler) {
  stopHandler = typeof handler === 'function' ? handler : null;
}

export function stopActiveMedia() {
  if (typeof stopHandler === 'function') {
    stopHandler();
  }
}
