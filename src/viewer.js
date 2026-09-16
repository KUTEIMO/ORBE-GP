import { appState, selectors } from './state.js';
import { announceScene, buildSceneAnnouncement } from './announcer.js';
import { renderHotspots, clearHotspots } from './hotspotManager.js';
import { isEditMode } from './hotspotEditing.js';
import { pickSpatialTarget } from './spatialNav.js';

const DEFAULT_TRANSITION = 110;
const DEFAULT_INITIAL_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 2 };

function resolveInitialView(sceneData) {
  const raw = sceneData?.initialView;
  if (!raw || typeof raw.yaw !== 'number') {
    return { ...DEFAULT_INITIAL_VIEW };
  }
  return {
    yaw: raw.yaw,
    pitch: typeof raw.pitch === 'number' ? raw.pitch : 0,
    fov: typeof raw.fov === 'number' ? raw.fov : DEFAULT_INITIAL_VIEW.fov
  };
}

function applySceneView(view, sceneData) {
  if (!view) return;
  const next = resolveInitialView(sceneData);
  view.setYaw(next.yaw);
  view.setPitch(next.pitch);
  if (typeof view.setFov === 'function') {
    view.setFov(next.fov);
  }
}

export function initViewer(config, callbacks = {}) {
  if (!window.Marzipano) {
    throw new Error('La librería Marzipano no se ha cargado. Verifica la conexión a internet.');
  }

  const panorama = selectors.panorama();
  if (!panorama) {
    throw new Error('No se encontró el contenedor del visor 360.');
  }

  const viewer = new window.Marzipano.Viewer(panorama, {
    stageType: 'webgl',
    controls: {
      mouseViewMode: 'drag'
    }
  });

  const scenes = new Map();
  const defaultSceneId = config.defaultScene || config.scenes[0].id;
  const initialSceneId = resolveInitialScene(config, defaultSceneId);
  let previousSceneId = null;

  config.scenes.forEach((sceneData) => {
    const scene = createScene(viewer, config, sceneData);
    scenes.set(sceneData.id, scene);
  });

  // Precarga solo la inicial + vecinos (evita lentitud al arrancar)
  const initialEntry = scenes.get(initialSceneId);
  if (initialEntry?.marzipanoScene?.preload) {
    initialEntry.marzipanoScene.preload();
  }
  preloadNeighbors(scenes, initialSceneId);

  appState.viewer = viewer;
  appState.scenes = scenes;

  function switchScene(sceneId, options = {}) {
    const sceneEntry = scenes.get(sceneId);
    if (!sceneEntry) {
      console.warn(`La escena "${sceneId}" no existe en la configuración.`);
      return;
    }

    if (appState.currentSceneId && appState.currentSceneId !== sceneId) {
      previousSceneId = appState.currentSceneId;
    }

    const { marzipanoScene, data } = sceneEntry;
    const overlay = selectors.loadingOverlay();
    const duration = options.transition === false
      ? 0
      : (typeof options.transitionDuration === 'number' ? options.transitionDuration : DEFAULT_TRANSITION);

    // Overlay solo en cambios sin transición; los cortos van directos
    if (overlay && duration === 0) {
      overlay.removeAttribute('aria-hidden');
      overlay.style.display = 'flex';
    }

    marzipanoScene.switchTo({
      transitionDuration: duration
    }, () => {
      if (overlay) {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.classList.remove('loading-overlay--soft');
      }
    });

    // Reaplicar vista frontal en cada entrada (no solo al crear el RectilinearView).
    applySceneView(sceneEntry.view, data);

    appState.currentSceneId = sceneId;
    updateLocationHash(sceneId);
    updateSceneHeader(data);
    renderHotspots(data, marzipanoScene, {
      onOpenHotspot: handleHotspotOpen,
      onNavigateScene: switchScene
    });
    preloadNeighbors(scenes, sceneId);
    announceScene(buildSceneAnnouncement(data));
    callbacks.onSceneChange?.(data);
  }

  function updateSceneHeader(data) {
    const title = selectors.sceneTitle();
    const zone = selectors.sceneZone();
    if (title) {
      title.textContent = data.title;
    }
    if (zone) {
      const zoneLabel = config.zones?.[data.zone] || data.zone || 'Escena sin zona asignada';
      zone.textContent = `Zona: ${zoneLabel}`;
    }
  }

  function handleHotspotOpen(sceneData, hotspotData, options = {}) {
    callbacks.onHotspotOpen?.(sceneData, hotspotData, options);
  }

  function getCurrentScene() {
    if (!appState.currentSceneId) return null;
    return scenes.get(appState.currentSceneId) || null;
  }

  function getSceneData(sceneId) {
    const entry = scenes.get(sceneId);
    return entry ? entry.data : null;
  }

  function getView() {
    const current = getCurrentScene();
    return current ? current.view : null;
  }

  function destroy() {
    clearHotspots();
    viewer.destroy();
  }

  switchScene(initialSceneId, { transition: false });

  const api = {
    switchScene,
    getCurrentScene,
    getSceneData,
    getView,
    destroy,
    getScenes: () => scenes
  };

  initPointerNavigation(api.switchScene, () => previousSceneId);
  callbacks.onViewerReady?.(api);

  return api;
}

function resolveSceneImageUrl(config, sceneData) {
  const url = sceneData?.imageUrl;
  if (url && typeof url === 'string') {
    if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
    // Absolute site path or tour-relative media (multi-tenant media/org/tour/…).
    if (url.startsWith('/') || url.includes('/')) {
      try {
        return new URL(url, window.location.href).href;
      } catch {
        return url;
      }
    }
  }
  return `${config.basePath || ''}${sceneData.file}`;
}

function createScene(viewer, config, sceneData) {
  const source = window.Marzipano.ImageUrlSource.fromString(resolveSceneImageUrl(config, sceneData));

  const levels = (sceneData.levels || []).map((level) => ({
    tileSize: level.tileSize,
    size: level.size,
    fallbackOnly: level.fallbackOnly
  }));

  const geometry = levels.length
    ? new window.Marzipano.CubeGeometry(levels)
    : new window.Marzipano.EquirectGeometry([{ width: sceneData.width || 8192 }]);

  const limiter = window.Marzipano.RectilinearView.limit.traditional(
    sceneData.maxResolution || 2048,
    (sceneData.maxFov || 120) * Math.PI / 180
  );

  const initialView = resolveInitialView(sceneData);
  const view = new window.Marzipano.RectilinearView(initialView, limiter);

  const marzipanoScene = viewer.createScene({
    source,
    geometry,
    view,
    pinFirstLevel: false
  });

  return {
    data: sceneData,
    marzipanoScene,
    view
  };
}

function initPointerNavigation(switchScene, getPreviousSceneId = () => null) {
  const panorama = selectors.panorama();
  const cue = selectors.directionCue();
  if (!panorama || !cue) return;

  let activeSelection = null;
  let hideTimeout = null;
  let lastPointer = null;
  let pointerDown = null;
  let isDraggingView = false;
  let cueVisible = false;
  let rafId = null;

  // Posición suavizada (lerp). Targets se actualizan en pointermove.
  let curX = 50;
  let curY = 50;
  let curRot = 0;
  let tgtX = 50;
  let tgtY = 50;
  let tgtRot = 0;
  let snapNext = true;

  const reducedMotionMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointerMq = window.matchMedia('(hover: none) and (pointer: coarse)');
  const prefersReducedMotion = () => reducedMotionMq.matches;
  const isCoarsePointer = () => coarsePointerMq.matches;

  // Decorativo: el clic real lo captura el panorama cerca del cue.
  cue.removeAttribute('role');
  cue.setAttribute('tabindex', '-1');
  cue.setAttribute('aria-hidden', 'true');
  cue.style.pointerEvents = 'none';

  const stopRaf = () => {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  const applyCueTransform = () => {
    cue.style.left = `${curX}%`;
    cue.style.top = `${curY}%`;
    cue.style.setProperty('--cue-rotate', `${curRot}deg`);
  };

  const shortestAngleDelta = (from, to) => {
    let delta = to - from;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  };

  const tickCue = () => {
    rafId = null;
    if (!cueVisible) return;

    const alpha = prefersReducedMotion() ? 1 : 0.32;
    curX += (tgtX - curX) * alpha;
    curY += (tgtY - curY) * alpha;
    curRot += shortestAngleDelta(curRot, tgtRot) * alpha;

    const settled =
      Math.abs(tgtX - curX) < 0.04
      && Math.abs(tgtY - curY) < 0.04
      && Math.abs(shortestAngleDelta(curRot, tgtRot)) < 0.4;

    if (settled) {
      curX = tgtX;
      curY = tgtY;
      curRot = tgtRot;
    }

    applyCueTransform();
    if (!settled) {
      rafId = requestAnimationFrame(tickCue);
    }
  };

  const ensureRaf = () => {
    if (rafId == null && cueVisible) {
      rafId = requestAnimationFrame(tickCue);
    }
  };

  const hideCue = () => {
    activeSelection = null;
    cueVisible = false;
    snapNext = true;
    stopRaf();
    clearTimeout(hideTimeout);
    hideTimeout = null;
    cue.classList.remove('direction-cue--visible', 'direction-cue--ready', 'direction-cue--over-hotspot');
    cue.setAttribute('aria-hidden', 'true');
    cue.removeAttribute('aria-label');
    cue.removeAttribute('title');
    cue.style.left = '';
    cue.style.top = '';
    cue.style.removeProperty('--cue-rotate');
  };

  const scheduleHide = () => {
    clearTimeout(hideTimeout);
    // Más holgado: si el ratón se detiene, no desvanecer a los 0.9s.
    hideTimeout = setTimeout(hideCue, 1600);
  };

  const getPointerCoordinates = (event) => {
    const current = appState.scenes.get(appState.currentSceneId);
    if (!current) return null;
    const view = current.view;
    if (!view || typeof view.screenToCoordinates !== 'function') return null;
    const rect = panorama.getBoundingClientRect();
    return view.screenToCoordinates({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const selectNavTarget = (yaw, pitch, preferredTargetId = null) => {
    const current = appState.scenes.get(appState.currentSceneId);
    const list = current?.data?.navigationHotspots || [];
    if (preferredTargetId) {
      const preferred = list.find((item) => item.target === preferredTargetId)
        || current?.data?.hotspots?.find((h) => h.type === 'nav' && h.target === preferredTargetId);
      if (preferred) {
        const yawDiff = yaw - (preferred.yaw || 0);
        return {
          target: {
            title: preferred.title,
            yaw: preferred.yaw || 0,
            pitch: preferred.pitch || 0,
            target: preferred.target
          },
          yawDiff,
          pitchDiff: pitch - (preferred.pitch || 0),
          score: 0
        };
      }
    }
    return pickSpatialTarget(list, yaw, pitch, 1.05, {
      previousSceneId: getPreviousSceneId?.() || null,
      coneRadians: 0.95
    });
  };

  const positionCue = (event, navSelection, overHotspot = false) => {
    const rect = panorama.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    // Margen para no tapar header/flechas laterales ni la lista inferior.
    const padX = 28;
    const padYTop = 56;
    const padYBottom = 72;
    const rawX = event.clientX - rect.left;
    const rawY = event.clientY - rect.top;
    const clampedX = Math.min(rect.width - padX, Math.max(padX, rawX));
    const clampedY = Math.min(rect.height - padYBottom, Math.max(padYTop, rawY));
    const percentX = (clampedX / rect.width) * 100;
    const percentY = (clampedY / rect.height) * 100;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    tgtX = percentX;
    tgtY = percentY;
    tgtRot = rotationDeg;

    if (snapNext || prefersReducedMotion()) {
      curX = tgtX;
      curY = tgtY;
      curRot = tgtRot;
      snapNext = false;
      applyCueTransform();
    } else {
      ensureRaf();
    }

    cue.classList.add('direction-cue--visible', 'direction-cue--ready');
    cue.classList.toggle('direction-cue--over-hotspot', overHotspot);
    cue.setAttribute('aria-hidden', 'false');
    cue.setAttribute('aria-label', `Avanzar a ${navSelection.target.title}`);
    cue.title = `Clic para ir a ${navSelection.target.title}`;
    cueVisible = true;
    activeSelection = navSelection;
  };

  const navigateFromSelection = () => {
    if (activeSelection?.target?.target) {
      switchScene(activeSelection.target.target, { transitionDuration: 90 });
      hideCue();
    }
  };

  panorama.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    pointerDown = { x: event.clientX, y: event.clientY };
    isDraggingView = false;
  });

  panorama.addEventListener('pointerup', () => {
    pointerDown = null;
    // Pequeña demora para no mostrar la flecha justo al soltar el arrastre
    setTimeout(() => {
      isDraggingView = false;
    }, 120);
  });

  panorama.addEventListener('pointercancel', () => {
    pointerDown = null;
    isDraggingView = false;
    hideCue();
  });

  panorama.addEventListener('pointermove', (event) => {
    if (isEditMode() || event.pointerType === 'touch' || isCoarsePointer()) {
      hideCue();
      return;
    }

    // Evita la flecha “vibrando” mientras se arrastra el panorama
    if (pointerDown && (event.buttons & 1)) {
      const dist = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
      if (dist > 5) {
        isDraggingView = true;
        hideCue();
        panorama.style.cursor = 'grabbing';
        return;
      }
    }
    if (isDraggingView || (event.buttons & 1)) {
      hideCue();
      return;
    }

    lastPointer = event;
    const hotspotEl = event.target?.closest?.('.hotspot');
    const overHotspot = Boolean(hotspotEl);
    const preferredTarget = hotspotEl?.dataset?.hotspotType === 'nav'
      ? hotspotEl.dataset.targetId || null
      : null;
    const coords = getPointerCoordinates(event);
    if (!coords) {
      hideCue();
      return;
    }

    let preferred = preferredTarget;
    if (overHotspot && hotspotEl?.dataset?.hotspotType === 'nav' && !preferred) {
      const current = appState.scenes.get(appState.currentSceneId);
      const hs = current?.data?.hotspots?.find((h) => h.id === hotspotEl.dataset.hotspotId);
      preferred = hs?.target || null;
    }

    const selection = selectNavTarget(coords.yaw, coords.pitch, preferred);
    if (!selection) {
      hideCue();
      panorama.style.cursor = '';
      return;
    }

    positionCue(event, selection, overHotspot);
    panorama.style.cursor = overHotspot ? 'pointer' : 'grab';
    scheduleHide();
  });

  panorama.addEventListener('mouseleave', () => {
    hideCue();
    panorama.style.cursor = '';
    pointerDown = null;
    isDraggingView = false;
  });

  panorama.addEventListener('dblclick', (event) => {
    if (isEditMode() || isDraggingView || isCoarsePointer()) return;
    if (event.target?.closest?.('.hotspot')) return;
    event.preventDefault();
    const coords = getPointerCoordinates(event);
    if (!coords) return;
    const selection = selectNavTarget(coords.yaw, coords.pitch);
    if (selection?.target?.target) {
      switchScene(selection.target.target, { transitionDuration: 90 });
      hideCue();
    }
  });

  panorama.addEventListener('click', (event) => {
    if (isEditMode() || isDraggingView || isCoarsePointer()) return;
    if (event.target?.closest?.('.hotspot')) return;
    if (!activeSelection?.target?.target || !lastPointer) return;
    const rect = panorama.getBoundingClientRect();
    const cueLeft = (Number.parseFloat(cue.style.left) / 100) * rect.width;
    const cueTop = (Number.parseFloat(cue.style.top) / 100) * rect.height;
    const dx = event.clientX - rect.left - cueLeft;
    const dy = event.clientY - rect.top - cueTop;
    // Hit-box un poco mayor: el cue ahora es un disco ~48px + lerp.
    if (Math.hypot(dx, dy) < 48) {
      event.preventDefault();
      navigateFromSelection();
    }
  });
}

function preloadNeighbors(scenes, sceneId) {
  const current = scenes.get(sceneId);
  if (!current) return;
  const targets = (current.data.navigationHotspots || [])
    .map((item) => item.target)
    .filter(Boolean)
    .slice(0, 6);
  targets.forEach((id) => {
    const entry = scenes.get(id);
    if (entry?.marzipanoScene && typeof entry.marzipanoScene.preload === 'function') {
      entry.marzipanoScene.preload();
    }
  });
}

function resolveInitialScene(config, fallbackId) {
  try {
    const url = new URL(window.location.href);
    const sceneParam = url.searchParams.get('scene');
    if (!sceneParam) return fallbackId;
    const exists = config.scenes.some((scene) => scene.id === sceneParam);
    return exists ? sceneParam : fallbackId;
  } catch (_error) {
    return fallbackId;
  }
}

function updateLocationHash(sceneId) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('scene', sceneId);
    window.history.replaceState({}, '', url);
  } catch (_error) {
    // Ignorar si el navegador no permite modificar el historial
  }
}

