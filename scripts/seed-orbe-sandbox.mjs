/**
 * Copy a small panorama subset + seed Orbe sandbox org/tour in Convex.
 * Does NOT mutate Unisimón experienciavirtual.
 *
 * Usage: node scripts/seed-orbe-sandbox.mjs
 */
import { copyFileSync, mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CONVEX = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEDIA_DIR = join(root, "media", "orbe", "sandbox", "panoramas");
// Prefer Unisimón tenant media; fall back to legacy root if still present
const SRC_CANDIDATES = [
  join(root, "media", "unisimoncucuta", "experienciavirtual", "panoramas"),
  join(root, "panoramas"),
];

const FILES = [
  "R0010060_202503281449_YP00145909.JPG",
  "R0010061_202503281452_YP00145909.JPG",
  "R0010062_202503281454_YP00145909.JPG",
  "R0010066_202503281503_YP00145909.JPG",
];

const SUPER_EMAIL = process.env.ORBE_SUPER_EMAIL || "superadmin@orbe360.local";
const SUPER_PASS = process.env.ORBE_SUPER_PASSWORD || "OrbeSuper2026!";

async function convex(kind, path, args = {}) {
  const res = await fetch(`${CONVEX}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await res.json();
  if (!res.ok || data.status === "error") {
    throw new Error(data.errorMessage || data.message || "convex error");
  }
  return data.value;
}

mkdirSync(MEDIA_DIR, { recursive: true });
const copied = [];
for (const file of FILES) {
  let src = null;
  for (const dir of SRC_CANDIDATES) {
    const candidate = join(dir, file);
    if (existsSync(candidate)) {
      src = candidate;
      break;
    }
  }
  const dest = join(MEDIA_DIR, file);
  if (!src) {
    if (existsSync(dest)) {
      copied.push(file);
      continue;
    }
    throw new Error(`Missing source panorama: ${file}`);
  }
  copyFileSync(src, dest);
  copied.push(file);
}
console.log(`Copied ${copied.length} panoramas → media/orbe/sandbox/panoramas/`);

// Ensure tenant-local config (4 scenes only) — never rely on root config.json
const tenantConfigPath = join(root, "media", "orbe", "sandbox", "config.json");
if (!existsSync(tenantConfigPath)) {
  writeFileSync(
    tenantConfigPath,
    JSON.stringify(
      {
        basePath: "/media/orbe/sandbox/panoramas/",
        scenes: FILES.map((file, i) => ({
          file,
          zone: ["acceso", "acceso", "circulacion", "servicios"][i],
        })),
        zones: {},
        accessibleScenes: {},
        __tenantIsolated: true,
      },
      null,
      2
    )
  );
  console.log("Wrote media/orbe/sandbox/config.json");
}

const login = await convex("mutation", "auth:login", {
  email: SUPER_EMAIL,
  password: SUPER_PASS,
});
if (!login?.ok || !login.token) {
  throw new Error(`Superadmin login failed: ${login?.error || "unknown"}`);
}

const result = await convex("mutation", "seedOrbeSandbox:seedOrbeSandbox", {
  token: login.token,
});

// Verify Unisimón still intact
const uni = await convex("query", "graph:getTourGraph", {
  orgSlug: "unisimoncucuta",
  tourSlug: "experienciavirtual",
});
const sandbox = await convex("query", "graph:getTourGraph", {
  orgSlug: "orbe",
  tourSlug: "sandbox",
});

console.log(
  JSON.stringify(
    {
      ok: true,
      seed: result,
      urls: {
        public: "http://127.0.0.1:8081/orbe/sandbox/",
        controlWeb: "http://127.0.0.1:8081/orbe/sandbox/control-web/",
        orgAdmin: "http://127.0.0.1:8081/orbe/org-admin.html",
      },
      adminLogin: { email: result.adminEmail, password: "OrbeSandbox2026!" },
      unisimonUntouched: {
        scenes: uni?.scenes?.length,
        connections: uni?.connections?.length,
        branding: uni?.branding?.primaryColor,
      },
      sandbox: {
        scenes: sandbox?.scenes?.length,
        connections: sandbox?.connections?.length,
        branding: sandbox?.branding?.primaryColor,
        sampleHotspotIcons: (sandbox?.scenes?.[0]?.hotspots || []).map((h) => ({
          title: h.title,
          iconKey: h.iconKey,
          category: h.category,
          animationPreset: h.animationPreset,
        })),
      },
    },
    null,
    2
  )
);
