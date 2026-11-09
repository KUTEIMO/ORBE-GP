/**
 * Backup Unisimón experienciavirtual graph from Convex (read-only).
 * Usage: node scripts/backup-unisimon-graph.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONVEX = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const outDir = join(root, "backups");
mkdirSync(outDir, { recursive: true });
const outPath = join(
  outDir,
  `graph-unisimoncucuta-experienciavirtual-${date}.json`
);

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
  orgSlug: "unisimoncucuta",
  tourSlug: "experienciavirtual",
});

if (!graph || !graph.tour) {
  console.error("Empty or missing tour graph — aborting backup.");
  process.exit(1);
}

const backup = {
  format: "orbe360.tour-graph.backup.v1",
  source: "convex graph:getTourGraph (HTTP)",
  convexUrl: CONVEX,
  exportedAt: new Date().toISOString(),
  orgSlug: "unisimoncucuta",
  tourSlug: "experienciavirtual",
  counts: {
    scenes: Array.isArray(graph.scenes) ? graph.scenes.length : 0,
    connections: Array.isArray(graph.connections)
      ? graph.connections.length
      : 0,
    hotspots: Array.isArray(graph.scenes)
      ? graph.scenes.reduce((n, s) => n + (s.hotspots?.length || 0), 0)
      : 0,
  },
  restoreNotes: [
    "Read-only snapshot of the published public graph shape.",
    "SoT: Convex tables scenes / hotspots / connections for experienciavirtual.",
    "Restore curated nav via Control Web Import + Guardar, or tourAdmin:saveTourSnapshot.",
    "NEVER run tourAdmin:syncCampusSpatialGraph on the piloto (wipes curated edges).",
  ],
  graph,
};

writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");
console.log(
  JSON.stringify(
    {
      ok: true,
      path: outPath,
      counts: backup.counts,
      tourId: graph.tour.id,
      brandingPrimary: graph.branding?.primaryColor,
    },
    null,
    2
  )
);
