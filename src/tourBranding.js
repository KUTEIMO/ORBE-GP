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

function hexToRgba(hex, alpha) {
  const raw = String(hex || "").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  if (full.length !== 6) return `rgba(75, 85, 99, ${alpha})`;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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

  const clientBrand = document.getElementById("tourClientBrand");
  if (clientBrand) {
    clientBrand.replaceChildren();
    if (resolved.logoUrl) {
      const img = document.createElement("img");
      img.src = resolved.logoUrl;
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
    const hasClient = Boolean(nameText || resolved.logoUrl);
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

  if (resolved.fallbackImageUrl) {
    const liveFallback = document.querySelector("#noJsMessage img");
    if (liveFallback instanceof HTMLImageElement) {
      liveFallback.src = resolved.fallbackImageUrl;
    }
  }

  document.documentElement.dataset.tourBrand = "applied";
  document.documentElement.dataset.tourBrandPrimary = primary.toLowerCase();
}
