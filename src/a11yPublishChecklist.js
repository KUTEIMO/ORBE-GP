/**
 * Pure publish-readiness rules for tour accessibility content (T-P0-8).
 * Usable from Convex, Node QA, and admin — no DOM / no fs.
 *
 * @typedef {{
 *   id?: string,
 *   title?: string,
 *   srSummary?: string | null,
 *   narration?: string | null,
 *   transcript?: string | null,
 *   captionFile?: string | null,
 *   narrationOptional?: boolean,
 *   hotspots?: Array<{
 *     id?: string,
 *     type?: string,
 *     title?: string,
 *     srSummary?: string | null,
 *     narration?: string | null,
 *     transcript?: string | null,
 *     captionFile?: string | null,
 *     narrationOptional?: boolean,
 *   }>
 * }} SceneA11yInput
 */

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function isPlaceholderNarration(url) {
  if (!url || typeof url !== 'string') return true;
  const lower = url.trim().toLowerCase();
  if (!lower) return true;
  if (lower.includes('assets/audio/placeholder.mp3')) return true;
  if (lower.startsWith('data:audio/') && lower.includes('base64,')) {
    const payload = url.split('base64,')[1] || '';
    if (payload.length < 200) return true;
  }
  return false;
}

/**
 * @param {string | null | undefined} url
 * @returns {boolean}
 */
export function hasNarrationRef(url) {
  return Boolean(url && typeof url === 'string' && url.trim() && !isPlaceholderNarration(url));
}

/**
 * Evaluate whether a tour's a11y package is ready to claim "accessible published".
 * Does not verify binary files on disk (caller may add fs checks).
 *
 * @param {{ scenes: SceneA11yInput[], requireCaptions?: boolean, requireInfoHotspotAudio?: boolean }} input
 */
export function evaluateAccessibilityPublishChecklist(input) {
  const scenes = Array.isArray(input?.scenes) ? input.scenes : [];
  const requireCaptions = Boolean(input?.requireCaptions);

  /** @type {string[]} */
  const blocking = [];
  /** @type {string[]} */
  const warnings = [];

  let scenesWithSrSummary = 0;
  let scenesWithNarrationOrOptional = 0;
  let scenesWithTranscriptIfAudio = 0;
  let infoHotspotsChecked = 0;
  let infoHotspotsOk = 0;

  if (scenes.length === 0) {
    blocking.push('El tour no tiene escenas para evaluar accesibilidad.');
  }

  for (const scene of scenes) {
    const label = scene.title || scene.id || 'escena-sin-id';
    const sr = typeof scene.srSummary === 'string' ? scene.srSummary.trim() : '';
    if (sr) {
      scenesWithSrSummary += 1;
    } else {
      blocking.push(`Escena "${label}": falta srSummary (resumen corto para lector de pantalla).`);
    }

    const optional = Boolean(scene.narrationOptional);
    const narrated = hasNarrationRef(scene.narration);

    if (narrated || optional) {
      scenesWithNarrationOrOptional += 1;
    } else {
      blocking.push(
        `Escena "${label}": sin narración ni narrationOptional=true (debe haber audio o marcarse opcional).`
      );
    }

    if (narrated) {
      const transcript = typeof scene.transcript === 'string' ? scene.transcript.trim() : '';
      if (transcript) {
        scenesWithTranscriptIfAudio += 1;
      } else {
        blocking.push(`Escena "${label}": hay narración pero falta transcript.`);
      }
      const caption = typeof scene.captionFile === 'string' ? scene.captionFile.trim() : '';
      if (!caption) {
        const msg = `Escena "${label}": hay narración pero falta captionFile (VTT).`;
        if (requireCaptions) blocking.push(msg);
        else warnings.push(msg);
      }
    } else if (optional) {
      scenesWithTranscriptIfAudio += 1;
    }

    const hotspots = Array.isArray(scene.hotspots) ? scene.hotspots : [];
    for (const hotspot of hotspots) {
      // Only evaluate hotspots that declare a11y audio fields (package-tracked).
      const tracked =
        Object.prototype.hasOwnProperty.call(hotspot, 'narration') ||
        Object.prototype.hasOwnProperty.call(hotspot, 'narrationOptional');
      if (!tracked) continue;
      if (hotspot.type && hotspot.type !== 'info') continue;

      infoHotspotsChecked += 1;
      const hLabel = hotspot.title || hotspot.id || 'hotspot';
      const hOptional = Boolean(hotspot.narrationOptional);
      const hNarrated = hasNarrationRef(hotspot.narration);
      if (!hNarrated && !hOptional) {
        blocking.push(
          `Hotspot "${hLabel}" en "${label}": sin narración ni narrationOptional=true.`
        );
        continue;
      }
      if (hNarrated) {
        const hTranscript = typeof hotspot.transcript === 'string' ? hotspot.transcript.trim() : '';
        if (!hTranscript) {
          blocking.push(`Hotspot "${hLabel}" en "${label}": hay narración pero falta transcript.`);
          continue;
        }
      }
      infoHotspotsOk += 1;
    }
  }

  const ready = blocking.length === 0 && scenes.length > 0;

  return {
    ready,
    sceneCount: scenes.length,
    scenesWithSrSummary,
    scenesWithNarrationOrOptional,
    scenesWithTranscriptIfAudio,
    infoHotspotsChecked,
    infoHotspotsOk,
    blockingIssues: blocking,
    warnings,
    checkedAt: null
  };
}

/**
 * Map static a11y-package.json → SceneA11yInput[] for authoring preview / import tooling.
 * Phase 8: NOT the publish gate — sync into Convex then use evaluateTourFromDb.
 * Mirrors scripts/check-a11y-publish.mjs (pilot package scope). Skips aliasOf scenes.
 * @param {{ scenes?: Record<string, object>, hotspots?: Record<string, object> } | null | undefined} pkg
 * @returns {SceneA11yInput[]}
 */
export function scenesFromA11yPackage(pkg) {
  if (!pkg || typeof pkg !== 'object') return [];
  /** @type {SceneA11yInput[]} */
  const scenes = [];
  for (const [sceneKey, entry] of Object.entries(pkg.scenes || {})) {
    if (!entry || typeof entry !== 'object') continue;
    if (/** @type {{ aliasOf?: string }} */ (entry).aliasOf) continue;
    const e = /** @type {Record<string, unknown>} */ (entry);
    scenes.push({
      id: sceneKey,
      title: sceneKey,
      srSummary: typeof e.srSummary === 'string' ? e.srSummary : null,
      narration: typeof e.narration === 'string' ? e.narration : null,
      transcript: typeof e.transcript === 'string' ? e.transcript : null,
      captionFile: typeof e.captionFile === 'string' ? e.captionFile : null,
      narrationOptional: Boolean(e.narrationOptional),
      hotspots: []
    });
  }

  for (const [id, entry] of Object.entries(pkg.hotspots || {})) {
    if (!entry || typeof entry !== 'object') continue;
    const e = /** @type {Record<string, unknown>} */ (entry);
    scenes.push({
      id: `hotspot:${id}`,
      title: id,
      srSummary: typeof e.srSummary === 'string' ? e.srSummary : id,
      narration: null,
      narrationOptional: true,
      transcript: null,
      captionFile: null,
      hotspots: [
        {
          id,
          type: 'info',
          title: id,
          narration: typeof e.narration === 'string' ? e.narration : null,
          transcript: typeof e.transcript === 'string' ? e.transcript : null,
          captionFile: typeof e.captionFile === 'string' ? e.captionFile : null,
          narrationOptional: Boolean(e.narrationOptional)
        }
      ]
    });
  }
  return scenes;
}
