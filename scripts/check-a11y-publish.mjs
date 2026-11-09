/**
 * Local a11y publish readiness check (T-P0-8) + audio drop-in inventory.
 * Distinguishes pilot publish checklist (package.scenes/hotspots) vs full campus TTS batch.
 * Does not require Convex. Usage: node scripts/check-a11y-publish.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluateAccessibilityPublishChecklist } from '../src/a11yPublishChecklist.js';
import {
  expectedHotspotAssets,
  expectedSceneAssets,
  legacyHotspotScriptPath,
  legacySceneScriptPath
} from '../src/a11yPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function existsRel(rel) {
  if (!rel) return false;
  // Absolute site paths (/media/…) map to repo-relative paths
  const normalized = rel.replace(/^\.\//, "").replace(/^\//, "");
  return fs.existsSync(path.join(root, normalized));
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

function listKeys(dir, ext) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs)
    .filter((f) => f.endsWith(ext))
    .map((f) => f.slice(0, -ext.length))
    .sort();
}

function scriptExists(canonical, legacy) {
  return existsRel(canonical) || existsRel(legacy);
}

function inventoryKey(kind, key) {
  const expected = kind === 'scene' ? expectedSceneAssets(key) : expectedHotspotAssets(key);
  const legacyScript =
    kind === 'scene' ? legacySceneScriptPath(key) : legacyHotspotScriptPath(key);
  const checks = {
    audio: existsRel(expected.narration),
    transcript: existsRel(expected.transcript),
    caption: existsRel(expected.captionFile),
    script: scriptExists(expected.script, legacyScript),
    timing: existsRel(expected.timingFile)
  };
  const missing = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  return { key, ...checks, complete: missing.length === 0, missing };
}

function main() {
  const pkg = readJson(
    'media/unisimoncucuta/experienciavirtual/assets/accessibility/a11y-package.json'
  );
  const scenes = [];
  const audioMissing = [];
  const audioPresent = [];
  const textMissing = [];

  for (const [sceneKey, entry] of Object.entries(pkg.scenes || {})) {
    if (entry.aliasOf) continue; // evaluate canonical ids only
    scenes.push({
      id: sceneKey,
      title: sceneKey,
      srSummary: entry.srSummary,
      narration: entry.narration,
      transcript: entry.transcript,
      captionFile: entry.captionFile,
      narrationOptional: entry.narrationOptional,
      hotspots: []
    });

    if (entry.narration && !entry.narrationOptional) {
      if (existsRel(entry.narration)) audioPresent.push(entry.narration);
      else audioMissing.push(entry.narration);
    }
    for (const file of [entry.transcript, entry.captionFile, entry.scriptFile, entry.timingFile]) {
      if (file && !existsRel(file)) {
        // scripts: accept legacy mirror
        if (
          typeof file === 'string' &&
          file.includes('/accessibility/scripts/') &&
          existsRel(file.replace('/accessibility/scripts/', '/scripts/'))
        ) {
          continue;
        }
        textMissing.push(file);
        console.warn(`Missing text asset: ${file}`);
      }
    }
  }

  const hotspotScenes = Object.entries(pkg.hotspots || {}).map(([id, entry]) => ({
    id: `hotspot:${id}`,
    title: id,
    srSummary: entry.srSummary || id,
    narration: null,
    narrationOptional: true,
    transcript: null,
    captionFile: null,
    hotspots: [
      {
        id,
        type: 'info',
        title: id,
        narration: entry.narration,
        transcript: entry.transcript,
        captionFile: entry.captionFile,
        narrationOptional: entry.narrationOptional
      }
    ]
  }));

  for (const [id, entry] of Object.entries(pkg.hotspots || {})) {
    if (entry.narration && !entry.narrationOptional) {
      if (existsRel(entry.narration)) audioPresent.push(entry.narration);
      else audioMissing.push(entry.narration);
    }
    for (const file of [entry.transcript, entry.captionFile, entry.scriptFile, entry.timingFile]) {
      if (file && !existsRel(file)) {
        if (
          typeof file === 'string' &&
          file.includes('/accessibility/scripts/') &&
          existsRel(file.replace('/accessibility/scripts/', '/scripts/'))
        ) {
          continue;
        }
        textMissing.push(file);
        console.warn(`Missing text asset: ${file}`);
      }
    }
  }

  const checklist = evaluateAccessibilityPublishChecklist({
    scenes: [...scenes, ...hotspotScenes],
    requireCaptions: false
  });

  console.log('\n=== A11y publish checklist (package scenes/hotspots → metadata) ===\n');
  console.log(JSON.stringify({ ...checklist, checkedAt: new Date().toISOString() }, null, 2));
  console.log('\nPilot audio binaries present:', audioPresent.length);
  audioPresent.forEach((f) => console.log('  ✔', f));
  console.log('Package audio binaries missing (drop-in pending):', audioMissing.length);
  audioMissing.forEach((f) => console.log('  ·', f));
  if (textMissing.length) {
    console.log('Package text/timing missing:', textMissing.length);
  }

  const metadataReady = checklist.ready;
  console.log('\nPackage metadata checklist ready:', metadataReady ? 'YES' : 'NO');
  console.log(
    'Package binary audio ready for claim:',
    audioMissing.length === 0 && audioPresent.length > 0 ? 'YES' : 'NO (pipeline OK; files pending)'
  );

  // Full campus TTS inventory (disk) — aligns with scopes.fullCampusTts / Phase 9 publish claim after Convex sync.
  const diskScenes = listKeys(
    'media/unisimoncucuta/experienciavirtual/assets/audio/scenes',
    '.mp3'
  );
  const diskHotspots = listKeys(
    'media/unisimoncucuta/experienciavirtual/assets/audio/hotspots',
    '.mp3'
  );
  const tourHotspots =
    pkg.scopes?.fullCampusTts?.hotspotTourIds ||
    Object.keys(pkg.hotspots || {});
  const sceneInv = diskScenes.map((k) => inventoryKey('scene', k));
  const hotspotInv = tourHotspots.map((k) => inventoryKey('hotspot', k));
  const sceneComplete = sceneInv.filter((r) => r.complete).length;
  const hotspotComplete = hotspotInv.filter((r) => r.complete).length;
  const incomplete = [...sceneInv, ...hotspotInv].filter((r) => !r.complete);

  console.log('\n=== Full campus TTS inventory (disk) ===\n');
  console.log(
    JSON.stringify(
      {
        scope: 'fullCampusTts',
        publishClaimDefault: pkg.scopes?.fullCampusTts?.publishClaimDefault === true,
        voice: 'es-CO-SalomeNeural (see docs/producto/19-tts-accesibilidad.md)',
        scenesOnDisk: diskScenes.length,
        scenesCompleteBundle: `${sceneComplete}/${diskScenes.length}`,
        packageScenesCanonical: Object.keys(pkg.scenes || {}).filter(
          (k) => !pkg.scenes[k]?.aliasOf
        ).length,
        tourHotspotsTracked: tourHotspots.length,
        tourHotspotsCompleteBundle: `${hotspotComplete}/${tourHotspots.length}`,
        hotspotsAudioOnDisk: diskHotspots.length,
        legacyAliases: pkg.scopes?.fullCampusTts?.legacyTtsAliases || null,
        incomplete: incomplete.map((r) => ({ key: r.key, missing: r.missing }))
      },
      null,
      2
    )
  );

  if (!metadataReady) {
    process.exitCode = 1;
  }
}

main();

