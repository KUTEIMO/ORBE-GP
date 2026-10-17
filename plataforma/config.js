/**
 * Same contract as /orbe-config.js — plataforma may load this alone.
 * Defaults: unisimoncucuta / experienciavirtual (P0 public path slugs).
 */
(function applyOrbeConfig() {
  const fromStorage =
    typeof localStorage !== "undefined"
      ? localStorage.getItem("orbe360.convexUrl")
      : null;

  window.__CONVEX_URL__ =
    window.__CONVEX_URL__ || fromStorage || "";

  window.__ORBE_ORG_SLUG__ = window.__ORBE_ORG_SLUG__ || "unisimoncucuta";
  window.__ORBE_TOUR_SLUG__ = window.__ORBE_TOUR_SLUG__ || "experienciavirtual";
})();
