import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** Canonical piloto public slugs (URL = DB after P0 migration). */
export const PILOT_ORG_SLUG = "unisimoncucuta";
export const PILOT_TOUR_SLUG = "experienciavirtual";

/** Legacy seed / query aliases — resolve only; do not create new docs with these. */
export const LEGACY_ORG_SLUG = "unisimon-cucuta";
export const LEGACY_TOUR_SLUG = "unisimon-campus";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isUrlSafeSlug(slug: string): boolean {
  return SLUG_RE.test(slug.trim().toLowerCase());
}

export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/** Tour slug aliases → canonical DB slug */
export function canonicalizeTourSlug(slug: string): string {
  const s = normalizeSlug(slug);
  if (s === LEGACY_TOUR_SLUG) return PILOT_TOUR_SLUG;
  return s;
}

export function canonicalizeOrgSlug(slug: string): string {
  const s = normalizeSlug(slug);
  if (s === LEGACY_ORG_SLUG) return PILOT_ORG_SLUG;
  return s;
}

type DbCtx = QueryCtx | MutationCtx;

/**
 * Find organization by canonical or legacy slug.
 * Candidates = input + canonicalize(input) only.
 * Legacy alias `unisimon-cucuta` maps to piloto via canonicalize — never
 * silently append piloto when searching an unrelated / missing slug.
 */
export async function findOrganizationBySlug(
  ctx: DbCtx,
  orgSlug: string
): Promise<Doc<"organizations"> | null> {
  const normalized = normalizeSlug(orgSlug);
  const canonical = canonicalizeOrgSlug(orgSlug);
  const candidates = Array.from(new Set([canonical, normalized]));
  for (const slug of candidates) {
    const org = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (org) return org;
  }
  return null;
}

/**
 * Find tour by (orgSlug, tourSlug) preferring compound index, with legacy fallbacks.
 * Does not check published — callers gate as needed.
 */
export async function findTourByOrgAndSlug(
  ctx: DbCtx,
  args: { orgSlug?: string; tourSlug?: string; slug?: string }
): Promise<Doc<"tours"> | null> {
  const rawTour = args.tourSlug || args.slug;
  if (!rawTour) return null;
  const tourSlug = canonicalizeTourSlug(rawTour);
  const legacyTour = normalizeSlug(rawTour);

  if (args.orgSlug) {
    const org = await findOrganizationBySlug(ctx, args.orgSlug);
    if (!org) return null;

    for (const slug of Array.from(new Set([tourSlug, legacyTour, LEGACY_TOUR_SLUG]))) {
      const byOrg = await ctx.db
        .query("tours")
        .withIndex("by_org_and_slug", (q) =>
          q.eq("organizationId", org._id).eq("slug", slug)
        )
        .unique();
      if (byOrg) return byOrg;
    }
    return null;
  }

  // Legacy: global by_slug (canonical then legacy)
  for (const slug of Array.from(new Set([tourSlug, legacyTour, LEGACY_TOUR_SLUG]))) {
    const tour = await ctx.db
      .query("tours")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (tour) return tour;
  }
  return null;
}

/**
 * Patch piloto org/tour slugs in place (no delete — preserves graph).
 */
export async function migratePilotSlugsIfNeeded(
  ctx: MutationCtx
): Promise<{
  organizationId: Id<"organizations"> | null;
  tourId: Id<"tours"> | null;
  migrated: boolean;
}> {
  const org =
    (await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", PILOT_ORG_SLUG))
      .unique()) ||
    (await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", LEGACY_ORG_SLUG))
      .unique());

  if (!org) {
    return { organizationId: null, tourId: null, migrated: false };
  }

  let migrated = false;
  if (org.slug !== PILOT_ORG_SLUG) {
    await ctx.db.patch(org._id, { slug: PILOT_ORG_SLUG });
    migrated = true;
  }

  const tour =
    (await ctx.db
      .query("tours")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("organizationId", org._id).eq("slug", PILOT_TOUR_SLUG)
      )
      .unique()) ||
    (await ctx.db
      .query("tours")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("organizationId", org._id).eq("slug", LEGACY_TOUR_SLUG)
      )
      .unique()) ||
    (await ctx.db
      .query("tours")
      .withIndex("by_slug", (q) => q.eq("slug", PILOT_TOUR_SLUG))
      .unique()) ||
    (await ctx.db
      .query("tours")
      .withIndex("by_slug", (q) => q.eq("slug", LEGACY_TOUR_SLUG))
      .unique());

  if (!tour) {
    return { organizationId: org._id, tourId: null, migrated };
  }

  if (tour.slug !== PILOT_TOUR_SLUG) {
    await ctx.db.patch(tour._id, {
      slug: PILOT_TOUR_SLUG,
      updatedAt: Date.now(),
    });
    migrated = true;
  }

  return { organizationId: org._id, tourId: tour._id, migrated };
}
