/**
 * Multi-tenant public routing (P0).
 *
 * Canonical public path: /{orgSlug}/{tourSlug}/
 * Example: /unisimoncucuta/experienciavirtual/?scene=entrada-principal
 *
 * DB slug choice (2026-09-11): migrate piloto to public slugs
 *   organizations.slug = unisimoncucuta
 *   tours.slug         = experienciavirtual
 * Legacy aliases (query + old seed) still resolve:
 *   unisimon-campus → experienciavirtual
 *   unisimon-cucuta → unisimoncucuta
 *
 * Precedence for tour slug:
 * 1. Path /{org}/{tour}/…
 * 2. URL query ?slug= (compat; may redirect at server)
 * 3. Injected window.__ORBE_TOUR_SLUG__
 * 4. Default piloto experienciavirtual
 */

export const DEFAULT_ORG_SLUG = "unisimoncucuta";
export const DEFAULT_TOUR_SLUG = "experienciavirtual";

/** @deprecated use DEFAULT_TOUR_SLUG — kept for older call sites during migration */
export const LEGACY_TOUR_SLUG = "unisimon-campus";
export const LEGACY_ORG_SLUG = "unisimon-cucuta";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** First path segments that are never org slugs. */
const RESERVED_ROOT = new Set([
  "plataforma",
  "control-web",
  "src",
  "css",
  "assets",
  "panoramas",
  "vendors",
  "tests",
  "docs",
  "scripts",
  "reports",
  "node_modules",
  "convex",
]);

/** Legacy / alternate tour slugs → canonical DB tour slug */
export const TOUR_SLUG_ALIASES = {
  "unisimon-campus": DEFAULT_TOUR_SLUG,
  experienciavirtual: DEFAULT_TOUR_SLUG,
};

/** Legacy / alternate org slugs → canonical DB org slug */
export const ORG_SLUG_ALIASES = {
  "unisimon-cucuta": DEFAULT_ORG_SLUG,
  unisimoncucuta: DEFAULT_ORG_SLUG,
};

/**
 * @param {unknown} value
 * @returns {string | null}
 */
export function parseSlugParam(value) {
  if (value == null || typeof value !== "string") return null;
  const s = value.trim().toLowerCase();
  return SLUG_RE.test(s) ? s : null;
}

/**
 * Normalize a tour slug (apply aliases). Unknown slugs pass through if valid.
 * @param {string | null | undefined} slug
 * @returns {string | null}
 */
export function canonicalizeTourSlug(slug) {
  const s = parseSlugParam(slug);
  if (!s) return null;
  return TOUR_SLUG_ALIASES[s] || s;
}

/**
 * @param {string | null | undefined} slug
 * @returns {string | null}
 */
export function canonicalizeOrgSlug(slug) {
  const s = parseSlugParam(slug);
  if (!s) return null;
  return ORG_SLUG_ALIASES[s] || s;
}

/**
 * Parse /{orgSlug}/{tourSlug}/… from a pathname.
 * @param {string} [pathname]
 * @returns {{ orgSlug: string, tourSlug: string, rest: string } | null}
 */
export function parseTourPath(pathname = "") {
  let p = pathname || "";
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  const parts = p.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const [a, b, ...rest] = parts;
  if (!parseSlugParam(a) || !parseSlugParam(b)) return null;
  if (RESERVED_ROOT.has(a)) return null;
  return {
    orgSlug: canonicalizeOrgSlug(a) || a,
    tourSlug: canonicalizeTourSlug(b) || b,
    rest: rest.join("/"),
  };
}

/**
 * @param {{ search?: string, pathname?: string, injected?: string | null, fallback?: string }} [opts]
 * @returns {string}
 */
export function resolveTourSlug(opts = {}) {
  const search = opts.search ?? "";
  const pathname = opts.pathname ?? "";
  const injected = opts.injected ?? null;
  const fallback = opts.fallback ?? DEFAULT_TOUR_SLUG;

  const fromPath = parseTourPath(pathname);
  if (fromPath?.tourSlug) return fromPath.tourSlug;

  let fromUrl = null;
  try {
    const raw = typeof search === "string" ? search : "";
    const params = new URLSearchParams(
      raw.startsWith("?") ? raw.slice(1) : raw
    );
    fromUrl = canonicalizeTourSlug(params.get("slug"));
  } catch {
    fromUrl = null;
  }

  const fromInject = canonicalizeTourSlug(injected);
  return fromUrl || fromInject || fallback;
}

/**
 * @param {{ search?: string, pathname?: string, injectedOrg?: string | null, fallback?: string }} [opts]
 * @returns {string}
 */
export function resolveOrgSlug(opts = {}) {
  const pathname = opts.pathname ?? "";
  const injectedOrg = opts.injectedOrg ?? null;
  const fallback = opts.fallback ?? DEFAULT_ORG_SLUG;

  const fromPath = parseTourPath(pathname);
  if (fromPath?.orgSlug) return fromPath.orgSlug;

  const fromInject = canonicalizeOrgSlug(injectedOrg);
  return fromInject || fallback;
}

/**
 * @typedef {{ orgSlug?: string, tourSlug?: string, slug?: string, scene?: string }} TourHrefOpts
 */

/**
 * Require an explicit org slug — never invent a tenant (no silent Unisimón).
 * @param {unknown} orgSlug
 * @param {string} fnName
 * @returns {string}
 */
function requireOrgSlug(orgSlug, fnName) {
  const org = canonicalizeOrgSlug(orgSlug);
  if (!org) {
    throw new Error(
      `${fnName} requires orgSlug from membership / tour.organizationId (no default tenant)`
    );
  }
  return org;
}

/**
 * Public viewer href under canonical path.
 * orgSlug is required — never falls back to unisimoncucuta.
 * @param {string | TourHrefOpts} slugOrOpts
 * @param {TourHrefOpts} [maybeOpts]
 * @returns {string}
 */
export function publicTourHref(slugOrOpts, maybeOpts = {}) {
  let tourSlug;
  let orgSlug;
  let scene;
  if (typeof slugOrOpts === "string") {
    tourSlug = canonicalizeTourSlug(slugOrOpts) || DEFAULT_TOUR_SLUG;
    orgSlug = requireOrgSlug(maybeOpts.orgSlug, "publicTourHref");
    scene = maybeOpts.scene;
  } else {
    const o = slugOrOpts || {};
    tourSlug =
      canonicalizeTourSlug(o.tourSlug || o.slug) || DEFAULT_TOUR_SLUG;
    orgSlug = requireOrgSlug(o.orgSlug, "publicTourHref");
    scene = o.scene;
  }
  const q = scene ? `?scene=${encodeURIComponent(scene)}` : "";
  return `/${orgSlug}/${tourSlug}/${q}`;
}

/**
 * Control Web under tour prefix. orgSlug required (no default tenant).
 * @param {string | TourHrefOpts} slugOrOpts
 * @param {TourHrefOpts} [maybeOpts]
 * @returns {string}
 */
export function controlWebHref(slugOrOpts, maybeOpts = {}) {
  let tourSlug;
  let orgSlug;
  if (typeof slugOrOpts === "string") {
    tourSlug = canonicalizeTourSlug(slugOrOpts) || DEFAULT_TOUR_SLUG;
    orgSlug = requireOrgSlug(maybeOpts.orgSlug, "controlWebHref");
  } else {
    const o = slugOrOpts || {};
    tourSlug =
      canonicalizeTourSlug(o.tourSlug || o.slug) || DEFAULT_TOUR_SLUG;
    orgSlug = requireOrgSlug(o.orgSlug, "controlWebHref");
  }
  return `/${orgSlug}/${tourSlug}/control-web/`;
}

/**
 * Parse /{orgSlug}/org-admin.html (canonical) or legacy /{org}/{tour}/org-admin.html.
 * @param {string} [pathname]
 * @returns {{ orgSlug: string, tourSlug?: string, legacy?: boolean } | null}
 */
export function parseOrgAdminPath(pathname = "") {
  let p = pathname || "";
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  const parts = p.split("/").filter(Boolean);
  if (
    parts.length === 2 &&
    parseSlugParam(parts[0]) &&
    !RESERVED_ROOT.has(parts[0]) &&
    parts[1] === "org-admin.html"
  ) {
    return {
      orgSlug: canonicalizeOrgSlug(parts[0]) || parts[0],
    };
  }
  const tourPath = parseTourPath(pathname);
  if (tourPath && tourPath.rest === "org-admin.html") {
    return {
      orgSlug: tourPath.orgSlug,
      tourSlug: tourPath.tourSlug,
      legacy: true,
    };
  }
  return null;
}

/**
 * Canonical org-admin under organization prefix (not tour).
 * orgSlug required — never falls back to unisimoncucuta.
 * @param {string | TourHrefOpts} orgSlugOrOpts
 * @param {TourHrefOpts} [maybeOpts]
 * @returns {string}
 */
export function orgAdminHref(orgSlugOrOpts, maybeOpts = {}) {
  let orgSlug;
  if (typeof orgSlugOrOpts === "string") {
    orgSlug = requireOrgSlug(
      orgSlugOrOpts || maybeOpts.orgSlug,
      "orgAdminHref"
    );
  } else {
    const o = orgSlugOrOpts || {};
    orgSlug = requireOrgSlug(o.orgSlug, "orgAdminHref");
  }
  return `/${orgSlug}/org-admin.html`;
}

/**
 * Resolve using current browser location + optional inject on window.
 * @returns {string}
 */
export function resolveTourSlugFromBrowser() {
  const search =
    typeof location !== "undefined" && location.search ? location.search : "";
  const pathname =
    typeof location !== "undefined" && location.pathname
      ? location.pathname
      : "";
  const injected =
    typeof window !== "undefined" && window.__ORBE_TOUR_SLUG__
      ? window.__ORBE_TOUR_SLUG__
      : null;
  return resolveTourSlug({ search, pathname, injected });
}

/**
 * @returns {string}
 */
export function resolveOrgSlugFromBrowser() {
  const pathname =
    typeof location !== "undefined" && location.pathname
      ? location.pathname
      : "";
  const injectedOrg =
    typeof window !== "undefined" && window.__ORBE_ORG_SLUG__
      ? window.__ORBE_ORG_SLUG__
      : null;
  return resolveOrgSlug({ pathname, injectedOrg });
}

/**
 * Apply path context onto window for downstream modules (Control Web, viewer).
 */
export function applyPathContextToWindow() {
  if (typeof window === "undefined" || typeof location === "undefined") return;
  const pathCtx = parseTourPath(location.pathname);
  if (pathCtx) {
    window.__ORBE_ORG_SLUG__ = pathCtx.orgSlug;
    window.__ORBE_TOUR_SLUG__ = pathCtx.tourSlug;
    return;
  }
  const tour = resolveTourSlugFromBrowser();
  const org = resolveOrgSlugFromBrowser();
  window.__ORBE_TOUR_SLUG__ = tour;
  window.__ORBE_ORG_SLUG__ = org;
}
