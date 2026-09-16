/**
 * Canonical relative / absolute paths for tour accessibility media.
 * Unisimón campus assets live under media/{org}/{tour}/ — never shared root.
 */

export const A11Y_AUDIO_EXT = 'mp3';

/** Piloto campus media root (absolute site path). */
export const PILOT_ORG_SLUG = 'unisimoncucuta';
export const PILOT_TOUR_SLUG = 'experienciavirtual';
export const PILOT_MEDIA_ROOT = `/media/${PILOT_ORG_SLUG}/${PILOT_TOUR_SLUG}`;
export const PILOT_ASSETS_ROOT = `${PILOT_MEDIA_ROOT}/assets`;
export const PILOT_PANORAMA_ROOT = `${PILOT_MEDIA_ROOT}/panoramas`;

/**
 * @param {string} orgSlug
 * @param {string} tourSlug
 */
export function tourMediaRoot(orgSlug, tourSlug) {
  return `/media/${orgSlug}/${tourSlug}`;
}

/**
 * @param {string} orgSlug
 * @param {string} tourSlug
 */
export function tourAssetsRoot(orgSlug, tourSlug) {
  return `${tourMediaRoot(orgSlug, tourSlug)}/assets`;
}

/** Default assets root for Unisimón a11y helpers (embed + checklist). */
const ASSETS = PILOT_ASSETS_ROOT;

/** @param {string} sceneKey */
export function sceneAudioPath(sceneKey) {
  return `${ASSETS}/audio/scenes/${sceneKey}.${A11Y_AUDIO_EXT}`;
}

/** @param {string} hotspotId */
export function hotspotAudioPath(hotspotId) {
  return `${ASSETS}/audio/hotspots/${hotspotId}.${A11Y_AUDIO_EXT}`;
}

/** @param {string} sceneKey */
export function sceneTranscriptPath(sceneKey) {
  return `${ASSETS}/transcripts/scenes/${sceneKey}.txt`;
}

/** @param {string} hotspotId */
export function hotspotTranscriptPath(hotspotId) {
  return `${ASSETS}/transcripts/hotspots/${hotspotId}.txt`;
}

/** @param {string} sceneKey */
export function sceneCaptionPath(sceneKey) {
  return `${ASSETS}/captions/scenes/${sceneKey}.vtt`;
}

/** @param {string} hotspotId */
export function hotspotCaptionPath(hotspotId) {
  return `${ASSETS}/captions/hotspots/${hotspotId}.vtt`;
}

/**
 * Canonical guion path (Phase 3).
 * @param {string} sceneKey
 */
export function sceneScriptPath(sceneKey) {
  return `${ASSETS}/accessibility/scripts/scenes/${sceneKey}.md`;
}

/** @param {string} hotspotId */
export function hotspotScriptPath(hotspotId) {
  return `${ASSETS}/accessibility/scripts/hotspots/${hotspotId}.md`;
}

/** @deprecated Prefer sceneScriptPath — kept for TTS/config migration. */
export function legacySceneScriptPath(sceneKey) {
  return `${ASSETS}/scripts/scenes/${sceneKey}.md`;
}

/** @deprecated Prefer hotspotScriptPath — kept for TTS/config migration. */
export function legacyHotspotScriptPath(hotspotId) {
  return `${ASSETS}/scripts/hotspots/${hotspotId}.md`;
}

/** @param {string} sceneKey */
export function sceneTimingPath(sceneKey) {
  return `${ASSETS}/accessibility/timing/scenes/${sceneKey}.json`;
}

/** @param {string} hotspotId */
export function hotspotTimingPath(hotspotId) {
  return `${ASSETS}/accessibility/timing/hotspots/${hotspotId}.json`;
}

/**
 * Expected asset bundle for a scene key (paths only — files may not exist yet).
 * @param {string} sceneKey
 */
export function expectedSceneAssets(sceneKey) {
  return {
    narration: sceneAudioPath(sceneKey),
    transcript: sceneTranscriptPath(sceneKey),
    captionFile: sceneCaptionPath(sceneKey),
    script: sceneScriptPath(sceneKey),
    timingFile: sceneTimingPath(sceneKey)
  };
}

/**
 * Expected asset bundle for a hotspot id.
 * @param {string} hotspotId
 */
export function expectedHotspotAssets(hotspotId) {
  return {
    narration: hotspotAudioPath(hotspotId),
    transcript: hotspotTranscriptPath(hotspotId),
    captionFile: hotspotCaptionPath(hotspotId),
    script: hotspotScriptPath(hotspotId),
    timingFile: hotspotTimingPath(hotspotId)
  };
}
