/**
 * Orbe360 local static server with virtual multi-tenant rewrites.
 *
 * Serves one shared codebase:
 *   /                                    → plataforma/index.html (marketing — only public URL)
 *   /{orgSlug}/org-admin.html            → plataforma/org-admin.html (org-level admin)
 *   /{orgSlug}/{tourSlug}/               → index.html (viewer)
 *   /{orgSlug}/{tourSlug}/control-web/*  → control-web/*
 *   /{orgSlug}/{tourSlug}/*               → /* (shared assets under tour prefix)
 *
 * Marketing redirects (single landing at /):
 *   /plataforma/index.html               → 302 /
 *   /plataforma/  and /plataforma        → 302 /
 *   /{org}/{tour}/plataforma/index.html  → 302 /
 *   /{org}/{tour}/plataforma/login.html  → 302 /plataforma/login.html
 *   /{org}/{tour}/plataforma/org-admin.html → 302 /{org}/org-admin.html
 *
 * Org-admin redirects:
 *   /{org}/{tour}/org-admin.html         → 302 /{org}/org-admin.html
 *
 * Compat redirects:
 *   /?slug=…  and  /index.html?slug=…  → /{org}/{tour}/ (known aliases)
 *
 * Usage: node scripts/dev-server.mjs  (npm start / npm run dev:web)
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.env.PORT || 8081);
const HOST = process.env.HOST || "127.0.0.1";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Paths that must never be HTTP-served (secrets, source, dumps, tooling).
 * This server is loopback-only by default, but it gets tunnelled for demos —
 * one `cloudflared --url` away from publishing .env.local, docs/ and backups/.
 */
const BLOCKED_PREFIXES = [
  ".env",
  ".git",
  ".convex",
  ".cursor",
  "node_modules",
  "convex",
  "backups",
  "docs",
  "scripts",
  "reports",
  "tests",
  "test-results",
  "playwright-report",
  "coverage",
  "_restos_exras_bloqueados",
];

/**
 * Lowercase only — isBlockedSensitive() lowercases the request path before
 * lookup, so mixed-case entries here would silently never match.
 */
const BLOCKED_FILES = new Set([
  ".env",
  ".env.local",
  ".gitignore",
  "package.json",
  "package-lock.json",
  "convex.json",
  "playwright.config.js",
  "audit-runner.js",
  "instrumento_auditoria_v1.json",
  "config.local.js",
  "orbe-config.local.js",
  "agents.md",
  "changelog.md",
  "license",
  "leeme.md",
  "readme.md",
  "ubicacion_y_archivo.md",
  "backlog.md",
]);

function normalizeRel(rel) {
  return String(rel || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function isBlockedSensitive(rel) {
  const r = normalizeRel(rel).toLowerCase();
  if (!r) return false;
  const base = path.posix.basename(r);
  if (base.startsWith(".env")) return true;
  if (BLOCKED_FILES.has(base) || BLOCKED_FILES.has(r)) return true;
  if (base.endsWith(".map") && r.startsWith("src/")) return true;
  for (const prefix of BLOCKED_PREFIXES) {
    if (r === prefix || r.startsWith(`${prefix}/`) || r.startsWith(`.${prefix}/`)) {
      return true;
    }
  }
  // Dotfiles / dirs at root (e.g. .convex via path tricks)
  if (r.startsWith(".") && !r.startsWith("vendors/")) return true;
  return false;
}

function forbid(res, message = "Forbidden") {
  res.writeHead(403, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(message);
}

/** Public URL map for known piloto + legacy query slugs. */
const SLUG_TO_PATH = {
  experienciavirtual: { org: "unisimoncucuta", tour: "experienciavirtual" },
  "unisimon-campus": { org: "unisimoncucuta", tour: "experienciavirtual" },
};

const RESERVED_ROOT = new Set([
  "plataforma",
  "control-web",
  "src",
  "css",
  "assets",
  "media",
  "panoramas",
  "vendors",
  "tests",
  "docs",
  "scripts",
  "reports",
  "node_modules",
  "convex",
  "playwright-report",
  "test-results",
  "backups",
]);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".vtt": "text/vtt; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".ico": "image/x-icon",
};

function isSafeSlug(s) {
  return typeof s === "string" && SLUG_RE.test(s);
}

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function sendFile(res, filePath, status = 200) {
  const abs = path.resolve(filePath);
  // Compare against ROOT + separator: a bare startsWith(ROOT) also matches
  // sibling directories such as `…/ORBE-backup`, escaping the served root.
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (abs !== ROOT && !abs.startsWith(rootWithSep)) {
    forbid(res);
    return;
  }
  const rel = normalizeRel(path.relative(ROOT, abs));
  if (isBlockedSensitive(rel)) {
    forbid(res);
    return;
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  res.writeHead(status, {
    "Content-Type": contentType(abs),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  fs.createReadStream(abs).pipe(res);
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, "Cache-Control": "no-store" });
  res.end();
}

/**
 * @param {string} pathname
 * @returns {{ kind: 'marketing' } | { kind: 'static', rel: string } | { kind: 'org-admin', org: string } | { kind: 'tour', org: string, tour: string, rest: string } | null}
 */
function resolveRoute(pathname) {
  let p = pathname || "/";
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  if (!p.startsWith("/")) p = `/${p}`;

  if (p === "/" || p === "") return { kind: "marketing" };

  const parts = p.split("/").filter(Boolean);
  if (parts.length === 0) return { kind: "marketing" };

  // Org-level admin: /{orgSlug}/org-admin.html
  if (
    parts.length === 2 &&
    isSafeSlug(parts[0]) &&
    !RESERVED_ROOT.has(parts[0]) &&
    parts[1] === "org-admin.html"
  ) {
    return { kind: "org-admin", org: parts[0] };
  }

  const [a, b, ...restParts] = parts;
  if (
    isSafeSlug(a) &&
    isSafeSlug(b) &&
    !RESERVED_ROOT.has(a) &&
    a !== "index.html"
  ) {
    const rest = restParts.join("/");
    return { kind: "tour", org: a, tour: b, rest };
  }

  return { kind: "static", rel: parts.join("/") };
}

/**
 * Tour-isolated static resolution.
 * EVERY tour (including Unisimón piloto) resolves from media/{org}/{tour}/…
 * Shared root panoramas/ + campus config.json are deprecated — never leak across tenants.
 * @param {string} org
 * @param {string} tour
 * @param {string} rest
 * @returns {string} filesystem relative path under ROOT
 */
function mapTourRest(org, tour, rest) {
  const r = (rest || "").replace(/^\/+/, "");
  if (!r || r === "index.html") return "index.html";
  if (r === "control-web" || r.startsWith("control-web/")) {
    const sub =
      r === "control-web"
        ? "index.html"
        : r.slice("control-web/".length) || "index.html";
    return path.join("control-web", sub);
  }

  const mediaRoot = path.join("media", org, tour);

  // Panoramas: tenant folder only — never shared root /panoramas/
  if (r === "panoramas" || r.startsWith("panoramas/")) {
    const sub = r === "panoramas" ? "" : r.slice("panoramas/".length);
    return path.join(mediaRoot, "panoramas", sub);
  }

  // Tour-local a11y / static assets under media/{org}/{tour}/assets/
  if (r === "assets" || r.startsWith("assets/")) {
    const sub = r === "assets" ? "" : r.slice("assets/".length);
    return path.join(mediaRoot, "assets", sub);
  }

  // Tour-local JSON (config, graph, biblioteca) — never serve another tenant's campus JSON
  const TENANT_JSON = new Set([
    "config.json",
    "tour-graph.json",
    "biblioteca-scenes.json",
    "tour-branding.json",
    "hotspot-overrides.json",
  ]);
  if (TENANT_JSON.has(r)) {
    return path.join(mediaRoot, r);
  }

  // Already under media/… — serve from repo root (absolute media URLs)
  if (r === "media" || r.startsWith("media/")) return r;

  // Shared motor assets under virtual prefix (css, src, orbe-config.js, …)
  return r;
}

/** Minimal empty tour config when a tour has no media/{org}/{tour}/config.json yet. */
function emptyTourConfigBody(org, tour) {
  return JSON.stringify(
    {
      basePath: `/media/${org}/${tour}/panoramas/`,
      scenes: [],
      zones: {},
      accessibleScenes: {},
      __tenantIsolated: true,
      organization: { slug: org },
      tourSlug: tour,
    },
    null,
    2
  );
}

/**
 * Orbe marketing must NOT live under /{org}/{tour}/.
 * Prefer global /plataforma/login|superadmin and /{org}/org-admin.html.
 * @param {string} org
 * @param {string} tour
 * @param {string} rest
 * @returns {string | null} redirect Location, or null to continue
 */
function tourPlataformaRedirect(org, tour, rest) {
  const r = (rest || "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!r.startsWith("plataforma")) return null;

  // Marketing landing under tenant → Orbe root only
  if (r === "plataforma" || r === "plataforma/index.html") {
    return "/";
  }

  if (r === "plataforma/login.html") return "/plataforma/login.html";
  if (r === "plataforma/superadmin.html") return "/plataforma/superadmin.html";
  if (r === "plataforma/org-admin.html") {
    return `/${org}/org-admin.html`;
  }

  // Other plataforma/*.html under tenant → global /plataforma/...
  if (r.startsWith("plataforma/") && r.endsWith(".html")) {
    return `/${r}`;
  }

  return null;
}

function buildPrettyRedirect(slug, searchParams) {
  const mapped = SLUG_TO_PATH[slug];
  if (!mapped) return null;
  const next = new URLSearchParams(searchParams);
  next.delete("slug");
  const q = next.toString();
  return `/${mapped.org}/${mapped.tour}/${q ? `?${q}` : ""}`;
}

/**
 * Mock accounts for local evaluation (Gestión de Proyectos 2026-2).
 */
const DEV_USERS = [
  {
    email: "superadmin@orbe360.local",
    password: "OrbeSuper2026!",
    token: "demo-token-superadmin",
    user: {
      id: "mock-superadmin",
      name: "Superadministrador Orbe360",
      email: "superadmin@orbe360.local",
      isSuperadmin: true,
    },
  },
  {
    email: "admin@unisimon.local",
    password: "UnisimonAdmin2026!",
    token: "demo-token-orgadmin",
    user: {
      id: "mock-orgadmin",
      name: "Administrador Unisimón",
      email: "admin@unisimon.local",
      isSuperadmin: false,
    },
  },
  {
    email: "admin@unisimon.edu.co",
    password: "UnisimonAdmin2026!",
    token: "demo-token-orgadmin",
    user: {
      id: "mock-orgadmin",
      name: "Administrador Unisimón",
      email: "admin@unisimon.local",
      isSuperadmin: false,
    },
  },
  {
    email: "qa-third@orbe-authz.test",
    password: "QaThirdUser2026!",
    token: "demo-token-qa",
    user: {
      id: "mock-qa",
      name: "Usuario QA Test",
      email: "qa-third@orbe-authz.test",
      isSuperadmin: false,
    },
  },
];

function handleDevApi(apiPath, args = {}) {
  if (apiPath === "auth:login") {
    const email = String(args.email || "").trim().toLowerCase();
    const password = String(args.password || "").trim();
    const match = DEV_USERS.find(
      (u) =>
        (u.email.toLowerCase() === email ||
          (email === "admin" && u.email === "admin@unisimon.local") ||
          (email === "superadmin" && u.email === "superadmin@orbe360.local")) &&
        u.password === password
    );
    if (match) {
      return { ok: true, token: match.token, user: match.user };
    }
    return { ok: false, error: "Credenciales inválidas. Verifica tu correo y contraseña." };
  }

  if (apiPath === "auth:me") {
    const token = String(args.token || "");
    const match = DEV_USERS.find((u) => u.token === token);
    if (match) return match.user;
    if (token.includes("superadmin")) return DEV_USERS[0].user;
    return DEV_USERS[1].user;
  }

  if (apiPath === "auth:logout") {
    return { ok: true };
  }

  if (apiPath === "organizations:listOrganizations") {
    return [
      {
        id: "org-unisimon",
        name: "Universidad Simón Bolívar (Cúcuta)",
        slug: "unisimoncucuta",
        description: "Sede Cúcuta — Campus Anita Consuegra",
        maxTours: 5,
        tourCount: 1,
      },
    ];
  }

  if (apiPath === "organizations:listTours") {
    return [
      {
        id: "tour-unisimon-1",
        organizationId: "org-unisimon",
        orgSlug: "unisimoncucuta",
        slug: "experienciavirtual",
        title: "Campus Cúcuta — Biblioteca Anita Consuegra",
        published: true,
      },
    ];
  }

  if (apiPath === "organizations:getPlatformStats") {
    return { orgCount: 1, tourCount: 1, publishedTourCount: 1, userCount: 2 };
  }

  if (apiPath === "auth:listUsers") {
    return [DEV_USERS[0].user, DEV_USERS[1].user];
  }

  if (apiPath === "tourAdmin:assertTourEditorAccess") {
    const token = String(args.token || "");
    if (token === "demo-token-superadmin" || token.includes("superadmin")) {
      return { ok: false, reason: "superadmin_no_tour_edit" };
    }
    return {
      ok: true,
      tourId: "local-tour-unisimon",
      title: "Campus Cúcuta — Biblioteca Anita Consuegra",
      orgSlug: args.orgSlug || "unisimoncucuta",
      tourSlug: args.tourSlug || "experienciavirtual",
    };
  }

  if (apiPath === "tourAdmin:getAdminSnapshot") {
    return null;
  }

  if (apiPath === "tourAdmin:saveTourSnapshot" || apiPath === "tourAdmin:syncGraphFromAdmin") {
    return {
      ok: true,
      scenesSaved: (args.scenes || []).length || 62,
      connectionsSaved: (args.connections || []).length || 43,
    };
  }

  if (apiPath === "branding:getBrandingForAdmin" || apiPath === "branding:getPublicBranding") {
    return {
      branding: {
        clientName: "Universidad Simón Bolívar",
        clientShortName: "Unisimón Cúcuta",
        primaryColor: "#0a7a45",
        primaryStrong: "#086638",
        accentColor: "#1d9bf0",
        metaTitle: "Recorrido Virtual 360° Unisimón",
        metaDescription: "Campus Virtual Inclusivo PEVCI — Universidad Simón Bolívar Sede Cúcuta",
        logoUrl: "/media/branding/logo-unisimon.png",
        fallbackImageUrl: "/panoramas/biblioteca_01_entrada.jpg",
      },
    };
  }

  return { ok: true };
}

const server = http.createServer((req, res) => {
  try {
    const method = (req.method || "GET").toUpperCase();
    const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
    const pathname = url.pathname;

    // Local Mock API endpoints for zero-config authentication & admin
    if (method === "POST" && (pathname === "/api/mutation" || pathname === "/api/query")) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const result = handleDevApi(parsed.path, parsed.args || {});
          res.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ status: "success", value: result }));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ status: "error", errorMessage: err.message }));
        }
      });
      return;
    }

    // Static file server: no other write verbs.
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD, POST", "Cache-Control": "no-store" });
      res.end("Method Not Allowed");
      return;
    }

    // Hard deny secret / tooling paths before routing (covers encoded tricks).
    {
      let decoded = pathname;
      try {
        decoded = decodeURIComponent(pathname);
      } catch {
        res.writeHead(400).end("Bad request");
        return;
      }
      if (isBlockedSensitive(normalizeRel(decoded))) {
        forbid(res);
        return;
      }
    }

    // Compat: root / index with ?slug= → pretty path
    if (
      (pathname === "/" || pathname === "/index.html") &&
      url.searchParams.has("slug")
    ) {
      const raw = String(url.searchParams.get("slug") || "")
        .trim()
        .toLowerCase();
      if (isSafeSlug(raw)) {
        const loc = buildPrettyRedirect(raw, url.searchParams);
        if (loc) {
          redirect(res, loc);
          return;
        }
      }
    }

    // Bare / with no slug → marketing (not the tour)
    if (pathname === "/" || pathname === "") {
      sendFile(res, path.join(ROOT, "plataforma", "index.html"));
      return;
    }

    // Exactly one public marketing URL: /plataforma(/index.html) → /
    if (
      pathname === "/plataforma" ||
      pathname === "/plataforma/" ||
      pathname === "/plataforma/index.html"
    ) {
      redirect(res, "/");
      return;
    }

    const route = resolveRoute(pathname);
    if (!route) {
      res.writeHead(400).end("Bad request");
      return;
    }

    if (route.kind === "marketing") {
      sendFile(res, path.join(ROOT, "plataforma", "index.html"));
      return;
    }

    if (route.kind === "org-admin") {
      sendFile(res, path.join(ROOT, "plataforma", "org-admin.html"));
      return;
    }

    if (route.kind === "tour") {
      // Legacy tour-scoped org-admin → org-level
      const restNorm = (route.rest || "").replace(/^\/+/, "").replace(/\/+$/, "");
      if (restNorm === "org-admin.html") {
        redirect(res, `/${route.org}/org-admin.html`);
        return;
      }

      const platRedirect = tourPlataformaRedirect(route.org, route.tour, route.rest);
      if (platRedirect) {
        redirect(res, platRedirect);
        return;
      }

      let rel = mapTourRest(route.org, route.tour, route.rest);
      const abs = path.join(ROOT, rel);
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
        rel = path.join(rel, "index.html");
      }
      const finalAbs = path.join(ROOT, rel);
      // Missing config.json → empty isolated stub (never another tenant's campus JSON)
      const restFile = (route.rest || "").replace(/^\/+/, "").replace(/\/+$/, "");
      if (
        restFile === "config.json" &&
        (!fs.existsSync(finalAbs) || !fs.statSync(finalAbs).isFile())
      ) {
        const body = emptyTourConfigBody(route.org, route.tour);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Tour-Isolation": "empty-stub",
        });
        res.end(body);
        return;
      }
      sendFile(res, finalAbs);
      return;
    }

    // Block legacy shared campus panoramas/assets at root (moved under media/{org}/{tour}/)
    if (
      route.kind === "static" &&
      (route.rel === "panoramas" ||
        route.rel.startsWith("panoramas/") ||
        route.rel === "assets" ||
        route.rel.startsWith("assets/"))
    ) {
      const leaf = route.rel.split("/").pop() || "";
      if (leaf === "DEPRECATED.md") {
        sendFile(res, path.join(ROOT, route.rel));
        return;
      }
      const base = route.rel.split("/")[0];
      res.writeHead(410, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      });
      res.end(
        `Gone: shared /${base}/ retired. Use /media/{org}/{tour}/${base}/…`
      );
      return;
    }

    // Static from repo root
    let rel = route.rel;
    let abs = path.join(ROOT, rel);
    if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
      abs = path.join(abs, "index.html");
    }
    sendFile(res, abs);
  } catch (err) {
    console.error("[dev-server]", err);
    res.writeHead(500).end("Server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Orbe360 static server http://${HOST}:${PORT}/`);
  console.log(`  Marketing:  http://${HOST}:${PORT}/`);
  console.log(
    `  Unisimón:   http://${HOST}:${PORT}/unisimoncucuta/experienciavirtual/`
  );
  console.log(
    `  Org-admin:  http://${HOST}:${PORT}/unisimoncucuta/org-admin.html`
  );
  console.log(
    `  Control:    http://${HOST}:${PORT}/unisimoncucuta/experienciavirtual/control-web/`
  );
  console.log(`  Sandbox:    http://${HOST}:${PORT}/orbe/sandbox/`);
  console.log(
    `  Sandbox CW: http://${HOST}:${PORT}/orbe/sandbox/control-web/`
  );
});
