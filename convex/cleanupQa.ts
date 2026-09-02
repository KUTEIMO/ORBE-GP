import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperadmin } from "./lib/authHelpers";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

const PILOT_TOUR_SLUG = "experienciavirtual";
const PILOT_ORG_SLUG = "unisimoncucuta";
/** Legacy aliases still accepted by find helpers / cleanup filters */
const LEGACY_TOUR_SLUG = "unisimon-campus";
const LEGACY_ORG_SLUG = "unisimon-cucuta";

function isQaTourSlug(slug: string): boolean {
  return /^qa-pub-/i.test(slug) || /^qa-/i.test(slug);
}

function isQaSceneFileKey(fileKey: string): boolean {
  return /^QA_TEST_/i.test(fileKey) || /^qa[-_]/i.test(fileKey);
}

function isQaOrgSlug(slug: string): boolean {
  return (
    /^qa-/i.test(slug) ||
    slug === "hack-org" ||
    /^other-org-/i.test(slug) ||
    /^x-tenant/i.test(slug)
  );
}

async function deleteTourCascade(
  ctx: MutationCtx,
  tourId: Id<"tours">
): Promise<{
  scenes: number;
  hotspots: number;
  connections: number;
  assets: number;
  brandings: number;
}> {
  const hotspots = await ctx.db
    .query("hotspots")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const h of hotspots) await ctx.db.delete(h._id);

  const connections = await ctx.db
    .query("connections")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const c of connections) await ctx.db.delete(c._id);

  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const s of scenes) await ctx.db.delete(s._id);

  const assets = await ctx.db
    .query("assets")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const a of assets) await ctx.db.delete(a._id);

  const brandings = await ctx.db
    .query("tourBrandings")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const b of brandings) await ctx.db.delete(b._id);

  await ctx.db.delete(tourId);

  return {
    scenes: scenes.length,
    hotspots: hotspots.length,
    connections: connections.length,
    assets: assets.length,
    brandings: brandings.length,
  };
}

/**
 * Purge disposable QA artifacts without touching Unisimón campus content.
 *
 * Removes:
 * - Tours with slug `qa-pub-*` / `qa-*`
 * - QA_TEST_* scenes (and their hotspots) left on the piloto tour by qa-orbe
 * - Disposable orgs created by cross-tenant QA (`hack-org`, etc.) if empty of real tours
 *
 * Run (superadmin session):
 *   npx convex run seed:cleanupQaArtifacts '{"token":"<session>"}'
 * Or after login in Convex dashboard with a one-off script.
 */
export const cleanupQaArtifacts = mutation({
  args: {
    token: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    dryRun: v.boolean(),
    toursDeleted: v.number(),
    tourSlugs: v.array(v.string()),
    qaScenesRemovedFromPilot: v.number(),
    qaHotspotsRemovedFromPilot: v.number(),
    qaConnectionsRemovedFromPilot: v.number(),
    orgsDeleted: v.number(),
    orgSlugs: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token);
    const dryRun = args.dryRun === true;

    const tourSlugs: string[] = [];
    let toursDeleted = 0;
    let qaScenesRemovedFromPilot = 0;
    let qaHotspotsRemovedFromPilot = 0;
    let qaConnectionsRemovedFromPilot = 0;

    const allTours = await ctx.db.query("tours").collect();
    for (const tour of allTours) {
      if (!isQaTourSlug(tour.slug)) continue;
      tourSlugs.push(tour.slug);
      if (!dryRun) {
        await deleteTourCascade(ctx, tour._id);
      }
      toursDeleted += 1;
    }

    const pilot =
      (await ctx.db
        .query("tours")
        .withIndex("by_slug", (q) => q.eq("slug", PILOT_TOUR_SLUG))
        .unique()) ||
      (await ctx.db
        .query("tours")
        .withIndex("by_slug", (q) => q.eq("slug", LEGACY_TOUR_SLUG))
        .unique());

    if (pilot) {
      const scenes = await ctx.db
        .query("scenes")
        .withIndex("by_tour", (q) => q.eq("tourId", pilot._id))
        .collect();
      const qaScenes = scenes.filter((s) => isQaSceneFileKey(s.fileKey));
      const qaSceneIds = new Set(qaScenes.map((s) => s._id));

      for (const scene of qaScenes) {
        const hs = await ctx.db
          .query("hotspots")
          .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
          .collect();
        qaHotspotsRemovedFromPilot += hs.length;
        if (!dryRun) {
          for (const h of hs) await ctx.db.delete(h._id);
        }

        const fromConns = await ctx.db
          .query("connections")
          .withIndex("by_from", (q) => q.eq("fromSceneId", scene._id))
          .collect();
        qaConnectionsRemovedFromPilot += fromConns.length;
        if (!dryRun) {
          for (const c of fromConns) await ctx.db.delete(c._id);
        }

        if (!dryRun) await ctx.db.delete(scene._id);
        qaScenesRemovedFromPilot += 1;
      }

      // Connections that target QA scenes from real campus scenes
      const allConns = await ctx.db
        .query("connections")
        .withIndex("by_tour", (q) => q.eq("tourId", pilot._id))
        .collect();
      for (const c of allConns) {
        if (qaSceneIds.has(c.toSceneId) || qaSceneIds.has(c.fromSceneId)) {
          qaConnectionsRemovedFromPilot += 1;
          if (!dryRun) await ctx.db.delete(c._id);
        }
      }

      // Nav hotspots on real scenes that still point at deleted QA file keys
      const remainingHs = await ctx.db
        .query("hotspots")
        .withIndex("by_tour", (q) => q.eq("tourId", pilot._id))
        .collect();
      for (const h of remainingHs) {
        if (h.targetFileKey && isQaSceneFileKey(h.targetFileKey)) {
          qaHotspotsRemovedFromPilot += 1;
          if (!dryRun) await ctx.db.delete(h._id);
        }
      }
    }

    const orgSlugs: string[] = [];
    let orgsDeleted = 0;
    const orgs = await ctx.db.query("organizations").collect();
    for (const org of orgs) {
      if (org.slug === PILOT_ORG_SLUG || org.slug === LEGACY_ORG_SLUG) continue;
      if (!isQaOrgSlug(org.slug)) continue;

      const orgTours = await ctx.db
        .query("tours")
        .withIndex("by_org", (q) => q.eq("organizationId", org._id))
        .collect();
      // Only delete if no non-QA tours remain
      const realTours = orgTours.filter((t) => !isQaTourSlug(t.slug));
      if (realTours.length > 0) continue;

      orgSlugs.push(org.slug);
      if (!dryRun) {
        for (const t of orgTours) {
          await deleteTourCascade(ctx, t._id);
        }
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_org", (q) => q.eq("organizationId", org._id))
          .collect();
        for (const m of memberships) await ctx.db.delete(m._id);
        await ctx.db.delete(org._id);
      }
      orgsDeleted += 1;
    }

    // Strip legacy superadmin org memberships (platform ops should not be tour editors)
    if (!dryRun) {
      const users = await ctx.db.query("platformUsers").collect();
      for (const u of users) {
        if (!u.isSuperadmin) continue;
        const memberships = await ctx.db
          .query("memberships")
          .withIndex("by_user", (q) => q.eq("userId", u._id))
          .collect();
        for (const m of memberships) await ctx.db.delete(m._id);
      }
    }

    return {
      dryRun,
      toursDeleted,
      tourSlugs,
      qaScenesRemovedFromPilot,
      qaHotspotsRemovedFromPilot,
      qaConnectionsRemovedFromPilot,
      orgsDeleted,
      orgSlugs,
    };
  },
});
