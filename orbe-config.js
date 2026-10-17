/**
 * Runtime config (portable).
 *
 * Precedence for Convex URL:
 * 1. window.__CONVEX_URL__ set by a prior inject
 * 2. localStorage `orbe360.convexUrl`
 * 3. Local defaults below
 *
 * Precedence for tour context (P0 multi-tenant URL):
 * 1. Path /{orgSlug}/{tourSlug}/…
 * 2. URL query ?slug= (compat; server may redirect known slugs)
 * 3. window.__ORBE_TOUR_SLUG__ / __ORBE_ORG_SLUG__ inject
 * 4. Local piloto defaults: unisimoncucuta / experienciavirtual
 */
(function applyOrbeConfig() {
  const fromStorage =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("orbe360.convexUrl")
      : null;

  window.__CONVEX_URL__ =
    window.__CONVEX_URL__ || fromStorage || "";

  const DEFAULT_ORG = "unisimoncucuta";
  const DEFAULT_TOUR = "experienciavirtual";
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const TOUR_ALIASES = { "unisimon-campus": DEFAULT_TOUR };
  const ORG_ALIASES = { "unisimon-cucuta": DEFAULT_ORG };
  const RESERVED = {
    plataforma: 1,
    "control-web": 1,
    src: 1,
    css: 1,
    assets: 1,
    media: 1,
    panoramas: 1,
    vendors: 1,
    tests: 1,
    docs: 1,
    scripts: 1,
    reports: 1,
    node_modules: 1,
    convex: 1,
  };

  function canonTour(s) {
    if (!s || !SLUG_RE.test(s)) return null;
    return TOUR_ALIASES[s] || s;
  }
  function canonOrg(s) {
    if (!s || !SLUG_RE.test(s)) return null;
    return ORG_ALIASES[s] || s;
  }

  function fromPath() {
    try {
      if (typeof location === "undefined" || !location.pathname) return null;
      const parts = location.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return null;
      const a = parts[0].toLowerCase();
      const b = parts[1].toLowerCase();
      if (RESERVED[a] || !SLUG_RE.test(a) || !SLUG_RE.test(b)) return null;
      return { org: canonOrg(a) || a, tour: canonTour(b) || b };
    } catch (_e) {
      return null;
    }
  }

  function slugFromQuery() {
    try {
      if (typeof location === "undefined" || !location.search) return null;
      const raw = new URLSearchParams(location.search).get("slug");
      if (!raw || typeof raw !== "string") return null;
      const s = raw.trim().toLowerCase();
      return canonTour(s);
    } catch (_e) {
      return null;
    }
  }

  const pathCtx = fromPath();
  const fromUrl = slugFromQuery();
  const fromInjectTour =
    typeof window.__ORBE_TOUR_SLUG__ === "string"
      ? canonTour(window.__ORBE_TOUR_SLUG__.trim().toLowerCase())
      : null;
  const fromInjectOrg =
    typeof window.__ORBE_ORG_SLUG__ === "string"
      ? canonOrg(window.__ORBE_ORG_SLUG__.trim().toLowerCase())
      : null;

  window.__ORBE_TOUR_SLUG__ =
    (pathCtx && pathCtx.tour) || fromUrl || fromInjectTour || DEFAULT_TOUR;
  window.__ORBE_ORG_SLUG__ =
    (pathCtx && pathCtx.org) || fromInjectOrg || DEFAULT_ORG;
})();
