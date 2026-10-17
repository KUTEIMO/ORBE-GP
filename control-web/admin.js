import {
  getSessionToken,
  requireControlWebAccess,
} from './auth-gate.js';

const STORAGE_KEY_BASE = 'tour.graph.v1';
function storageKey() {
  const org = ORG_SLUG();
  const tour = TOUR_SLUG();
  if (org && tour) return `${STORAGE_KEY_BASE}:${org}:${tour}`;
  return STORAGE_KEY_BASE;
}
/**
 * Path context from /{org}/{tour}/control-web/ (set by orbe-config).
 * No silent Unisimón defaults.
 */
const TOUR_SLUG = () => window.__ORBE_TOUR_SLUG__ || null;
const ORG_SLUG = () => window.__ORBE_ORG_SLUG__ || null;
function requireTourSlug() {
  const s = TOUR_SLUG();
  if (!s) {
    throw new Error(
      'Falta contexto de tour (abre Control Web bajo /{org}/{tour}/control-web/)'
    );
  }
  return s;
}
function requireOrgSlugCw() {
  const s = ORG_SLUG();
  if (!s) {
    throw new Error('Falta contexto de organización (path /{org}/{tour}/…)');
  }
  return s;
}
/** Tour-scoped panoramas: /media/{org}/{tour}/panoramas/ — never shared root /panoramas/. */
function panoramaBaseUrl() {
  const org = ORG_SLUG();
  const tour = TOUR_SLUG();
  if (org && tour) return `/media/${org}/${tour}/panoramas/`;
  return null;
}
function PANORAMA_BASE() {
  const base = panoramaBaseUrl();
  if (!base) {
    throw new Error(
      'Falta contexto /{org}/{tour}/ para panoramas (no usar root compartido)'
    );
  }
  return base;
}
const CONVEX_URL = () => String(window.__CONVEX_URL__ || '').replace(/\/$/, '');

function syncHeaderTourLink() {
  const link = document.getElementById('headerTourLink');
  if (!link) return;
  const slug = TOUR_SLUG();
  const org = ORG_SLUG();
  if (!slug || !org) {
    link.href = '#';
    link.title = 'Sin contexto /{org}/{tour}/';
    return;
  }
  link.href = `/${org}/${slug}/`;
  link.title = `Visor público · ${org}/${slug}`;
}
syncHeaderTourLink();

const DIRECTION_PRESETS = {
  forward: { yaw: 0, pitch: -0.06, label: 'Adelante' },
  back: { yaw: Math.PI, pitch: -0.06, label: 'Atrás' },
  left: { yaw: -Math.PI / 2, pitch: -0.05, label: 'Izquierda' },
  right: { yaw: Math.PI / 2, pitch: -0.05, label: 'Derecha' },
  up: { yaw: 0, pitch: 0.35, label: 'Arriba / 2º piso' },
  down: { yaw: 0, pitch: -0.42, label: 'Abajo / 1º piso' }
};

const DEFAULT_FRONT_VIEW = { yaw: 0, pitch: 0, fov: Math.PI / 2 };

const state = {
  config: null,
  scenes: [],
  zones: {},
  availableFiles: [],
  graph: { version: 1, connections: [], scenes: {}, sceneMeta: {} },
  selectedFile: null,
  selectedHotspotId: null,
  placeMode: 'nav',
  workMode: 'view',
  draftLink: null,
  nodePositions: new Map(),
  dirty: false,
  saving: false,
  /** Connection count last known synced to Convex (delta warnings). */
  lastSyncedConnectionCount: 0,
  focusNeighborhood: true,
  highlightOrphans: true,
  viewer: null,
  marzipanoScene: null,
  view: null,
  hotspotControls: [],
  viewChangeUnsub: null,
  sceneDialogMode: 'add',
  authorized: false
};

/** Tours above this scene count use neighborhood focus by default. */
const LARGE_TOUR_SCENE_THRESHOLD = 16;

const els = {
  zoneFilter: document.getElementById('zoneFilter'),
  sceneSearch: document.getElementById('sceneSearch'),
  sceneList: document.getElementById('sceneList'),
  graphSvg: document.getElementById('graphSvg'),
  connectionList: document.getElementById('connectionList'),
  graphStats: document.getElementById('graphStats'),
  graphFocusNeighborhood: document.getElementById('graphFocusNeighborhood'),
  graphHighlightOrphans: document.getElementById('graphHighlightOrphans'),
  btnFitGraph: document.getElementById('btnFitGraph'),
  connectForm: document.getElementById('connectForm'),
  connectFrom: document.getElementById('connectFrom'),
  connectTo: document.getElementById('connectTo'),
  connectBidirectional: document.getElementById('connectBidirectional'),
  saveProgress: document.getElementById('saveProgress'),
  editorEmpty: document.getElementById('editorEmpty'),
  editorBody: document.getElementById('editorBody'),
  editorSubtitle: document.getElementById('editorSubtitle'),
  pano360: document.getElementById('pano360'),
  hotspotList: document.getElementById('hotspotList'),
  targetSelect: document.getElementById('targetSelect'),
  directionSelect: document.getElementById('directionSelect'),
  statusBar: document.getElementById('statusBar'),
  importFile: document.getElementById('importFile'),
  dirtyBadge: document.getElementById('dirtyBadge'),
  btnSaveAll: document.getElementById('btnSaveAll'),
  btnPlaceHere: document.getElementById('btnPlaceHere'),
  btnSetFrontView: document.getElementById('btnSetFrontView'),
  frontViewHint: document.getElementById('frontViewHint'),
  btnDeleteSelected: document.getElementById('btnDeleteSelected'),
  btnSaveScene: document.getElementById('btnSaveScene'),
  btnDiscardScene: document.getElementById('btnDiscardScene'),
  sceneTools: document.getElementById('sceneTools'),
  sceneDialog: document.getElementById('sceneDialog'),
  sceneForm: document.getElementById('sceneForm'),
  sceneDialogTitle: document.getElementById('sceneDialogTitle'),
  sceneFileSelect: document.getElementById('sceneFileSelect'),
  sceneZoneSelect: document.getElementById('sceneZoneSelect'),
  sceneDialogHint: document.getElementById('sceneDialogHint'),
  sceneFileLabel: document.getElementById('sceneFileLabel'),
  sceneUploadLabel: document.getElementById('sceneUploadLabel'),
  panoramaUploadInput: document.getElementById('panoramaUploadInput'),
  sceneFormSave: document.getElementById('sceneFormSave'),
  confirmDialog: document.getElementById('confirmDialog'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmMessage: document.getElementById('confirmMessage')
};

waitForMarzipano()
  .then(init)
  .catch((error) => {
    console.error(error);
    setStatus(`Error al iniciar: ${error.message}`);
  });

function waitForMarzipano() {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const tick = () => {
      if (window.Marzipano) return resolve();
      if (tries++ > 80) return reject(new Error('Marzipano no cargó'));
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function init() {
  const access = await requireControlWebAccess({
    orgSlug: ORG_SLUG(),
    tourSlug: TOUR_SLUG(),
    convexFetch,
  });
  if (!access.ok) {
    // Redirect or deny UI already handled — do not load editor / panoramas / modes.
    return;
  }
  state.authorized = true;

  const [config, library, fileGraph] = await Promise.all([
    fetchJson('../config.json'),
    fetchJson('../biblioteca-scenes.json').catch(() => ({})),
    fetchJson('../tour-graph.json').catch(() => ({ version: 1, connections: [], scenes: {}, sceneMeta: {} }))
  ]);

  state.config = config;
  state.zones = config.zones || {};
  state.availableFiles = (config.scenes || []).map((s) => s.file);
  const accessible = { ...(config.accessibleScenes || {}), ...library };

  state.scenes = (config.scenes || []).map((entry, index) => {
    const patch = accessible[entry.file] || {};
    const meta = {};
    return {
      file: entry.file,
      zone: entry.zone,
      id: patch.id || slugify(entry.file),
      title: patch.title || config.sceneNames?.[entry.file] || entry.file,
      shortTitle: patch.shortTitle || cleanTitle(patch.title || config.sceneNames?.[entry.file] || entry.file),
      hotspots: Array.isArray(patch.hotspots) ? structuredClone(patch.hotspots) : [],
      order: index,
      ...meta
    };
  });

  const stored = loadStoredGraph();
  // Never prefer an empty placeholder {connections:[],scenes:{}} over a richer source.
  // Empty static tour-graph after media migrate wiped the editor → Guardar wiped Convex.
  state.graph = normalizeGraph(pickRichestGraph(stored, fileGraph));

  Object.entries(state.graph.scenes || {}).forEach(([file, patch]) => {
    const scene = state.scenes.find((s) => s.file === file);
    if (scene && Array.isArray(patch.hotspots)) scene.hotspots = structuredClone(patch.hotspots);
  });

  Object.entries(state.graph.sceneMeta || {}).forEach(([file, meta]) => {
    const scene = state.scenes.find((s) => s.file === file);
    if (!scene || !meta) return;
    if (meta.title) scene.title = meta.title;
    if (meta.shortTitle) scene.shortTitle = meta.shortTitle;
    if (meta.zone) scene.zone = meta.zone;
  });

  fillZones();
  fillTargets();
  fillConnectSelects();
  state.focusNeighborhood = state.scenes.length >= LARGE_TOUR_SCENE_THRESHOLD;
  if (els.graphFocusNeighborhood) els.graphFocusNeighborhood.checked = state.focusNeighborhood;
  if (els.graphHighlightOrphans) els.graphHighlightOrphans.checked = state.highlightOrphans;
  bindUi();
  setWorkMode('view');
  renderSceneList();
  layoutNodes();
  renderGraph();
  renderConnections();
  updateGraphStats();
  updateDirtyUi(false);

  applyTourChrome(access.title ? { title: access.title, slug: TOUR_SLUG() } : null);
  const token = getSessionToken();
  setStatus('Sesión autorizada. Edita el grafo y pulsa Guardar cambios para publicar en Convex.');
  await pullConvexSnapshot().catch((err) => {
    setStatus(`No se pudo cargar snapshot Convex: ${err.message || err}`);
  });
  state.lastSyncedConnectionCount = (state.graph.connections || []).length;
  updateGraphStats();
  await loadClientBrandContext(token);
}

/** Product chrome stays Orbe360; optional client chip from TourBranding (context only). */
function applyTourChrome(snap, branding) {
  const label = document.getElementById('tourContextLabel');
  if (!label) return;
  const title = snap?.title || snap?.shortTitle;
  const slug = snap?.slug || TOUR_SLUG();
  if (title) {
    label.textContent = `Tour · ${title}`;
    document.title = `Orbe360 Control Web — ${title}`;
  } else {
    label.textContent = `Orbe360 · Editor de tour (${slug})`;
    document.title = 'Orbe360 Control Web — Editor de tour';
  }
  applyClientBrandChip(branding);
}

/**
 * Shows client TourBranding as a context chip. Never writes Orbe colors into branding.
 * @param {{ clientShortName?: string, clientName?: string, primaryColor?: string } | null | undefined} branding
 */
function applyClientBrandChip(branding) {
  const chip = document.getElementById('clientBrandChip');
  const chipLabel = document.getElementById('clientBrandChipLabel');
  if (!chip || !chipLabel) return;
  const name =
    branding?.clientShortName ||
    branding?.headerTitle ||
    branding?.clientName ||
    '';
  const color = branding?.primaryColor;
  if (color && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
    document.documentElement.style.setProperty('--cw-client', color);
  }
  if (name) {
    chipLabel.textContent = name;
    chip.hidden = false;
    chip.title = branding?.clientName || name;
  } else {
    chip.hidden = true;
  }
}

async function loadClientBrandContext(token) {
  try {
    if (token) {
      const row = await convexFetch('query', 'branding:getBrandingForAdmin', {
        token,
        slug: TOUR_SLUG(),
        orgSlug: requireOrgSlugCw(),
        now: Date.now(),
      });
      applyClientBrandChip(row?.branding || null);
      return row?.branding || null;
    }
    const pub = await convexFetch('query', 'branding:getPublicBranding', {
      slug: TOUR_SLUG(),
      orgSlug: requireOrgSlugCw(),
      tourSlug: TOUR_SLUG(),
    });
    applyClientBrandChip(pub);
    return pub;
  } catch (_e) {
    return null;
  }
}

function handleAdminOfflineFallback(kind, path, args = {}) {
  const token = args.token || getSessionToken();
  if (path === 'tourAdmin:assertTourEditorAccess') {
    if (token === 'demo-token-superadmin') {
      return { ok: false, reason: 'superadmin_no_tour_edit' };
    }
    if (token) {
      return {
        ok: true,
        tourId: 'local-tour-unisimon',
        title: 'Campus Cúcuta — Biblioteca Anita Consuegra',
        orgSlug: args.orgSlug || requireOrgSlugCw(),
        tourSlug: args.tourSlug || TOUR_SLUG(),
      };
    }
  }
  if (path === 'branding:getBrandingForAdmin' || path === 'branding:getPublicBranding') {
    return {
      branding: {
        clientName: 'Universidad Simón Bolívar',
        clientShortName: 'Unisimón Cúcuta',
        primaryColor: '#0a7a45',
        primaryStrong: '#086638',
        accentColor: '#1d9bf0',
      }
    };
  }
  if (path === 'tourAdmin:getAdminSnapshot') {
    return null;
  }
  if (path === 'tourAdmin:saveTourSnapshot') {
    return {
      ok: true,
      scenesSaved: (args.scenes || []).length,
      connectionsSaved: (args.connections || []).length,
      offlineSaved: true,
    };
  }
  return undefined;
}

async function convexFetch(kind, path, args) {
  const base = CONVEX_URL();
  try {
    const url = base ? `${base}/api/${kind}` : `/api/${kind}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, args, format: 'json' })
    });
    const data = await response.json();
    if (!response.ok || data.status === 'error') {
      throw new Error(data.errorMessage || data.message || 'Error Convex');
    }
    return data.value;
  } catch (networkError) {
    const fallback = handleAdminOfflineFallback(kind, path, args);
    if (fallback !== undefined) return fallback;
    throw networkError;
  }
}

async function pullConvexSnapshot() {
  const token = getSessionToken();
  if (!token) return;
  const snap = await convexFetch('query', 'tourAdmin:getAdminSnapshot', {
    token,
    slug: TOUR_SLUG(),
    orgSlug: requireOrgSlugCw(),
  });
  if (!snap) return;
  applyTourChrome(snap);
  if (!snap.scenes || Object.keys(snap.scenes).length === 0) return;

  // Isolation: Convex snapshot replaces local scene list (never keep other-tenant config.json scenes).
  const nextScenes = [];
  const nextAvailable = [];
  Object.entries(snap.scenes).forEach(([file, patch]) => {
    const scene = {
      file,
      zone: patch.zone || 'general',
      id: slugify(file),
      title: patch.title || file,
      shortTitle: patch.shortTitle || patch.title || file,
      hotspots: Array.isArray(patch.hotspots) ? structuredClone(patch.hotspots) : [],
      order: typeof patch.order === 'number' ? patch.order : nextScenes.length,
      imageUrl: patch.imageUrl || null,
    };
    if (patch.initialView && typeof patch.initialView.yaw === 'number') {
      scene.initialView = {
        yaw: patch.initialView.yaw,
        pitch: typeof patch.initialView.pitch === 'number' ? patch.initialView.pitch : 0,
        ...(typeof patch.initialView.fov === 'number' ? { fov: patch.initialView.fov } : {}),
      };
    }
    nextScenes.push(scene);
    nextAvailable.push(file);
  });
  state.scenes = nextScenes;
  state.availableFiles = nextAvailable;

  const localConnCount = (state.graph.connections || []).length;
  const snapConnCount = Array.isArray(snap.connections) ? snap.connections.length : 0;
  // Do not replace a curated local graph with an empty Convex connections array
  // (post-migrate empty snapshot / failed save). Keep local and mark dirty for recovery.
  if (Array.isArray(snap.connections)) {
    if (snapConnCount > 0 || localConnCount === 0) {
      state.graph.connections = structuredClone(snap.connections);
    }
  }
  state.graph.scenes = {};
  Object.entries(snap.scenes).forEach(([file, patch]) => {
    state.graph.scenes[file] = {
      hotspots: structuredClone(patch.hotspots || []),
      ...(patch.initialView && typeof patch.initialView.yaw === 'number'
        ? { initialView: structuredClone(patch.initialView) }
        : {})
    };
  });

  // Public SoT = connections edges. Align local nav hotspots so editor matches viewer.
  const navBefore = countNavHotspots();
  const connCount = (state.graph.connections || []).length;
  if (snapConnCount === 0 && localConnCount > 0) {
    syncNavHotspotsToConnections();
    setStatus(
      `Convex sin conexiones (${Object.keys(snap.scenes).length} escenas); se mantienen ${localConnCount} locales. ` +
        `Pulsa Guardar para restaurar el grafo en Convex.`
    );
    updateDirtyUi(true);
  } else if (connCount > 0 && navBefore !== connCount) {
    syncNavHotspotsToConnections();
    setStatus(
      `Sincronizado desde Convex (${Object.keys(snap.scenes).length} escenas). ` +
        `Desync corregido: ${navBefore} nav → ${connCount} conexiones. Pulsa Guardar cambios para publicar.`
    );
    updateDirtyUi(true);
  } else {
    setStatus(`Sincronizado desde Convex (${Object.keys(snap.scenes).length} escenas · ${requireOrgSlugCw()}/${TOUR_SLUG()}).`);
  }

  fillTargets();
  fillZones();
  renderSceneList();
  renderConnections();
  layoutNodes();
  renderGraph();
  if (state.selectedFile) {
    const scene = getSelectedScene();
    if (scene) {
      renderViewerHotspots(scene);
      renderHotspotEditor(scene);
    } else {
      state.selectedFile = null;
    }
  }
}

function bindUi() {
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setWorkMode(btn.dataset.mode));
  });

  els.zoneFilter.addEventListener('change', () => {
    layoutNodes();
    renderSceneList();
    renderGraph();
    renderConnections();
    updateGraphStats();
  });
  els.sceneSearch.addEventListener('input', () => {
    renderSceneList();
    layoutNodes();
    renderGraph();
    renderConnections();
  });

  els.graphFocusNeighborhood?.addEventListener('change', () => {
    state.focusNeighborhood = !!els.graphFocusNeighborhood.checked;
    layoutNodes();
    renderGraph();
    renderConnections();
  });
  els.graphHighlightOrphans?.addEventListener('change', () => {
    state.highlightOrphans = !!els.graphHighlightOrphans.checked;
    renderGraph();
    renderSceneList();
    updateGraphStats();
  });
  els.btnFitGraph?.addEventListener('click', () => {
    layoutNodes();
    renderGraph();
    setStatus('Nodos reordenados según filtros y vecindario.');
  });
  els.connectForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.workMode !== 'hotspots') {
      setStatus('Cambia a “Editar hotspots” para crear conexiones.');
      return;
    }
    const from = els.connectFrom?.value;
    const to = els.connectTo?.value;
    if (!from || !to || from === to) {
      setStatus('Elige dos escenas distintas para conectar.');
      return;
    }
    addConnection(from, to, {
      bidirectional: !!els.connectBidirectional?.checked
    });
  });

  els.btnSaveAll.addEventListener('click', () => {
    void saveAllChanges();
  });
  document.getElementById('btnExport').addEventListener('click', exportGraph);
  document.getElementById('btnImport').addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', importGraph);

  document.getElementById('btnAddScene').addEventListener('click', () => openSceneDialog('add'));
  document.getElementById('btnUploadPanorama')?.addEventListener('click', () => openSceneDialog('upload'));
  document.getElementById('btnEditSceneMeta').addEventListener('click', () => {
    if (!state.selectedFile) {
      setStatus('Selecciona una escena primero.');
      return;
    }
    openSceneDialog('edit');
  });

  els.sceneForm.addEventListener('submit', onSceneFormSubmit);
  els.btnSaveScene.addEventListener('click', applySelectedSceneToGraph);
  els.btnDiscardScene.addEventListener('click', discardSelectedSceneEdits);
  els.btnPlaceHere.addEventListener('click', placeHotspotAtViewCenter);
  els.btnSetFrontView?.addEventListener('click', useCurrentViewAsForward);
  els.btnDeleteSelected.addEventListener('click', deleteSelectedHotspot);
  document.getElementById('btnPruneConnections')?.addEventListener('click', pruneOrphanConnections);
  document.getElementById('btnClearSceneConnections')?.addEventListener('click', clearSelectedSceneConnections);
  document.getElementById('btnClearAllConnections')?.addEventListener('click', clearAllConnections);

  document.querySelectorAll('[data-place]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.workMode !== 'hotspots') return;
      state.placeMode = btn.dataset.place;
      document.querySelectorAll('[data-place]').forEach((b) => b.classList.toggle('chip--active', b === btn));
    });
  });

  document.querySelectorAll('.compass-btn[data-dir]').forEach((btn) => {
    btn.addEventListener('click', () => snapViewToDirection(btn.dataset.dir));
  });

  els.directionSelect.addEventListener('change', () => {
    if (!state.view || state.workMode !== 'hotspots') return;
    snapViewToDirection(els.directionSelect.value);
  });

  window.addEventListener('beforeunload', (event) => {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });

  window.addEventListener('resize', () => {
    layoutNodes();
    renderGraph();
    state.viewer?.updateSize?.();
  });
}

function setWorkMode(mode) {
  if (!state.authorized || !getSessionToken()) {
    setStatus('Sesión de editor requerida. Redirigiendo a login…');
    mode = 'view';
  }
  if (mode !== 'view' && !state.authorized) {
    mode = 'view';
  }
  state.workMode = mode;
  document.body.classList.remove('mode-view', 'mode-scenes', 'mode-hotspots');
  document.body.classList.add(`mode-${mode}`);
  document.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.classList.toggle('mode-btn--active', btn.dataset.mode === mode);
  });

  els.sceneTools.hidden = mode !== 'scenes';
  const hotspotUi = mode === 'hotspots';
  document.getElementById('chipNav').disabled = !hotspotUi;
  document.getElementById('chipInfo').disabled = !hotspotUi;
  els.targetSelect.disabled = !hotspotUi;
  els.directionSelect.disabled = !hotspotUi;
  els.btnPlaceHere.disabled = !(hotspotUi && state.selectedFile);
  if (els.btnSetFrontView) els.btnSetFrontView.disabled = !(hotspotUi && state.selectedFile && state.view);
  els.btnDeleteSelected.disabled = !(hotspotUi && state.selectedHotspotId);
  els.btnSaveScene.disabled = !(hotspotUi && state.selectedFile);
  els.btnDiscardScene.disabled = !(hotspotUi && state.selectedFile);
  if (els.connectFrom) els.connectFrom.disabled = !hotspotUi;
  if (els.connectTo) els.connectTo.disabled = !hotspotUi;
  if (els.connectBidirectional) els.connectBidirectional.disabled = !hotspotUi;
  const btnConnect = document.getElementById('btnConnectScenes');
  if (btnConnect) btnConnect.disabled = !hotspotUi;

  document.querySelectorAll('.compass-btn').forEach((btn) => {
    btn.disabled = !state.view;
  });

  layoutNodes();
  renderGraph();
  renderConnections();
  updateGraphStats();
  if (state.selectedFile) {
    const scene = getSelectedScene();
    if (scene) {
      renderHotspotEditor(scene);
      renderViewerHotspots(scene);
    }
  }
  updateCompassHighlight();
  setStatus(
    mode === 'view'
      ? 'Modo ver: toca los puntos verdes (nav) para cambiar de escena y probar el recorrido.'
      : mode === 'scenes'
        ? 'Modo escenas: añade o edita metadatos. Eliminar pide confirmación.'
        : 'Modo hotspots: conecta con el formulario o arrastra nodo→nodo; luego Guardar cambios.'
  );
}

function fillZones() {
  const zones = [...new Set([
    ...Object.keys(state.zones),
    ...state.scenes.map((s) => s.zone).filter(Boolean)
  ])];
  els.zoneFilter.innerHTML = `<option value="">Todas las zonas</option>` + zones.map((z) =>
    `<option value="${z}">${state.zones[z] || z}</option>`
  ).join('');
  els.sceneZoneSelect.innerHTML = zones.map((z) =>
    `<option value="${z}">${state.zones[z] || z}</option>`
  ).join('');
}

function fillTargets() {
  els.targetSelect.innerHTML = state.scenes.map((s) =>
    `<option value="${s.file}">${escapeHtml(s.shortTitle)}</option>`
  ).join('');
  fillConnectSelects();
}

function fillConnectSelects() {
  if (!els.connectFrom || !els.connectTo) return;
  const opts = state.scenes.map((s) =>
    `<option value="${escapeAttr(s.file)}">${escapeHtml(s.shortTitle)}</option>`
  ).join('');
  const prevFrom = els.connectFrom.value;
  const prevTo = els.connectTo.value;
  els.connectFrom.innerHTML = opts;
  els.connectTo.innerHTML = opts;
  if (prevFrom && state.scenes.some((s) => s.file === prevFrom)) els.connectFrom.value = prevFrom;
  else if (state.selectedFile) els.connectFrom.value = state.selectedFile;
  if (prevTo && state.scenes.some((s) => s.file === prevTo)) els.connectTo.value = prevTo;
  else {
    const other = state.scenes.find((s) => s.file !== els.connectFrom.value);
    if (other) els.connectTo.value = other.file;
  }
}

function orphanSceneFiles() {
  const linked = new Set();
  for (const c of state.graph.connections || []) {
    if (c?.from) linked.add(c.from);
    if (c?.to) linked.add(c.to);
  }
  return state.scenes.filter((s) => !linked.has(s.file)).map((s) => s.file);
}

function connectionDegree(file) {
  let n = 0;
  for (const c of state.graph.connections || []) {
    if (c.from === file || c.to === file) n += 1;
  }
  return n;
}

function filteredScenes() {
  const zone = els.zoneFilter.value;
  const q = (els.sceneSearch.value || '').trim().toLowerCase();
  return state.scenes.filter((s) => {
    if (zone && s.zone !== zone) return false;
    if (!q) return true;
    return `${s.title} ${s.shortTitle} ${s.file}`.toLowerCase().includes(q);
  });
}

/** Scenes visible in the SVG: zone/search filter, optionally 1-hop neighborhood. */
function graphVisibleScenes() {
  const base = filteredScenes();
  const useNeighborhood =
    state.focusNeighborhood &&
    state.selectedFile &&
    state.scenes.length >= LARGE_TOUR_SCENE_THRESHOLD;
  if (!useNeighborhood) return base;

  const focus = state.selectedFile;
  const neighbor = new Set([focus]);
  for (const c of state.graph.connections || []) {
    if (c.from === focus) neighbor.add(c.to);
    if (c.to === focus) neighbor.add(c.from);
  }
  const focused = base.filter((s) => neighbor.has(s.file));
  // If zone/search left the focus out, still show focus + its neighbors from full tour.
  if (focused.length === 0 || !focused.some((s) => s.file === focus)) {
    return state.scenes.filter((s) => neighbor.has(s.file));
  }
  return focused;
}

function updateGraphStats() {
  const conns = (state.graph.connections || []).length;
  const scenes = state.scenes.length;
  const orphans = orphanSceneFiles().length;
  const visible = state.nodePositions.size;
  if (els.graphStats) {
    els.graphStats.textContent =
      `${conns} conexiones · ${scenes} escenas` +
      (orphans ? ` · ${orphans} huérfanas` : '') +
      (visible < scenes ? ` · mostrando ${visible}` : '');
  }
}

function renderSceneList() {
  const scenes = filteredScenes();
  const orphans = new Set(state.highlightOrphans ? orphanSceneFiles() : []);
  els.sceneList.innerHTML = scenes.map((s) => {
    const deg = connectionDegree(s.file);
    const orphan = orphans.has(s.file);
    return `
    <li class="scene-item ${orphan ? 'scene-item--orphan' : ''}" role="option" tabindex="0" data-file="${escapeAttr(s.file)}" aria-selected="${s.file === state.selectedFile}">
      <div class="scene-item__title">${escapeHtml(s.shortTitle)}${orphan ? ' <span class="orphan-tag">huérfana</span>' : ''}</div>
      <div class="scene-item__meta">${escapeHtml(state.zones[s.zone] || s.zone || 'Sin zona')} · ${deg} enlaces · ${s.hotspots.length} hotspots</div>
    </li>`;
  }).join('');

  els.sceneList.querySelectorAll('.scene-item').forEach((item) => {
    const select = () => selectScene(item.dataset.file);
    item.addEventListener('click', select);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        select();
      }
    });
  });
}

function getSelectedScene() {
  return state.scenes.find((s) => s.file === state.selectedFile) || null;
}

async function selectScene(file) {
  state.selectedFile = file;
  state.selectedHotspotId = null;
  const scene = getSelectedScene();
  if (!scene) return;

  if (els.connectFrom) els.connectFrom.value = file;
  fillConnectSelects();
  renderSceneList();
  layoutNodes();
  renderGraph();
  renderConnections();
  updateGraphStats();

  els.editorEmpty.hidden = true;
  els.editorBody.hidden = false;
  els.editorSubtitle.textContent = scene.title;
  const hotspotUi = state.workMode === 'hotspots';
  els.btnPlaceHere.disabled = !hotspotUi;
  if (els.btnSetFrontView) els.btnSetFrontView.disabled = !hotspotUi;
  els.btnDeleteSelected.disabled = true;
  els.btnSaveScene.disabled = !hotspotUi;
  els.btnDiscardScene.disabled = !hotspotUi;

  if (els.targetSelect.value === file) {
    const other = state.scenes.find((s) => s.file !== file);
    if (other) els.targetSelect.value = other.file;
  }

  await mountViewer(scene);
  renderHotspotEditor(scene);
}

async function mountViewer(scene) {
  destroyViewer();
  const viewer = new window.Marzipano.Viewer(els.pano360, {
    controls: { mouseViewMode: 'drag' }
  });
  const source = window.Marzipano.ImageUrlSource.fromString(sceneImageUrl(scene));
  const geometry = new window.Marzipano.EquirectGeometry([{ width: 4096 }]);
  const limiter = window.Marzipano.RectilinearView.limit.traditional(2048, 120 * Math.PI / 180);
  const front = getSceneFront(scene);
  const view = new window.Marzipano.RectilinearView(
    { yaw: front.yaw, pitch: front.pitch, fov: front.fov },
    limiter
  );
  const marzipanoScene = viewer.createScene({ source, geometry, view, pinFirstLevel: true });
  marzipanoScene.switchTo({ transitionDuration: 0 });

  state.viewer = viewer;
  state.marzipanoScene = marzipanoScene;
  state.view = view;

  const onViewChange = () => updateCompassHighlight();
  view.addEventListener('change', onViewChange);
  state.viewChangeUnsub = () => {
    try { view.removeEventListener('change', onViewChange); } catch (_e) { /* ignore */ }
  };

  document.querySelectorAll('.compass-btn').forEach((btn) => { btn.disabled = false; });
  if (els.btnSetFrontView) {
    els.btnSetFrontView.disabled = state.workMode !== 'hotspots';
  }
  updateFrontViewHint(scene);
  updateCompassHighlight();
  renderViewerHotspots(scene);
}

function sceneImageUrl(scene) {
  if (scene?.imageUrl && (/^https?:\/\//i.test(scene.imageUrl) || scene.imageUrl.startsWith('data:'))) {
    return scene.imageUrl;
  }
  return `${PANORAMA_BASE()}${scene.file}`;
}

function destroyViewer() {
  if (typeof state.viewChangeUnsub === 'function') {
    state.viewChangeUnsub();
    state.viewChangeUnsub = null;
  }
  clearViewerHotspots();
  try {
    state.viewer?.destroy?.();
  } catch (_error) {
    /* ignore */
  }
  state.viewer = null;
  state.marzipanoScene = null;
  state.view = null;
  els.pano360.innerHTML = '';
  document.querySelectorAll('.compass-btn').forEach((btn) => {
    btn.classList.remove('compass-btn--active');
    btn.disabled = true;
  });
}

function clearViewerHotspots() {
  if (state.marzipanoScene?.hotspotContainer) {
    const container = state.marzipanoScene.hotspotContainer();
    if (typeof container.listHotspots === 'function') {
      container.listHotspots().slice().forEach((hs) => {
        try { container.destroyHotspot(hs); } catch (_e) { /* ignore */ }
      });
    }
  }
  state.hotspotControls = [];
}

function renderViewerHotspots(scene) {
  if (!state.marzipanoScene) return;
  clearViewerHotspots();
  const container = state.marzipanoScene.hotspotContainer();
  const canEdit = state.workMode === 'hotspots';

  scene.hotspots.forEach((hotspot) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.dataset.hotspotId = hotspot.id;
    el.className = `hotspot hotspot--${hotspot.type === 'nav' ? 'nav' : 'info'}`;
    if (hotspot.animationPreset === 'pulse') el.classList.add('hotspot--anim-pulse');
    if (hotspot.category) el.dataset.category = hotspot.category;
    if (state.selectedHotspotId === hotspot.id) el.classList.add('hotspot--selected');
    el.title = hotspot.title || hotspot.id;
    el.setAttribute('aria-label', hotspot.title || hotspot.id);
    const isNav = hotspot.type === 'nav';
    const labelText = hotspot.shortLabel || hotspot.title || hotspot.id;
    const iconKey = hotspot.iconKey || (isNav ? 'nav' : 'info');
    const accent = hotspot.accentColor || ADMIN_HOTSPOT_CATEGORIES[hotspot.category]?.color;
    if (accent) el.style.setProperty('--hotspot-accent', accent);
    el.innerHTML = `
      <span class="hotspot__chip">
        <span class="hotspot__icon" aria-hidden="true">${adminHotspotIconSvg(iconKey)}</span>
        <span class="hotspot__label">${escapeHtml(labelText)}</span>
      </span>`;

    const control = container.createHotspot(el, {
      yaw: hotspot.yaw || 0,
      pitch: hotspot.pitch || 0
    });
    state.hotspotControls.push({ id: hotspot.id, control, el });

    if (canEdit) {
      enableHotspotDrag(el, control, hotspot, scene);
    } else {
      el.style.cursor = hotspot.type === 'nav' && hotspot.targetFile ? 'pointer' : 'default';
      if (hotspot.type === 'nav' && hotspot.targetFile) {
        const target = state.scenes.find((s) => s.file === hotspot.targetFile);
        el.title = target ? `Ir a ${target.shortTitle}` : (hotspot.title || hotspot.id);
      }
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.workMode === 'view' && hotspot.type === 'nav' && hotspot.targetFile) {
          navigateViaHotspot(hotspot);
          return;
        }
        if (hotspot.type === 'info') {
          selectHotspot(hotspot.id, { look: true });
          setStatus(hotspot.description || hotspot.title || 'Punto de información');
          return;
        }
        selectHotspot(hotspot.id, { look: true });
      });
    }
  });
}

async function navigateViaHotspot(hotspot) {
  const target = state.scenes.find((s) => s.file === hotspot.targetFile);
  if (!target) {
    setStatus(`No se encontró la escena destino (${hotspot.targetFile}).`);
    return;
  }
  setStatus(`Navegando a ${target.shortTitle}…`);
  await selectScene(hotspot.targetFile);
  setStatus(`Vista previa: ${target.shortTitle}. Sigue tocando puntos verdes para recorrer el tour.`);
}

function enableHotspotDrag(el, control, hotspot, scene) {
  let dragging = false;
  let moved = false;
  let pointerId = null;
  let suppressClick = false;

  el.setAttribute('draggable', 'false');
  el.style.touchAction = 'none';

  const onDocMove = (event) => {
    if (!dragging || !state.view) return;
    event.preventDefault();
    event.stopPropagation();
    moved = true;
    const rect = els.pano360.getBoundingClientRect();
    const coords = state.view.screenToCoordinates({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
    if (!coords) return;
    control.setPosition(coords);
    hotspot.yaw = coords.yaw;
    hotspot.pitch = coords.pitch;
    hotspot.direction = classifyLookingDirection(coords.yaw, coords.pitch, scene);
    hotspot.weight = directionWeight(hotspot.direction);
  };

  const endDrag = (event) => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    document.body.classList.remove('is-dragging-hotspot');
    window.removeEventListener('pointermove', onDocMove, true);
    window.removeEventListener('pointerup', endDrag, true);
    window.removeEventListener('pointercancel', endDrag, true);
    if (pointerId != null) {
      try { el.releasePointerCapture?.(pointerId); } catch (_e) { /* ignore */ }
    }
    pointerId = null;
    try { state.viewer?.controls?.()?.enable?.(); } catch (_e) { /* ignore */ }
    if (moved) {
      suppressClick = true;
      markDirty();
      if (els.directionSelect.querySelector(`option[value="${hotspot.direction}"]`)) {
        els.directionSelect.value = hotspot.direction;
      }
      // Actualiza panel sin hacer scroll de la página
      renderHotspotEditor(scene);
      setStatus(`Hotspot acomodado → ${DIRECTION_PRESETS[hotspot.direction]?.label || hotspot.direction}. Aplica y guarda.`);
    }
    event?.preventDefault?.();
    event?.stopPropagation?.();
  };

  el.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    dragging = true;
    moved = false;
    pointerId = event.pointerId;
    el.classList.add('is-dragging');
    document.body.classList.add('is-dragging-hotspot');
    try { el.setPointerCapture(pointerId); } catch (_e) { /* ignore */ }
    // Sin scrollList: evita que la página “salte” al panel
    selectHotspot(hotspot.id, { look: false, scrollList: false });
    try { state.viewer?.controls?.()?.disable?.(); } catch (_e) { /* ignore */ }
    window.addEventListener('pointermove', onDocMove, true);
    window.addEventListener('pointerup', endDrag, true);
    window.addEventListener('pointercancel', endDrag, true);
  });

  el.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    selectHotspot(hotspot.id, { look: true, scrollList: false });
  });

  el.addEventListener('dragstart', (event) => event.preventDefault());
}

function snapViewToDirection(direction) {
  if (!state.view) return;
  const preset = DIRECTION_PRESETS[direction];
  if (!preset) return;
  const abs = absoluteFromDirectionPreset(direction, getSelectedScene());
  state.view.setYaw(abs.yaw);
  state.view.setPitch(abs.pitch);
  if (els.directionSelect.querySelector(`option[value="${direction}"]`)) {
    els.directionSelect.value = direction;
  }
  updateCompassHighlight();
  setStatus(`Vista orientada a ${preset.label}. Coloca el hotspot o arrastra uno existente.`);
}

function updateCompassHighlight() {
  if (!state.view) {
    document.querySelectorAll('.compass-btn').forEach((btn) => btn.classList.remove('compass-btn--active'));
    return;
  }
  const scene = getSelectedScene();
  const dir = classifyLookingDirection(state.view.yaw(), state.view.pitch(), scene);
  document.querySelectorAll('.compass-btn[data-dir]').forEach((btn) => {
    btn.classList.toggle('compass-btn--active', btn.dataset.dir === dir);
  });
  if (els.directionSelect && DIRECTION_PRESETS[dir] && !els.directionSelect.disabled) {
    if (['forward', 'back', 'left', 'right', 'up', 'down'].includes(dir)) {
      const opt = els.directionSelect.querySelector(`option[value="${dir}"]`);
      if (opt) els.directionSelect.value = dir;
    }
  }
}

function useCurrentViewAsForward() {
  if (!state.view || state.workMode !== 'hotspots') return;
  const scene = getSelectedScene();
  if (!scene) return;
  const yaw = state.view.yaw();
  const pitch = state.view.pitch();
  const fov = typeof state.view.fov === 'function' ? state.view.fov() : DEFAULT_FRONT_VIEW.fov;
  scene.initialView = { yaw, pitch, fov };
  markDirty();
  updateFrontViewHint(scene);
  updateCompassHighlight();
  setStatus(
    `Vista principal (Adelante) definida: yaw ${yaw.toFixed(2)}, pitch ${pitch.toFixed(2)}. Aplica/guarda la escena; el pad y el visor público usarán este frente.`
  );
}

function getSceneFront(scene) {
  const raw = scene?.initialView;
  if (!raw || typeof raw.yaw !== 'number') {
    return { ...DEFAULT_FRONT_VIEW };
  }
  return {
    yaw: raw.yaw,
    pitch: typeof raw.pitch === 'number' ? raw.pitch : 0,
    fov: typeof raw.fov === 'number' ? raw.fov : DEFAULT_FRONT_VIEW.fov
  };
}

function absoluteFromDirectionPreset(direction, scene) {
  const preset = DIRECTION_PRESETS[direction] || DIRECTION_PRESETS.forward;
  const front = getSceneFront(scene);
  return {
    yaw: normalizeYaw(front.yaw + preset.yaw),
    pitch: front.pitch + preset.pitch,
    label: preset.label
  };
}

function classifyLookingDirection(yaw, pitch, scene) {
  const front = getSceneFront(scene);
  return classifyDirection(normalizeYaw(yaw - front.yaw), pitch - front.pitch);
}

function updateFrontViewHint(scene) {
  if (!els.frontViewHint) return;
  const front = getSceneFront(scene);
  const custom = scene?.initialView && typeof scene.initialView.yaw === 'number';
  els.frontViewHint.hidden = !custom;
  if (custom) {
    els.frontViewHint.textContent =
      `Vista principal (Adelante): yaw ${front.yaw.toFixed(2)} · pitch ${front.pitch.toFixed(2)}`;
  }
}

function selectHotspot(hotspotId, options = {}) {
  const { look = true, scrollList = false } = options;
  state.selectedHotspotId = hotspotId;
  const scene = getSelectedScene();
  const hotspot = scene?.hotspots.find((h) => h.id === hotspotId);

  els.btnDeleteSelected.disabled = !(state.workMode === 'hotspots' && hotspotId);

  state.hotspotControls.forEach(({ id, el }) => {
    el.classList.toggle('hotspot--selected', id === hotspotId);
  });

  els.hotspotList.querySelectorAll('.hotspot-admin-item').forEach((item) => {
    const selected = item.dataset.id === hotspotId;
    item.classList.toggle('hotspot-admin-item--selected', selected);
    if (selected && scrollList) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  if (look && hotspot && state.view) {
    state.view.setYaw(hotspot.yaw || 0);
    state.view.setPitch(hotspot.pitch || 0);
    updateCompassHighlight();
  }

  if (hotspot && look) {
    setStatus(`Seleccionado: ${hotspot.title || hotspot.id}`);
  }
}

async function deleteSelectedHotspot() {
  if (state.workMode !== 'hotspots' || !state.selectedHotspotId) return;
  const scene = getSelectedScene();
  if (!scene) return;
  const index = scene.hotspots.findIndex((h) => h.id === state.selectedHotspotId);
  if (index < 0) return;
  const ok = await askConfirm('Quitar hotspot', '¿Quitar el hotspot seleccionado? Puedes descartar antes de guardar.');
  if (!ok) return;
  const hotspot = scene.hotspots[index];
  const targetFile = hotspot?.targetFile;
  const hotspotId = hotspot?.id;
  scene.hotspots.splice(index, 1);
  if (hotspot?.type === 'nav') {
    state.graph.connections = state.graph.connections.filter((c) =>
      !(c.from === scene.file && (c.id === hotspotId || c.to === targetFile))
    );
  }
  state.selectedHotspotId = null;
  syncScenePatch(scene);
  persistGraphLocal();
  markDirty();
  renderViewerHotspots(scene);
  renderHotspotEditor(scene);
  renderConnections();
  layoutNodes();
  renderGraph();
  renderSceneList();
  updateGraphStats();
  els.btnDeleteSelected.disabled = true;
  setStatus('Hotspot y su conexión quitados del borrador. Pulsa Guardar cambios.');
}

function placeHotspotAtViewCenter() {
  if (state.workMode !== 'hotspots') {
    setStatus('Cambia a “Editar hotspots” para colocar puntos.');
    return;
  }
  const scene = getSelectedScene();
  if (!scene || !state.view) return;

  const yaw = state.view.yaw();
  const pitch = state.view.pitch();
  const direction = classifyLookingDirection(yaw, pitch, scene);
  els.directionSelect.value = direction;
  const id = `admin-${Date.now().toString(36)}`;

  if (state.placeMode === 'nav') {
    const targetFile = els.targetSelect.value;
    const target = state.scenes.find((s) => s.file === targetFile);
    if (!target) return;
    if (targetFile === scene.file) {
      setStatus('El destino no puede ser la misma escena.');
      return;
    }
    // Evitar duplicar mismo destino en el mismo sector
    const duplicate = scene.hotspots.find((h) =>
      h.type === 'nav' &&
      h.targetFile === targetFile &&
      Math.abs(shortestAngleDiff(h.yaw || 0, yaw)) < 0.35
    );
    if (duplicate) {
      setStatus('Ya hay un enlace a ese destino en esta dirección. Ajústalo en la lista.');
      return;
    }

    scene.hotspots.push({
      id,
      type: 'nav',
      title: `Ir a ${target.shortTitle}`,
      shortLabel: target.shortTitle,
      targetFile,
      yaw,
      pitch,
      direction,
      weight: directionWeight(direction),
      altText: `Navegar a ${target.shortTitle}`,
      description: `Continúa hacia ${target.shortTitle} (${DIRECTION_PRESETS[direction].label}).`,
      iconKey: 'nav',
      category: 'navigation',
      animationPreset: 'none'
    });
  } else {
    scene.hotspots.push({
      id,
      type: 'info',
      title: 'Punto de información',
      yaw,
      pitch,
      direction,
      altText: 'Punto de información',
      description: 'Describe este punto de interés del campus.',
      iconKey: 'info',
      category: 'general',
      animationPreset: 'none'
    });
  }

  markDirty();
  state.selectedHotspotId = id;
  renderViewerHotspots(scene);
  renderHotspotEditor(scene);
  renderSceneList();
  els.btnDeleteSelected.disabled = false;
  setStatus(`Hotspot colocado mirando ${DIRECTION_PRESETS[direction].label}. Aplica la escena y luego “Guardar cambios”.`);
}

function renderHotspotEditor(scene) {
  const canEdit = state.workMode === 'hotspots';
  els.hotspotList.innerHTML = scene.hotspots.map((h, index) => {
    const iconKey = h.iconKey || (h.type === 'nav' ? 'nav' : 'info');
    const category = h.category || 'general';
    const anim = h.animationPreset || 'none';
    const iconOptions = Object.entries(ADMIN_HOTSPOT_ICONS)
      .map(([key, meta]) =>
        `<option value="${key}" ${key === iconKey ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`
      )
      .join('');
    const categoryOptions = Object.entries(ADMIN_HOTSPOT_CATEGORIES)
      .map(([key, meta]) =>
        `<option value="${key}" ${key === category ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`
      )
      .join('');
    return `
    <li class="hotspot-admin-item${state.selectedHotspotId === h.id ? ' hotspot-admin-item--selected' : ''}" data-index="${index}" data-id="${escapeAttr(h.id)}">
      <strong>${escapeHtml(h.title || h.id)}</strong>
      <div class="meta">${h.type || 'info'} · ${iconKey} · ${category} · ${anim} · ${h.direction || classifyLookingDirection(h.yaw || 0, h.pitch || 0, scene)} · yaw ${(h.yaw || 0).toFixed(2)} · pitch ${(h.pitch || 0).toFixed(2)}</div>
      <div class="row">
        <input data-field="title" value="${escapeAttr(h.title || '')}" ${canEdit ? '' : 'disabled'}>
        <select data-field="type" ${canEdit ? '' : 'disabled'}>
          <option value="nav" ${h.type === 'nav' ? 'selected' : ''}>nav</option>
          <option value="info" ${h.type !== 'nav' ? 'selected' : ''}>info</option>
        </select>
        <select data-field="iconKey" title="Icono" ${canEdit ? '' : 'disabled'}>${iconOptions}</select>
        <select data-field="category" title="Categoría" ${canEdit ? '' : 'disabled'}>${categoryOptions}</select>
        <select data-field="animationPreset" title="Animación" ${canEdit ? '' : 'disabled'}>
          <option value="none" ${anim === 'none' ? 'selected' : ''}>sin animación</option>
          <option value="pulse" ${anim === 'pulse' ? 'selected' : ''}>pulse</option>
        </select>
        <select data-field="direction" ${canEdit ? '' : 'disabled'}>
          ${Object.entries(DIRECTION_PRESETS).map(([key, val]) =>
            `<option value="${key}" ${(h.direction || classifyLookingDirection(h.yaw || 0, h.pitch || 0, scene)) === key ? 'selected' : ''}>${val.label}</option>`
          ).join('')}
        </select>
        <select data-field="targetFile" ${canEdit && h.type === 'nav' ? '' : 'disabled'}>
          ${state.scenes.map((s) => `<option value="${s.file}" ${s.file === (h.targetFile || '') ? 'selected' : ''}>${escapeHtml(s.shortTitle)}</option>`).join('')}
        </select>
        <button type="button" data-action="look" ${state.view ? '' : 'disabled'}>Mirar</button>
        <button type="button" data-action="delete" ${canEdit ? '' : 'disabled'}>Eliminar</button>
      </div>
    </li>`;
  }).join('') || '<li class="meta list-empty">Escena sin hotspots · Encuadra la vista y pulsa «Colocar hotspot aquí».</li>';

  els.hotspotList.querySelectorAll('.hotspot-admin-item').forEach((item) => {
    const index = Number(item.dataset.index);
    const hotspotId = item.dataset.id;

    item.addEventListener('click', (event) => {
      if (event.target.closest('button, input, select')) return;
      selectHotspot(hotspotId, { look: true, scrollList: false });
    });

    item.querySelectorAll('[data-field]').forEach((field) => {
      field.addEventListener('change', () => {
        const hotspot = scene.hotspots[index];
        if (!hotspot) return;
        const key = field.dataset.field;
        hotspot[key] = field.value;
        if (key === 'type' && field.value !== 'nav') delete hotspot.targetFile;
        if (key === 'type' && field.value === 'nav' && !hotspot.targetFile) {
          hotspot.targetFile = els.targetSelect.value;
        }
        if (key === 'direction') {
          const abs = absoluteFromDirectionPreset(field.value, scene);
          hotspot.yaw = abs.yaw;
          hotspot.pitch = abs.pitch;
          hotspot.weight = directionWeight(field.value);
          if (state.view) {
            state.view.setYaw(abs.yaw);
            state.view.setPitch(abs.pitch);
            updateCompassHighlight();
          }
        }
        markDirty();
        state.selectedHotspotId = hotspot.id;
        renderViewerHotspots(scene);
        renderHotspotEditor(scene);
      });
    });
    item.querySelector('[data-action="look"]')?.addEventListener('click', () => {
      selectHotspot(hotspotId, { look: true, scrollList: true });
    });
    item.querySelector('[data-action="delete"]')?.addEventListener('click', async () => {
      const ok = await askConfirm('Eliminar hotspot', '¿Seguro que quieres eliminar este hotspot? Esta acción se puede descartar antes de guardar.');
      if (!ok) return;
      const hotspot = scene.hotspots[index];
      const targetFile = hotspot?.targetFile;
      const hotspotId = hotspot?.id;
      scene.hotspots.splice(index, 1);
      if (hotspot?.type === 'nav') {
        state.graph.connections = state.graph.connections.filter((c) =>
          !(c.from === scene.file && (c.id === hotspotId || c.to === targetFile))
        );
      }
      if (state.selectedHotspotId === hotspotId) state.selectedHotspotId = null;
      syncScenePatch(scene);
      persistGraphLocal();
      markDirty();
      renderViewerHotspots(scene);
      renderHotspotEditor(scene);
      renderConnections();
      layoutNodes();
      renderGraph();
      renderSceneList();
      updateGraphStats();
      els.btnDeleteSelected.disabled = !state.selectedHotspotId;
      setStatus('Hotspot eliminado del borrador. Pulsa Guardar cambios.');
    });
  });

  els.btnDeleteSelected.disabled = !(canEdit && state.selectedHotspotId);
}

function applySelectedSceneToGraph() {
  const scene = getSelectedScene();
  if (!scene) return;
  syncScenePatch(scene);

  // Reconstruir conexiones de esta escena (borrar las viejas, no acumular)
  state.graph.connections = (state.graph.connections || []).filter(
    (c) => c.from !== scene.file
  );
  scene.hotspots.filter((h) => h.type === 'nav' && h.targetFile).forEach((h) => {
    state.graph.connections.push({
      id: h.id,
      from: scene.file,
      to: h.targetFile,
      label: h.title,
      yaw: h.yaw,
      pitch: h.pitch,
      direction: h.direction || classifyLookingDirection(h.yaw || 0, h.pitch || 0, scene),
      weight: h.weight || directionWeight(h.direction || 'forward')
    });
  });

  persistGraphLocal();
  markDirty();
  renderConnections();
  layoutNodes();
  renderGraph();
  updateFrontViewHint(scene);
  updateGraphStats();
  setStatus(
    `Escena “${scene.shortTitle}” aplicada al borrador (${scene.hotspots.length} hotspots). Pulsa Guardar cambios para publicar.`
  );
}

async function saveAllChanges() {
  if (state.saving) {
    setStatus('Ya hay un guardado en curso…');
    return;
  }
  if (!state.authorized || !getSessionToken()) {
    setStatus('Sesión de editor requerida para guardar.');
    return;
  }

  const scene = getSelectedScene();
  if (scene && state.workMode === 'hotspots') {
    syncScenePatch(scene);
    state.graph.connections = (state.graph.connections || []).filter(
      (c) => c.from !== scene.file
    );
    scene.hotspots.filter((h) => h.type === 'nav' && h.targetFile).forEach((h) => {
      state.graph.connections.push({
        id: h.id,
        from: scene.file,
        to: h.targetFile,
        label: h.title,
        yaw: h.yaw,
        pitch: h.pitch,
        direction: h.direction || classifyLookingDirection(h.yaw || 0, h.pitch || 0, scene),
        weight: h.weight || directionWeight(h.direction || 'forward')
      });
    });
  }

  const sceneCount = state.scenes.length;
  const connCount = (state.graph.connections || []).length;
  const prevConn = state.lastSyncedConnectionCount || 0;
  const delta = Math.abs(connCount - prevConn);

  if (connCount === 0 && sceneCount > 3 && prevConn > 0) {
    const ok = await askConfirm(
      'Guardar sin conexiones',
      `Vas a publicar 0 conexiones (antes había ${prevConn} en Convex). El tour público perderá la navegación. ¿Continuar?`
    );
    if (!ok) {
      setStatus('Guardado cancelado: se evita borrar el grafo en Convex.');
      return;
    }
  } else if (sceneCount >= LARGE_TOUR_SCENE_THRESHOLD && delta >= 20) {
    const ok = await askConfirm(
      'Cambio grande en el grafo',
      `Vas a guardar ${sceneCount} escenas y ${connCount} conexiones (antes ~${prevConn}; Δ ${delta}). ¿Continuar?`
    );
    if (!ok) {
      setStatus('Guardado cancelado.');
      return;
    }
  }

  state.saving = true;
  els.btnSaveAll.disabled = true;
  setSaveProgress(
    sceneCount >= LARGE_TOUR_SCENE_THRESHOLD
      ? `Guardando ${sceneCount} escenas / ${connCount} conexiones…`
      : 'Guardando…'
  );

  try {
    persistGraphLocal();
    const result = await syncGraphToConvex({
      allowEmptyConfirmed: connCount === 0 && sceneCount > 3
    });
    if (!result) {
      updateDirtyUi(true);
      setSaveProgress('');
      return;
    }
    state.lastSyncedConnectionCount = result.connectionsSaved ?? connCount;
    updateDirtyUi(false);
    setSaveProgress('');
    const msg =
      `Guardado OK: ${result.scenesSaved} escenas, ${result.hotspotsSaved} hotspots, ` +
      `${result.connectionsSaved} conexiones. Recarga el tour (F5).`;
    setStatus(msg);
    announceToast(msg);
  } catch (error) {
    updateDirtyUi(true);
    setSaveProgress('');
    setStatus(`Error al sincronizar Convex: ${error.message}`);
  } finally {
    state.saving = false;
    updateDirtyUi(state.dirty);
  }
}

async function discardSelectedSceneEdits() {
  const ok = await askConfirm('Descartar edición', '¿Descartar los hotspots locales no guardados de esta escena y recargar el último grafo?');
  if (!ok) return;
  const file = state.selectedFile;
  const patch = state.graph.scenes[file];
  const scene = getSelectedScene();
  if (!scene) return;
  if (patch?.hotspots) {
    scene.hotspots = structuredClone(patch.hotspots);
    if (patch.initialView && typeof patch.initialView.yaw === 'number') {
      scene.initialView = structuredClone(patch.initialView);
    } else {
      delete scene.initialView;
    }
  } else {
    // Recargar desde biblioteca/config base requeriría re-init; mantenemos actuales si no hay patch
    setStatus('No hay parche guardado distinto para descartar en el grafo.');
  }
  renderViewerHotspots(scene);
  renderHotspotEditor(scene);
  updateFrontViewHint(scene);
  updateCompassHighlight();
  renderSceneList();
}

function layoutNodes() {
  const scenes = graphVisibleScenes();
  const width = els.graphSvg.clientWidth || 640;
  const height = Math.max(
    els.graphSvg.clientHeight || 360,
    120 + Math.ceil(Math.sqrt(Math.max(scenes.length, 1))) * 78
  );
  const cols = Math.max(3, Math.ceil(Math.sqrt(Math.max(scenes.length, 1))));
  state.nodePositions.clear();
  scenes.forEach((scene, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const span = Math.max(1, cols - 1);
    const x = 60 + col * ((width - 100) / span);
    const y = 50 + row * 72;
    state.nodePositions.set(scene.file, {
      x: Math.min(width - 40, x),
      y: Math.min(height - 30, y),
      scene
    });
  });
  if (els.graphSvg) {
    els.graphSvg.style.minHeight = `${height}px`;
  }
}

function renderGraph() {
  const width = els.graphSvg.clientWidth || 640;
  const height = Math.max(
    els.graphSvg.clientHeight || 360,
    120 + Math.ceil(Math.sqrt(Math.max(state.nodePositions.size, 1))) * 78
  );
  const nodes = [...state.nodePositions.entries()];
  const links = state.graph.connections.filter(
    (c) => state.nodePositions.has(c.from) && state.nodePositions.has(c.to)
  );
  const canLink = state.workMode === 'hotspots';
  const orphans = new Set(state.highlightOrphans ? orphanSceneFiles() : []);

  els.graphSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  els.graphSvg.setAttribute(
    'aria-label',
    `Mapa de enlaces: ${nodes.length} escenas visibles, ${links.length} conexiones mostradas`
  );
  els.graphSvg.innerHTML = `
    <defs>
      <marker id="arrowHead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,3 L0,6 Z" fill="#0284c7" />
      </marker>
      <marker id="arrowHeadBlue" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,3 L0,6 Z" fill="#0b7ad1" />
      </marker>
    </defs>
    ${links.map((c, index) => {
      const a = state.nodePositions.get(c.from);
      const b = state.nodePositions.get(c.to);
      const hasReturn = links.some((other) => other.from === c.to && other.to === c.from);
      const bend = hasReturn ? (c.from < c.to ? -36 : 36) : -28;
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2 + bend * 0.55;
      const cls = hasReturn ? 'graph-link graph-link--pair' : 'graph-link';
      const marker = hasReturn ? 'url(#arrowHeadBlue)' : 'url(#arrowHead)';
      const fromLabel = a.scene.shortTitle;
      const toLabel = b.scene.shortTitle;
      return `
        <path class="${cls}" data-from="${escapeAttr(c.from)}" data-to="${escapeAttr(c.to)}"
          tabindex="0" role="button"
          aria-label="Conexión ${escapeAttr(fromLabel)} ${hasReturn ? 'ida y vuelta' : 'hacia'} ${escapeAttr(toLabel)}. Enter para quitar."
          marker-end="${marker}" d="M${a.x},${a.y} Q ${midX},${(a.y + b.y) / 2 + bend} ${b.x},${b.y}" />
        ${index === links.findIndex((l) =>
          (l.from === c.from && l.to === c.to) || (hasReturn && l.from === c.to && l.to === c.from)
        ) && hasReturn && c.from < c.to
          ? `<text class="graph-link-label" x="${midX}" y="${midY}" text-anchor="middle">↔</text>`
          : ''}
      `;
    }).join('')}
    <path id="draftLink" class="graph-link-draft" d="" hidden></path>
    ${nodes.map(([file, pos]) => {
      const orphan = orphans.has(file);
      const selected = file === state.selectedFile;
      const deg = connectionDegree(file);
      return `
      <g class="graph-node ${selected ? 'selected' : ''} ${orphan ? 'graph-node--orphan' : ''}"
         data-file="${escapeAttr(file)}" transform="translate(${pos.x},${pos.y})"
         tabindex="0" role="button"
         aria-label="Escena ${escapeAttr(pos.scene.shortTitle)}${orphan ? ', sin conexiones' : `, ${deg} enlaces`}${selected ? ', seleccionada' : ''}. Enter para seleccionar.">
        <circle r="${selected ? 20 : 16}"></circle>
        <text text-anchor="middle" y="32">${escapeHtml(pos.scene.shortTitle).slice(0, 14)}</text>
      </g>`;
    }).join('')}
  `;

  const removeLink = async (from, to) => {
    if (state.workMode === 'view') {
      setStatus('Cambia a “Editar hotspots” para quitar conexiones.');
      return;
    }
    const hasReturn = state.graph.connections.some((c) => c.from === to && c.to === from);
    const ok = await askConfirm(
      'Quitar conexión',
      hasReturn
        ? '¿Quitar ida y vuelta entre estas escenas (ambos sentidos y sus hotspots nav)?'
        : '¿Quitar este enlace y su hotspot de navegación?'
    );
    if (!ok) return;
    removeConnectionPair(from, to, hasReturn);
  };

  els.graphSvg.querySelectorAll('.graph-link[data-from]').forEach((path) => {
    path.addEventListener('click', (event) => {
      event.stopPropagation();
      void removeLink(path.dataset.from, path.dataset.to);
    });
    path.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        void removeLink(path.dataset.from, path.dataset.to);
      }
    });
  });

  const draft = els.graphSvg.querySelector('#draftLink');
  els.graphSvg.querySelectorAll('.graph-node').forEach((node) => {
    node.addEventListener('click', (event) => {
      if (state._graphDidDrag) {
        state._graphDidDrag = false;
        event.preventDefault();
        return;
      }
      selectScene(node.dataset.file);
    });
    node.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectScene(node.dataset.file);
      }
    });
    if (!canLink) return;

    node.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const from = node.dataset.file;
      state.draftLink = { from };
      state._graphDidDrag = false;
      draft.hidden = false;
      const origin = state.nodePositions.get(from);

      const onMove = (moveEvent) => {
        if (!state.draftLink || state.draftLink.from !== from) return;
        state._graphDidDrag = true;
        const pt = svgPoint(moveEvent);
        draft.setAttribute('d', `M${origin.x},${origin.y} L${pt.x},${pt.y}`);
      };

      const onUp = (upEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (!state.draftLink) return;
        const targetEl = document.elementFromPoint(upEvent.clientX, upEvent.clientY)?.closest?.('.graph-node');
        const to = targetEl?.dataset?.file;
        state.draftLink = null;
        draft.hidden = true;
        draft.removeAttribute('d');
        if (to && to !== from && state._graphDidDrag) {
          addConnection(from, to, { bidirectional: true });
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
  });

  updateGraphStats();
}

function svgPoint(event) {
  const pt = els.graphSvg.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const ctm = els.graphSvg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

function oppositeDirection(direction) {
  switch (direction) {
    case 'forward': return 'back';
    case 'back': return 'forward';
    case 'left': return 'right';
    case 'right': return 'left';
    case 'up': return 'down';
    case 'down': return 'up';
    default: return 'back';
  }
}

function ensureNavHotspot(scene, targetFile, targetScene, direction, connectionId) {
  const abs = absoluteFromDirectionPreset(direction, scene);
  const existing = scene.hotspots.find((h) =>
    h.type === 'nav' &&
    h.targetFile === targetFile
  );
  if (existing) {
    // Ya hay enlace a ese destino: no duplicar; solo asegurar conexión en grafo
    return existing.id;
  }
  const id = connectionId || `conn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const label = `Ir a ${targetScene.shortTitle}`;
  scene.hotspots.push({
    id,
    type: 'nav',
    title: label,
    shortLabel: targetScene.shortTitle,
    targetFile,
    yaw: abs.yaw,
    pitch: abs.pitch,
    direction,
    weight: directionWeight(direction),
    altText: label,
    description: `Continúa hacia ${targetScene.shortTitle} (${abs.label}). Arrástralo en el 360° para acomodarlo.`
  });
  return id;
}

function upsertConnectionRecord(from, to, direction, hotspotId, label) {
  const fromScene = state.scenes.find((s) => s.file === from);
  const abs = absoluteFromDirectionPreset(direction, fromScene);
  const existing = state.graph.connections.find((c) => c.from === from && c.to === to);
  if (existing) {
    existing.id = hotspotId || existing.id;
    existing.direction = direction;
    existing.yaw = abs.yaw;
    existing.pitch = abs.pitch;
    existing.weight = directionWeight(direction);
    existing.label = label || existing.label;
    return existing;
  }
  const conn = {
    id: hotspotId || `conn-${Date.now().toString(36)}`,
    from,
    to,
    label: label || 'Ir a escena',
    yaw: abs.yaw,
    pitch: abs.pitch,
    direction,
    weight: directionWeight(direction)
  };
  state.graph.connections.push(conn);
  return conn;
}

function syncScenePatch(scene) {
  state.graph.scenes[scene.file] = {
    hotspots: structuredClone(scene.hotspots),
    ...(scene.initialView && typeof scene.initialView.yaw === 'number'
      ? { initialView: structuredClone(scene.initialView) }
      : {})
  };
}

function addConnection(from, to, options = {}) {
  const bidirectional = options.bidirectional !== false;
  const fromScene = state.scenes.find((s) => s.file === from);
  const toScene = state.scenes.find((s) => s.file === to);
  if (!fromScene || !toScene) return;

  const alreadyBoth = state.graph.connections.some((c) => c.from === from && c.to === to)
    && state.graph.connections.some((c) => c.from === to && c.to === from);
  if (alreadyBoth) {
    setStatus(`Ya estaban conectadas ida y vuelta: ${fromScene.shortTitle} ↔ ${toScene.shortTitle}.`);
    renderGraph();
    return;
  }

  const forwardDir = els.directionSelect.value || 'forward';
  const returnDir = oppositeDirection(forwardDir);

  const forwardId = ensureNavHotspot(fromScene, to, toScene, forwardDir);
  upsertConnectionRecord(from, to, forwardDir, forwardId, `Ir a ${toScene.shortTitle}`);

  if (bidirectional) {
    const returnId = ensureNavHotspot(toScene, from, fromScene, returnDir);
    upsertConnectionRecord(to, from, returnDir, returnId, `Ir a ${fromScene.shortTitle}`);
  }

  syncScenePatch(fromScene);
  if (bidirectional) syncScenePatch(toScene);

  persistGraphLocal();
  markDirty();
  renderConnections();
  layoutNodes();
  renderGraph();
  renderSceneList();
  updateGraphStats();

  const selected = getSelectedScene();
  if (selected && (selected.file === from || selected.file === to)) {
    renderViewerHotspots(selected);
    renderHotspotEditor(selected);
  }

  setStatus(
    bidirectional
      ? `Borrador: ${fromScene.shortTitle} ↔ ${toScene.shortTitle}. Pulsa Guardar cambios para publicar.`
      : `Borrador: ${fromScene.shortTitle} → ${toScene.shortTitle}. Pulsa Guardar cambios.`
  );
}

function removeNavHotspot(scene, targetFile, connectionId) {
  if (!scene) return;
  const before = scene.hotspots.length;
  scene.hotspots = scene.hotspots.filter((h) => {
    if (h.type !== 'nav') return true;
    if (connectionId && h.id === connectionId) return false;
    if (targetFile && h.targetFile === targetFile) return false;
    return true;
  });
  if (scene.hotspots.length !== before) syncScenePatch(scene);
}

function removeConnectionPair(from, to, bothWays = false) {
  const targets = bothWays
    ? [{ from, to }, { from: to, to: from }]
    : [{ from, to }];

  targets.forEach(({ from: a, to: b }) => {
    const removed = state.graph.connections.filter((c) => c.from === a && c.to === b);
    state.graph.connections = state.graph.connections.filter((c) => !(c.from === a && c.to === b));
    const scene = state.scenes.find((s) => s.file === a);
    removed.forEach((c) => removeNavHotspot(scene, b, c.id));
    if (scene) removeNavHotspot(scene, b, null);
  });

  persistGraphLocal();
  markDirty();
  renderConnections();
  layoutNodes();
  renderGraph();
  renderSceneList();
  updateGraphStats();
  const selected = getSelectedScene();
  if (selected) {
    renderViewerHotspots(selected);
    renderHotspotEditor(selected);
  }
  setStatus(
    bothWays
      ? 'Conexión ida y vuelta eliminada del borrador. Pulsa Guardar cambios.'
      : 'Conexión eliminada del borrador. Pulsa Guardar cambios.'
  );
}

function rebuildConnectionsFromHotspots() {
  const next = [];
  state.scenes.forEach((scene) => {
    scene.hotspots
      .filter((h) => h.type === 'nav' && h.targetFile)
      .forEach((h) => {
        next.push({
          id: h.id,
          from: scene.file,
          to: h.targetFile,
          label: h.title,
          yaw: h.yaw,
          pitch: h.pitch,
          direction: h.direction || classifyLookingDirection(h.yaw || 0, h.pitch || 0, scene),
          weight: h.weight || directionWeight(h.direction || 'forward')
        });
      });
    syncScenePatch(scene);
  });
  state.graph.connections = next;
}

/** Count nav hotspots across scenes (public viewer SoT before reconcile). */
function countNavHotspots() {
  return state.scenes.reduce(
    (n, s) => n + (s.hotspots || []).filter((h) => h.type === 'nav').length,
    0
  );
}

/**
 * Connections (graph panel) are SoT for which nav edges exist.
 * Drops phantom campus auto-next/prev nav not listed as connections;
 * creates missing nav from connection yaw/pitch when needed.
 */
function syncNavHotspotsToConnections() {
  const byFrom = new Map();
  for (const c of state.graph.connections || []) {
    if (!c?.from || !c?.to) continue;
    const list = byFrom.get(c.from) || [];
    list.push(c);
    byFrom.set(c.from, list);
  }

  state.scenes.forEach((scene) => {
    const info = (scene.hotspots || []).filter((h) => h.type !== 'nav');
    const navByTarget = new Map(
      (scene.hotspots || [])
        .filter((h) => h.type === 'nav' && h.targetFile)
        .map((h) => [h.targetFile, h])
    );
    const navById = new Map(
      (scene.hotspots || []).filter((h) => h.type === 'nav').map((h) => [h.id, h])
    );
    const edges = byFrom.get(scene.file) || [];
    const nav = edges.map((edge) => {
      const existing = (edge.id && navById.get(edge.id)) || navByTarget.get(edge.to);
      const toScene = state.scenes.find((s) => s.file === edge.to);
      if (existing) {
        return {
          ...existing,
          type: 'nav',
          targetFile: edge.to,
          title: existing.title || edge.label || `Ir a ${toScene?.shortTitle || 'escena'}`,
          direction: edge.direction || existing.direction,
          yaw: typeof existing.yaw === 'number' ? existing.yaw : Number(edge.yaw) || 0,
          pitch: typeof existing.pitch === 'number' ? existing.pitch : Number(edge.pitch) || -0.05,
          weight: edge.weight || existing.weight
        };
      }
      return {
        id: edge.id || `conn-${Date.now().toString(36)}-${edge.to}`,
        type: 'nav',
        title: edge.label || `Ir a ${toScene?.shortTitle || 'escena'}`,
        yaw: Number(edge.yaw) || 0,
        pitch: Number(edge.pitch) || -0.05,
        direction: edge.direction || 'forward',
        targetFile: edge.to,
        weight: edge.weight || directionWeight(edge.direction || 'forward'),
        altText: edge.label || 'Navegación',
        description: edge.label || 'Continúa el recorrido.'
      };
    });
    scene.hotspots = [...info, ...nav];
    syncScenePatch(scene);
  });
}

async function pruneOrphanConnections() {
  const before = state.graph.connections.length;
  rebuildConnectionsFromHotspots();
  persistGraphLocal();
  markDirty();
  renderConnections();
  layoutNodes();
  renderGraph();
  updateGraphStats();
  const removed = Math.max(0, before - state.graph.connections.length);
  setStatus(
    removed > 0
      ? `Borrador: se quitaron ${removed} conexiones huérfanas. Pulsa Guardar cambios.`
      : 'No había conexiones huérfanas. El listado ya coincide con los hotspots nav.'
  );
}

async function clearSelectedSceneConnections() {
  const scene = getSelectedScene();
  if (!scene) {
    setStatus('Selecciona una escena primero.');
    return;
  }
  const ok = await askConfirm(
    'Limpiar escena',
    `¿Quitar todas las conexiones de “${scene.shortTitle}” (entrantes y salientes) y sus hotspots nav?`
  );
  if (!ok) return;

  const file = scene.file;
  const related = state.graph.connections.filter((c) => c.from === file || c.to === file);
  related.forEach((c) => {
    const fromScene = state.scenes.find((s) => s.file === c.from);
    removeNavHotspot(fromScene, c.to, c.id);
  });
  state.graph.connections = state.graph.connections.filter((c) => c.from !== file && c.to !== file);
  scene.hotspots = scene.hotspots.filter((h) => h.type !== 'nav');
  syncScenePatch(scene);

  persistGraphLocal();
  markDirty();
  renderConnections();
  layoutNodes();
  renderGraph();
  renderViewerHotspots(scene);
  renderHotspotEditor(scene);
  renderSceneList();
  updateGraphStats();
  setStatus(`Escena “${scene.shortTitle}” sin conexiones en borrador. Pulsa Guardar cambios.`);
}

async function clearAllConnections() {
  const ok = await askConfirm(
    'Limpiar todas las conexiones',
    '¿Borrar TODAS las conexiones del grafo y todos los hotspots de navegación de todas las escenas? Los puntos info se conservan. Deberás confirmar de nuevo al Guardar si el tour tenía aristas en Convex.'
  );
  if (!ok) return;

  state.graph.connections = [];
  state.scenes.forEach((scene) => {
    scene.hotspots = scene.hotspots.filter((h) => h.type !== 'nav');
    syncScenePatch(scene);
  });

  persistGraphLocal();
  markDirty();
  renderConnections();
  layoutNodes();
  renderGraph();
  renderSceneList();
  updateGraphStats();
  const selected = getSelectedScene();
  if (selected) {
    renderViewerHotspots(selected);
    renderHotspotEditor(selected);
  }
  setStatus('Grafo limpio en borrador. Pulsa Guardar cambios para publicar (pedirá confirmación si Convex tenía aristas).');
}

function renderConnections() {
  const canEdit = state.workMode === 'hotspots' || state.workMode === 'scenes';
  const visibleFiles = new Set(state.nodePositions.keys());
  const zoneActive = !!els.zoneFilter.value || !!(els.sceneSearch.value || '').trim() ||
    (state.focusNeighborhood && state.scenes.length >= LARGE_TOUR_SCENE_THRESHOLD && state.selectedFile);
  let list = state.graph.connections || [];
  if (zoneActive && visibleFiles.size > 0) {
    list = list.filter((c) => visibleFiles.has(c.from) || visibleFiles.has(c.to));
  }
  // Prefer selected scene's edges first when focusing.
  if (state.selectedFile) {
    const focus = state.selectedFile;
    list = [...list].sort((a, b) => {
      const aHit = a.from === focus || a.to === focus ? 0 : 1;
      const bHit = b.from === focus || b.to === focus ? 0 : 1;
      return aHit - bHit;
    });
  }

  els.connectionList.innerHTML = list.map((c, index) => {
    const from = state.scenes.find((s) => s.file === c.from)?.shortTitle || c.from;
    const to = state.scenes.find((s) => s.file === c.to)?.shortTitle || c.to;
    const dir = c.direction || classifyDirection(c.yaw || 0, c.pitch || 0);
    const hasReturn = state.graph.connections.some((other) => other.from === c.to && other.to === c.from);
    const focused = state.selectedFile && (c.from === state.selectedFile || c.to === state.selectedFile);
    return `<li class="connection-item ${focused ? 'connection-item--focus' : ''}" data-index="${index}" data-from="${escapeAttr(c.from)}" data-to="${escapeAttr(c.to)}">
      <span>${escapeHtml(from)} ${hasReturn ? '↔' : '→'} ${escapeHtml(to)} <em>(${DIRECTION_PRESETS[dir]?.label || dir})</em></span>
      <span class="row-actions">
        ${hasReturn ? `<button type="button" data-action="remove-pair" ${canEdit ? '' : 'disabled'} aria-label="Quitar ida y vuelta entre ${escapeAttr(from)} y ${escapeAttr(to)}">Quitar ↔</button>` : ''}
        <button type="button" data-action="remove" ${canEdit ? '' : 'disabled'} aria-label="Quitar enlace de ${escapeAttr(from)} a ${escapeAttr(to)}">Quitar</button>
      </span>
    </li>`;
  }).join('') || '<li class="meta list-empty">Sin enlaces todavía · Usa «Conectar» o arrastra un nodo sobre otro en el grafo.</li>';

  els.connectionList.querySelectorAll('[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.connection-item');
      const ok = await askConfirm('Quitar enlace', '¿Eliminar esta conexión (un sentido) y su hotspot nav?');
      if (!ok) return;
      removeConnectionPair(item.dataset.from, item.dataset.to, false);
    });
  });

  els.connectionList.querySelectorAll('[data-action="remove-pair"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.connection-item');
      const ok = await askConfirm('Quitar ida y vuelta', '¿Eliminar ambos sentidos y sus hotspots nav?');
      if (!ok) return;
      removeConnectionPair(item.dataset.from, item.dataset.to, true);
    });
  });
}

function openSceneDialog(mode) {
  state.sceneDialogMode = mode;
  const isUpload = mode === 'upload';
  els.sceneDialogTitle.textContent =
    mode === 'add' ? 'Añadir / registrar escena'
      : mode === 'upload' ? 'Subir panorama a Convex'
        : 'Editar datos de escena';
  if (els.sceneDialogHint) {
    els.sceneDialogHint.textContent = isUpload
      ? 'Sube un JPG/PNG/WebP equirectangular. Queda en Convex File Storage y aparece en el tour público.'
      : mode === 'add'
        ? 'Registra un archivo ya presente en panoramas/ (config local).'
        : 'Actualiza título y zona de la escena seleccionada.';
  }
  if (els.sceneFileLabel) els.sceneFileLabel.hidden = isUpload;
  if (els.sceneUploadLabel) els.sceneUploadLabel.hidden = !isUpload;
  if (els.panoramaUploadInput) {
    els.panoramaUploadInput.value = '';
    els.panoramaUploadInput.required = isUpload;
  }
  els.sceneFileSelect.required = !isUpload;
  els.sceneFileSelect.disabled = mode === 'edit';

  if (!isUpload) {
    const used = new Set(state.scenes.map((s) => s.file));
    const files = mode === 'add'
      ? state.availableFiles.filter((f) => !used.has(f))
      : state.availableFiles;
    if (mode === 'add' && files.length === 0) {
      setStatus('No hay panoramas sin registrar en config.json. Usa “Subir panorama” para añadir nuevos.');
      return;
    }
    els.sceneFileSelect.innerHTML = files.map((f) => `<option value="${f}">${f}</option>`).join('');
  }

  const scene = getSelectedScene();
  if (mode === 'edit' && scene) {
    els.sceneForm.shortTitle.value = scene.shortTitle;
    els.sceneForm.title.value = scene.title;
    els.sceneFileSelect.value = scene.file;
    els.sceneZoneSelect.value = scene.zone || els.sceneZoneSelect.options[0]?.value;
  } else {
    els.sceneForm.reset();
    if (els.sceneFileLabel) els.sceneFileLabel.hidden = isUpload;
    if (els.sceneUploadLabel) els.sceneUploadLabel.hidden = !isUpload;
    els.sceneFileSelect.disabled = false;
    els.sceneForm.shortTitle.value = '';
    els.sceneForm.title.value = '';
  }
  if (els.sceneFormSave) {
    els.sceneFormSave.textContent = isUpload ? 'Subir y registrar' : 'Guardar';
  }
  els.sceneDialog.showModal();
}

async function onSceneFormSubmit(event) {
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return;
  event.preventDefault();
  const shortTitle = els.sceneForm.shortTitle.value.trim();
  const title = els.sceneForm.title.value.trim();
  const zone = els.sceneZoneSelect.value;
  if (!shortTitle || !title || !zone) return;

  if (state.sceneDialogMode === 'upload') {
    await uploadPanoramaAndRegister({ shortTitle, title, zone });
    return;
  }

  const file = els.sceneFileSelect.value;
  if (!file) return;

  if (state.sceneDialogMode === 'add') {
    if (state.scenes.some((s) => s.file === file)) {
      setStatus('Esa escena ya existe.');
      return;
    }
    state.scenes.push({
      file,
      zone,
      id: slugify(file),
      title,
      shortTitle,
      hotspots: [],
      order: state.scenes.length,
      imageUrl: null
    });
  } else {
    const scene = getSelectedScene();
    if (!scene) return;
    scene.title = title;
    scene.shortTitle = shortTitle;
    scene.zone = zone;
  }

  state.graph.sceneMeta[file] = { title, shortTitle, zone };
  markDirty();
  fillTargets();
  fillZones();
  renderSceneList();
  layoutNodes();
  renderGraph();
  els.sceneDialog.close();
  setStatus('Metadatos de escena actualizados. Recuerda guardar cambios.');
}

async function uploadPanoramaAndRegister({ shortTitle, title, zone }) {
  const token = getSessionToken();
  if (!token) {
    setStatus('Inicia sesión para subir panoramas a Convex.');
    return;
  }
  const file = els.panoramaUploadInput?.files?.[0];
  if (!file) {
    setStatus('Elige un archivo de imagen.');
    return;
  }
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (file.type && !allowed.includes(file.type)) {
    setStatus('Formato no soportado. Usa JPG, PNG o WebP.');
    return;
  }
  if (file.size > 40 * 1024 * 1024) {
    setStatus('Archivo demasiado grande (máx. ~40 MB).');
    return;
  }

  const saveBtn = els.sceneFormSave;
  if (saveBtn) saveBtn.disabled = true;
  setStatus('Subiendo panorama a Convex…');
  try {
    const uploadMeta = await convexFetch('mutation', 'media:generateUploadUrl', {
      token,
      tourSlug: requireTourSlug(),
      orgSlug: requireOrgSlugCw(),
    });
    const uploadUrl = uploadMeta?.uploadUrl || uploadMeta;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: file.type ? { 'Content-Type': file.type } : undefined,
      body: file
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload HTTP ${uploadRes.status}`);
    }
    const uploaded = await uploadRes.json();
    const storageId = uploaded.storageId;
    if (!storageId) throw new Error('Convex no devolvió storageId');

    const stamped = `${Date.now()}-${file.name || 'panorama.jpg'}`;
    const result = await convexFetch('mutation', 'media:attachPanoramaToScene', {
      token,
      tourSlug: requireTourSlug(),
      orgSlug: requireOrgSlugCw(),
      fileKey: stamped,
      storageId,
      title,
      shortTitle,
      zone,
      organizationId: uploadMeta?.organizationId
    });

    const fileKey = result.fileKey;
    let scene = state.scenes.find((s) => s.file === fileKey);
    if (!scene) {
      scene = {
        file: fileKey,
        zone,
        id: slugify(fileKey),
        title,
        shortTitle,
        hotspots: [],
        order: state.scenes.length,
        imageUrl: result.imageUrl
      };
      state.scenes.push(scene);
    } else {
      scene.title = title;
      scene.shortTitle = shortTitle;
      scene.zone = zone;
      scene.imageUrl = result.imageUrl;
    }
    if (!state.availableFiles.includes(fileKey)) state.availableFiles.push(fileKey);
    state.graph.sceneMeta[fileKey] = { title, shortTitle, zone };
    state.graph.scenes[fileKey] = { hotspots: structuredClone(scene.hotspots || []) };

    markDirty();
    fillTargets();
    fillZones();
    renderSceneList();
    layoutNodes();
    renderGraph();
    els.sceneDialog.close();
    await selectScene(fileKey);
    setStatus(`Panorama subido: ${fileKey}. Guarda cambios para sincronizar hotspots/conexiones.`);
  } catch (error) {
    setStatus(`Error al subir panorama: ${error.message}`);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

/** Local draft only — never pushes to Convex (avoids accidental wipe on every edit). */
function persistGraphLocal() {
  state.graph.updatedAt = new Date().toISOString();
  state.scenes.forEach((scene) => {
    syncScenePatch(scene);
  });
  localStorage.setItem(storageKey(), JSON.stringify(state.graph, null, 2));
}

/**
 * @deprecated Prefer persistGraphLocal + explicit saveAllChanges.
 * Kept for import path that intentionally publishes after confirm.
 */
function persistGraph() {
  persistGraphLocal();
  return syncGraphToConvex({});
}

/**
 * Push draft to Convex. Empty-connection wipe requires allowEmptyConfirmed or interactive confirm.
 * @param {{ allowEmptyConfirmed?: boolean }} opts
 */
async function syncGraphToConvex(opts = {}) {
  const token = getSessionToken();
  if (!token) {
    setStatus('Guardado local. Inicia sesión para sincronizar a Convex (compartido entre navegadores).');
    return null;
  }

  syncNavHotspotsToConnections();

  const pendingConnections = state.graph.connections || [];
  let allowEmptyConnections = false;
  if (pendingConnections.length === 0 && state.scenes.length > 3) {
    if (opts.allowEmptyConfirmed) {
      allowEmptyConnections = true;
    } else {
      const ok = await askConfirm(
        'Guardar sin conexiones',
        'Vas a publicar 0 conexiones en Convex y el tour público perderá los hotspots de navegación. ' +
          'Solo continúa si es intencional (p. ej. borrar todo el grafo). ¿Continuar?'
      );
      if (!ok) {
        setStatus('Guardado cancelado: se evita borrar el grafo en Convex.');
        return null;
      }
      allowEmptyConnections = true;
    }
  }

  const scenesPayload = state.scenes.map((s, index) => ({
    fileKey: s.file,
    title: s.title,
    shortTitle: s.shortTitle || s.title,
    zone: s.zone,
    order: typeof s.order === 'number' ? s.order : index,
    imageUrl: s.imageUrl && /^https?:\/\//i.test(s.imageUrl)
      ? s.imageUrl
      : `${PANORAMA_BASE()}${s.file}`,
    altText: s.altText || s.title,
    longDescription: s.longDescription,
    ...(s.initialView && typeof s.initialView.yaw === 'number'
      ? {
          initialView: {
            yaw: Number(s.initialView.yaw) || 0,
            pitch: Number(s.initialView.pitch) || 0,
            ...(typeof s.initialView.fov === 'number' ? { fov: Number(s.initialView.fov) } : {})
          }
        }
      : {}),
    hotspots: (s.hotspots || []).map((h) => ({
      id: h.id,
      type: h.type === 'nav' ? 'nav' : 'info',
      title: h.title || h.id,
      yaw: Number(h.yaw) || 0,
      pitch: Number(h.pitch) || 0,
      direction: h.direction,
      targetFile: h.targetFile,
      description: h.description,
      weight: h.weight,
      shortLabel: h.shortLabel,
      altText: h.altText,
      ...(h.iconKey ? { iconKey: h.iconKey } : {}),
      ...(h.category ? { category: h.category } : {}),
      ...(h.animationPreset ? { animationPreset: h.animationPreset } : {}),
      ...(h.accentColor ? { accentColor: h.accentColor } : {})
    }))
  }));

  const connections = (state.graph.connections || []).map((c) => ({
    id: c.id,
    from: c.from,
    to: c.to,
    label: c.label,
    yaw: c.yaw,
    pitch: c.pitch,
    direction: c.direction,
    weight: c.weight
  }));

  setSaveProgress(
    state.scenes.length >= LARGE_TOUR_SCENE_THRESHOLD
      ? `Enviando ${scenesPayload.length} escenas / ${connections.length} conexiones a Convex…`
      : 'Enviando a Convex…'
  );

  const result = await convexFetch('mutation', 'tourAdmin:saveTourSnapshot', {
    token,
    slug: TOUR_SLUG(),
    orgSlug: requireOrgSlugCw(),
    scenes: scenesPayload,
    connections,
    ...(allowEmptyConnections ? { allowEmptyConnections: true } : {})
  });
  return result;
}

function setSaveProgress(text) {
  if (!els.saveProgress) return;
  if (!text) {
    els.saveProgress.hidden = true;
    els.saveProgress.textContent = '';
    return;
  }
  els.saveProgress.hidden = false;
  els.saveProgress.textContent = text;
}

function announceToast(message) {
  // statusBar already has aria-live; also flash saveProgress briefly for SR/visual feedback
  setSaveProgress(message);
  window.setTimeout(() => {
    if (els.saveProgress?.textContent === message) setSaveProgress('');
  }, 6000);
}

function exportGraph() {
  persistGraphLocal();
  const blob = new Blob([JSON.stringify(state.graph, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tour-graph.json';
  a.click();
  URL.revokeObjectURL(url);
  setStatus(
    state.dirty
      ? 'Descargado tour-graph.json (borrador local). Aún hay cambios sin publicar en Convex.'
      : 'Descargado tour-graph.json (backup). La fuente viva es Convex si hay sesión.'
  );
}

async function importGraph(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const ok = await askConfirm(
    'Importar grafo',
    state.dirty
      ? 'Hay cambios sin guardar. Importar reemplaza el grafo local (y Convex si hay sesión). ¿Continuar?'
      : 'Importar reemplaza el grafo actual con el JSON. Si hay sesión, se guarda en Convex. ¿Continuar?'
  );
  if (!ok) {
    event.target.value = '';
    return;
  }
  try {
    const text = await file.text();
    state.graph = normalizeGraph(JSON.parse(text));

    Object.entries(state.graph.scenes || {}).forEach(([fileName, patch]) => {
      const scene = state.scenes.find((s) => s.file === fileName);
      if (scene && Array.isArray(patch.hotspots)) scene.hotspots = structuredClone(patch.hotspots);
    });
    Object.entries(state.graph.sceneMeta || {}).forEach(([fileName, meta]) => {
      const scene = state.scenes.find((s) => s.file === fileName);
      if (!scene || !meta) return;
      if (meta.title) scene.title = meta.title;
      if (meta.shortTitle) scene.shortTitle = meta.shortTitle;
      if (meta.zone) scene.zone = meta.zone;
    });

    if ((state.graph.connections || []).length > 0) {
      syncNavHotspotsToConnections();
    } else {
      rebuildConnectionsFromHotspots();
    }

    persistGraphLocal();
    fillConnectSelects();
    const token = getSessionToken();
    if (token) {
      setSaveProgress('Importando y publicando en Convex…');
      const result = await syncGraphToConvex({});
      if (result) {
        state.lastSyncedConnectionCount = result.connectionsSaved;
        updateDirtyUi(false);
        setStatus(
          `Grafo importado y guardado en Convex (${result.connectionsSaved} conexiones).`
        );
      } else {
        markDirty();
        setStatus('Grafo importado en local; publicación en Convex cancelada o fallida.');
      }
      setSaveProgress('');
    } else {
      markDirty();
      setStatus('Grafo importado en local. Inicia sesión y pulsa Guardar para publicarlo en Convex.');
    }
    renderSceneList();
    renderConnections();
    layoutNodes();
    renderGraph();
    updateGraphStats();
    if (state.selectedFile) {
      const scene = getSelectedScene();
      if (scene) {
        await mountViewer(scene);
        renderHotspotEditor(scene);
      }
    }
  } catch (error) {
    setStatus(`No se pudo importar: ${error.message}`);
  } finally {
    event.target.value = '';
  }
}

function markDirty() {
  updateDirtyUi(true);
}

function updateDirtyUi(dirty) {
  state.dirty = dirty;
  els.dirtyBadge.hidden = !dirty;
  if (els.dirtyBadge) {
    els.dirtyBadge.textContent = dirty ? 'Cambios sin guardar' : '';
  }
  els.btnSaveAll.disabled = !dirty || state.saving;
  if (dirty) {
    document.title = document.title.startsWith('● ')
      ? document.title
      : `● ${document.title.replace(/^●\s*/, '')}`;
  } else {
    document.title = document.title.replace(/^●\s*/, '');
  }
}

function loadStoredGraph() {
  try {
    const raw = localStorage.getItem(storageKey());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function normalizeGraph(graph) {
  return {
    version: 1,
    updatedAt: graph?.updatedAt || null,
    connections: Array.isArray(graph?.connections) ? graph.connections : [],
    scenes: graph?.scenes && typeof graph.scenes === 'object' ? graph.scenes : {},
    sceneMeta: graph?.sceneMeta && typeof graph.sceneMeta === 'object' ? graph.sceneMeta : {}
  };
}

/** Score for choosing between localStorage and static tour-graph.json. */
function graphEdgeScore(graph) {
  if (!graph || typeof graph !== 'object') return 0;
  const conns = Array.isArray(graph.connections) ? graph.connections.length : 0;
  const scenes =
    graph.scenes && typeof graph.scenes === 'object' ? Object.keys(graph.scenes).length : 0;
  return conns * 10 + scenes;
}

function pickRichestGraph(...candidates) {
  let best = null;
  let bestScore = -1;
  for (const g of candidates) {
    const score = graphEdgeScore(g);
    if (score > bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return best || { version: 1, connections: [], scenes: {}, sceneMeta: {} };
}

function classifyDirection(yaw, pitch) {
  if (pitch > 0.22) return 'up';
  if (pitch < -0.28) return 'down';
  const y = normalizeYaw(yaw);
  const abs = Math.abs(y);
  if (abs <= Math.PI / 4) return 'forward';
  if (abs >= (3 * Math.PI) / 4) return 'back';
  return y < 0 ? 'left' : 'right';
}

function directionWeight(direction) {
  switch (direction) {
    case 'forward': return 1.5;
    case 'back': return 1.35;
    case 'up':
    case 'down': return 1.45;
    case 'left':
    case 'right': return 1.25;
    default: return 1.2;
  }
}

function normalizeYaw(yaw) {
  let y = yaw;
  while (y > Math.PI) y -= Math.PI * 2;
  while (y < -Math.PI) y += Math.PI * 2;
  return y;
}

function shortestAngleDiff(a, b) {
  let diff = normalizeYaw(a - b);
  return diff;
}

function askConfirm(title, message) {
  return new Promise((resolve) => {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    const onClose = () => {
      els.confirmDialog.removeEventListener('close', onClose);
      resolve(els.confirmDialog.returnValue === 'ok');
    };
    els.confirmDialog.addEventListener('close', onClose);
    els.confirmDialog.showModal();
  });
}

function setStatus(message) {
  els.statusBar.textContent = message;
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json();
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function cleanTitle(title) {
  return String(title || '').replace(/^\d+\.\s*/, '');
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Inline SVG icons (mirror src/hotspotIcons.js — Control Web is non-module). */
const ADMIN_HOTSPOT_CATEGORIES = {
  general: { label: 'General', color: '#64748b' },
  facilities: { label: 'Servicios', color: '#0284c7' },
  medical: { label: 'Salud', color: '#dc2626' },
  transport: { label: 'Transporte', color: '#ca8a04' },
  expo: { label: 'Expo', color: '#7c3aed' },
  navigation: { label: 'Navegación', color: '#059669' }
};

const ADMIN_HOTSPOT_ICONS = {
  nav: { label: 'Navegación' },
  info: { label: 'Información' },
  pin: { label: 'Pin / lugar' },
  bath: { label: 'Baños' },
  medical: { label: 'Salud' },
  transport: { label: 'Transporte' },
  drone: { label: 'Vista / drone' },
  expo: { label: 'Expo' },
  wardrobe: { label: 'Guardarropa' }
};

function adminHotspotIconSvg(type) {
  const common =
    'class="hotspot__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"';
  const icons = {
    nav: `<svg ${common}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/><path fill="currentColor" d="M10.2 7.4a1 1 0 0 1 1.4-.15l4.2 3.6a1 1 0 0 1 0 1.5l-4.2 3.6a1 1 0 1 1-1.25-1.55L13.4 12l-3.05-2.6a1 1 0 0 1-.15-1.4z"/></svg>`,
    info: `<svg ${common}><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/><circle cx="12" cy="8" r="1.35" fill="currentColor"/><path fill="currentColor" d="M11.1 11.2h1.8v6.1h-1.8z"/></svg>`,
    pin: `<svg ${common}><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>`,
    bath: `<svg ${common}><path fill="currentColor" d="M7 4.5A1.5 1.5 0 0 1 8.5 3h1A1.5 1.5 0 0 1 11 4.5V8h7.5a.5.5 0 0 1 .5.5V10H5V8.5A.5.5 0 0 1 5.5 8H7V4.5zM5 11h14v2.2c0 2.4-1.6 4.5-3.9 5.2l.4 1.6h-1.6l-.3-1.2H9.4l-.3 1.2H7.5l.4-1.6C5.6 17.7 4 15.6 4 13.2V11h1z"/></svg>`,
    medical: `<svg ${common}><path fill="currentColor" d="M9 3h6v4h4v6h-4v4H9v-4H5V7h4V3zm2 2v4H7v2h4v4h2v-4h4v-2h-4V5h-2z"/></svg>`,
    transport: `<svg ${common}><path fill="currentColor" d="M6 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1l1 2v1h-2l-1-2H9l-1 2H6v-1l1-2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v5h12V6H6zm2.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/></svg>`,
    drone: `<svg ${common}><path fill="currentColor" d="M4 7.5 7.5 4 10 6.5 8.5 8 11 10.5 13 8.5l-1.5-1.5L14 4.5 17.5 8 15 10.5l1.5 1.5L14 14.5 16.5 17 13 20.5 10.5 18l-1.5 1.5L6 16.5 8.5 14 6.5 12 4 14.5 0.5 11 3 8.5 4 7.5zm8 2.2 1.3 1.3-1.3 1.3-1.3-1.3 1.3-1.3z"/></svg>`,
    expo: `<svg ${common}><path fill="currentColor" d="M4 19h16v2H4v-2zm2-2V9l6-5 6 5v8H6zm2-1h8v-6.2l-4-3.3-4 3.3V16z"/></svg>`,
    wardrobe: `<svg ${common}><path fill="currentColor" d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v14h4.5V5H7zm5.5 0v14H17V5h-4.5zM9 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/></svg>`
  };
  return icons[type] || icons.info;
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", '&#39;');
}
