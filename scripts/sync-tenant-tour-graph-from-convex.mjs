/**
 * Sync media/{org}/{tour}/tour-graph.json FROM Convex (read-only query).
 * Keeps offline / Control Web fallback aligned with published connections.
 *
 * Does NOT call syncCampusSpatialGraph. Does NOT touch Orbe sandbox unless asked.
 *
 * Usage:
 *   node scripts/sync-tenant-tour-graph-from-convex.mjs
 *   node scripts/sync-tenant-tour-graph-from-convex.mjs --org unisimoncucuta --tour experienciavirtual
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONVEX = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const ORG = arg("org", "unisimoncucuta");
const TOUR = arg("tour", "experienciavirtual");

async function convexQuery(path, args = {}) {
  const res = await fetch(`${CONVEX}/api/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (!res.ok || data.status === "error") {
    throw new Error(data.errorMessage || data.message || "convex query error");
  }
  return data.value;
}

const graph = await convexQuery("graph:getTourGraph", {
  orgSlug: ORG,
  tourSlug: TOUR,
});

if (!graph?.scenes?.length) {
  console.error("No published scenes — abort (refusing to write empty tour-graph.json).");
  process.exit(1);
}

const connCount = Array.isArray(graph.connections) ? graph.connections.length : 0;
if (connCount === 0 && graph.scenes.length > 3) {
  console.error(
    `Convex has ${graph.scenes.length} scenes but 0 connections — abort. ` +
      `Restore from backups/ first, then re-run.`
  );
  process.exit(1);
}

const scenesOut = {};
for (const scene of graph.scenes) {
  const hotspots = Array.isArray(scene.hotspots)
    ? scene.hotspots.map((h) => ({
        id: h.id,
        type: h.type === "nav" ? "nav" : "info",
        title: h.title,
        yaw: h.yaw,
        pitch: h.pitch,
        direction: h.direction,
        targetFile: h.targetFile,
        description: h.description,
        weight: h.weight,
        shortLabel: h.shortLabel,
        altText: h.altText || h.title,
        ...(h.iconKey ? { iconKey: h.iconKey } : {}),
        ...(h.category ? { category: h.category } : {}),
        ...(h.animationPreset ? { animationPreset: h.animationPreset } : {}),
        ...(h.accentColor ? { accentColor: h.accentColor } : {}),
      }))
    : [];
  scenesOut[scene.fileKey] = {
    hotspots,
    ...(scene.initialView && typeof scene.initialView.yaw === "number"
      ? { initialView: scene.initialView }
      : {}),
  };
}

const yawPitchByEdge = new Map();
for (const scene of graph.scenes) {
  for (const h of scene.hotspots || []) {
    if (h.type === "nav" && h.targetFile) {
      yawPitchByEdge.set(`${scene.fileKey}=>${h.targetFile}`, {
        yaw: h.yaw,
        pitch: h.pitch,
        label: h.title,
        direction: h.direction,
        weight: h.weight,
        id: h.id,
      });
    }
  }
}

const connections = (graph.connections || []).map((c, index) => {
  const key = `${c.fromFile}=>${c.toFile}`;
  const match = yawPitchByEdge.get(key);
  return {
    id: match?.id || `conn-${index}-${c.fromFile}-${c.toFile}`,
    from: c.fromFile,
    to: c.toFile,
    label: c.label || match?.label || "Ir a escena",
    yaw: typeof match?.yaw === "number" ? match.yaw : 0,
    pitch: typeof match?.pitch === "number" ? match.pitch : -0.05,
    direction: c.direction || match?.direction || null,
    weight: match?.weight || 1.4,
  };
});

const out = {
  version: 1,
  updatedAt: new Date().toISOString(),
  source: "convex graph:getTourGraph",
  orgSlug: ORG,
  tourSlug: TOUR,
  connections,
  scenes: scenesOut,
};

const outPath = join(root, "media", ORG, TOUR, "tour-graph.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");

console.log(
  JSON.stringify(
    {
      ok: true,
      path: `media/${ORG}/${TOUR}/tour-graph.json`,
      scenes: graph.scenes.length,
      connections: connections.length,
      note: "Static fallback synced FROM Convex. Public SoT remains Convex.",
    },
    null,
    2
  )
);
