/**
 * Build convex/lib/campusSpatialPackage.ts from known-good static sources:
 * config.json + biblioteca-scenes.json + tour-graph.json (+ hotspot-overrides).
 * Zone auto-nav fills scenes that lack explicit nav hotspots.
 *
 * Usage: node scripts/gen-campus-spatial-embed.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT = path.join("media", "unisimoncucuta", "experienciavirtual");

const cfg = JSON.parse(
  fs.readFileSync(path.join(root, TENANT, "config.json"), "utf8")
);
const bib = JSON.parse(
  fs.readFileSync(path.join(root, TENANT, "biblioteca-scenes.json"), "utf8")
);
let tourGraph = { scenes: {}, connections: [] };
try {
  tourGraph = JSON.parse(
    fs.readFileSync(path.join(root, TENANT, "tour-graph.json"), "utf8")
  );
} catch {
  /* empty */
}
let overrides = {};
try {
  overrides = JSON.parse(
    fs.readFileSync(path.join(root, TENANT, "hotspot-overrides.json"), "utf8")
  );
} catch {
  /* empty */
}

function cleanTitle(t) {
  return (t || "").replace(/^\s*\d+[.\-)]\s*/, "").trim() || "Escena";
}
function slugify(v) {
  return (
    String(v || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "") || "scene"
  );
}

const acc = cfg.accessibleScenes || {};
const sceneNames = cfg.sceneNames || {};
const tgScenes =
  tourGraph.scenes && typeof tourGraph.scenes === "object" ? tourGraph.scenes : {};

/** @type {Record<string, any>} */
const merged = {};

for (let i = 0; i < (cfg.scenes || []).length; i++) {
  const entry = cfg.scenes[i];
  const file = entry.file;
  const fromAcc = acc[file] || {};
  const fromBib = bib[file] || {};
  const fromTg = tgScenes[file] || {};

  const lists = [
    Array.isArray(fromTg.hotspots) ? fromTg.hotspots : null,
    Array.isArray(fromBib.hotspots) ? fromBib.hotspots : null,
    Array.isArray(fromAcc.hotspots) ? fromAcc.hotspots : null,
  ].filter(Boolean);
  lists.sort((a, b) => b.length - a.length);
  let hotspots = lists[0] ? structuredClone(lists[0]) : [];

  const title =
    fromBib.title || fromAcc.title || fromTg.title || sceneNames[file] || file;
  const id = fromBib.id || fromAcc.id || fromTg.id || slugify(file);

  const scene = {
    fileKey: file,
    sceneId: id,
    title,
    shortTitle:
      fromBib.shortTitle ||
      fromAcc.shortTitle ||
      fromTg.shortTitle ||
      cleanTitle(title),
    zone: fromBib.zone || fromAcc.zone || fromTg.zone || entry.zone || "general",
    order:
      typeof fromBib.order === "number"
        ? fromBib.order
        : typeof fromAcc.order === "number"
          ? fromAcc.order
          : typeof fromTg.order === "number"
            ? fromTg.order
            : i,
    imageUrl:
      fromBib.imageUrl ||
      fromAcc.imageUrl ||
      fromTg.imageUrl ||
      `/media/unisimoncucuta/experienciavirtual/panoramas/${file}`,
    altText: fromBib.altText || fromAcc.altText || fromTg.altText || cleanTitle(title),
    longDescription:
      fromBib.longDescription ||
      fromAcc.longDescription ||
      fromTg.longDescription ||
      undefined,
    hotspots: hotspots.map((h, idx) => {
      const hid = h.id || `${id}-hotspot-${idx}`;
      const type = h.type === "nav" ? "nav" : "info";
      return {
        id: hid,
        type,
        title: h.title || h.shortLabel || "Hotspot",
        yaw: typeof h.yaw === "number" ? h.yaw : 0,
        pitch: typeof h.pitch === "number" ? h.pitch : 0,
        direction: h.direction || undefined,
        targetFile: h.targetFile || undefined,
        description: h.description || h.altText || undefined,
        weight: typeof h.weight === "number" ? h.weight : undefined,
        shortLabel: h.shortLabel || undefined,
        altText: h.altText || undefined,
      };
    }),
  };

  const links = [
    ...(Array.isArray(fromBib.links) ? fromBib.links : []),
    ...(Array.isArray(fromAcc.links) ? fromAcc.links : []),
    ...(Array.isArray(fromTg.links) ? fromTg.links : []),
  ];
  for (const link of links) {
    if (!link?.targetFile) continue;
    const exists = scene.hotspots.some(
      (h) => h.type === "nav" && h.targetFile === link.targetFile
    );
    if (exists) continue;
    scene.hotspots.push({
      id: `${id}-link-${slugify(link.label || link.targetFile)}`,
      type: "nav",
      title: link.label || "Ir a escena",
      yaw: typeof link.yaw === "number" ? link.yaw : 0,
      pitch: typeof link.pitch === "number" ? link.pitch : -0.05,
      targetFile: link.targetFile,
      description: `Continúa hacia: ${link.label || "siguiente escena"}`,
    });
  }

  // Apply yaw/pitch overrides by sceneId + hotspot id
  const sceneOv = overrides[id];
  if (sceneOv && typeof sceneOv === "object") {
    for (const h of scene.hotspots) {
      const ov = sceneOv[h.id];
      if (ov && typeof ov.yaw === "number") h.yaw = ov.yaw;
      if (ov && typeof ov.pitch === "number") h.pitch = ov.pitch;
    }
  }

  merged[file] = scene;
}

// Zone chain for scenes without any nav hotspot
const byZone = new Map();
for (const s of Object.values(merged)) {
  if (!byZone.has(s.zone)) byZone.set(s.zone, []);
  byZone.get(s.zone).push(s);
}
for (const list of byZone.values()) {
  list.sort((a, b) => a.order - b.order);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.hotspots.some((h) => h.type === "nav")) continue;
    if (list[i + 1]) {
      s.hotspots.push({
        id: `${s.sceneId}-auto-next`,
        type: "nav",
        title: `Ir a ${list[i + 1].shortTitle}`,
        yaw: 0,
        pitch: -0.05,
        targetFile: list[i + 1].fileKey,
        description: `Siguiente en zona ${s.zone}`,
        direction: "forward",
      });
    }
    if (list[i - 1]) {
      s.hotspots.push({
        id: `${s.sceneId}-auto-prev`,
        type: "nav",
        title: `Ir a ${list[i - 1].shortTitle}`,
        yaw: Math.PI * 0.85,
        pitch: -0.05,
        targetFile: list[i - 1].fileKey,
        description: `Anterior en zona ${s.zone}`,
        direction: "back",
      });
    }
  }
}

// Connections: explicit tour-graph + derived from nav hotspots
const connKey = new Set();
const connections = [];
function addConn(from, to, label, direction) {
  if (!from || !to || !merged[from] || !merged[to]) return;
  const key = `${from}->${to}`;
  if (connKey.has(key)) return;
  connKey.add(key);
  connections.push({
    from,
    to,
    label: label || undefined,
    direction: direction || undefined,
  });
}

for (const c of tourGraph.connections || []) {
  if (c?.from && c?.to) addConn(c.from, c.to, c.label, c.direction);
}
for (const s of Object.values(merged)) {
  for (const h of s.hotspots) {
    if (h.type === "nav" && h.targetFile) {
      addConn(s.fileKey, h.targetFile, h.title, h.direction);
    }
  }
}

const scenesArr = Object.values(merged).sort((a, b) => a.order - b.order);
const hotspotCount = scenesArr.reduce((n, s) => n + s.hotspots.length, 0);
const navCount = scenesArr.reduce(
  (n, s) => n + s.hotspots.filter((h) => h.type === "nav").length,
  0
);

function esc(s) {
  return JSON.stringify(s);
}

let scenesTs = "";
for (const s of scenesArr) {
  scenesTs += `  {\n`;
  scenesTs += `    fileKey: ${esc(s.fileKey)},\n`;
  scenesTs += `    sceneId: ${esc(s.sceneId)},\n`;
  scenesTs += `    title: ${esc(s.title)},\n`;
  scenesTs += `    shortTitle: ${esc(s.shortTitle)},\n`;
  scenesTs += `    zone: ${esc(s.zone)},\n`;
  scenesTs += `    order: ${s.order},\n`;
  scenesTs += `    imageUrl: ${esc(s.imageUrl)},\n`;
  scenesTs += `    altText: ${esc(s.altText)},\n`;
  if (s.longDescription) {
    scenesTs += `    longDescription: ${esc(s.longDescription)},\n`;
  }
  scenesTs += `    hotspots: [\n`;
  for (const h of s.hotspots) {
    scenesTs += `      {\n`;
    scenesTs += `        id: ${esc(h.id)},\n`;
    scenesTs += `        type: ${esc(h.type)},\n`;
    scenesTs += `        title: ${esc(h.title)},\n`;
    scenesTs += `        yaw: ${h.yaw},\n`;
    scenesTs += `        pitch: ${h.pitch},\n`;
    if (h.direction) scenesTs += `        direction: ${esc(h.direction)},\n`;
    if (h.targetFile) scenesTs += `        targetFile: ${esc(h.targetFile)},\n`;
    if (h.description) scenesTs += `        description: ${esc(h.description)},\n`;
    if (typeof h.weight === "number") scenesTs += `        weight: ${h.weight},\n`;
    if (h.shortLabel) scenesTs += `        shortLabel: ${esc(h.shortLabel)},\n`;
    if (h.altText) scenesTs += `        altText: ${esc(h.altText)},\n`;
    scenesTs += `      },\n`;
  }
  scenesTs += `    ],\n`;
  scenesTs += `  },\n`;
}

let connsTs = "";
for (const c of connections) {
  connsTs += `  {\n`;
  connsTs += `    from: ${esc(c.from)},\n`;
  connsTs += `    to: ${esc(c.to)},\n`;
  if (c.label) connsTs += `    label: ${esc(c.label)},\n`;
  if (c.direction) connsTs += `    direction: ${esc(c.direction)},\n`;
  connsTs += `  },\n`;
}

const out = `/**
 * Unisimón campus spatial graph (yaw/pitch/nav/connections) for Convex sync.
 * Built from config.json + biblioteca-scenes.json + tour-graph.json.
 * Does NOT include a11y URLs — apply spatial then a11y (or preserve existing a11y).
 *
 * Regenerate: node scripts/gen-campus-spatial-embed.mjs
 * Counts: ${scenesArr.length} scenes, ${hotspotCount} hotspots (${navCount} nav), ${connections.length} connections.
 */

export const CAMPUS_SPATIAL_TOUR_SLUG = "experienciavirtual";
export const CAMPUS_SPATIAL_SCENE_COUNT = ${scenesArr.length};
export const CAMPUS_SPATIAL_HOTSPOT_COUNT = ${hotspotCount};
export const CAMPUS_SPATIAL_NAV_COUNT = ${navCount};
export const CAMPUS_SPATIAL_CONNECTION_COUNT = ${connections.length};

export type SpatialHotspot = {
  id: string;
  type: "nav" | "info";
  title: string;
  yaw: number;
  pitch: number;
  direction?: string;
  targetFile?: string;
  description?: string;
  weight?: number;
  shortLabel?: string;
  altText?: string;
};

export type SpatialScene = {
  fileKey: string;
  sceneId: string;
  title: string;
  shortTitle: string;
  zone: string;
  order: number;
  imageUrl: string;
  altText: string;
  longDescription?: string;
  hotspots: SpatialHotspot[];
};

export type SpatialConnection = {
  from: string;
  to: string;
  label?: string;
  direction?: string;
};

export type CampusSpatialPackage = {
  tourSlug: string;
  scenes: SpatialScene[];
  connections: SpatialConnection[];
};

export const CAMPUS_SPATIAL_PACKAGE: CampusSpatialPackage = {
  tourSlug: CAMPUS_SPATIAL_TOUR_SLUG,
  scenes: [
${scenesTs}  ],
  connections: [
${connsTs}  ],
};
`;

const dest = path.join(root, "convex/lib/campusSpatialPackage.ts");
fs.writeFileSync(dest, out, "utf8");
console.log(
  `Wrote ${path.relative(root, dest)} — scenes=${scenesArr.length} hotspots=${hotspotCount} nav=${navCount} connections=${connections.length}`
);
