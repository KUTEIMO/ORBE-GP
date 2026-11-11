/**
 * Subcutáneo de Audio Guía Espacial y Narración Descriptiva (WCAG 2.1 AA / KAN-19).
 * Gestiona la reproducción de audiodescripciones MP3 de escenas y puntos de interés,
 * con fallback honesto a Web Speech API (síntesis de voz) y atajo de teclado 'M'.
 */
import { appState } from './state.js';
import { sceneAudioPath, sceneCaptionPath } from './a11yPaths.js';
import { parseVtt } from './vttParser.js';

let sceneAudioEl = null;
let isAudioActive = false;
let speechUtterance = null;
let liveAnnounceTimer = null;
let viewerApiRef = null;
let sceneCues = [];
let captionLoadSeq = 0;
let isCaptionDismissedByUser = false;

function getAudioElement() {
  if (!sceneAudioEl) {
    sceneAudioEl = document.getElementById('sceneAudio');
    if (!sceneAudioEl) {
      sceneAudioEl = document.createElement('audio');
      sceneAudioEl.id = 'sceneAudio';
      sceneAudioEl.preload = 'metadata';
      document.body.appendChild(sceneAudioEl);
    }
  }
  return sceneAudioEl;
}

export function initSceneAudio(viewerApi) {
  viewerApiRef = viewerApi;
  const audio = getAudioElement();

  const btnHeader = document.getElementById('audioGuideToggle');
  if (btnHeader) {
    btnHeader.addEventListener('click', () => {
      toggleSceneAudio();
    });
  }

  const btnPanel = document.getElementById('playSceneAudioBtn');
  if (btnPanel) {
    btnPanel.addEventListener('click', () => {
      toggleSceneAudio();
    });
  }

  const closeCaptionBtn = document.getElementById('closeSceneCaptionBtn');
  if (closeCaptionBtn) {
    closeCaptionBtn.addEventListener('click', () => {
      isCaptionDismissedByUser = true;
      hideSceneCaptionOverlay();
    });
  }

  audio.addEventListener('timeupdate', () => {
    if (!isAudioActive || isCaptionDismissedByUser || sceneCues.length === 0) return;
    const ct = audio.currentTime;
    const activeCue =
      sceneCues.find((c) => ct >= c.start && ct <= c.end) ||
      sceneCues.find((c) => ct >= c.start && ct <= c.end + 0.8);
    if (activeCue) {
      updateSceneCaptionText(activeCue.text);
    }
  });

  audio.addEventListener('ended', () => {
    isAudioActive = false;
    updateAudioUiState(false);
    hideSceneCaptionOverlay();
  });

  audio.addEventListener('error', (e) => {
    console.warn('[sceneAudio] Archivo MP3 no disponible o error de carga, usando síntesis de voz fallback:', e);
    const currentScene = getCurrentSceneData();
    if (currentScene && isAudioActive) {
      fallbackSpeechNarration(currentScene);
    }
  });

  window.addEventListener('keydown', (event) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (event.key === 'm' || event.key === 'M') {
      event.preventDefault();
      toggleSceneAudio();
    }
  });
}

function getCurrentSceneData() {
  if (viewerApiRef?.getCurrentScene) {
    const sc = viewerApiRef.getCurrentScene();
    if (sc?.data) return sc.data;
  }
  if (appState.currentSceneId && appState.config?.accessibleScenes) {
    return appState.config.accessibleScenes[appState.currentSceneId];
  }
  return null;
}

async function loadSceneCaptions(target, seq) {
  sceneCues = [];
  const sceneId = target.id;
  const strictDb = Boolean(appState.config?.convexAuthoritative);
  const captionUrl = target.captionFile || (!strictDb && sceneId ? sceneCaptionPath(sceneId) : null);
  if (!captionUrl) return;

  try {
    const res = await fetch(captionUrl);
    if (seq !== captionLoadSeq) return;
    if (res.ok) {
      const vttText = await res.text();
      if (seq !== captionLoadSeq) return;
      sceneCues = parseVtt(vttText);
      if (sceneCues.length > 0 && isAudioActive && !isCaptionDismissedByUser) {
        updateSceneCaptionText(sceneCues[0].text);
        showSceneCaptionOverlay();
      }
    }
  } catch (err) {
    console.warn('[sceneAudio] No se pudieron cargar los subtítulos VTT de la escena:', err);
  }
}

export async function playSceneNarration(sceneData, _options = {}) {
  const target = sceneData || getCurrentSceneData();
  if (!target) return;

  const audio = getAudioElement();
  const sceneId = target.id;
  const seq = ++captionLoadSeq;
  isCaptionDismissedByUser = false;
  sceneCues = [];

  const strictDb = Boolean(appState.config?.convexAuthoritative);
  const audioUrl = target.narration || (!strictDb ? sceneAudioPath(sceneId) : null);

  stopSpeech();
  audio.pause();
  audio.currentTime = 0;

  isAudioActive = true;
  updateAudioUiState(true, target.title);

  if (!audioUrl) {
    fallbackSpeechNarration(target);
    loadSceneCaptions(target, seq);
    return;
  }

  audio.src = audioUrl;

  // Cargar y activar subtítulos sincronizados
  loadSceneCaptions(target, seq);

  try {
    await audio.play();
    announceStatus(`Reproduciendo audio guía: ${target.title}`);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.warn('[sceneAudio] Autoplay pausado por el navegador hasta interacción del usuario.');
      isAudioActive = false;
      hideSceneCaptionOverlay();
      updateAudioUiState(false, 'Haz clic para activar audio guía (M)');
    } else {
      console.warn('[sceneAudio] Error al reproducir audio, usando síntesis de voz:', err);
      fallbackSpeechNarration(target);
    }
  }
}

export function pauseSceneNarration() {
  const audio = getAudioElement();
  if (audio) {
    audio.pause();
  }
  stopSpeech();
  isAudioActive = false;
  hideSceneCaptionOverlay();
  updateAudioUiState(false);
  announceStatus('Audio guía pausada.');
}

export function stopSceneNarration() {
  captionLoadSeq += 1;
  sceneCues = [];
  const audio = getAudioElement();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopSpeech();
  isAudioActive = false;
  hideSceneCaptionOverlay();
  updateAudioUiState(false);
}

export function toggleSceneAudio(sceneDataOverride) {
  const audio = getAudioElement();
  const currentScene = sceneDataOverride || getCurrentSceneData();

  if (isAudioActive && (!audio.paused || (window.speechSynthesis && window.speechSynthesis.speaking))) {
    pauseSceneNarration();
  } else {
    if (currentScene) {
      playSceneNarration(currentScene, { userInitiated: true });
    }
  }
}

export function isAudioGuideActive() {
  return isAudioActive;
}

function showSceneCaptionOverlay() {
  const overlay = document.getElementById('sceneCaptionOverlay');
  if (overlay && !isCaptionDismissedByUser) {
    overlay.removeAttribute('hidden');
    overlay.setAttribute('aria-hidden', 'false');
  }
}

function hideSceneCaptionOverlay() {
  const overlay = document.getElementById('sceneCaptionOverlay');
  if (overlay) {
    overlay.setAttribute('hidden', 'hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }
}

function updateSceneCaptionText(text) {
  const captionTextEl = document.getElementById('sceneCaptionText');
  if (captionTextEl && text) {
    captionTextEl.textContent = text;
    showSceneCaptionOverlay();
  }
}

function fallbackSpeechNarration(sceneData) {
  if (!('speechSynthesis' in window)) {
    isAudioActive = false;
    updateAudioUiState(false);
    hideSceneCaptionOverlay();
    return;
  }
  stopSpeech();

  const textToRead =
    sceneData.srSummary ||
    sceneData.altText ||
    sceneData.longDescription ||
    sceneData.title ||
    'Recinto del campus.';

  updateSceneCaptionText(textToRead);
  showSceneCaptionOverlay();

  speechUtterance = new SpeechSynthesisUtterance(textToRead);
  speechUtterance.lang = 'es-CO';
  speechUtterance.rate = 0.95;

  speechUtterance.onend = () => {
    isAudioActive = false;
    updateAudioUiState(false);
    hideSceneCaptionOverlay();
  };

  speechUtterance.onerror = () => {
    isAudioActive = false;
    updateAudioUiState(false);
    hideSceneCaptionOverlay();
  };

  isAudioActive = true;
  updateAudioUiState(true, sceneData.title);
  window.speechSynthesis.speak(speechUtterance);
  announceStatus(`Reproduciendo descripción por voz: ${sceneData.title}`);
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function updateAudioUiState(isPlaying, customText) {
  const btnHeader = document.getElementById('audioGuideToggle');
  if (btnHeader) {
    btnHeader.classList.toggle('action-button--active', isPlaying);
    btnHeader.setAttribute('aria-pressed', String(isPlaying));
    btnHeader.setAttribute('aria-label', isPlaying ? 'Silenciar audio guía (tecla M)' : 'Activar audio guía descriptiva (tecla M)');
    btnHeader.title = isPlaying ? 'Silenciar audio guía (M)' : 'Activar audio guía (M)';
  }

  const btnPanel = document.getElementById('playSceneAudioBtn');
  if (btnPanel) {
    const pauseSvg = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
    const speakerSvg = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>';
    btnPanel.innerHTML = isPlaying
      ? `${pauseSvg}<span>Pausar audio guía de esta escena</span>`
      : `${speakerSvg}<span>Escuchar audio guía de esta escena (M)</span>`;
    btnPanel.classList.toggle('toolbar-button--active', isPlaying);
  }

  const statusEl = document.getElementById('sceneAudioStatus');
  if (statusEl) {
    if (isPlaying) {
      statusEl.textContent = `Reproduciendo narración: ${customText || 'escena'}`;
      statusEl.classList.add('scene-audio-status--active');
      statusEl.style.color = '';
    } else {
      statusEl.textContent = customText ? customText : 'Audio guía en pausa (Presiona M para escuchar)';
      statusEl.classList.remove('scene-audio-status--active');
      statusEl.style.color = '';
    }
  }
}

function announceStatus(msg) {
  const region = document.getElementById('sceneAnnouncement') || document.getElementById('audioStatus');
  if (!region) return;
  if (liveAnnounceTimer) clearTimeout(liveAnnounceTimer);
  liveAnnounceTimer = setTimeout(() => {
    region.textContent = '';
    requestAnimationFrame(() => {
      region.textContent = msg;
    });
  }, 50);
}

