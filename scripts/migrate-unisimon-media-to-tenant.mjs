/**
 * Move Unisimón campus media + static configs into
 * media/unisimoncucuta/experienciavirtual/ (MOVE, not copy of JPGs).
 *
 * Does NOT touch Convex graph connections — only filesystem + static JSON paths.
 * Run Convex URL migration separately: npx convex run migratePilotMediaUrls:migratePilotMediaUrls
 *
 * Usage: node scripts/migrate-unisimon-media-to-tenant.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ORG = "unisimoncucuta";
const TOUR = "experienciavirtual";
const TENANT = path.join(ROOT, "media", ORG, TOUR);
const MEDIA_ABS = `/media/${ORG}/${TOUR}`;
const PANORAMA_ABS = `${MEDIA_ABS}/panoramas/`;
const ASSETS_ABS = `${MEDIA_ABS}/assets`;

const TOUR_JSON = [
  "config.json",
  "tour-graph.json",
  "biblioteca-scenes.json",
  "tour-branding.json",
  "hotspot-overrides.json",
];

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function moveDirContents(src, dest) {
  ensureDir(dest);
  if (!fs.existsSync(src)) return { moved: 0, skipped: true };
  let moved = 0;
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.existsSync(to)) {
      // Already migrated
      continue;
    }
    fs.renameSync(from, to);
    moved += 1;
  }
  return { moved, skipped: false };
}

function rewriteAssetPaths(text) {
  // assets/... → /media/unisimoncucuta/experienciavirtual/assets/...
  return text.replace(
    /(?<![\w/])assets\//g,
    `${ASSETS_ABS}/`
  );
}

function rewriteImageUrlsInJson(value) {
  if (typeof value === "string") {
    let s = value;
    if (
      s === "panoramas/" ||
      s.startsWith("panoramas/") ||
      s.startsWith("../panoramas/") ||
      s.startsWith("/panoramas/")
    ) {
      const file = s.replace(/^(\.\.\/)?\/?panoramas\//, "");
      s = file ? `${PANORAMA_ABS}${file}` : PANORAMA_ABS;
    } else if (
      s.startsWith("assets/") ||
      (s.includes("assets/") && !s.startsWith(MEDIA_ABS))
    ) {
      s = rewriteAssetPaths(s);
    }
    return s;
  }
  if (Array.isArray(value)) {
    return value.map(rewriteImageUrlsInJson);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = rewriteImageUrlsInJson(v);
    }
    return out;
  }
  return value;
}

function moveTourJson(name) {
  const src = path.join(ROOT, name);
  const dest = path.join(TENANT, name);
  if (!fs.existsSync(src) && fs.existsSync(dest)) {
    return { status: "already-at-tenant" };
  }
  if (!fs.existsSync(src)) {
    return { status: "missing" };
  }
  ensureDir(TENANT);
  let raw = fs.readFileSync(src, "utf8");
  if (name.endsWith(".json")) {
    try {
      const parsed = JSON.parse(raw);
      if (name === "config.json") {
        parsed.basePath = PANORAMA_ABS;
      }
      const rewritten = rewriteImageUrlsInJson(parsed);
      raw = JSON.stringify(rewritten, null, 2) + "\n";
    } catch {
      raw = rewriteAssetPaths(raw);
    }
  }
  fs.writeFileSync(dest, raw, "utf8");
  fs.unlinkSync(src);
  return { status: "moved" };
}

function leaveRootDeprecation() {
  const panoramasDir = path.join(ROOT, "panoramas");
  ensureDir(panoramasDir);
  // Keep listado if still there; otherwise empty
  const remaining = fs.existsSync(panoramasDir)
    ? fs.readdirSync(panoramasDir).filter((n) => n !== "DEPRECATED.md")
    : [];
  const note = `# DEPRECATED — Unisimón panoramas moved

**Do not put tenant panoramas here.** Shared root \`panoramas/\` caused multi-tenant leaks.

Canonical location:
\`media/${ORG}/${TOUR}/panoramas/\`

Public URL:
\`${PANORAMA_ABS}{file}.JPG\`

Marketing \`/\` must never serve Unisimón campus imagery from this folder.
Orbe sandbox: \`media/orbe/sandbox/panoramas/\` only.

Migrated: ${new Date().toISOString()}
Remaining entries here (should be empty or listado only): ${remaining.join(", ") || "(none)"}
`;
  fs.writeFileSync(path.join(panoramasDir, "DEPRECATED.md"), note, "utf8");

  // Stub root config pointing maintainers away from shared campus default
  const stubConfig = {
    __deprecated: true,
    message:
      "Root config.json removed. Unisimón lives under media/unisimoncucuta/experienciavirtual/config.json",
    basePath: PANORAMA_ABS,
    scenes: [],
    zones: {},
    accessibleScenes: {},
  };
  fs.writeFileSync(
    path.join(ROOT, "config.json"),
    JSON.stringify(stubConfig, null, 2) + "\n",
    "utf8"
  );

  const assetsStub = path.join(ROOT, "assets");
  ensureDir(assetsStub);
  fs.writeFileSync(
    path.join(assetsStub, "DEPRECATED.md"),
    `# DEPRECATED — Unisimón a11y assets moved

Canonical: \`media/${ORG}/${TOUR}/assets/\`
Absolute URLs: \`${ASSETS_ABS}/…\`

Do not share campus audio/transcripts with other tenants (e.g. orbe/sandbox).
`,
    "utf8"
  );
}

// --- run ---
ensureDir(path.join(TENANT, "panoramas"));
ensureDir(path.join(TENANT, "assets"));

const panoSrc = path.join(ROOT, "panoramas");
const panoDest = path.join(TENANT, "panoramas");
const pano = moveDirContents(panoSrc, panoDest);
// Move listado.txt with panoramas if present at root panoramas
const listadoSrc = path.join(panoSrc, "listado.txt");
if (fs.existsSync(listadoSrc) && !fs.existsSync(path.join(panoDest, "listado.txt"))) {
  fs.renameSync(listadoSrc, path.join(panoDest, "listado.txt"));
}

const assetsSrc = path.join(ROOT, "assets");
const assetsDest = path.join(TENANT, "assets");
let assetsMoved = { dirs: [] };
if (fs.existsSync(assetsSrc)) {
  for (const name of fs.readdirSync(assetsSrc)) {
    if (name === "DEPRECATED.md") continue;
    const from = path.join(assetsSrc, name);
    const to = path.join(assetsDest, name);
    if (fs.existsSync(to)) continue;
    fs.renameSync(from, to);
    assetsMoved.dirs.push(name);
  }
}

// Rewrite a11y package paths if present under tenant
const a11yPkg = path.join(assetsDest, "accessibility", "a11y-package.json");
if (fs.existsSync(a11yPkg)) {
  const pkg = JSON.parse(fs.readFileSync(a11yPkg, "utf8"));
  const rewritten = rewriteImageUrlsInJson(pkg);
  fs.writeFileSync(a11yPkg, JSON.stringify(rewritten, null, 2) + "\n", "utf8");
}

const jsonResults = {};
for (const name of TOUR_JSON) {
  jsonResults[name] = moveTourJson(name);
}

// If config was already at tenant (re-run), still force basePath
const tenantConfig = path.join(TENANT, "config.json");
if (fs.existsSync(tenantConfig)) {
  const cfg = JSON.parse(fs.readFileSync(tenantConfig, "utf8"));
  cfg.basePath = PANORAMA_ABS;
  const rewritten = rewriteImageUrlsInJson(cfg);
  fs.writeFileSync(tenantConfig, JSON.stringify(rewritten, null, 2) + "\n", "utf8");
}

leaveRootDeprecation();

// Never leave an empty tour-graph.json as tenant fallback (wipes Control Web → Convex).
const tenantGraphPath = path.join(TENANT, "tour-graph.json");
if (fs.existsSync(tenantGraphPath)) {
  try {
    const tg = JSON.parse(fs.readFileSync(tenantGraphPath, "utf8"));
    const conns = Array.isArray(tg.connections) ? tg.connections.length : 0;
    const scenes =
      tg.scenes && typeof tg.scenes === "object" ? Object.keys(tg.scenes).length : 0;
    if (conns === 0 && scenes === 0) {
      console.warn(
        "[migrate] WARNING: media/.../tour-graph.json is EMPTY. " +
          "Run: npm run sync:unisimon-graph  (after Convex has connections) " +
          "or Import backup in Control Web. Do NOT Guardar with empty graph."
      );
    }
  } catch {
    /* ignore parse */
  }
}

const panoCount = fs
  .readdirSync(panoDest)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length;

console.log(
  JSON.stringify(
    {
      ok: true,
      tenantRoot: `media/${ORG}/${TOUR}/`,
      panoramasMoved: pano.moved,
      panoramasAtTenant: panoCount,
      assetsDirsMoved: assetsMoved.dirs,
      tourJson: jsonResults,
      panoramaUrlPrefix: PANORAMA_ABS,
      assetsUrlPrefix: `${ASSETS_ABS}/`,
      next: [
        "Update code resolvers (dev-server, a11yPaths, …)",
        "npx convex run migratePilotMediaUrls:migratePilotMediaUrls",
        "npm run sync:unisimon-graph  # static tour-graph ← Convex (never leave empty)",
        "node scripts/gen-pilot-a11y-embed.mjs",
      ],
    },
    null,
    2
  )
);
