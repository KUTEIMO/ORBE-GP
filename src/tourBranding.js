/**
 * Apply TourBranding to the public viewer shell.
 * Platform Orbe360 identity stays in plataforma/; client identity is 100% data
 * (Convex tourBrandings + optional generic offline JSON).
 */

/**
 * @typedef {object} TourBranding
 * @property {string} clientName
 * @property {string} [clientShortName]
 * @property {string} [logoUrl]
 * @property {string} primaryColor
 * @property {string} [primaryStrong]
 * @property {string} [accentColor]
 * @property {string} metaTitle
 * @property {string} metaDescription
 * @property {boolean} showPoweredByOrbe360
 * @property {string} [fallbackImageUrl]
 * @property {string} [headerTitle]
 */

/** Orbe platform accents — never paint a client tour as Orbe chrome. */
export const ORBE_PLATFORM_PRIMARY_COLORS = new Set([
  "#0284c7",
  "#0369a1",
  "#38bdf8",
  "#009b3a",
  "#007a2e",
]);

/**
 * Neutral gray/ink until Convex (or offline JSON) supplies client identity.
 * Not Orbe sky, not any single-client institutional color.
 * @type {TourBranding}
 */
export const NEUTRAL_BRANDING_FALLBACK = {
  clientName: "Tour virtual",
  clientShortName: "Tour",
  primaryColor: "#4b5563",
  primaryStrong: "#1f2937",
  accentColor: "#64748b",
  metaTitle: "Tour virtual 360°",
  metaDescription: "Recorrido virtual 360° accesible. Identidad del cliente vía TourBranding.",
  showPoweredByOrbe360: true,
  headerTitle: "Tour virtual",
};

/**
 * @param {{ primaryColor?: string } | null | undefined} branding
 */
export function brandingLooksLikeOrbePlatform(branding) {
  if (!branding?.primaryColor) return false;
  return ORBE_PLATFORM_PRIMARY_COLORS.has(
    String(branding.primaryColor).trim().toLowerCase()
  );
}

/**
 * Public tour viewer path: /{org}/{tour}/… (not marketing, plataforma, ops).
 * @param {string} [pathname]
 */
export function isPublicTourViewerPath(pathname = location.pathname) {
  const p = String(pathname || "");
  if (p === "/" || p === "") return false;
  if (/\/plataforma\//i.test(p)) return false;
  if (/\/control-web/i.test(p)) return false;
  if (/login\.html|org-admin\.html|superadmin\.html/i.test(p)) return false;
  // Canonical multi-tenant: /{orgSlug}/{tourSlug}/…
  if (/^\/[^/]+\/[^/]+(\/|$)/i.test(p)) return true;
  // Local root viewer (dev index.html served for a tour path)
  if (/\/index\.html$/i.test(p)) return true;
  return false;
}

/**
 * Refuse Orbe platform accents as client primary for any tour.
 * Missing / invalid → neutral (never invent a specific client's palette).
 * @param {TourBranding | null | undefined} branding
 * @param {string | null | undefined} [_tourSlug]
 * @returns {TourBranding | null | undefined}
 */
export function resolveClientBranding(branding, _tourSlug) {
  if (!branding || typeof branding !== "object") {
    return { ...NEUTRAL_BRANDING_FALLBACK };
  }
  if (brandingLooksLikeOrbePlatform(branding)) {
    return {
      ...NEUTRAL_BRANDING_FALLBACK,
      clientName: branding.clientName || NEUTRAL_BRANDING_FALLBACK.clientName,
      clientShortName:
        branding.clientShortName || NEUTRAL_BRANDING_FALLBACK.clientShortName,
      metaTitle: branding.metaTitle || NEUTRAL_BRANDING_FALLBACK.metaTitle,
      metaDescription:
        branding.metaDescription || NEUTRAL_BRANDING_FALLBACK.metaDescription,
      headerTitle: branding.headerTitle || NEUTRAL_BRANDING_FALLBACK.headerTitle,
      showPoweredByOrbe360:
        branding.showPoweredByOrbe360 !== false,
      logoUrl: branding.logoUrl,
      fallbackImageUrl: branding.fallbackImageUrl,
    };
  }
  if (!branding.primaryColor) {
    return {
      ...NEUTRAL_BRANDING_FALLBACK,
      ...branding,
      primaryColor: NEUTRAL_BRANDING_FALLBACK.primaryColor,
    };
  }
  return branding;
}

function parseHexRgb(hex) {
  const raw = String(hex || "").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return { r: 75, g: 85, b: 99 };
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 75, g: 85, b: 99 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Reject javascript:/data:text/html and other unsafe URLs from logo / fallback media.
 * @param {unknown} raw
 * @returns {string | null}
 */
export function sanitizeSafeAssetUrl(raw) {
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  if (/^(javascript|vbscript):/i.test(s) || /^data:text\//i.test(s)) return null;
  if (s.startsWith("//")) return null;
  if (s.startsWith("/")) return s;
  try {
    const parsed = new URL(s);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

function relativeLuminance(hex) {
  const { r, g, b } = parseHexRgb(hex);
  const toLin = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/**
 * WCAG 2.1 contrast ratio between two hex colors (1 .. 21).
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
export function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const bright = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (bright + 0.05) / (dark + 0.05);
}

/**
 * WCAG 2.1 relative luminance -> pick dark or light ink with >= 4.5:1 contrast.
 * @param {string} hex
 * @returns {string}
 */
export function contrastInkForHex(hex) {
  const lum = relativeLuminance(hex);
  // Exact WCAG crossover where #09110d has higher contrast than #ffffff is ~0.179.
  return lum > 0.179 ? "#09110d" : "#ffffff";
}

function ensureMetaDescription(content) {
  let el = document.querySelector('meta[name="description"]');
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", "description");
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Synchronous early paint for any public tour path — gray/ink until Convex.
 * Safe no-op on marketing `/` and plataforma.
 */
export function bootNeutralBrandingIfNeeded() {
  if (typeof document === "undefined") return;
  if (!isPublicTourViewerPath(location.pathname)) return;
  applyTourBranding(NEUTRAL_BRANDING_FALLBACK);
  document.documentElement.dataset.tourBrandBoot = "neutral";
}

/** @deprecated Use bootNeutralBrandingIfNeeded */
export function bootPilotBrandingIfNeeded() {
  bootNeutralBrandingIfNeeded();
}

/**
 * @param {TourBranding | null | undefined} branding
 * @param {{ tourSlug?: string | null }} [opts]
 */
export function applyTourBranding(branding, opts = {}) {
  const resolved = resolveClientBranding(branding, opts.tourSlug);
  if (!resolved || typeof resolved !== "object") return;

  const root = document.documentElement;
  const primary = resolved.primaryColor || NEUTRAL_BRANDING_FALLBACK.primaryColor;
  const strong = resolved.primaryStrong || primary;
  const accent = resolved.accentColor || NEUTRAL_BRANDING_FALLBACK.accentColor;

  root.style.setProperty("--brand", primary);
  root.style.setProperty("--brand-strong", strong);
  root.style.setProperty("--brand-ink", contrastInkForHex(primary));
  root.style.setProperty("--brand-strong-ink", contrastInkForHex(strong));
  root.style.setProperty("--hotspot-ink", "#ffffff");
  root.style.setProperty("--hotspot-icon-ink", contrastInkForHex(primary));
  root.style.setProperty("--brand-soft", hexToRgba(primary, 0.88));
  root.style.setProperty("--brand-ghost", hexToRgba(primary, 0.22));
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-soft", hexToRgba(accent, 0.9));
  root.style.setProperty("--emerald", primary);
  root.style.setProperty("--emerald-80", hexToRgba(primary, 0.88));
  root.style.setProperty("--emerald-30", hexToRgba(primary, 0.22));
  root.style.setProperty("--hotspot-accent", primary);

  document.body.style.background = [
    `radial-gradient(1200px 600px at 10% -10%, ${hexToRgba(primary, 0.22)}, transparent 55%)`,
    `radial-gradient(900px 500px at 90% 0%, ${hexToRgba(accent, 0.12)}, transparent 50%)`,
    "#050807",
  ].join(",");

  if (resolved.metaTitle) {
    document.title = resolved.metaTitle;
  }
  if (resolved.metaDescription) {
    ensureMetaDescription(resolved.metaDescription);
  }

  const safeLogoUrl = sanitizeSafeAssetUrl(resolved.logoUrl);
  const safeFallbackImgUrl = sanitizeSafeAssetUrl(resolved.fallbackImageUrl);

  const clientBrand = document.getElementById("tourClientBrand");
  if (clientBrand) {
    clientBrand.replaceChildren();
    if (safeLogoUrl) {
      const img = document.createElement("img");
      img.src = safeLogoUrl;
      img.alt = resolved.clientShortName || resolved.clientName || "Logo del tour";
      img.className = "tour-client-brand__logo";
      clientBrand.appendChild(img);
    }
    const nameText =
      resolved.clientShortName ||
      resolved.headerTitle ||
      resolved.clientName ||
      "";
    if (nameText) {
      const label = document.createElement("span");
      label.className = "tour-client-brand__name";
      label.textContent = nameText;
      clientBrand.appendChild(label);
    }
    const hasClient = Boolean(nameText || safeLogoUrl);
    clientBrand.hidden = !hasClient;
    clientBrand.removeAttribute("hidden");
    if (!hasClient) clientBrand.setAttribute("hidden", "");
    clientBrand.setAttribute(
      "title",
      resolved.clientName || resolved.clientShortName || "Cliente del tour"
    );
  }

  const powered = document.getElementById("poweredByOrbe");
  if (powered) {
    const show = resolved.showPoweredByOrbe360 !== false;
    powered.hidden = !show;
    if (show) powered.removeAttribute("hidden");
    else powered.setAttribute("hidden", "");
    powered.setAttribute("aria-hidden", show ? "false" : "true");
  }

  // Product chrome stays subtle — never compete with client name.
  const platformLink = document.getElementById("platformLink");
  if (platformLink) {
    platformLink.classList.add("action-button--powered-subtle");
    platformLink.setAttribute("title", "Powered by Orbe360");
  }

  if (safeFallbackImgUrl) {
    const liveFallback = document.querySelector("#noJsMessage img");
    if (liveFallback instanceof HTMLImageElement) {
      liveFallback.src = safeFallbackImgUrl;
    }
  }

  document.documentElement.dataset.tourBrand = "applied";
  document.documentElement.dataset.tourBrandPrimary = primary.toLowerCase();
}
