/**
 * Regenerate convex/lib/pilotA11yPackage.ts from tenant a11y-package.json.
 * Skips aliasOf scenes (same as applyA11yPackage).
 * Usage: node scripts/gen-pilot-a11y-embed.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const A11Y_PKG =
  "media/unisimoncucuta/experienciavirtual/assets/accessibility/a11y-package.json";
const pkg = JSON.parse(fs.readFileSync(path.join(root, A11Y_PKG), "utf8"));

function esc(s) {
  return JSON.stringify(s);
}

let scenes = "";
for (const [k, e] of Object.entries(pkg.scenes || {})) {
  if (e.aliasOf) continue;
  scenes += `    ${esc(k)}: {\n`;
  scenes += `      fileKey: ${esc(e.fileKey)},\n`;
  scenes += `      srSummary: ${esc(e.srSummary)},\n`;
  scenes += `      narrationOptional: false,\n`;
  scenes += `      narration: ${esc(e.narration)},\n`;
  scenes += `      transcript: ${esc(e.transcript)},\n`;
  scenes += `      captionFile: ${esc(e.captionFile)},\n`;
  scenes += `      timingFile: ${esc(e.timingFile)},\n`;
  scenes += `      scriptFile: ${esc(e.scriptFile)},\n`;
  scenes += `    },\n`;
}

let hotspots = "";
for (const [k, e] of Object.entries(pkg.hotspots || {})) {
  hotspots += `    ${esc(k)}: {\n`;
  if (e.sceneKey) hotspots += `      sceneKey: ${esc(e.sceneKey)},\n`;
  if (e.srSummary) hotspots += `      srSummary: ${esc(e.srSummary)},\n`;
  hotspots += `      narrationOptional: false,\n`;
  hotspots += `      narration: ${esc(e.narration)},\n`;
  hotspots += `      transcript: ${esc(e.transcript)},\n`;
  hotspots += `      captionFile: ${esc(e.captionFile)},\n`;
  hotspots += `      timingFile: ${esc(e.timingFile)},\n`;
  hotspots += `      scriptFile: ${esc(e.scriptFile)},\n`;
  hotspots += `    },\n`;
}

const sceneCount = Object.values(pkg.scenes || {}).filter((e) => !e.aliasOf).length;
const hotspotCount = Object.keys(pkg.hotspots || {}).length;

const ts = `/**
 * Full campus a11y package metadata for Unisimón (seed / bootstrap sync).
 * Mirrors media/unisimoncucuta/experienciavirtual/assets/accessibility/a11y-package.json scopes.fullCampusTts entries (no aliasOf).
 * Static JSON remains authoring/TTS input; Convex fields are publish SoT (Phase 8/9).
 * Phase 9: default publish claim = full campus TTS (${sceneCount} scenes + ${hotspotCount} hotspots),
 * not the old 4-scene piloto subset.
 *
 * Regenerate: node scripts/gen-pilot-a11y-embed.mjs
 */

export const PILOT_A11Y_TOUR_SLUG = "experienciavirtual";

export type A11yPackageSceneEntry = {
  fileKey?: string;
  srSummary?: string;
  narrationOptional?: boolean;
  narration?: string;
  transcript?: string;
  captionFile?: string;
  timingFile?: string;
  scriptFile?: string;
  aliasOf?: string;
};

export type A11yPackageHotspotEntry = {
  /** Parent scene package key (for createMissing stubs). */
  sceneKey?: string;
  srSummary?: string;
  narrationOptional?: boolean;
  narration?: string;
  transcript?: string;
  captionFile?: string;
  timingFile?: string;
  scriptFile?: string;
};

export type A11yPackagePayload = {
  tourSlug?: string;
  scenes?: Record<string, A11yPackageSceneEntry>;
  hotspots?: Record<string, A11yPackageHotspotEntry>;
};

/** Full campus TTS set — default Unisimón accessible publish claim after sync. */
export const FULL_CAMPUS_A11Y_PACKAGE: A11yPackagePayload = {
  tourSlug: PILOT_A11Y_TOUR_SLUG,
  scenes: {
${scenes}  },
  hotspots: {
${hotspots}  },
};

/** @deprecated Name kept for seed/sync call sites — same as FULL_CAMPUS_A11Y_PACKAGE (Phase 9). */
export const PILOT_A11Y_PACKAGE: A11yPackagePayload = FULL_CAMPUS_A11Y_PACKAGE;

export const FULL_CAMPUS_A11Y_SCENE_COUNT = ${sceneCount};
export const FULL_CAMPUS_A11Y_HOTSPOT_COUNT = ${hotspotCount};
`;

const out = path.join(root, "convex/lib/pilotA11yPackage.ts");
fs.writeFileSync(out, ts);
console.log(`Wrote ${path.relative(root, out)} (${sceneCount} scenes, ${hotspotCount} hotspots)`);
