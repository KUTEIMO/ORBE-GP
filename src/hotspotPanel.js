import { getSetting, appState } from './state.js';
import { dismissOpenLayers, trapFocusWithin } from './uiLayers.js';
import { registerMediaSessionStop } from './mediaSession.js';
import { resolveNarrationUrl } from './configLoader.js';
import { pauseSceneNarration } from './sceneAudio.js';

let lastFocusedElement = null;
let currentHotspot = null;
let currentScene = null;
let speechUtterance = null;
let speechPaused = false;
let hasRealNarration = false;

const panel = () => document.getElementById('hotspotPanel');
const summary = () => document.getElementById('hotspotSummary');
const transcriptLink = () => document.getElementById('transcriptDownload');
const audioElement = () => document.getElementById('hotspotAudio');
const audioStatus = () => document.getElementById('audioStatus');
const captionContainer = () => document.getElementById('captionContainer');

export function initHotspotPanel() {
  const closeButton = document.getElementById('closeHotspotPanel');
  const toggleCaptions = document.getElementById('toggleCaptions');
  const volumeSlider = document.getElementById('audioVolume');
  const panelElement = panel();
  hideCaptions();

  registerMediaSessionStop(() => {
    forceStop();
  });

  if (closeButton) {
    // `true`: el panel es un diálogo modal, cerrarlo debe devolver el foco al
    // hotspot/chip que lo abrió en lugar de dejarlo en el <body>.
    closeButton.addEventListener('click', () => closePanel(true));
  }

  if (panelElement) {
    // Evita que un toque en el panel se interprete como clic en el visor/backdrop.
    panelElement.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });

    panelElement.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePanel(true);
      } else if (event.key === 'Tab') {
        trapFocusWithin(panelElement, event);
      }
    });
  }

  document.querySelectorAll('[data-audio-action]').forEach((button) => {
    button.addEventListener('click', () => handleAudioAction(button.dataset.audioAction));
  });

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (event) => {
      const audio = audioElement();
      if (!audio) return;
      audio.volume = parseFloat(event.target.value);
      setAudioStatus(`Volumen ajustado a ${(audio.volume * 100).toFixed(0)}%`);
    });
  }

  if (toggleCaptions) {
    toggleCaptions.addEventListener('click', () => toggleCaptionVisibility());
  }
}

/** Stop audio + speech without mutating panel visibility (idempotent). */
export function forceStop() {
  const audio = audioElement();
  if (audio) {
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch (_error) {
      /* ignore */
    }
  }
  stopSpeech();
}

export async function openHotspotPanel(sceneData, hotspotData, { focusPanel = false, autoNarration = true } = {}) {
  currentScene = sceneData;
  currentHotspot = hotspotData;
  forceStop();
  try {
    pauseSceneNarration();
  } catch (_e) {
    /* ignore */
  }

  const panelElement = panel();
  if (!panelElement) return;

  lastFocusedElement = document.activeElement;
  panelElement.removeAttribute('hidden');
  panelElement.setAttribute('aria-hidden', 'false');
  panelElement.classList.add('hotspot-panel--open');

  updatePanelContent(sceneData, hotspotData);

  if (focusPanel) {
    requestAnimationFrame(() => {
      panelElement.querySelector('.close-button')?.focus();
    });
  }

  // Reproducir narración del hotspot inmediatamente
  const wantAuto = autoNarration ?? (getSetting('autoNarration') || appState?.accessibleMode || true);
  if (wantAuto) {
    const ready = await waitForNarrationReady(1200);
    if (ready) {
      await playAudio();
    } else {
      // Síntesis de voz directa si el archivo tarda o no está disponible
      startSpeechFallback({ asPrimaryAudio: false });
    }
  }

  if (getSetting('autoCaptions') || appState?.accessibleMode) {
    await showCaptions();
  } else {
    hideCaptions();
  }
}

/**
 * Wait until audio element can play, or timeout (missing file → false).
 * @param {number} timeoutMs
 */
function waitForNarrationReady(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const audio = audioElement();
    const narration = resolveNarrationUrl(
      currentHotspot?.narration || currentScene?.narration
    );
    if (!narration || !audio) {
      resolve(false);
      return;
    }
    if (hasRealNarration && audio.src) {
      resolve(true);
      return;
    }
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('error', onError);
      resolve(value);
    };
    const onCanPlay = () => done(true);
    const onError = () => done(false);
    const timer = setTimeout(() => done(hasRealNarration), timeoutMs);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('error', onError);
  });
}

export function closePanel(restoreFocus = false) {
  const panelElement = panel();
  if (!panelElement) return;

  forceStop();
  hideCaptions();
  panelElement.setAttribute('hidden', 'hidden');
  panelElement.setAttribute('aria-hidden', 'true');
  panelElement.classList.remove('hotspot-panel--open');
  dismissOpenLayers();

  if (restoreFocus && lastFocusedElement) {
    lastFocusedElement.focus();
  }
}

function updatePanelContent(sceneData, hotspotData) {
  if (summary()) {
    summary().textContent =
      hotspotData.srSummary ||
      hotspotData.description ||
      sceneData.srSummary ||
      sceneData.longDescription;
  }

  const captions = captionContainer();
  if (captions) {
    captions.innerHTML = '';
    captions.dataset.visible = 'false';
    captions.hidden = true;
  }
  const toggleButton = document.getElementById('toggleCaptions');
  if (toggleButton) {
    toggleButton.textContent = 'Mostrar subtítulos';
  }

  if (transcriptLink()) {
    const transcript = hotspotData.transcript || sceneData.transcript;
    if (transcript) {
      transcriptLink().href = transcript;
      transcriptLink().removeAttribute('aria-disabled');
    } else {
      transcriptLink().removeAttribute('href');
      transcriptLink().setAttribute('aria-disabled', 'true');
    }
  }

  const audio = audioElement();
  const narration = resolveNarrationUrl(hotspotData.narration || sceneData.narration);
  hasRealNarration = false;
  setAudioControlsEnabled(false);

  if (audio) {
    stopSpeech();
    audio.oncanplay = null;
    audio.onerror = null;
    if (narration) {
      audio.src = narration;
      audio.setAttribute('data-caption', hotspotData.captionFile || sceneData.captionFile || '');
      const timingRef = hotspotData.timingFile || sceneData.timingFile || '';
      if (timingRef) audio.setAttribute('data-timing', timingRef);
      else audio.removeAttribute('data-timing');
      setAudioStatus('Comprobando archivo de audiodescripción…');
      audio.oncanplay = () => {
        hasRealNarration = true;
        setAudioControlsEnabled(true);
        setAudioStatus('Audio listo para reproducirse.');
      };
      audio.onerror = () => {
        hasRealNarration = false;
        try {
          audio.removeAttribute('src');
          audio.load();
        } catch (_error) {
          /* ignore */
        }
        setAudioControlsEnabled(false);
        setAudioStatus(
          'No hay archivo de audiodescripción para este punto (ruta reservada para TTS/grabación). Puedes usar la síntesis de voz del navegador o la transcripción si está disponible.'
        );
      };
      audio.load();
    } else {
      audio.removeAttribute('src');
      audio.removeAttribute('data-caption');
      audio.removeAttribute('data-timing');
      setAudioStatus(
        'No hay archivo de audiodescripción para este punto. Puedes usar la síntesis de voz del navegador o la transcripción si está disponible.'
      );
    }
  }
}

function setAudioControlsEnabled(enabled) {
  document.querySelectorAll('[data-audio-action]').forEach((button) => {
    button.disabled = !enabled && button.dataset.audioAction !== 'play';
    // Play stays enabled so user can try speech fallback; label honesty via status.
    if (button.dataset.audioAction === 'play') {
      button.disabled = false;
      button.setAttribute(
        'aria-label',
        enabled ? 'Reproducir audiodescripción' : 'Reproducir descripción con síntesis de voz'
      );
    } else {
      button.disabled = !enabled && !speechUtterance;
    }
  });
  const volume = document.getElementById('audioVolume');
  if (volume) volume.disabled = !enabled;
}

function handleAudioAction(action) {
  switch (action) {
    case 'play':
      playAudio();
      break;
    case 'pause':
      pauseAudio();
      break;
    case 'stop':
      stopAudio();
      break;
    default:
      break;
  }
}

async function playAudio() {
  const audio = audioElement();
  if (hasRealNarration && audio?.src) {
    try {
      stopSpeech();
      await audio.play();
      setAudioStatus('Reproduciendo audiodescripción.');
      setAudioControlsEnabled(true);
      return;
    } catch (error) {
      console.warn('No se pudo reproducir el audio; se usará síntesis de voz.', error);
    }
  }

  startSpeechFallback({ asPrimaryAudio: false });
}

function pauseAudio() {
  const audio = audioElement();
  if (audio && !audio.paused && !audio.ended) {
    audio.pause();
    setAudioStatus('Audiodescripción en pausa.');
    return;
  }
  pauseSpeech();
  if (speechUtterance) {
    setAudioStatus('Síntesis de voz en pausa.');
  }
}

function stopAudio() {
  forceStop();
  setAudioStatus(hasRealNarration ? 'Audiodescripción detenida.' : 'Síntesis de voz detenida.');
}

function setAudioStatus(message) {
  const status = audioStatus();
  if (!status) return;
  status.textContent = '';
  requestAnimationFrame(() => {
    status.textContent = message;
  });
}

async function toggleCaptionVisibility() {
  const container = captionContainer();
  const toggleButton = document.getElementById('toggleCaptions');
  if (!container) return;
  if (container.dataset.visible === 'true') {
    hideCaptions();
    if (toggleButton) toggleButton.textContent = 'Mostrar subtítulos';
  } else {
    await showCaptions();
    if (toggleButton) toggleButton.textContent = 'Ocultar subtítulos';
  }
}

async function showCaptions() {
  const container = captionContainer();
  const toggleButton = document.getElementById('toggleCaptions');
  if (!container) return;

  const captionFile = currentHotspot?.captionFile || currentScene?.captionFile;
  if (!captionFile) {
    container.textContent = 'No hay subtítulos disponibles para este recurso.';
    container.dataset.visible = 'true';
    container.hidden = false;
    return;
  }

  try {
    const response = await fetch(captionFile);
    if (!response.ok) throw new Error(`No se pudo cargar ${captionFile}`);
    const text = await response.text();
    container.replaceChildren(buildCaptionList(text));
    container.dataset.visible = 'true';
    container.hidden = false;
    if (toggleButton) toggleButton.textContent = 'Ocultar subtítulos';
  } catch (error) {
    console.error(error);
    container.textContent = 'Error al cargar los subtítulos.';
    container.dataset.visible = 'true';
    container.hidden = false;
    if (toggleButton) toggleButton.textContent = 'Ocultar subtítulos';
  }
}

function hideCaptions() {
  const container = captionContainer();
  if (!container) return;
  container.hidden = true;
  container.dataset.visible = 'false';
  const toggleButton = document.getElementById('toggleCaptions');
  if (toggleButton) toggleButton.textContent = 'Mostrar subtítulos';
}

/** Build caption DOM with textContent (no innerHTML / XSS). */
function buildCaptionList(vttText) {
  const lines = vttText
    .split('\n')
    .filter((line) => line.trim().length > 0 && !line.startsWith('WEBVTT'));
  const ul = document.createElement('ul');
  ul.className = 'caption-list';
  for (const line of lines) {
    const li = document.createElement('li');
    li.textContent = line;
    ul.appendChild(li);
  }
  return ul;
}

function startSpeechFallback({ asPrimaryAudio = false } = {}) {
  if (!currentHotspot) return;
  if (!('speechSynthesis' in window)) {
    setAudioStatus('No hay audiodescripción ni síntesis de voz disponible en este navegador.');
    return;
  }

  stopSpeech();
  const text = currentHotspot.description || currentScene?.longDescription || 'Descripción no disponible.';
  speechUtterance = new SpeechSynthesisUtterance(text);
  speechUtterance.lang = 'es-ES';
  speechUtterance.rate = 1;
  speechUtterance.pitch = 1;
  speechUtterance.onend = () => {
    speechUtterance = null;
    speechPaused = false;
    setAudioStatus('Síntesis de voz finalizada.');
  };
  speechUtterance.onerror = () => {
    speechUtterance = null;
    speechPaused = false;
    setAudioStatus('No se pudo reproducir la síntesis de voz.');
  };
  window.speechSynthesis.speak(speechUtterance);
  setAudioStatus(
    asPrimaryAudio
      ? 'Reproduciendo audiodescripción sintetizada.'
      : 'Reproduciendo descripción con síntesis de voz (no hay archivo de audio).'
  );
  document.querySelectorAll('[data-audio-action="pause"], [data-audio-action="stop"]').forEach((button) => {
    button.disabled = false;
  });
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  speechUtterance = null;
  speechPaused = false;
}

function pauseSpeech() {
  if (speechUtterance && !speechPaused && 'speechSynthesis' in window) {
    window.speechSynthesis.pause();
    speechPaused = true;
  }
}
