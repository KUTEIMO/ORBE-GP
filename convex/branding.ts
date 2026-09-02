import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, userCanEditTour } from "./lib/authHelpers";
import {
  brandingPublicValidator,
  brandingLooksLikeOrbePlatform,
  defaultBrandingForTour,
  getBrandingByTourId,
  sanitizePublicBranding,
  toBrandingPublic,
  upsertBrandingDoc,
  type BrandingPublic,
} from "./lib/branding";
import { findTourByOrgAndSlug, canonicalizeOrgSlug } from "./lib/tourResolve";

/**
 * Guard: refuse saving Orbe platform accents as client TourBranding.
 * First-party org slug `orbe` may use Soft Clay sky.
 */
function assertNotOrbePlatformChrome(
  branding: BrandingPublic,
  orgSlug: string
): void {
  if (orgSlug === "orbe") return;
  if (brandingLooksLikeOrbePlatform(branding)) {
    throw new Error(
      "TourBranding no puede usar colores de plataforma Orbe (#0284c7 / legacy #009b3a). Elige el color institucional del cliente."
    );
  }
}

/**
 * Public branding for a published tour (or null if unpublished / missing / Orbe leak).
 */
export const getPublicBranding = query({
  args: {
    slug: v.optional(v.string()),
    tourSlug: v.optional(v.string()),
    orgSlug: v.optional(v.string()),
  },
  returns: v.union(v.null(), brandingPublicValidator),
  handler: async (ctx, args) => {
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: args.orgSlug,
      tourSlug: args.tourSlug || args.slug,
      slug: args.slug,
    });
    if (!tour || !tour.published) return null;
    const org = await ctx.db.get(tour.organizationId);
    const doc = await getBrandingByTourId(ctx, tour._id);
    const raw = doc ? toBrandingPublic(doc) : null;
    return (
      sanitizePublicBranding(raw ?? undefined, {
        allowOrbePlatformChrome: org?.slug === "orbe",
      }) ?? null
    );
  },
});

/**
 * Admin read — any tour editor (includes unpublished).
 */
export const getBrandingForAdmin = query({
  args: {
    token: v.string(),
    slug: v.string(),
    /** Required — no global slug lookup for admin branding. */
    orgSlug: v.string(),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      tourId: v.id("tours"),
      organizationId: v.id("organizations"),
      branding: brandingPublicValidator,
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token, args.now);
    const want = canonicalizeOrgSlug(args.orgSlug);
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: want,
      tourSlug: args.slug,
      slug: args.slug,
    });
    if (!tour) return null;
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado para ver branding de este tour");
    }
    const org = await ctx.db.get(tour.organizationId);
    if (!org || canonicalizeOrgSlug(org.slug) !== want) {
      throw new Error("Tour no pertenece a la organización solicitada");
    }
    const doc = await getBrandingByTourId(ctx, tour._id);
    if (!doc) {
      return {
        tourId: tour._id,
        organizationId: tour.organizationId,
        branding: defaultBrandingForTour(tour.title),
      };
    }
    return {
      tourId: tour._id,
      organizationId: tour.organizationId,
      branding: toBrandingPublic(doc),
    };
  },
});

export const saveBranding = mutation({
  args: {
    token: v.string(),
    slug: v.string(),
    /** Required — multi-tenant isolation. */
    orgSlug: v.string(),
    branding: brandingPublicValidator,
  },
  returns: v.id("tourBrandings"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const want = canonicalizeOrgSlug(args.orgSlug);
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: want,
      tourSlug: args.slug,
      slug: args.slug,
    });
    if (!tour) throw new Error("Tour no encontrado");
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado para editar branding de este tour");
    }

    const branding: BrandingPublic = args.branding;
    if (!branding.clientName.trim()) throw new Error("clientName requerido");
    if (!branding.metaTitle.trim()) throw new Error("metaTitle requerido");
    if (!branding.metaDescription.trim()) {
      throw new Error("metaDescription requerido");
    }
    const org = await ctx.db.get(tour.organizationId);
    if (!org || canonicalizeOrgSlug(org.slug) !== want) {
      throw new Error("Tour no pertenece a la organización solicitada");
    }
    assertNotOrbePlatformChrome(branding, org.slug);

    return await upsertBrandingDoc(ctx, {
      tourId: tour._id,
      organizationId: tour.organizationId,
      branding,
    });
  },
});
