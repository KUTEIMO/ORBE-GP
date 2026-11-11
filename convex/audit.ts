import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { requireUser, userBelongsToOrg } from "./lib/authHelpers";
import { findTourByOrgAndSlug } from "./lib/tourResolve";

export async function writeAuditLog(
  ctx: MutationCtx,
  entry: {
    user: Doc<"platformUsers">;
    actorRole?: string;
    organizationId?: Id<"organizations">;
    tourId?: Id<"tours">;
    action: string;
    target?: string;
    detail?: string;
  }
): Promise<void> {
  const actorRole =
    entry.actorRole || (entry.user.isSuperadmin ? "superadmin" : "member");
  await ctx.db.insert("auditLogs", {
    organizationId: entry.organizationId,
    tourId: entry.tourId,
    actorUserId: entry.user._id,
    actorEmail: entry.user.email,
    actorRole,
    action: entry.action,
    target: entry.target,
    detail: entry.detail,
    createdAt: Date.now(),
  });
}

export const listAuditLogs = query({
  args: {
    token: v.string(),
    organizationId: v.optional(v.id("organizations")),
    tourId: v.optional(v.id("tours")),
    limit: v.optional(v.number()),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("auditLogs"),
      actorEmail: v.string(),
      actorRole: v.string(),
      action: v.string(),
      target: v.optional(v.string()),
      detail: v.optional(v.string()),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token, args.now);
    const maxRows = Math.min(Math.max(1, Math.floor(args.limit ?? 50)), 200);

    let orgId = args.organizationId;
    if (args.tourId && !orgId) {
      const tour = await ctx.db.get("tours", args.tourId);
      if (tour) orgId = tour.organizationId;
    }

    if (orgId) {
      if (!(await userBelongsToOrg(ctx, user, orgId))) {
        throw new Error("No autorizado para consultar bitácora de esta organización");
      }
    } else if (!user.isSuperadmin) {
      throw new Error("Se requiere organización o superadmin para consultar bitácora");
    }

    const rows = args.tourId
      ? await ctx.db
          .query("auditLogs")
          .withIndex("by_tour_time", (q) => q.eq("tourId", args.tourId))
          .order("desc")
          .take(maxRows)
      : orgId
        ? await ctx.db
            .query("auditLogs")
            .withIndex("by_org_time", (q) => q.eq("organizationId", orgId))
            .order("desc")
            .take(maxRows)
        : await ctx.db
            .query("auditLogs")
            .withIndex("by_time")
            .order("desc")
            .take(maxRows);

    return rows.map((r) => ({
      id: r._id,
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      action: r.action,
      target: r.target,
      detail: r.detail,
      createdAt: r.createdAt,
    }));
  },
});

function utcDateKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Anonymous first-party usage telemetry for published tours (zero PII/cookies).
 */
export const recordTourEvent = mutation({
  args: {
    orgSlug: v.optional(v.string()),
    tourSlug: v.string(),
    event: v.union(v.literal("view"), v.literal("scene"), v.literal("hotspot")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: args.orgSlug,
      tourSlug: args.tourSlug,
      slug: args.tourSlug,
    });
    if (!tour || !tour.published || tour.archived) return null;

    const now = Date.now();
    const dateKey = utcDateKey(now);
    const existing = await ctx.db
      .query("tourMetrics")
      .withIndex("by_tour_and_date", (q) =>
        q.eq("tourId", tour._id).eq("dateKey", dateKey)
      )
      .unique();

    if (existing) {
      await ctx.db.patch("tourMetrics", existing._id, {
        views: existing.views + (args.event === "view" ? 1 : 0),
        sceneChanges: existing.sceneChanges + (args.event === "scene" ? 1 : 0),
        hotspotOpens: existing.hotspotOpens + (args.event === "hotspot" ? 1 : 0),
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("tourMetrics", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        dateKey,
        views: args.event === "view" ? 1 : 0,
        sceneChanges: args.event === "scene" ? 1 : 0,
        hotspotOpens: args.event === "hotspot" ? 1 : 0,
        updatedAt: now,
      });
    }
    return null;
  },
});

export const getTourMetrics = query({
  args: {
    token: v.string(),
    organizationId: v.id("organizations"),
    tourId: v.optional(v.id("tours")),
    now: v.optional(v.number()),
  },
  returns: v.object({
    views: v.number(),
    sceneChanges: v.number(),
    hotspotOpens: v.number(),
    days: v.array(
      v.object({
        dateKey: v.string(),
        views: v.number(),
        sceneChanges: v.number(),
        hotspotOpens: v.number(),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token, args.now);
    if (!(await userBelongsToOrg(ctx, user, args.organizationId))) {
      throw new Error("No autorizado para métricas de esta organización");
    }

    const filterTourId = args.tourId;
    const rows = filterTourId
      ? await ctx.db
          .query("tourMetrics")
          .withIndex("by_tour_and_date", (q) => q.eq("tourId", filterTourId))
          .collect()
      : await ctx.db
          .query("tourMetrics")
          .withIndex("by_org_and_date", (q) =>
            q.eq("organizationId", args.organizationId)
          )
          .collect();

    const byDate = new Map<
      string,
      { views: number; sceneChanges: number; hotspotOpens: number }
    >();
    let views = 0;
    let sceneChanges = 0;
    let hotspotOpens = 0;
    for (const r of rows) {
      views += r.views;
      sceneChanges += r.sceneChanges;
      hotspotOpens += r.hotspotOpens;
      const cur = byDate.get(r.dateKey) || {
        views: 0,
        sceneChanges: 0,
        hotspotOpens: 0,
      };
      cur.views += r.views;
      cur.sceneChanges += r.sceneChanges;
      cur.hotspotOpens += r.hotspotOpens;
      byDate.set(r.dateKey, cur);
    }

    const days = [...byDate.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30)
      .map(([dateKey, m]) => ({ dateKey, ...m }));

    return { views, sceneChanges, hotspotOpens, days };
  },
});
