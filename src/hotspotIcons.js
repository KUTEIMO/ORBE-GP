/**
 * Inline SVG catalog for Orbe360 hotspots (no icon-library dependency).
 * Keys are stable `iconKey` values stored on hotspots; missing key → type fallback.
 */

const SVG_ATTRS =
  'class="hotspot__svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"';

/** Directional “go” mark — chevron in circle (scene / nav). */
const NAV_GO_SVG = `
<svg ${SVG_ATTRS}>
  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/>
  <path fill="currentColor" d="M10.2 7.4a1 1 0 0 1 1.4-.15l4.2 3.6a1 1 0 0 1 0 1.5l-4.2 3.6a1 1 0 1 1-1.25-1.55L13.4 12l-3.05-2.6a1 1 0 0 1-.15-1.4z"/>
</svg>`.trim();

/** Info — ring + “i” stem. */
const INFO_SVG = `
<svg ${SVG_ATTRS}>
  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.75"/>
  <circle cx="12" cy="8" r="1.35" fill="currentColor"/>
  <path fill="currentColor" d="M11.1 11.2h1.8v6.1h-1.8z"/>
</svg>`.trim();

const PIN_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/>
</svg>`.trim();

const BATH_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M7 4.5A1.5 1.5 0 0 1 8.5 3h1A1.5 1.5 0 0 1 11 4.5V8h7.5a.5.5 0 0 1 .5.5V10H5V8.5A.5.5 0 0 1 5.5 8H7V4.5zM5 11h14v2.2c0 2.4-1.6 4.5-3.9 5.2l.4 1.6h-1.6l-.3-1.2H9.4l-.3 1.2H7.5l.4-1.6C5.6 17.7 4 15.6 4 13.2V11h1z"/>
</svg>`.trim();

const MEDICAL_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M9 3h6v4h4v6h-4v4H9v-4H5V7h4V3zm2 2v4H7v2h4v4h2v-4h4v-2h-4V5h-2z"/>
</svg>`.trim();

const TRANSPORT_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M6 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-1l1 2v1h-2l-1-2H9l-1 2H6v-1l1-2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm0 2v5h12V6H6zm2.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
</svg>`.trim();

const DRONE_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M4 7.5 7.5 4 10 6.5 8.5 8 11 10.5 13 8.5l-1.5-1.5L14 4.5 17.5 8 15 10.5l1.5 1.5L14 14.5 16.5 17 13 20.5 10.5 18l-1.5 1.5L6 16.5 8.5 14 6.5 12 4 14.5 0.5 11 3 8.5 4 7.5zm8 2.2 1.3 1.3-1.3 1.3-1.3-1.3 1.3-1.3z"/>
</svg>`.trim();

const EXPO_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M4 19h16v2H4v-2zm2-2V9l6-5 6 5v8H6zm2-1h8v-6.2l-4-3.3-4 3.3V16z"/>
</svg>`.trim();

const WARDROBE_SVG = `
<svg ${SVG_ATTRS}>
  <path fill="currentColor" d="M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v14h4.5V5H7zm5.5 0v14H17V5h-4.5zM9 11.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm6 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
</svg>`.trim();

/** @typedef {'nav'|'info'|'pin'|'bath'|'medical'|'transport'|'drone'|'expo'|'wardrobe'} HotspotIconKey */

/** @type {Record<HotspotIconKey, { label: string, svg: string }>} */
export const HOTSPOT_ICON_CATALOG = {
  nav: { label: 'Navegación', svg: NAV_GO_SVG },
  info: { label: 'Información', svg: INFO_SVG },
  pin: { label: 'Pin / lugar', svg: PIN_SVG },
  bath: { label: 'Baños', svg: BATH_SVG },
  medical: { label: 'Salud / primeros auxilios', svg: MEDICAL_SVG },
  transport: { label: 'Transporte', svg: TRANSPORT_SVG },
  drone: { label: 'Vista / drone', svg: DRONE_SVG },
  expo: { label: 'Expo / stand', svg: EXPO_SVG },
  wardrobe: { label: 'Guardarropa', svg: WARDROBE_SVG },
};

/**
 * Categories for chips / future HUD filters.
 * @type {Record<string, { label: string, color: string }>}
 */
export const HOTSPOT_CATEGORIES = {
  general: { label: 'General', color: '#64748b' },
  facilities: { label: 'Servicios', color: '#0284c7' },
  medical: { label: 'Salud', color: '#dc2626' },
  transport: { label: 'Transporte', color: '#ca8a04' },
  expo: { label: 'Expo', color: '#7c3aed' },
  navigation: { label: 'Navegación', color: '#059669' },
};

/** @type {readonly string[]} */
export const ANIMATION_PRESETS = Object.freeze(['none', 'pulse']);

/**
 * @param {'nav' | 'info'} type
 * @param {string} [iconKey]
 * @returns {string} HTML for icon inner content
 */
export function hotspotIconHtml(type, iconKey) {
  if (iconKey && HOTSPOT_ICON_CATALOG[iconKey]) {
    return HOTSPOT_ICON_CATALOG[iconKey].svg;
  }
  if (type === 'nav') return NAV_GO_SVG;
  return INFO_SVG;
}

/**
 * @param {string} [category]
 * @returns {{ label: string, color: string } | null}
 */
export function hotspotCategoryMeta(category) {
  if (!category) return null;
  return HOTSPOT_CATEGORIES[category] || null;
}

export { NAV_GO_SVG, INFO_SVG };
