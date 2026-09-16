import { enrichSpatialGraph } from './spatialNav.js';
import { expectedHotspotAssets, expectedSceneAssets } from './a11yPaths.js';
import {
  DEFAULT_TOUR_SLUG,
  parseSlugParam,
  resolveTourSlugFromBrowser,
} from './tourSlug.js';
import {
  applyTourBranding,
  brandingLooksLikeOrbePlatform,
  resolveClientBranding,
  NEUTRAL_BRANDING_FALLBACK,
} from './tourBranding.js';

/**
 * Fake / placeholder audio must not look like real narration.
 * Real files can be wired later; until then narration stays null.
 */
const PLACEHOLDER_AUDIO_MARKERS = [
  'assets/audio/placeholder.mp3',
  '/media/unisimoncucuta/experienciavirtual/assets/audio/placeholder.mp3',
  'data:audio/wav;base64,',
  'data:audio/mpeg;base64,'
];

const A11Y_PACKAGE_URL =
  '/media/unisimoncucuta/experienciavirtual/assets/accessibility/a11y-package.json';

const FALLBACK_LONG_DESC_PREFIX = 'Vista 360° del recorrido virtual';
const DEFAULT_INFO_ICON = 'ⓘ';
const FALLBACK_POSITIONS = [
  { yaw: 0, pitch: 0 },
  { yaw: Math.PI / 3, pitch: -0.1 },
  { yaw: -Math.PI / 3, pitch: 0.05 },
  { yaw: Math.PI / 2, pitch: -0.05 },
  { yaw: -Math.PI / 2, pitch: -0.05 }
];

/**
 * Resolve a narration URL to a real asset or null (honest empty state).
 */
export function resolveNarrationUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (PLACEHOLDER_AUDIO_MARKERS.some((marker) => lower.includes(marker.toLowerCase()))) {
    return null;
  }
  if (lower.startsWith('data:audio/') && lower.includes('base64,')) {
    // Tiny synthetic blobs are not product narration.
    const payload = trimmed.split('base64,')[1] || '';
    if (payload.length < 200) return null;
  }
  return trimmed;
}

export async function loadConfig() {
  const response = await fetch('config.json', {
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo cargar config.json (estado ${response.status})`);
  }

  const rawConfig = await response.json();
  const orgSlug =
    typeof window !== "undefined" && window.__ORBE_ORG_SLUG__
      ? String(window.__ORBE_ORG_SLUG__).toLowerCase()
      : null;
  const isPilotOrg = !orgSlug || orgSlug === "unisimoncucuta";

  // Biblioteca + a11y package are Unisimón campus assets — never apply to other tenants.
  if (isPilotOrg) {
    await mergeBibliotecaAccessibleScenes(rawConfig);
  }
  // Public priority: Convex published graph > static JSON fallback (offline/local).
  // Draft (?draft=1) skips Convex and uses localStorage / tour-graph.json.
  await mergeConvexTourGraph(rawConfig);
  if (rawConfig.__tourSlugRejected) {
    throw new Error(
      `El tour "${rawConfig.__requestedTourSlug}" no está publicado o no existe.`
    );
  }
  await mergeTourGraph(rawConfig);
  // Offline / before Convex branding: static pilot file (client data, not motor defaults).
  await mergeTourBrandingFallback(rawConfig);
  // A11y package last: preserves narration/transcript/srSummary across spatial merges.
  if (isPilotOrg) {
    await mergeA11yPackage(rawConfig);
  }
  const externalOverrides = await loadExternalOverrides();
  const normalized = normalizeConfig(rawConfig, externalOverrides);
  validateConfig(normalized);
  return normalized;
}

/**
 * Apply Unisimón (or future tour) accessibility package by scene id / fileKey / hotspot id.
 * Paths are relative drop-in targets — audio binaries may arrive later from TTS/human.
 */
async function mergeA11yPackage(rawConfig) {
  let pkg = null;
  try {
    const response = await fetch(A11Y_PACKAGE_URL, { cache: 'no-store' });
    if (!response.ok) return;
    pkg = await response.json();
  } catch (error) {
    console.warn('No se pudo cargar a11y-package.json', error);
    return;
  }
  if (!pkg || typeof pkg !== 'object') return;

  rawConfig.accessibleScenes = rawConfig.accessibleScenes || {};
  rawConfig.__a11yPackage = pkg;

  const byFile = new Map();
  const sceneEntries = pkg.scenes && typeof pkg.scenes === 'object' ? Object.entries(pkg.scenes) : [];
  for (const [sceneKey, entry] of sceneEntries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.fileKey) byFile.set(entry.fileKey, { sceneKey, entry });
  }

  for (const [file, scene] of Object.entries(rawConfig.accessibleScenes)) {
    if (!scene || typeof scene !== 'object') continue;
    const id = scene.id || null;
    const fromId = id && pkg.scenes?.[id] ? { sceneKey: id, entry: pkg.scenes[id] } : null;
    const fromFile = byFile.get(file) || null;
    // Prefer matching scene.id; fall back to fileKey (handles biblioteca-lobby vs biblioteca-principal).
    const match = fromId || fromFile;
    if (match?.entry) {
      applySceneA11yEntry(scene, match.sceneKey, match.entry);
    }

    if (Array.isArray(scene.hotspots) && pkg.hotspots) {
      scene.hotspots = scene.hotspots.map((hotspot) => {
        if (!hotspot?.id || !pkg.hotspots[hotspot.id]) return hotspot;
        return applyHotspotA11yEntry({ ...hotspot }, hotspot.id, pkg.hotspots[hotspot.id]);
      });
    }
  }

  applyConventionAssetFallbacks(rawConfig);
}

/**
 * Drop-in: if a scene/hotspot has a stable id and no explicit narration yet,
 * point at the canonical relative path. Missing files stay honest via canplay/error.
 */
function applyConventionAssetFallbacks(rawConfig) {
  const scenes = rawConfig.accessibleScenes || {};
  for (const scene of Object.values(scenes)) {
    if (!scene || typeof scene !== 'object' || !scene.id) continue;
    const expected = expectedSceneAssets(scene.id);
    if (!scene.narrationOptional && !resolveNarrationUrl(scene.narration)) {
      scene.narration = expected.narration;
    }
    if (!scene.transcript) scene.transcript = expected.transcript;
    if (!scene.captionFile) scene.captionFile = expected.captionFile;
    if (!scene.timingFile) scene.timingFile = expected.timingFile;
    if (!scene.scriptFile) scene.scriptFile = expected.script;
    if (!Array.isArray(scene.hotspots)) continue;
    scene.hotspots = scene.hotspots.map((hotspot) => {
      if (!hotspot?.id) return hotspot;
      const expected = expectedHotspotAssets(hotspot.id);
      const next = {
        ...hotspot,
        transcript: hotspot.transcript || expected.transcript,
        captionFile: hotspot.captionFile || expected.captionFile,
        timingFile: hotspot.timingFile || expected.timingFile,
        scriptFile: hotspot.scriptFile || expected.script
      };
      if (hotspot.narrationOptional) return next;
      if (hotspot.type && hotspot.type !== 'info') return next;
      if (resolveNarrationUrl(hotspot.narration)) return next;
      return { ...next, narration: expected.narration };
    });
  }
}

function applySceneA11yEntry(scene, sceneKey, entry) {
  const defaults = expectedSceneAssets(sceneKey);
  if (entry.srSummary) scene.srSummary = entry.srSummary;
  if (typeof entry.narrationOptional === 'boolean') {
    scene.narrationOptional = entry.narrationOptional;
  }
  // Prefer package paths; never keep placeholder from older config.
  const narration = resolveNarrationUrl(entry.narration ?? defaults.narration);
  if (entry.narrationOptional && !narration) {
    scene.narration = null;
  } else if (entry.narration !== undefined) {
    scene.narration = narration;
  } else if (!resolveNarrationUrl(scene.narration)) {
    scene.narration = narration;
  }

  if (entry.transcript != null) scene.transcript = entry.transcript;
  else if (!scene.transcript) scene.transcript = defaults.transcript;

  if (entry.captionFile != null) scene.captionFile = entry.captionFile;
  else if (!scene.captionFile) scene.captionFile = defaults.captionFile;

  if (entry.timingFile != null) scene.timingFile = entry.timingFile;
  else if (!scene.timingFile) scene.timingFile = defaults.timingFile;

  if (entry.scriptFile != null) scene.scriptFile = entry.scriptFile;
  return scene;
}

function applyHotspotA11yEntry(hotspot, hotspotId, entry) {
  const defaults = expectedHotspotAssets(hotspotId);
  if (entry.srSummary) hotspot.srSummary = entry.srSummary;
  if (typeof entry.narrationOptional === 'boolean') {
    hotspot.narrationOptional = entry.narrationOptional;
  }
  if (entry.narration !== undefined) {
    hotspot.narration = resolveNarrationUrl(entry.narration);
  } else if (!resolveNarrationUrl(hotspot.narration)) {
    hotspot.narration = resolveNarrationUrl(defaults.narration);
  }
  if (entry.transcript != null) hotspot.transcript = entry.transcript;
  else if (!hotspot.transcript) hotspot.transcript = defaults.transcript;
  if (entry.captionFile != null) hotspot.captionFile = entry.captionFile;
  else if (!hotspot.captionFile) hotspot.captionFile = defaults.captionFile;
  if (entry.timingFile != null) hotspot.timingFile = entry.timingFile;
  else if (!hotspot.timingFile) hotspot.timingFile = defaults.timingFile;
  if (entry.scriptFile != null) hotspot.scriptFile = entry.scriptFile;
  return hotspot;
}

/**
 * Fuente de verdad pública: Convex published graph (shared across browsers).
 * Sets rawConfig.__convexGraphLoaded when merge succeeds so static tour-graph
 * does not overwrite Convex hotspots (dual-source drift).
 * localStorage / draft path: skipped here; see mergeTourGraph.
 */
async function mergeConvexTourGraph(rawConfig) {
  const draftMode = typeof location !== "undefined" && /[?&]draft=1\b/.test(location.search);
  if (draftMode) return;

  const convexUrl = (typeof window !== "undefined" && window.__CONVEX_URL__) || "";
  const slug = resolveTourSlugFromBrowser();
  const orgSlug =
    typeof window !== "undefined" && window.__ORBE_ORG_SLUG__
      ? window.__ORBE_ORG_SLUG__
      : null;
  rawConfig.tourSlug = slug;
  if (typeof window !== "undefined") {
    window.__ORBE_TOUR_SLUG__ = slug;
    if (orgSlug) window.__ORBE_ORG_SLUG__ = orgSlug;
  }

  const explicitUrlSlug =
    typeof location !== "undefined"
      ? parseSlugParam(new URLSearchParams(location.search).get("slug"))
      : null;

  if (!convexUrl) {
    // Offline: only allow static piloto fallback for default / matching default slug.
    if (explicitUrlSlug && explicitUrlSlug !== DEFAULT_TOUR_SLUG) {
      rawConfig.__tourSlugRejected = true;
      rawConfig.__requestedTourSlug = explicitUrlSlug;
    }
    return;
  }

  try {
    const graphArgs = orgSlug
      ? { orgSlug, tourSlug: slug }
      : { slug };
    const response = await fetch(`${String(convexUrl).replace(/\/$/, "")}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "graph:getTourGraph",
        args: graphArgs,
        format: "json",
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      markRejectedIfForeignSlug(rawConfig, explicitUrlSlug);
      return;
    }
    const payload = await response.json();
    const graph = payload?.value;
    if (!graph || !Array.isArray(graph.scenes) || graph.scenes.length === 0) {
      // getTourGraph returns null for unpublished / missing — never invent another tour.
      markRejectedIfForeignSlug(rawConfig, explicitUrlSlug);
      return;
    }

    rawConfig.__convexGraphLoaded = true;
    // Isolation: Convex published graph is the scene SoT for this org/tour.
    // Never keep static scenes from another tenant's shared config.json.
    const prevAccessible = rawConfig.accessibleScenes || {};
    const nextAccessible = {};
    const nextScenes = [];
    const knownFiles = new Set();

    if (graph.branding && typeof graph.branding === "object") {
      // Any tour: refuse Orbe platform accents as client primary.
      rawConfig.branding = resolveClientBranding(graph.branding, slug);
      rawConfig.__brandingFromConvex = true;
      if (brandingLooksLikeOrbePlatform(graph.branding)) {
        rawConfig.__brandingSanitizedFromOrbe = true;
        console.warn(
          "[TourBranding] Colores Orbe en Convex — aplicando neutro gray/ink"
        );
      } else {
        // Paint client chrome ASAP (before rest of config merge) — kills Orbe FOUC.
        applyTourBranding(rawConfig.branding, { tourSlug: slug });
      }
    }
    if (graph.tour?.title) {
      rawConfig.tourTitle = graph.tour.title;
    }
    if (graph.organization) {
      rawConfig.organization = graph.organization;
    }

    graph.scenes.forEach((scene) => {
      const file = scene.fileKey;
      if (!knownFiles.has(file)) {
        nextScenes.push({
          file,
          zone: scene.zone || "general",
        });
        knownFiles.add(file);
      }
      const current = prevAccessible[file] || {};
      // Prefer Convex spatial graph; keep JSON a11y fields (narration/transcript/caption)
      // when Convex does not yet ship that package. Convex a11y URLs win when present.
      const convexHotspots = Array.isArray(scene.hotspots) ? scene.hotspots : null;
      const currentHotspots = Array.isArray(current.hotspots) ? current.hotspots : null;
      // Convex is SoT for spatial: empty nav after admin delete must win.
      // Do not re-merge static biblioteca/tour-graph nav when Convex returns [].
      const hotspots = convexHotspots != null ? convexHotspots : currentHotspots;
      nextAccessible[file] = {
        ...current,
        title: scene.title || current.title,
        shortTitle: scene.shortTitle || current.shortTitle,
        zone: scene.zone || current.zone,
        altText: scene.altText || current.altText,
        longDescription: scene.longDescription || current.longDescription,
        srSummary: scene.srSummary || current.srSummary,
        narration: scene.narration || current.narration,
        narrationOptional:
          typeof scene.narrationOptional === "boolean"
            ? scene.narrationOptional
            : current.narrationOptional,
        transcript: scene.transcript || current.transcript,
        captionFile: scene.captionFile || current.captionFile,
        timingFile: scene.timingFile || current.timingFile,
        imageUrl: scene.imageUrl || current.imageUrl,
        order: typeof scene.order === "number" ? scene.order : current.order,
        initialView:
          scene.initialView && typeof scene.initialView.yaw === "number"
            ? {
                yaw: scene.initialView.yaw,
                pitch:
                  typeof scene.initialView.pitch === "number"
                    ? scene.initialView.pitch
                    : 0,
                ...(typeof scene.initialView.fov === "number"
                  ? { fov: scene.initialView.fov }
                  : {}),
              }
            : current.initialView,
        hotspots,
        links: (hotspots || [])
          .filter((h) => h.type === "nav" && h.targetFile)
          .map((h) => ({
            label: h.title,
            targetFile: h.targetFile,
            yaw: h.yaw,
            pitch: h.pitch,
          })),
      };
    });

    rawConfig.scenes = nextScenes;
    rawConfig.accessibleScenes = nextAccessible;
    rawConfig.__tenantSceneReplace = true;
  } catch (error) {
    console.warn("No se pudo cargar grafo desde Convex", error);
    markRejectedIfForeignSlug(rawConfig, explicitUrlSlug);
  }
}

/**
 * Merge static spatial hotspots with Convex a11y-bearing hotspots (by id).
 * Used only when Convex published graph has zero nav for a scene.
 */
function mergeHotspotsPreferSpatial(staticHotspots, convexHotspots) {
  const byId = new Map();
  for (const h of staticHotspots) {
    if (h?.id) byId.set(h.id, { ...h });
  }
  for (const h of convexHotspots) {
    if (!h?.id) continue;
    const existing = byId.get(h.id);
    if (existing) {
      byId.set(h.id, {
        ...existing,
        ...h,
        yaw: typeof existing.yaw === "number" ? existing.yaw : h.yaw,
        pitch: typeof existing.pitch === "number" ? existing.pitch : h.pitch,
        targetFile: existing.targetFile || h.targetFile,
        type: existing.type || h.type,
        narration: h.narration || existing.narration,
        narrationOptional:
          typeof h.narrationOptional === "boolean"
            ? h.narrationOptional
            : existing.narrationOptional,
        transcript: h.transcript || existing.transcript,
        captionFile: h.captionFile || existing.captionFile,
        timingFile: h.timingFile || existing.timingFile,
        srSummary: h.srSummary || existing.srSummary,
      });
    } else {
      byId.set(h.id, { ...h });
    }
  }
  return Array.from(byId.values());
}

/**
 * Reject non-piloto explicit slugs when Convex has no published graph.
 * Default Unisimón path (no slug / slug=unisimon-campus) may still use static fallback.
 */
function markRejectedIfForeignSlug(rawConfig, explicitUrlSlug) {
  if (explicitUrlSlug && explicitUrlSlug !== DEFAULT_TOUR_SLUG) {
    rawConfig.__tourSlugRejected = true;
    rawConfig.__requestedTourSlug = explicitUrlSlug;
  }
}

/**
 * Static TourBranding fallback (offline / Convex without branding row yet).
 * File is generic (not client-specific); Orbe accents are sanitized for any tour.
 */
async function mergeTourBrandingFallback(rawConfig) {
  if (rawConfig.__tourSlugRejected) return;

  const slug = rawConfig.tourSlug || resolveTourSlugFromBrowser();
  const convexOk =
    rawConfig.__brandingFromConvex &&
    rawConfig.branding &&
    !brandingLooksLikeOrbePlatform(rawConfig.branding);

  if (convexOk && !rawConfig.__brandingSanitizedFromOrbe) {
    rawConfig.branding = resolveClientBranding(rawConfig.branding, slug);
    return;
  }

  try {
    const response = await fetch("tour-branding.json", { cache: "no-store" });
    if (!response.ok) {
      if (!rawConfig.branding) {
        rawConfig.branding = { ...NEUTRAL_BRANDING_FALLBACK };
      }
      return;
    }
    const branding = await response.json();
    if (branding && typeof branding === "object" && branding.primaryColor) {
      rawConfig.branding = resolveClientBranding(branding, slug);
    } else if (!rawConfig.branding) {
      rawConfig.branding = { ...NEUTRAL_BRANDING_FALLBACK };
    }
  } catch (error) {
    console.warn("No se pudo cargar tour-branding.json", error);
    if (!rawConfig.branding) {
      rawConfig.branding = { ...NEUTRAL_BRANDING_FALLBACK };
    }
  }
}

async function mergeBibliotecaAccessibleScenes(rawConfig) {
  try {
    const response = await fetch('biblioteca-scenes.json', { cache: 'no-store' });
    if (!response.ok) return;
    const libraryScenes = await response.json();
    if (!libraryScenes || typeof libraryScenes !== 'object') return;
    rawConfig.accessibleScenes = {
      ...(rawConfig.accessibleScenes || {}),
      ...libraryScenes
    };
  } catch (error) {
    console.warn('No se pudo cargar biblioteca-scenes.json', error);
  }
}

/**
 * Placeholder / migrated-empty package must never wipe Convex or config nav.
 * Empty = no connections AND no per-scene hotspot patches.
 */
function isEmptyTourGraph(graph) {
  if (!graph || typeof graph !== "object") return true;
  const conns = Array.isArray(graph.connections) ? graph.connections.length : 0;
  const scenes =
    graph.scenes && typeof graph.scenes === "object" && !Array.isArray(graph.scenes)
      ? Object.keys(graph.scenes).length
      : 0;
  return conns === 0 && scenes === 0;
}

/**
 * Fusiona enlaces/hotspots del panel admin / seed estático.
 *
 * Contratos (público vs draft):
 * - Público + Convex OK (con nav) → no sobrescribir hotspots/conexiones (evita dual SoT).
 * - Público + Convex sin nav / offline → tour-graph.json (fallback), if non-empty.
 * - ?draft=1 → localStorage tour.graph.v1, luego tour-graph.json.
 * - Empty static {connections:[],scenes:{}} is a no-op (never destructive replace).
 */
async function mergeTourGraph(rawConfig) {
  if (rawConfig.__tourSlugRejected) return;

  let graph = null;
  const draftMode = typeof location !== "undefined" && /[?&]draft=1\b/.test(location.search);

  if (!draftMode && rawConfig.__convexGraphLoaded) {
    return;
  }

  if (draftMode) {
    try {
      const stored = localStorage.getItem("tour.graph.v1");
      if (stored) graph = JSON.parse(stored);
    } catch (_error) {
      /* ignore */
    }
  }

  if (!graph || isEmptyTourGraph(graph)) {
    try {
      const response = await fetch("tour-graph.json", { cache: "no-store" });
      if (response.ok) {
        const fileGraph = await response.json();
        if (!isEmptyTourGraph(fileGraph)) graph = fileGraph;
      }
    } catch (error) {
      console.warn("No se pudo cargar tour-graph.json", error);
    }
  }

  if (!graph || typeof graph !== "object" || isEmptyTourGraph(graph)) return;

  rawConfig.accessibleScenes = rawConfig.accessibleScenes || {};

  const filesWithExplicitHotspots = new Set();

  // Parches de hotspots por archivo (lista completa = fuente de verdad)
  if (graph.scenes && typeof graph.scenes === 'object') {
    Object.entries(graph.scenes).forEach(([file, patch]) => {
      if (!patch || typeof patch !== 'object') return;
      const current = rawConfig.accessibleScenes[file] || {};
      if (Array.isArray(patch.hotspots)) {
        filesWithExplicitHotspots.add(file);
        const navLinks = patch.hotspots
          .filter((h) => h && h.type === 'nav' && h.targetFile)
          .map((h) => ({
            label: h.title || h.shortLabel || 'Ir a escena',
            targetFile: h.targetFile,
            yaw: h.yaw,
            pitch: h.pitch
          }));
        rawConfig.accessibleScenes[file] = {
          ...current,
          ...patch,
          hotspots: patch.hotspots,
          links: navLinks
        };
        return;
      }
      rawConfig.accessibleScenes[file] = {
        ...current,
        ...patch
      };
    });
  }

  // Conexiones del grafo → solo escenas SIN lista explícita de hotspots
  if (Array.isArray(graph.connections)) {
    graph.connections.forEach((conn, index) => {
      if (!conn?.from || !conn?.to) return;
      if (filesWithExplicitHotspots.has(conn.from)) return;

      const scene = rawConfig.accessibleScenes[conn.from] || {};
      const hotspots = Array.isArray(scene.hotspots) ? scene.hotspots.slice() : [];
      const links = Array.isArray(scene.links) ? scene.links.slice() : [];
      const id = conn.id || `graph-link-${index}`;
      const exists = hotspots.some((h) => h.id === id);
      if (!exists) {
        hotspots.push({
          id,
          type: 'nav',
          title: conn.label || 'Ir a escena',
          shortLabel: conn.shortLabel || conn.label || 'Ir',
          targetFile: conn.to,
          yaw: typeof conn.yaw === 'number' ? conn.yaw : 0,
          pitch: typeof conn.pitch === 'number' ? conn.pitch : -0.05,
          direction: conn.direction || null,
          weight: conn.weight || 1.4,
          altText: conn.label || 'Navegación',
          description: `Continúa el recorrido hacia: ${conn.label || 'siguiente escena'}.`
        });
      }
      links.push({
        label: conn.label || 'Ir a escena',
        targetFile: conn.to,
        yaw: conn.yaw,
        pitch: conn.pitch
      });
      rawConfig.accessibleScenes[conn.from] = {
        ...scene,
        hotspots,
        links
      };
    });
  }
}

async function loadExternalOverrides() {
  try {
    const response = await fetch('hotspot-overrides.json', { cache: 'no-store' });
    if (!response.ok) {
      return {};
    }
    const data = await response.json();
    return typeof data === 'object' && data ? data : {};
  } catch (error) {
    console.warn('No se pudo cargar hotspot-overrides.json', error);
    return {};
  }
}

function normalizeConfig(raw, externalOverrides = {}) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('El archivo de configuración no tiene un formato JSON válido.');
  }

  // When Convex graph loaded successfully, admin deletes are authoritative:
  // no zone auto-links and no seq/orbit/bridge phantom nav for cue/dblclick.
  const convexAuthoritative = Boolean(raw.__convexGraphLoaded);

  const sceneEntries = Array.isArray(raw.scenes) ? raw.scenes : [];
  if (sceneEntries.length === 0) {
    throw new Error('La configuración debe incluir al menos una escena.');
  }

  const accessibleOverrides = raw.accessibleScenes || {};
  const sceneNames = raw.sceneNames || {};
  const zones = raw.zones || {};
  const defaultShortcuts = raw.shortcuts || [];
  const rawHotspots = raw.hotspots || {};

  const temporaryScenes = sceneEntries.map((entry, index) => {
    const file = entry.file;
    const override = accessibleOverrides[file] || {};
    const resolvedTitle = override.title || sceneNames[file] || file;
    const id = override.id || slugify(file);
    const zoneKey = override.zone || entry.zone || null;
    const zoneLabel = zones[zoneKey] || zoneKey || 'Área general';

    const scene = {
      id,
      file,
      title: resolvedTitle,
      shortTitle: override.shortTitle || cleanSceneTitle(resolvedTitle),
      zone: zoneKey,
      order: typeof override.order === 'number' ? override.order : index,
      imageUrl: override.imageUrl || null,
      altText: override.altText || cleanSceneTitle(resolvedTitle),
      srSummary: override.srSummary || null,
      longDescription:
        override.longDescription ||
        `${FALLBACK_LONG_DESC_PREFIX} en ${zoneLabel}: ${resolvedTitle}. Usa el ratón o el teclado para moverte.`,
      narration: resolveNarrationUrl(override.narration),
      narrationOptional: Boolean(override.narrationOptional),
      transcript: override.transcript || null,
      captionFile: override.captionFile || null,
      timingFile: override.timingFile || null,
      scriptFile: override.scriptFile || null,
      initialView: override.initialView || null,
      keyboardShortcuts: override.keyboardShortcuts && override.keyboardShortcuts.length > 0
        ? override.keyboardShortcuts
        : defaultShortcuts,
      links: Array.isArray(override.links) ? override.links.slice() : [],
      hotspots: [],
      rawZoneKey: entry.zone || null
    };

    const normalizedHotspots = buildHotspotList({
      file,
      sceneId: scene.id,
      sceneTitle: resolvedTitle,
      zoneLabel,
      overrideHotspots: override.hotspots,
      rawHotspotEntries: rawHotspots[file],
      fallbackIndex: index
    });

    scene.hotspots = normalizedHotspots;
    ensureNarrationForHotspots(scene);

    return scene;
  });

  const fileToSceneId = new Map(temporaryScenes.map((scene) => [scene.file, scene.id]));

  // Normalizar enlaces definidos manualmente.
  temporaryScenes.forEach((scene) => {
    scene.links = (scene.links || []).map((link, idx) => {
      const targetFile = link.targetFile || link.target;
      const targetId = targetFile ? fileToSceneId.get(targetFile) : fileToSceneId.get(link.target);
      if (!targetId) return null;
      return {
        id: `${scene.id}-link-${idx}`,
        label: link.label || 'Ir a escena',
        target: targetId
      };
    }).filter(Boolean);
  });

  // Zone auto prev/next only for static/draft — not when Convex is SoT.
  if (!convexAuthoritative) {
    const scenesByZone = groupScenesByZone(temporaryScenes);
    scenesByZone.forEach((scenes) => {
      scenes.sort((a, b) => a.order - b.order);
      scenes.forEach((scene, idx) => {
        const prevScene = scenes[idx - 1];
        const nextScene = scenes[idx + 1];
        if (prevScene) {
          scene.links.push({
            id: `${scene.id}-auto-prev`,
            label: `Ir a ${prevScene.title}`,
            target: prevScene.id
          });
        }
        if (nextScene) {
          scene.links.push({
            id: `${scene.id}-auto-next`,
            label: `Ir a ${nextScene.title}`,
            target: nextScene.id
          });
        }
      });
    });
  }

  // Transformar enlaces en datos de navegación sin crear hotspots visibles.
  temporaryScenes.forEach((scene) => {
    resolveHotspotTargets(scene, fileToSceneId);
    scene.navigationHotspots = buildNavigationHotspots(scene, scene.links, fileToSceneId);
    // Incluir hotspots nav visibles (con yaw/pitch reales) para doble clic / cue.
    scene.hotspots.forEach((hotspot) => {
      if (hotspot.type === 'nav' && hotspot.target) {
        scene.navigationHotspots.push({
          id: `${hotspot.id}-pointer`,
          title: hotspot.title,
          yaw: hotspot.yaw,
          pitch: hotspot.pitch,
          target: hotspot.target,
          weight: hotspot.weight || 1.4,
          direction: hotspot.direction || null
        });
      }
    });
  });

  applyExternalOverrides(temporaryScenes, externalOverrides);
  enrichSpatialGraph(temporaryScenes, { autoNeighbors: !convexAuthoritative });

  const defaultSceneId = resolveDefaultScene(raw.defaultScene, fileToSceneId) || temporaryScenes[0].id;

  const tourSlug = raw.tourSlug || resolveTourSlugFromBrowser();
  return {
    basePath: raw.basePath || '',
    defaultScene: defaultSceneId,
    shortcuts: defaultShortcuts,
    zones,
    scenes: temporaryScenes,
    overrides: externalOverrides,
    branding: resolveClientBranding(
      raw.branding && typeof raw.branding === 'object' ? raw.branding : null,
      tourSlug
    ),
    tourTitle: raw.tourTitle || null,
    organization: raw.organization || null,
    tourSlug,
  };
}

function buildHotspotList({
  file,
  sceneId,
  sceneTitle,
  zoneLabel,
  overrideHotspots,
  rawHotspotEntries,
  fallbackIndex
}) {
  const fromOverride = normalizeHotspotArray(overrideHotspots, file, sceneId);
  // Lista explícita (aunque esté vacía) manda: no volver a biblioteca/fallback
  if (Array.isArray(overrideHotspots)) {
    return fromOverride;
  }

  const fromRaw = normalizeRawHotspots(rawHotspotEntries, file, sceneId);
  if (fromRaw.length > 0) {
    return fromRaw;
  }

  // Fallback hotspot informativo.
  const fallbackPosition = FALLBACK_POSITIONS[fallbackIndex % FALLBACK_POSITIONS.length];
  return [
    createInfoHotspot({
      sceneId,
      sceneTitle,
      zoneLabel,
      yaw: fallbackPosition.yaw,
      pitch: fallbackPosition.pitch
    })
  ];
}

function normalizeHotspotArray(hotspots, file, sceneId) {
  if (!Array.isArray(hotspots) || hotspots.length === 0) {
    return [];
  }

  return hotspots.map((hotspot, index) => {
    const coords = normalizeCoordinates(hotspot);
    const fallbackTitle = hotspot.title || `Hotspot ${index + 1}`;
    const type = hotspot.type || 'info';
    return {
      id: hotspot.id || `${sceneId}-hotspot-${index}`,
      title: fallbackTitle,
      shortLabel: hotspot.shortLabel || null,
      type,
      yaw: coords.yaw,
      pitch: coords.pitch,
      icon: hotspot.icon || (type === 'nav' ? '➜' : DEFAULT_INFO_ICON),
      altText: hotspot.altText || fallbackTitle,
      srSummary: hotspot.srSummary || null,
      description: hotspot.description || hotspot.altText || fallbackTitle,
      narration: resolveNarrationUrl(hotspot.narration),
      narrationOptional: Boolean(hotspot.narrationOptional),
      transcript: hotspot.transcript || null,
      captionFile: hotspot.captionFile || null,
      timingFile: hotspot.timingFile || null,
      scriptFile: hotspot.scriptFile || null,
      targetFile: hotspot.targetFile || hotspot.target || null,
      target: null
    };
  });
}

function normalizeRawHotspots(rawHotspots, file, sceneId) {
  if (!Array.isArray(rawHotspots) || rawHotspots.length === 0) {
    return [];
  }

  return rawHotspots.map((hotspot, index) => {
    const coords = normalizeCoordinates(hotspot);
    const title = hotspot.title || `Punto de interés ${index + 1}`;
    return {
      id: hotspot.id || `${sceneId}-raw-${index}`,
      title,
      type: hotspot.type || 'info',
      yaw: coords.yaw,
      pitch: coords.pitch,
      icon: hotspot.icon || DEFAULT_INFO_ICON,
      altText: hotspot.description || title,
      description: hotspot.description || title,
      narration: resolveNarrationUrl(hotspot.narration),
      transcript: hotspot.transcript || null,
      captionFile: hotspot.captionFile || null
    };
  });
}

function normalizeCoordinates(hotspot) {
  if (typeof hotspot?.yaw === 'number' && typeof hotspot?.pitch === 'number') {
    return { yaw: hotspot.yaw, pitch: hotspot.pitch };
  }

  if (hotspot && hotspot.position) {
    const { yaw, pitch } = vectorToAngles(hotspot.position);
    return { yaw, pitch };
  }

  return { yaw: 0, pitch: 0 };
}

function vectorToAngles(position) {
  const x = Number(position?.x) || 0;
  const y = Number(position?.y) || 0;
  const z = Number(position?.z) || 0;
  const length = Math.sqrt(x * x + y * y + z * z) || 1;
  const nx = x / length;
  const ny = y / length;
  const nz = z / length;
  const yaw = Math.atan2(nx, -nz);
  const pitch = Math.asin(Math.max(-1, Math.min(1, ny)));
  return { yaw, pitch };
}

function ensureNarrationForHotspots(scene) {
  // Do not inherit scene narration onto every hotspot — that falsely claims
  // hotspot-specific audio. Hotspots keep their own package paths or null.
  scene.hotspots.forEach((hotspot) => {
    hotspot.narration = resolveNarrationUrl(hotspot.narration);
  });
}

function groupScenesByZone(scenes) {
  const map = new Map();
  scenes.forEach((scene) => {
    const key = scene.zone || 'sin-zona';
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(scene);
  });
  return map;
}

function resolveHotspotTargets(scene, fileToSceneId) {
  const ids = new Set(fileToSceneId.values());
  scene.hotspots.forEach((hotspot) => {
    if (!hotspot.targetFile) return;
    if (fileToSceneId.has(hotspot.targetFile)) {
      hotspot.target = fileToSceneId.get(hotspot.targetFile);
      return;
    }
    if (ids.has(hotspot.targetFile)) {
      hotspot.target = hotspot.targetFile;
      return;
    }
    console.warn(`Hotspot "${hotspot.id}" apunta a destino desconocido: ${hotspot.targetFile}`);
  });
}

function buildNavigationHotspots(scene, links, fileToSceneId) {
  if (!Array.isArray(links) || links.length === 0) {
    return [];
  }

  const navHotspots = [];
  links.forEach((link) => {
    const targetSceneId = link.target && typeof link.target === 'string' ? link.target : null;
    if (!targetSceneId) return;

    const isPrev =
      link.id?.toLowerCase().includes('prev') ||
      /volver|anterior/.test(link.label || '');
    const yaw = typeof link.yaw === 'number' ? link.yaw : (isPrev ? Math.PI * 0.85 : 0);
    const pitch = typeof link.pitch === 'number' ? link.pitch : -0.05;
    const sequence = navHotspots.length;

    navHotspots.push({
      id: link.id || `${scene.id}-nav-${isPrev ? 'prev' : 'next'}-${sequence}`,
      title: link.label || 'Ir a escena',
      yaw,
      pitch,
      target: targetSceneId
    });
  });

  return navHotspots;
}

function resolveDefaultScene(defaultScene, fileToSceneId) {
  if (!defaultScene) return null;
  if (fileToSceneId.has(defaultScene)) {
    return fileToSceneId.get(defaultScene);
  }
  for (const [, id] of fileToSceneId) {
    if (id === defaultScene) {
      return id;
    }
  }
  return null;
}

function slugify(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'scene';
}

function cleanSceneTitle(title) {
  if (!title) return 'Escena';
  return title.replace(/^\s*\d+[\.\-)]\s*/, '').trim();
}

function createInfoHotspot({ sceneId, sceneTitle, zoneLabel, yaw, pitch }) {
  const cleanTitle = cleanSceneTitle(sceneTitle);
  return {
    id: `${sceneId}-info`,
    title: cleanTitle,
    type: 'info',
    yaw,
    pitch,
    icon: DEFAULT_INFO_ICON,
    altText: `Información sobre ${cleanTitle}`,
    description: `${cleanTitle} en ${zoneLabel}. Explora los detalles de este punto destacado.`,
    narration: null,
    narrationOptional: false,
    transcript: null,
    captionFile: null,
    timingFile: null
  };
}

function applyExternalOverrides(scenes, overrides) {
  if (!overrides || typeof overrides !== 'object') return;
  scenes.forEach((scene) => {
    const sceneOverrides = overrides[scene.id];
    if (!sceneOverrides) return;
    scene.hotspots.forEach((hotspot) => {
      const override = sceneOverrides[hotspot.id];
      if (override && typeof override.yaw === 'number' && typeof override.pitch === 'number') {
        hotspot.yaw = override.yaw;
        hotspot.pitch = override.pitch;
      }
    });
  });
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('La configuración normalizada no es válida.');
  }

  if (!Array.isArray(config.scenes) || config.scenes.length === 0) {
    throw new Error('La configuración debe incluir al menos una escena.');
  }

  const requiredSceneFields = ['id', 'title', 'file', 'altText', 'longDescription', 'hotspots'];

  config.scenes.forEach((scene) => {
    requiredSceneFields.forEach((field) => {
      if (typeof scene[field] === 'undefined' || scene[field] === null) {
        throw new Error(`La escena "${scene.title || scene.id}" no define el campo obligatorio "${field}".`);
      }
    });

    if (!Array.isArray(scene.hotspots)) {
      throw new Error(`La escena "${scene.id}" debe incluir un arreglo de hotspots.`);
    }

    scene.hotspots.forEach((hotspot) => {
      ['id', 'title', 'yaw', 'pitch', 'description', 'altText'].forEach((field) => {
        if (typeof hotspot[field] === 'undefined') {
          throw new Error(`El hotspot "${hotspot.id || hotspot.title}" de la escena "${scene.id}" necesita el campo "${field}".`);
        }
      });
    });
  });
}

