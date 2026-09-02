import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Public / API shape shared by graph + branding modules. */
export const brandingPublicValidator = v.object({
  clientName: v.string(),
  clientShortName: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  primaryColor: v.string(),
  primaryStrong: v.optional(v.string()),
  accentColor: v.optional(v.string()),
  metaTitle: v.string(),
  metaDescription: v.string(),
  showPoweredByOrbe360: v.boolean(),
  fallbackImageUrl: v.optional(v.string()),
  headerTitle: v.optional(v.string()),
});

export type BrandingPublic = {
  clientName: string;
  clientShortName?: string;
  logoUrl?: string;
  primaryColor: string;
  primaryStrong?: string;
  accentColor?: string;
  metaTitle: string;
  metaDescription: string;
  showPoweredByOrbe360: boolean;
  fallbackImageUrl?: string;
  headerTitle?: string;
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function assertCssHex(value: string, field: string): string {
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) {
    throw new Error(`${field} debe ser color CSS hex (#RGB o #RRGGBB)`);
  }
  return trimmed.toLowerCase();
}

export function toBrandingPublic(doc: Doc<"tourBrandings">): BrandingPublic {
  return {
    clientName: doc.clientName,
    clientShortName: doc.clientShortName,
    logoUrl: doc.logoUrl,
    primaryColor: doc.primaryColor,
    primaryStrong: doc.primaryStrong,
    accentColor: doc.accentColor,
    metaTitle: doc.metaTitle,
    metaDescription: doc.metaDescription,
    showPoweredByOrbe360: doc.showPoweredByOrbe360,
    fallbackImageUrl: doc.fallbackImageUrl,
    headerTitle: doc.headerTitle,
  };
}

/**
 * Seed DATA for the Unisimón piloto org only — not viewer engine defaults.
 * New companies get their own row via org-admin / defaultBrandingForTour.
 */
export const UNISIMON_BRANDING_SEED: BrandingPublic = {
  clientName: "Universidad Simón Bolívar — Cúcuta",
  clientShortName: "Unisimón",
  primaryColor: "#0a7a45",
  primaryStrong: "#086638",
  accentColor: "#1d9bf0",
  metaTitle: "PEVCI — Tour 360° Unisimón Cúcuta",
  metaDescription:
    "Recorrido virtual accesible 360° del campus Unisimón Cúcuta (piloto Biblioteca Anita Bolívar de Consuegra).",
  showPoweredByOrbe360: true,
  fallbackImageUrl: "/media/unisimoncucuta/experienciavirtual/panoramas/R0010060_202503281449_YP00145909.JPG",
  headerTitle: "Campus Unisimón",
};

/** Orbe platform accents — must never be written into client TourBranding by mistake. */
const ORBE_PLATFORM_PRIMARY_COLORS = new Set([
  "#0284c7",
  "#0369a1",
  "#38bdf8",
  "#009b3a",
  "#007a2e",
]);

/**
 * True when TourBranding primary looks like Orbe chrome leaked into client data.
 */
export function brandingLooksLikeOrbePlatform(
  branding: { primaryColor?: string } | null | undefined
): boolean {
  if (!branding?.primaryColor) return false;
  return ORBE_PLATFORM_PRIMARY_COLORS.has(branding.primaryColor.trim().toLowerCase());
}

/**
 * Neutral gray/ink defaults for new tours (until org-admin customizes).
 * Not Orbe sky, not any single-client institutional palette.
 */
export function defaultBrandingForTour(title: string): BrandingPublic {
  return {
    clientName: title,
    clientShortName: title.slice(0, 40),
    primaryColor: "#4b5563",
    primaryStrong: "#1f2937",
    accentColor: "#64748b",
    metaTitle: title,
    metaDescription: `Tour virtual 360° — ${title}`,
    showPoweredByOrbe360: true,
    headerTitle: title,
  };
}

/**
 * Soft Clay identity for first-party Orbe editor workspace (org slug `orbe`, tour slug `sandbox`).
 * Visible labels avoid obra vocabulary (doc 60). Never seed this into client orgs (Unisimón, etc.).
 */
export const ORBE_SANDBOX_BRANDING: BrandingPublic = {
  clientName: "Orbe360",
  clientShortName: "Orbe",
  primaryColor: "#0284c7",
  primaryStrong: "#0369a1",
  accentColor: "#38bdf8",
  metaTitle: "Orbe360 — Espacio de pruebas",
  metaDescription:
    "Espacio de pruebas first-party para el editor: iconos, categorías y animación de hotspots.",
  showPoweredByOrbe360: true,
  headerTitle: "Espacio de pruebas Orbe",
  fallbackImageUrl: "/media/orbe/sandbox/panoramas/R0010060_202503281449_YP00145909.JPG",
};

/**
 * Public payload: drop Orbe platform accents so client viewers never paint
 * SaaS chrome as institutional identity. First-party org `orbe` may keep Soft Clay.
 */
export function sanitizePublicBranding(
  branding: BrandingPublic | null | undefined,
  options?: { allowOrbePlatformChrome?: boolean }
): BrandingPublic | undefined {
  if (!branding) return undefined;
  if (
    !options?.allowOrbePlatformChrome &&
    brandingLooksLikeOrbePlatform(branding)
  ) {
    return undefined;
  }
  return branding;
}

export async function getBrandingByTourId(
  ctx: QueryCtx | MutationCtx,
  tourId: Id<"tours">
): Promise<Doc<"tourBrandings"> | null> {
  return await ctx.db
    .query("tourBrandings")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .unique();
}

export async function upsertBrandingDoc(
  ctx: MutationCtx,
  args: {
    tourId: Id<"tours">;
    organizationId: Id<"organizations">;
    branding: BrandingPublic;
  }
): Promise<Id<"tourBrandings">> {
  const now = Date.now();
  const existing = await getBrandingByTourId(ctx, args.tourId);
  const fields = {
    organizationId: args.organizationId,
    clientName: args.branding.clientName.trim(),
    clientShortName: args.branding.clientShortName?.trim() || undefined,
    logoUrl: args.branding.logoUrl?.trim() || undefined,
    primaryColor: assertCssHex(args.branding.primaryColor, "primaryColor"),
    primaryStrong: args.branding.primaryStrong
      ? assertCssHex(args.branding.primaryStrong, "primaryStrong")
      : undefined,
    accentColor: args.branding.accentColor
      ? assertCssHex(args.branding.accentColor, "accentColor")
      : undefined,
    metaTitle: args.branding.metaTitle.trim(),
    metaDescription: args.branding.metaDescription.trim(),
    showPoweredByOrbe360: args.branding.showPoweredByOrbe360,
    fallbackImageUrl: args.branding.fallbackImageUrl?.trim() || undefined,
    headerTitle: args.branding.headerTitle?.trim() || undefined,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, fields);
    return existing._id;
  }

  return await ctx.db.insert("tourBrandings", {
    tourId: args.tourId,
    ...fields,
    createdAt: now,
  });
}
