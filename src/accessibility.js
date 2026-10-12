import { appState, updateSetting, getSetting } from './state.js';
import { dismissOpenLayers, openExclusive, trapFocusWithin } from './uiLayers.js';
import { playSceneNarration, stopSceneNarration } from './sceneAudio.js';

const FONT_STEP = 0.1;
const FONT_MIN = 0.8;
const FONT_MAX = 1.6;
const STORAGE_KEY = 'tour.accessibilityPrefs';

let lastFocusedElement = null;
let storedSettings = loadStoredSettings();
let helpDialogOpener = null;
let storedConfig = null;

export function initAccessibilityControls(config) {
  storedConfig = config;
  setupTextSizeButtons();
  setupContrastButtons();
  setupAccessibleMode();
  setupAccessibilityPanel();
  helpDialogOpener = setupHelpDialog(config);
}

export function applyInitialAccessibilityState() {
  const settings = {
    textScale: storedSettings.textScale ?? 1,
    highContrast: storedSettings.highContrast ?? false,
    accessibleMode: storedSettings.accessibleMode ?? false,
    autoNarration: storedSettings.autoNarration ?? false,
    autoCaptions: storedSettings.autoCaptions ?? false
  };

  Object.assign(appState.settings, settings);
  applyFontScale(settings.textScale);
  applyContrast(settings.highContrast);
  applyAccessibleMode(settings.accessibleMode, { skipSync: true });
  updateSetting('autoNarration', settings.autoNarration);
  updateSetting('autoCaptions', settings.autoCaptions);

  syncToggle('accessibleModeToggle', settings.accessibleMode);
  syncToggle('textToSpeechToggle', settings.autoNarration);
  syncToggle('captionAutoToggle', settings.autoCaptions);
  syncContrastButtons(settings.highContrast);
  announceTextScale(settings.textScale, { silent: true });
}

/**
 * `checked` y `aria-checked` tienen que ir juntos.
 * Antes `aria-checked` sólo se escribía en el handler de `change`: al recargar
 * con la preferencia guardada activa, el control estaba marcado visualmente pero
 * el lector de pantalla seguía anunciando "no marcado".
 */
function syncToggle(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.checked = Boolean(value);
  if (el.getAttribute('role') === 'switch') {
    el.setAttribute('aria-checked', String(Boolean(value)));
  }
}

/** Estado del grupo de contraste como par de botones alternantes. */
function syncContrastButtons(highContrast) {
  document.querySelectorAll('[data-contrast]').forEach((button) => {
    const isActive = (button.dataset.contrast === 'high') === Boolean(highContrast);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

/** El tamaño de texto es un cambio no visual para un lector: hay que anunciarlo. */
function announceTextScale(scale, { silent = false } = {}) {
  const label = `${Math.round(scale * 100)}%`;
  document.querySelectorAll('[data-font-size]').forEach((button) => {
    button.setAttribute('aria-label', buildFontButtonLabel(button.dataset.fontSize, label));
  });
  if (silent) return;
  const region = document.getElementById('sceneAnnouncement');
  if (region) {
    region.textContent = '';
    requestAnimationFrame(() => {
      region.textContent = `Tamaño de texto: ${label}.`;
    });
  }
}

function buildFontButtonLabel(action, current) {
  if (action === 'increase') return `Aumentar tamaño de texto (actual ${current})`;
  if (action === 'decrease') return `Reducir tamaño de texto (actual ${current})`;
  return `Restablecer tamaño de texto al 100 % (actual ${current})`;
}

export function openHelpDialog(configOverride) {
  if (typeof helpDialogOpener === 'function') {
    helpDialogOpener(configOverride || storedConfig);
  }
}

function setupTextSizeButtons() {
  const buttons = document.querySelectorAll('[data-font-size]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const action = button.dataset.fontSize;
      const current = getSetting('textScale');
      let next = current;

      if (action === 'increase') {
        next = Math.min(FONT_MAX, current + FONT_STEP);
      } else if (action === 'decrease') {
        next = Math.max(FONT_MIN, current - FONT_STEP);
      } else if (action === 'reset') {
        next = 1;
      }

      updateSetting('textScale', next);
      applyFontScale(next);
      announceTextScale(next);
      persistSettings();
    });
  });
}

function applyFontScale(scale) {
  document.documentElement.style.setProperty('--font-scale', scale.toString());
}

function setupContrastButtons() {
  const buttons = document.querySelectorAll('[data-contrast]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const contrast = button.dataset.contrast;
      const highContrast = contrast === 'high';
      updateSetting('highContrast', highContrast);
      applyContrast(highContrast);
      syncContrastButtons(highContrast);
      persistSettings();
    });
  });
}

function applyContrast(highContrast) {
  document.body.classList.toggle('theme-high-contrast', highContrast);
}

function setupAccessibleMode() {
  const toggle = document.getElementById('accessibleModeToggle');
  if (toggle) {
    syncToggle('accessibleModeToggle', getSetting('accessibleMode'));
    toggle.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      syncToggle('accessibleModeToggle', enabled);
      applyAccessibleMode(enabled);
      persistSettings();
    });
  }

  const narrationToggle = document.getElementById('textToSpeechToggle');
  if (narrationToggle) {
    syncToggle('textToSpeechToggle', getSetting('autoNarration'));
    narrationToggle.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      syncToggle('textToSpeechToggle', enabled);
      updateSetting('autoNarration', enabled);
      if (enabled) {
        playSceneNarration();
      } else {
        stopSceneNarration();
      }
      persistSettings();
    });
  }

  const captionToggle = document.getElementById('captionAutoToggle');
  if (captionToggle) {
    syncToggle('captionAutoToggle', getSetting('autoCaptions'));
    captionToggle.addEventListener('change', (event) => {
      const enabled = event.target.checked;
      syncToggle('captionAutoToggle', enabled);
      updateSetting('autoCaptions', enabled);
      persistSettings();
    });
  }
}

function applyAccessibleMode(enabled, options = {}) {
  const skipSync = options.skipSync;
  document.body.classList.toggle('accessible-mode', enabled);
  updateSetting('accessibleMode', enabled);
  applyPanoramaSemantics(enabled);

  if (!skipSync) {
    if (enabled) {
      updateSetting('autoNarration', true);
      updateSetting('autoCaptions', true);
      updateSetting('highContrast', true);
      updateSetting('textScale', Math.min(FONT_MAX, Math.max(1.2, getSetting('textScale'))));
      applyFontScale(getSetting('textScale'));
      applyContrast(true);
      syncToggle('textToSpeechToggle', true);
      syncToggle('captionAutoToggle', true);
      syncContrastButtons(true);
      announceTextScale(getSetting('textScale'), { silent: true });
      playSceneNarration();
    } else {
      updateSetting('autoNarration', false);
      updateSetting('autoCaptions', false);
      updateSetting('highContrast', false);
      updateSetting('textScale', 1);
      applyFontScale(1);
      applyContrast(false);
      syncToggle('textToSpeechToggle', false);
      syncToggle('captionAutoToggle', false);
      syncContrastButtons(false);
      announceTextScale(1, { silent: true });
      stopSceneNarration();
    }
    persistSettings();
  }
}

/**
 * T-P0-4: prefer role=region (safer for TalkBack virtual cursor).
 * Accessible mode keeps region and nudges focus toward semantic lists.
 * Sighted keyboard rotation still works via tabindex=0 + keyboardControls.
 */
function applyPanoramaSemantics(accessibleMode) {
  const panorama = document.getElementById('panorama');
  if (!panorama) return;
  panorama.setAttribute('role', 'region');
  panorama.setAttribute(
    'aria-label',
    accessibleMode
      ? 'Visor 360 grados. Modo accesible: usa la lista de destinos o el menú de escenas; el panorama no es la ruta principal.'
      : 'Visor 360 grados. Usa las flechas del teclado para rotar; para recorrer sin arrastrar, usa la lista de destinos debajo o el menú de escenas.'
  );
  if (accessibleMode) {
    const list = document.getElementById('hotspotList');
    if (list && !list.hidden) {
      // Soft hint only — do not steal focus on every toggle.
      panorama.setAttribute('aria-describedby', 'hotspotList');
    }
  } else {
    panorama.removeAttribute('aria-describedby');
  }
}

function setupAccessibilityPanel() {
  const openButton = document.getElementById('accessibilityToggle');
  const panel = document.getElementById('accessibilityMenu');
  const closeButton = document.getElementById('closeAccessibility');

  if (!openButton || !panel || !closeButton) return;

  openButton.addEventListener('click', () => {
    const expanded = openButton.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      closePanel(openButton, panel);
    } else {
      openExclusive('accessibility');
      openPanel(openButton, panel, closeButton);
    }
  });

  closeButton.addEventListener('click', () => closePanel(openButton, panel));

  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePanel(openButton, panel, true);
    } else if (event.key === 'Tab') {
      trapFocusWithin(panel, event);
    }
  });
}

function openPanel(trigger, panel, closeButton) {
  lastFocusedElement = document.activeElement;
  trigger.setAttribute('aria-expanded', 'true');
  panel.removeAttribute('hidden');
  panel.classList.add('accessibility-menu--open');
  panel.focus();

  requestAnimationFrame(() => {
    closeButton.focus();
  });
}

function closePanel(trigger, panel, restoreFocus = false) {
  trigger.setAttribute('aria-expanded', 'false');
  panel.setAttribute('hidden', 'hidden');
  panel.classList.remove('accessibility-menu--open');
  dismissOpenLayers();

  if (restoreFocus && lastFocusedElement) {
    lastFocusedElement.focus();
  } else {
    trigger.focus();
  }
}

function setupHelpDialog(config) {
  const helpDialog = document.getElementById('helpDialog');
  const closeButton = document.getElementById('closeHelpDialog');
  const list = document.getElementById('helpShortcutsList');

  if (!helpDialog || !closeButton || !list) return null;

  const open = (conf = config) => {
    helpDialog.showModal();
    populateHelpShortcuts(list, conf);
    requestAnimationFrame(() => {
      closeButton.focus();
    });
  };

  closeButton.addEventListener('click', () => {
    helpDialog.close();
  });

  helpDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    helpDialog.close();
  });

  return open;
}

function populateHelpShortcuts(list, config) {
  list.innerHTML = '';
  const shortcuts = config?.shortcuts || [
    'Flechas ← →: rotar horizontalmente',
    'Flechas ↑ ↓: inclinar la vista',
    '+ / - : acercar y alejar',
    'Q / E: inclinar verticalmente',
    'Tab: navegar entre controles y hotspots'
  ];

  shortcuts.forEach((line) => {
    const item = document.createElement('li');
    item.textContent = line;
    list.appendChild(item);
  });
}

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.warn('No se pudieron cargar las preferencias de accesibilidad.', error);
    return {};
  }
}

function persistSettings() {
  storedSettings = {
    textScale: getSetting('textScale'),
    highContrast: getSetting('highContrast'),
    accessibleMode: getSetting('accessibleMode'),
    autoNarration: getSetting('autoNarration'),
    autoCaptions: getSetting('autoCaptions')
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSettings));
  } catch (error) {
    console.warn('No se pudieron guardar las preferencias de accesibilidad.', error);
  }
}

