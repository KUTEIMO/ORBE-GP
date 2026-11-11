#!/usr/bin/env node
/**
 * Build sanitized static distribution bundle in ./dist for production hosting
 * (Cloudflare Pages / Firebase Hosting / Netlify) paired with Convex Cloud.
 *
 * Usage:
 *   ORBE_CONVEX_URL=https://your-deployment.convex.cloud npm run build:prod
 *   node scripts/build-static-dist.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.join(ROOT, "dist");

const argv = new Set(process.argv.slice(2));
const dryRun = argv.has("--dry-run");
const allowLocal = argv.has("--allow-local");
const convexUrl = String(process.env.ORBE_CONVEX_URL || "").trim().replace(/\/$/, "");

if (convexUrl) {
  let parsed;
  try {
    parsed = new URL(convexUrl);
  } catch {
    console.error(`[build:prod] Invalid ORBE_CONVEX_URL: ${convexUrl}`);
    process.exit(1);
  }
  const isLocalHost = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(allowLocal && isLocalHost)) {
    console.error(`[build:prod] ORBE_CONVEX_URL must use https:// (got ${convexUrl})`);
    process.exit(1);
  }
}

const SKIP_BASENAMES = new Set([
  ".DS_Store",
  "Thumbs.db",
  "Desktop.ini",
  "links de images en internet .txt",
]);

function shouldCopyFile(relPosix) {
  const base = path.posix.basename(relPosix);
  if (SKIP_BASENAMES.has(base)) return false;
  if (base.startsWith(".env")) return false;
  if (relPosix.endsWith(".md")) return false;
  if (relPosix.endsWith(".local.js")) return false;
  return true;
}

function copyDirFiltered(srcDir, dstDir, relPrefix = "") {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  if (!dryRun) fs.mkdirSync(dstDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const srcPath = path.join(srcDir, entry.name);
    const dstPath = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      count += copyDirFiltered(srcPath, dstPath, rel);
    } else if (shouldCopyFile(rel)) {
      if (!dryRun) {
        fs.copyFileSync(srcPath, dstPath);
      }
      count += 1;
    }
  }
  return count;
}

function buildFirebaseConfig() {
  return {
    hosting: {
      public: ".",
      ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
      redirects: [
        { source: "/plataforma", destination: "/", type: 301 },
        { source: "/plataforma/", destination: "/", type: 301 },
        { source: "/plataforma/index.html", destination: "/", type: 301 },
        {
          source: "/:org/:tour/org-admin.html",
          destination: "/:org/org-admin.html",
          type: 302,
        },
      ],
      rewrites: [
        { source: "/:org/org-admin.html", destination: "/plataforma/org-admin.html" },
        { source: "/:org/:tour/control-web", destination: "/control-web/index.html" },
        { source: "/:org/:tour/control-web/", destination: "/control-web/index.html" },
        { source: "/:org/:tour/control-web/**", destination: "/control-web/index.html" },
        { source: "/:org/:tour", destination: "/viewer.html" },
        { source: "/:org/:tour/", destination: "/viewer.html" },
      ],
      headers: [
        {
          source: "**",
          headers: [
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "X-Frame-Options", value: "SAMEORIGIN" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            {
              key: "Permissions-Policy",
              value: "camera=(), geolocation=(), microphone=(self)",
            },
          ],
        },
        {
          source: "**/*.html",
          headers: [{ key: "Cache-Control", value: "no-cache" }],
        },
        {
          source: "/media/**",
          headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
        },
        {
          source: "/vendors/**",
          headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
        },
      ],
    },
  };
}

const CLOUDFLARE_ROUTES = {
  version: 1,
  include: ["/*"],
  exclude: [
    "/media/*",
    "/css/*",
    "/src/*",
    "/vendors/*",
    "/plataforma/assets/*",
    "/plataforma/data/*",
    "/control-web/*.css",
    "/control-web/*.js",
    "/plataforma/*.css",
    "/plataforma/*.js",
    "/orbe-config.js",
  ],
};

const CLOUDFLARE_HEADERS = [
  "/*",
  "  X-Content-Type-Options: nosniff",
  "  X-Frame-Options: SAMEORIGIN",
  "  Referrer-Policy: strict-origin-when-cross-origin",
  "  Permissions-Policy: camera=(), geolocation=(), microphone=(self)",
  "",
  "/*.html",
  "  Cache-Control: no-store, max-age=0",
  "",
  "/*.css",
  "  Cache-Control: public, max-age=0, must-revalidate",
  "",
  "/*.js",
  "  Cache-Control: public, max-age=0, must-revalidate",
  "",
  "/media/*",
  "  Cache-Control: public, max-age=604800",
  "",
  "/vendors/*",
  "  Cache-Control: public, max-age=0, must-revalidate",
  "",
].join("\n");

const ASSET_VERSION = "20261111h";

const VIEWER_CSS_ORDER = [
  "css/design-tokens.css",
  "css/base.css",
  "css/utilities.css",
  "css/header.css",
  "css/navigation.css",
  "css/menu/scene-menu.css",
  "css/menu/menu-groups.css",
  "css/menu/accessibility-menu.css",
  "css/components/loading.css",
  "css/components/error-notification.css",
  "css/components/hotspots.css",
  "css/components/nav-hotspot.css",
  "css/components/speaking-indicator.css",
  "css/components/accessibility-controls.css",
  "css/components/hotspot-panel.css",
  "css/components/direction-cue.css",
  "css/components/skip-links.css",
  "css/components/fallback.css",
  "css/responsive.css",
];

const PORTAL_CSS_ORDER = [
  "css/design-tokens.css",
  "plataforma/tokens.css",
  "plataforma/portal.css",
];

function joinCssBundle(relPaths) {
  return relPaths
    .map((rel) =>
      fs
        .readFileSync(path.join(ROOT, rel), "utf8")
        .replace(/^\s*@import\s+url\([^)]+\)\s*;\s*$/gm, "")
    )
    .join("\n");
}

async function bundleCssAndJs(esbuild) {
  let viewerCss = joinCssBundle(VIEWER_CSS_ORDER);
  let portalCss = joinCssBundle(PORTAL_CSS_ORDER);
  if (esbuild) {
    viewerCss = (await esbuild.transform(viewerCss, { loader: "css", minify: true })).code;
    portalCss = (await esbuild.transform(portalCss, { loader: "css", minify: true })).code;
  }
  fs.writeFileSync(path.join(DIST, "css", "viewer.bundle.css"), viewerCss, "utf8");
  fs.writeFileSync(path.join(DIST, "plataforma", "portal.bundle.css"), portalCss, "utf8");

  let bundledJs = false;
  if (esbuild) {
    await esbuild.build({
      entryPoints: [path.join(ROOT, "src", "main.js")],
      bundle: true,
      format: "esm",
      minify: true,
      outfile: path.join(DIST, "src", "viewer.bundle.js"),
    });
    const portalNoticeExternalPlugin = {
      name: "external-portal-notice",
      setup(build) {
        build.onResolve({ filter: /portal-notice\.js/ }, () => ({
          path: `/plataforma/portal-notice.js?v=${ASSET_VERSION}`,
          external: true,
        }));
      },
    };
    await esbuild.build({
      entryPoints: [path.join(ROOT, "plataforma", "portal-ui.js")],
      bundle: true,
      format: "esm",
      minify: true,
      plugins: [portalNoticeExternalPlugin],
      outfile: path.join(DIST, "plataforma", "portal-ui.bundle.js"),
    });
    bundledJs = true;
  }
  return bundledJs;
}

if (!dryRun) {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
}

let totalFiles = 0;
for (const dir of ["css", "src", "vendors", "plataforma", "control-web", "media"]) {
  totalFiles += copyDirFiltered(path.join(ROOT, dir), path.join(DIST, dir), dir);
}

// Root landing is plataforma/index.html; root viewer sits at /viewer.html so / matches cleanly.
if (!dryRun) {
  const esbuild = await import("esbuild").catch(() => null);
  const bundledJs = await bundleCssAndJs(esbuild);
  totalFiles += bundledJs ? 4 : 2;

  let landingHtml = fs.readFileSync(path.join(ROOT, "plataforma", "index.html"), "utf8");
  const landingCssBlockRe =
    /\s*<link rel="stylesheet" href="\/css\/design-tokens\.css(?:\?[^"]*)?">[\s\S]*?<link rel="stylesheet" href="\/plataforma\/portal\.css(?:\?[^"]*)?">/;
  if (!landingCssBlockRe.test(landingHtml)) {
    throw new Error("[build:prod] Unable to locate landing stylesheet block for bundling");
  }
  landingHtml = landingHtml.replace(
    landingCssBlockRe,
    `\n  <link rel="stylesheet" href="/plataforma/portal.bundle.css?v=${ASSET_VERSION}">`
  );
  if (bundledJs) {
    landingHtml = landingHtml.replace(
      /<script src="\/plataforma\/portal-ui\.js(?:\?[^"]*)?" type="module"><\/script>/,
      `<script src="/plataforma/portal-ui.bundle.js?v=${ASSET_VERSION}" type="module"></script>`
    );
  }
  fs.writeFileSync(path.join(DIST, "index.html"), landingHtml, "utf8");

  let viewerHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const viewerCssBlockRe =
    /\s*<link rel="stylesheet" href="\/css\/base\.css(?:\?[^"]*)?">[\s\S]*?<link rel="stylesheet" href="\/css\/responsive\.css(?:\?[^"]*)?">/;
  if (!viewerCssBlockRe.test(viewerHtml)) {
    throw new Error("[build:prod] Unable to locate viewer stylesheet block for bundling");
  }
  viewerHtml = viewerHtml.replace(
    viewerCssBlockRe,
    `\n    <link rel="stylesheet" href="/css/viewer.bundle.css?v=${ASSET_VERSION}">`
  );
  if (bundledJs) {
    viewerHtml = viewerHtml.replace(
      /<script type="module" src="\/src\/main\.js(?:\?[^"]*)?"><\/script>/,
      `<script type="module" src="/src/viewer.bundle.js?v=${ASSET_VERSION}"></script>`
    );
  }
  fs.writeFileSync(path.join(DIST, "viewer.html"), viewerHtml, "utf8");

  const orbeCfgRaw = fs.readFileSync(path.join(ROOT, "orbe-config.js"), "utf8");
  const platCfgRaw = fs.readFileSync(path.join(ROOT, "plataforma", "config.js"), "utf8");
  const injectBanner = convexUrl
    ? `window.__CONVEX_URL__ = window.__CONVEX_URL__ || ${JSON.stringify(convexUrl)};\n`
    : "";
  fs.writeFileSync(path.join(DIST, "orbe-config.js"), `${injectBanner}${orbeCfgRaw}`, "utf8");
  fs.writeFileSync(
    path.join(DIST, "plataforma", "config.js"),
    `${injectBanner}${platCfgRaw}`,
    "utf8"
  );

  fs.writeFileSync(
    path.join(DIST, "_routes.json"),
    `${JSON.stringify(CLOUDFLARE_ROUTES, null, 2)}\n`,
    "utf8"
  );
  fs.writeFileSync(path.join(DIST, "_headers"), CLOUDFLARE_HEADERS, "utf8");
  fs.writeFileSync(
    path.join(DIST, "404.html"),
    "<!DOCTYPE html><html lang=\"es\"><head><meta charset=\"UTF-8\"><title>No encontrado — Orbe360</title></head><body><h1>404 · Recurso no encontrado</h1><p><a href=\"/\">Volver al inicio</a></p></body></html>\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(DIST, "firebase.json"),
    `${JSON.stringify(buildFirebaseConfig(), null, 2)}\n`,
    "utf8"
  );
}
totalFiles += 8;

console.log(
  `[build:prod] ${dryRun ? "Dry-run OK" : "Built"} dist/ (${totalFiles} files${convexUrl ? `, Convex=${convexUrl}` : ", no Convex URL baked in"}).`
);

