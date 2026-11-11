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
import { appState } from './state.js';
import { focusFirstHotspot } from './hotspotManager.js';
import { initHotspotEditing, hydrateHotspotOverrides } from './hotspotEditing.js';
import { bindGlobalUiGuards, openExclusive, openSceneMenu } from './uiLayers.js';
import { stopActiveMedia } from './mediaSession.js';
import {
  DEFAULT_TOUR_SLUG,
  controlWebHref,
  resolveOrgSlugFromBrowser,
  resolveTourSlugFromBrowser,
} from './tourSlug.js';
import { initSceneAudio, playSceneNarration, stopSceneNarration, isAudioGuideActive } from './sceneAudio.js';

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

  if (config.isEmpty) {
    ['audioGuideToggle', 'shareButton', 'wcagAuditToggle', 'helpToggle'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.hidden = true;
    });
    renderEmptyTourState(config);
    initAccessibilityControls(config);
    applyInitialAccessibilityState();
    setupAdminEntryPoints(config);
    return;
  }

  let viewerApi = null;
  let initialSceneRecorded = false;
  recordTourUsageMetric(config, 'view');
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
      if (initialSceneRecorded) {
        recordTourUsageMetric(config, 'scene');
      }
      initialSceneRecorded = true;
      if (appState.settings.autoNarration || appState.settings.accessibleMode || isAudioGuideActive()) {
        playSceneNarration(sceneData);
      } else {
        stopSceneNarration();
      }
    },
    onHotspotOpen: (sceneData, hotspotData, options) => {
      recordTourUsageMetric(config, 'hotspot');
      openExclusive('hotspot');
      openHotspotPanel(sceneData, hotspotData, options);
    }
  });

  initSceneAudio(viewerApi);
  initMenu(config, viewerApi);
  initAccessibilityControls(config);
  applyInitialAccessibilityState();
  setupShareDialog();
  setupHelpAndInstructions(config);
  setupAdminEntryPoints(config);
  if (config.isDraftPreview) {
    const headerTitleWrap = document.getElementById('sceneZone');
    if (headerTitleWrap && !headerTitleWrap.textContent.includes('Borrador')) {
      headerTitleWrap.textContent = `${headerTitleWrap.textContent} · Borrador privado (solo admin)`.replace(/^\s*·\s*/, '');
    }
  }
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
  document.body.classList.remove('no-js');
  const loader = document.getElementById('loadingOverlay');
  if (loader) loader.style.display = 'none';
  const fallback = document.getElementById('noJsMessage');
  if (fallback) {
    fallback.classList.remove('no-js-message');
    fallback.removeAttribute('hidden');
    fallback.style.position = 'fixed';
    fallback.style.inset = '0';
    fallback.style.margin = 'auto';
    fallback.style.height = 'fit-content';
    fallback.style.zIndex = '2000';
    fallback.style.display = 'block';
    fallback.replaceChildren();
    const h2 = document.createElement('h2');
    h2.textContent = 'Recorrido no disponible en este momento';
    const p = document.createElement('p');
    p.textContent = error?.message || 'No se pudo cargar la configuración del recorrido.';
    const actions = document.createElement('p');
    actions.style.marginTop = '14px';
    actions.style.display = 'flex';
    actions.style.gap = '10px';
    actions.style.justifyContent = 'center';
    actions.style.flexWrap = 'wrap';
    const homeLink = document.createElement('a');
    homeLink.href = '/';
    homeLink.textContent = 'Volver al portal';
    homeLink.style.padding = '8px 14px';
    homeLink.style.borderRadius = '8px';
    homeLink.style.background = 'rgba(255,255,255,0.12)';
    homeLink.style.color = '#ffffff';
    homeLink.style.textDecoration = 'none';
    const loginLink = document.createElement('a');
    loginLink.href = '/plataforma/login.html';
    loginLink.textContent = 'Iniciar sesión admin';
    loginLink.style.padding = '8px 14px';
    loginLink.style.borderRadius = '8px';
    loginLink.style.background = 'var(--brand, #0a7a45)';
    loginLink.style.color = 'var(--brand-ink, #ffffff)';
    loginLink.style.textDecoration = 'none';
    actions.append(homeLink, loginLink);
    fallback.append(h2, p, actions);
  }
}

function renderEmptyTourState(config) {
  document.body.classList.remove('no-js');
  const titleText = config.tourTitle || config.branding?.name || 'Tour 360° en preparación';
  const sceneTitleEl = document.getElementById('sceneTitle');
  const sceneZoneEl = document.getElementById('sceneZone');
  if (sceneTitleEl) sceneTitleEl.textContent = titleText;
  if (sceneZoneEl) {
    sceneZoneEl.textContent = config.isDraftPreview
      ? 'Borrador privado (solo admin) · 0 escenas'
      : 'En preparación · 0 escenas';
  }

  ['loadingOverlay', 'prevScene', 'nextScene', 'directionCue', 'hotspotList', 'menuToggle'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute('hidden', 'hidden');
    el.style.display = 'none';
    if (id === 'loadingOverlay') {
      el.setAttribute('aria-hidden', 'true');
    }
  });

  const viewerSection = document.getElementById('viewerSection');
  if (!viewerSection) return;
  let overlay = document.getElementById('tourEmptyState');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'tourEmptyState';
    overlay.className = 'tour-empty-state';
    overlay.setAttribute('role', 'region');
    overlay.setAttribute('aria-label', 'Estado del recorrido virtual');
    viewerSection.appendChild(overlay);
  }

  overlay.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'tour-empty-card';

  const head = document.createElement('div');
  head.className = 'tour-empty-head';

  const iconWrap = document.createElement('div');
  iconWrap.className = 'tour-empty-icon';
  iconWrap.setAttribute('aria-hidden', 'true');
  iconWrap.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" focusable="false"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm8-9h-3.17l-1.24-1.35A2 2 0 0 0 14.12 4H9.88a2 2 0 0 0-1.47.65L7.17 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm0 12H4V8h4.05l1.83-2h4.24l1.83 2H20v10z"/></svg>';

  const titleGroup = document.createElement('div');
  const eyebrow = document.createElement('p');
  eyebrow.className = 'tour-empty-eyebrow';
  eyebrow.textContent = config.branding?.name || config.organization?.name || 'Recorrido virtual 360°';

  const heading = document.createElement('h2');
  heading.className = 'tour-empty-title';
  heading.textContent = titleText;

  titleGroup.append(eyebrow, heading);
  head.append(iconWrap, titleGroup);

  const copy = document.createElement('p');
  copy.className = 'tour-empty-copy';
  copy.textContent =
    'Este recorrido virtual ya está habilitado con la identidad de la sede y listo para recibir sus fotografías panorámicas 360° y puntos de interés.';

  const actions = document.createElement('div');
  actions.className = 'tour-empty-actions';

  const adminBtn = document.createElement('a');
  adminBtn.className = 'tour-empty-btn tour-empty-btn--primary';
  adminBtn.href = buildControlWebTarget(config);
  adminBtn.textContent = 'Subir escenas en Control Web';
  adminBtn.hidden = true;
  actions.appendChild(adminBtn);

  resolveTourEditorAccess(config).then((allowed) => {
    if (allowed) {
      adminBtn.hidden = false;
    } else {
      adminBtn.remove();
    }
  });

  const portalBtn = document.createElement('a');
  portalBtn.className = 'tour-empty-btn tour-empty-btn--ghost';
  portalBtn.href = '/';
  portalBtn.textContent = 'Volver al portal';
  actions.appendChild(portalBtn);

  card.append(head, copy, actions);
  overlay.appendChild(card);
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

function readStoredSession() {
  try {
    const raw = localStorage.getItem('orbe360.session');
    if (!raw || !raw.trim()) return { token: null, role: '' };
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return {
        token: typeof parsed?.token === 'string' ? parsed.token.trim() : null,
        role: String(parsed?.role || parsed?.user?.role || ''),
      };
    }
    return { token: trimmed, role: '' };
  } catch {
    return { token: null, role: '' };
  }
}

function buildControlWebTarget(config) {
  const orgSlug = config?.organization?.slug || resolveOrgSlugFromBrowser();
  const tourSlug = config?.tourSlug || resolveTourSlugFromBrowser();
  return controlWebHref({ orgSlug, tourSlug });
}

async function resolveTourEditorAccess(config) {
  if (document.documentElement.classList.contains('embed-mode')) return false;
  const session = readStoredSession();
  if (!session.token) return false;
  const convexUrl = (typeof window !== 'undefined' && window.__CONVEX_URL__) || '';
  if (!convexUrl) {
    return Boolean(session.role && session.role !== 'superadmin');
  }
  try {
    const orgSlug = config?.organization?.slug || resolveOrgSlugFromBrowser();
    const tourSlug = config?.tourSlug || resolveTourSlugFromBrowser();
    const res = await fetch(`${String(convexUrl).replace(/\/$/, '')}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'tourAdmin:assertTourEditorAccess',
        args: { token: session.token, orgSlug, tourSlug, now: Date.now() },
        format: 'json',
      }),
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const payload = await res.json();
    return Boolean(payload?.value?.ok);
  } catch {
    return false;
  }
}

function recordTourUsageMetric(config, event) {
  try {
    if (!config || config.isEmpty || config.isDraftPreview) return;
    if (document.documentElement.classList.contains('embed-mode')) return;
    const convexUrl = (typeof window !== 'undefined' && window.__CONVEX_URL__) || '';
    if (!convexUrl) return;
    const orgSlug = config.organization?.slug || resolveOrgSlugFromBrowser();
    const tourSlug = config.tourSlug || resolveTourSlugFromBrowser();
    if (!orgSlug || !tourSlug) return;
    fetch(`${String(convexUrl).replace(/\/$/, '')}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'audit:recordTourEvent',
        args: {
          orgSlug,
          tourSlug,
          event,
        },
        format: 'json',
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* métricas no bloqueantes */
  }
}

/**
 * Engranaje -> solo visible tras validar sesión autorizada de edición (superadmin excluido).
 */
function setupAdminEntryPoints(config) {
  const adminLink = document.getElementById('adminLink');
  const platformLink = document.getElementById('platformLink');

  if (adminLink) {
    const session = readStoredSession();
    if (!session.token || document.documentElement.classList.contains('embed-mode')) {
      adminLink.remove();
    } else {
      const targetHref = buildControlWebTarget(config);
      resolveTourEditorAccess(config).then((allowed) => {
        if (!allowed) {
          adminLink.remove();
          return;
        }
        adminLink.hidden = false;
        adminLink.removeAttribute('hidden');
        adminLink.setAttribute('href', targetHref);
        adminLink.setAttribute('aria-label', 'Abrir panel de administración del tour');
      });
    }
  }

  if (platformLink) {
    platformLink.setAttribute('href', '/');
  }
}

