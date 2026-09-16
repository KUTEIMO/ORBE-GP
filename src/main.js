import { loadConfig } from './configLoader.js';
import {
  applyTourBranding,
  bootNeutralBrandingIfNeeded,
} from './tourBranding.js';
import { initViewer } from './viewer.js';
import { initMenu } from './menu.js';
import { initAccessibilityControls, openHelpDialog, applyInitialAccessibilityState } from './accessibility.js';
import { initFallback } from './fallback.js';
import { initHotspotPanel, openHotspotPanel } from './hotspotPanel.js';
import { initKeyboardControls } from './keyboardControls.js';
import { initNavigation, updateNavigation } from './navigation.js';
import { appState, selectors } from './state.js';
import { focusFirstHotspot } from './hotspotManager.js';
import { initHotspotEditing, hydrateHotspotOverrides } from './hotspotEditing.js';
import { bindGlobalUiGuards, openExclusive, openSceneMenu } from './uiLayers.js';
import { stopActiveMedia } from './mediaSession.js';
import { DEFAULT_TOUR_SLUG } from './tourSlug.js';

// Early paint: public tour paths use neutral gray until Convex TourBranding.
bootNeutralBrandingIfNeeded();

document.addEventListener('DOMContentLoaded', () => {
  bootNeutralBrandingIfNeeded();
  startApp().catch(handleFatalError);
});

async function startApp() {
  initFallback();
  initHotspotPanel();
  bindGlobalUiGuards();

  const config = await loadConfig();
  appState.config = config;
  window.appState = appState;
  // Aggressive re-apply after full merge (Convex TourBranding wins; never Orbe Soft Clay).
  const paintClientBrand = () =>
    applyTourBranding(config.branding, { tourSlug: config.tourSlug });
  paintClientBrand();
  requestAnimationFrame(paintClientBrand);
  requestAnimationFrame(() => requestAnimationFrame(paintClientBrand));
  hydrateHotspotOverrides(config.overrides || {});

  let viewerApi = null;
  viewerApi = initViewer(config, {
    onViewerReady: (api) => {
      initKeyboardControls(api);
      initNavigation(config, api);
      initHotspotEditing();
    },
    onSceneChange: (sceneData) => {
      stopActiveMedia();
      const hotspotPanelEl = document.getElementById('hotspotPanel');
      if (hotspotPanelEl && !hotspotPanelEl.hasAttribute('hidden')) {
        hotspotPanelEl.setAttribute('hidden', 'hidden');
        hotspotPanelEl.setAttribute('aria-hidden', 'true');
        hotspotPanelEl.classList.remove('hotspot-panel--open');
      }
      updateNavigation(sceneData.id);
      updateKeyboardInstructions(sceneData);
      updateShareLink();
      if (viewerApi) {
        updateSceneDestinations(sceneData, viewerApi);
      }
    },
    onHotspotOpen: (sceneData, hotspotData, options) => {
      openExclusive('hotspot');
      openHotspotPanel(sceneData, hotspotData, options);
    }
  });

  initMenu(config, viewerApi);
  initAccessibilityControls(config);
  applyInitialAccessibilityState();
  setupShareDialog();
  setupHelpAndInstructions(config);
  setupAdminEntryPoints();
  updateNavigation(appState.currentSceneId);
  updateShareLink();
  const current = viewerApi.getCurrentScene()?.data;
  if (current) updateSceneDestinations(current, viewerApi);

  const skipHotspots = document.getElementById('skipHotspots');
  if (skipHotspots) {
    skipHotspots.addEventListener('click', (event) => {
      event.preventDefault();
      focusFirstHotspot();
    });
  }

  const skipMenu = document.getElementById('skipMenu');
  if (skipMenu) {
    skipMenu.addEventListener('click', (event) => {
      event.preventDefault();
      // Apertura centralizada: gestiona backdrop, `inert` del visor y foco.
      const firstSceneButton = document.querySelector('.scene-button');
      openSceneMenu({
        focusTarget: firstSceneButton instanceof HTMLElement ? firstSceneButton : 'first',
      });
    });
  }
}

function updateKeyboardInstructions(sceneData) {
  const container = document.getElementById('keyboardInstructions');
  if (!container) return;

  const instructions = sceneData.keyboardShortcuts || [];
  const fallback = 'Usa las flechas para rotar, + y - para zoom, y Tab para navegar por los controles.';

  container.textContent = instructions.length > 0 ? instructions.join(' • ') : fallback;
  if (!container.hasAttribute('data-manual')) {
    container.setAttribute('hidden', '');
  }
}

function handleFatalError(error) {
  console.error('Error crítico en la aplicación', error);
  const fallback = document.getElementById('noJsMessage');
  if (fallback) {
    fallback.removeAttribute('hidden');
    fallback.style.display = 'block';
    fallback.innerHTML = `
      <h2>Ocurrió un error al iniciar el tour</h2>
      <p>${error.message}</p>
      <p>Revisa el archivo README para más información o vuelve a intentarlo.</p>
    `;
  }
}

function setupShareDialog() {
  const openButton = document.getElementById('shareButton');
  const dialog = document.getElementById('shareDialog');
  const closeButton = document.getElementById('closeShareDialog');
  const copyButton = document.getElementById('copyShareLink');
  const input = document.getElementById('shareInput');
  const status = document.getElementById('shareStatus');
  if (!openButton || !dialog || !closeButton || !copyButton || !input) return;

  const openDialog = () => {
    updateShareLink();
    dialog.showModal();
    status.textContent = '';
    requestAnimationFrame(() => {
      input.select();
    });
  };

  openButton.addEventListener('click', () => {
    openExclusive('share');
    openDialog();
  });

  closeButton.addEventListener('click', () => {
    dialog.close();
    openButton.focus();
  });

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    dialog.close();
    openButton.focus();
  });

  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(input.value);
      status.textContent = 'Enlace copiado al portapapeles.';
    } catch (error) {
      console.warn('No se pudo copiar automáticamente.', error);
      status.textContent = 'No se pudo copiar automáticamente. Selecciona y copia el texto.';
    }
  });
}

function updateShareLink() {
  const input = document.getElementById('shareInput');
  if (!input) return;
  const url = new URL(window.location.href);
  const slug =
    appState.config?.tourSlug ||
    window.__ORBE_TOUR_SLUG__ ||
    DEFAULT_TOUR_SLUG;
  if (slug) {
    url.searchParams.set('slug', slug);
  }
  if (appState.currentSceneId) {
    url.searchParams.set('scene', appState.currentSceneId);
  } else {
    url.searchParams.delete('scene');
  }
  input.value = url.toString();
}

/**
 * Capa semántica de escena: lista completa de destinos + POI (sin tope artificial).
 * Ruta primaria para SR / teclado sin manipular el panorama.
 */
function updateSceneDestinations(sceneData, viewerApi) {
  const list = document.getElementById('hotspotList');
  if (!list) return;
  list.innerHTML = '';
  list.setAttribute('aria-label', 'Destinos y puntos de interés de la escena');

  const navs = (sceneData.navigationHotspots || []).filter(
    (item, index, arr) => arr.findIndex((x) => x.target === item.target) === index
  );

  const infoHotspots = (sceneData.hotspots || []).filter((h) => h.type === 'info');

  if (navs.length === 0 && infoHotspots.length === 0) {
    list.hidden = true;
    return;
  }

  list.hidden = false;

  navs.forEach((nav) => {
    const targetScene = appState.config.scenes.find((s) => s.id === nav.target);
    const label = targetScene?.shortTitle || nav.title || 'Destino';
    const item = document.createElement('li');
    item.className = 'hotspot-inline-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot-inline-button';
    button.textContent = label;
    button.setAttribute('aria-label', `Ir a ${label}`);
    button.addEventListener('click', () => viewerApi.switchScene(nav.target));
    item.appendChild(button);
    list.appendChild(item);
  });

  infoHotspots.forEach((hotspot) => {
    const label = hotspot.shortLabel || hotspot.title || 'Punto de interés';
    const item = document.createElement('li');
    item.className = 'hotspot-inline-item hotspot-inline-item--info';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'hotspot-inline-button';
    button.textContent = label;
    button.setAttribute('aria-label', `Abrir detalle: ${label}`);
    button.addEventListener('click', () => {
      openExclusive('hotspot');
      openHotspotPanel(sceneData, hotspot, { focusPanel: true });
    });
    item.appendChild(button);
    list.appendChild(item);
  });
}

function setupHelpAndInstructions(config) {
  const infoButton = document.getElementById('helpToggle');
  if (!infoButton) return;

  infoButton.addEventListener('click', (event) => {
    event.preventDefault();
    openExclusive('help');
    if (typeof openHelpDialog === 'function') {
      openHelpDialog(config);
    }
  });
}

/**
 * Engranaje → solo visible con sesión admin (evita fuga Control Web al visitante).
 * ORB → landing plataforma.
 */
function setupAdminEntryPoints() {
  const adminLink = document.getElementById('adminLink');
  const platformLink = document.getElementById('platformLink');
  const session = localStorage.getItem('orbe360.session');

  if (adminLink) {
    if (session) {
      adminLink.hidden = false;
      adminLink.removeAttribute('hidden');
      adminLink.setAttribute('href', 'control-web/index.html');
      adminLink.setAttribute('aria-label', 'Abrir panel de administración del tour');
    } else {
      adminLink.remove();
    }
  }

  if (platformLink) {
    platformLink.setAttribute('href', '/');
  }
}

