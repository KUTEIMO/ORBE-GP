/**
 * Subcutáneo de Audio Guía Espacial y Narración Descriptiva (WCAG 2.1 AA / KAN-19).
 * Gestiona la reproducción de audiodescripciones MP3 de escenas y puntos de interés,
 * con fallback honesto a Web Speech API (síntesis de voz) y atajo de teclado 'M'.
 */
import { appState, getSetting, updateSetting } from './state.js';
import { sceneAudioPath } from './a11yPaths.js';

let sceneAudioEl = null;
let currentPlayingSceneId = null;
let isAudioActive = false;
let speechUtterance = null;
let liveAnnounceTimer = null;
let viewerApiRef = null;

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

  audio.addEventListener('ended', () => {
    isAudioActive = false;
    updateAudioUiState(false);
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

export async function playSceneNarration(sceneData, options = {}) {
  const target = sceneData || getCurrentSceneData();
  if (!target) return;

  const audio = getAudioElement();
  const sceneId = target.id;
  currentPlayingSceneId = sceneId;

  // Ruta canónica del MP3 en media
  const audioUrl = target.narration || sceneAudioPath(sceneId);

  stopSpeech();
  audio.pause();
  audio.currentTime = 0;
  audio.src = audioUrl;

  isAudioActive = true;
  updateAudioUiState(true, target.title);

  try {
    await audio.play();
    announceStatus(`Reproduciendo audio guía: ${target.title}`);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.warn('[sceneAudio] Autoplay pausado por el navegador hasta interacción del usuario.');
      isAudioActive = false;
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
  updateAudioUiState(false);
  announceStatus('Audio guía pausada.');
}

export function stopSceneNarration() {
  const audio = getAudioElement();
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  stopSpeech();
  isAudioActive = false;
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

function fallbackSpeechNarration(sceneData) {
  if (!('speechSynthesis' in window)) {
    isAudioActive = false;
    updateAudioUiState(false);
    return;
  }
  stopSpeech();

  const textToRead = sceneData.srSummary || sceneData.altText || sceneData.longDescription || sceneData.title || 'Recinto del campus.';
  speechUtterance = new SpeechSynthesisUtterance(textToRead);
  speechUtterance.lang = 'es-ES';
  speechUtterance.rate = 0.95;

  speechUtterance.onend = () => {
    isAudioActive = false;
    updateAudioUiState(false);
  };

  speechUtterance.onerror = () => {
    isAudioActive = false;
    updateAudioUiState(false);
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
    btnPanel.innerHTML = isPlaying
      ? '<span aria-hidden="true">⏸</span> Pausar audio guía de esta escena'
      : '<span aria-hidden="true">🔊</span> Escuchar audio guía de esta escena (M)';
    btnPanel.classList.toggle('toolbar-button--active', isPlaying);
  }

  const statusEl = document.getElementById('sceneAudioStatus');
  if (statusEl) {
    if (isPlaying) {
      statusEl.textContent = `🔊 Reproduciendo narración: ${customText || 'escena'}`;
      statusEl.style.color = '#38bdf8';
    } else {
      statusEl.textContent = customText ? customText : 'Audio guía en pausa (Presiona M para escuchar)';
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
