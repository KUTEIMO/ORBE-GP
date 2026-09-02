import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  requireSuperadmin,
  requireUser,
  userBelongsToOrg,
  userCanEditTour,
} from "./lib/authHelpers";
import { defaultBrandingForTour, upsertBrandingDoc } from "./lib/branding";
import { isUrlSafeSlug, normalizeSlug } from "./lib/tourResolve";

export const listOrganizations = query({
  args: {
    token: v.optional(v.string()),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("organizations"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      maxTours: v.union(v.number(), v.null()),
      tourCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = args.token
      ? await requireUser(ctx, args.token, args.now).catch(() => null)
      : null;
    if (!user) return [];

    const mapOrg = async (o: Doc<"organizations">) => {
      const tours = await ctx.db
        .query("tours")
        .withIndex("by_org", (q) => q.eq("organizationId", o._id))
        .collect();
      return {
        id: o._id,
        name: o.name,
        slug: o.slug,
        description: o.description,
        maxTours: o.maxTours ?? null,
        tourCount: tours.length,
      };
    };

    if (user.isSuperadmin) {
      const orgs = await ctx.db.query("organizations").collect();
      const result = [];
      for (const o of orgs) {
        result.push(await mapOrg(o));
      }
      return result;
    }

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const result = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.organizationId);
      if (org) {
        result.push(await mapOrg(org));
      }
    }
    return result;
  },
});

export const createOrganization = mutation({
  args: {
    token: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    /** Soft quota; omit or null = unlimited */
    maxTours: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.id("organizations"),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token);
    const slug = normalizeSlug(args.slug);
    if (!isUrlSafeSlug(slug)) {
      throw new Error(
        "Slug de organización inválido (usa minúsculas, números y guiones)"
      );
    }
    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (existing) throw new Error("Ya existe una organización con ese slug");

    const maxTours =
      args.maxTours === null || args.maxTours === undefined
        ? undefined
        : Math.max(0, Math.floor(args.maxTours));

    return await ctx.db.insert("organizations", {
      name: args.name.trim(),
      slug,
      description: args.description,
      ...(maxTours !== undefined ? { maxTours } : {}),
      createdAt: Date.now(),
    });
  },
});

/** Superadmin: set or clear tour quota (null = unlimited). */
export const setOrganizationMaxTours = mutation({
  args: {
    token: v.string(),
    organizationId: v.id("organizations"),
    maxTours: v.union(v.number(), v.null()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token);
    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");
    if (args.maxTours === null) {
      await ctx.db.patch(args.organizationId, { maxTours: undefined });
    } else {
      await ctx.db.patch(args.organizationId, {
        maxTours: Math.max(0, Math.floor(args.maxTours)),
      });
    }
    return null;
  },
});

/** Platform KPIs for superadmin dashboard. */
export const getPlatformStats = query({
  args: {
    token: v.string(),
    now: v.optional(v.number()),
  },
  returns: v.object({
    orgCount: v.number(),
    tourCount: v.number(),
    publishedTourCount: v.number(),
    userCount: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token, args.now);
    const orgs = await ctx.db.query("organizations").collect();
    const tours = await ctx.db.query("tours").collect();
    const users = await ctx.db.query("platformUsers").collect();
    return {
      orgCount: orgs.length,
      tourCount: tours.length,
      publishedTourCount: tours.filter((t) => t.published).length,
      userCount: users.length,
    };
  },
});

/**
 * Listado administrativo de tours.
 * Requiere sesión. Superadmin ve todos; miembros solo orgs propias.
 * Drafts nunca se exponen sin pertenecer a la org.
 * Para demos públicas use `graph:listPublishedDemos`.
 */
export const listTours = query({
  args: {
    token: v.string(),
    organizationId: v.optional(v.id("organizations")),
    publishedOnly: v.optional(v.boolean()),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("tours"),
      organizationId: v.id("organizations"),
      orgSlug: v.string(),
      slug: v.string(),
      title: v.string(),
      published: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token, args.now);

    if (args.organizationId) {
      const allowed = await userBelongsToOrg(ctx, user, args.organizationId);
      if (!allowed) {
        throw new Error("No autorizado para esta organización");
      }
    }

    let tours;
    if (args.organizationId) {
      tours = await ctx.db
        .query("tours")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId!))
        .collect();
    } else if (user.isSuperadmin) {
      tours = await ctx.db.query("tours").collect();
    } else {
      const memberships = await ctx.db
        .query("memberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();
      tours = [];
      for (const m of memberships) {
        const orgTours = await ctx.db
          .query("tours")
          .withIndex("by_org", (q) => q.eq("organizationId", m.organizationId))
          .collect();
        tours.push(...orgTours);
      }
    }

    if (args.publishedOnly) {
      tours = tours.filter((t) => t.published);
    }

    const result = [];
    for (const t of tours) {
      const org = await ctx.db.get(t.organizationId);
      if (!org) continue;
      result.push({
        id: t._id,
        organizationId: t.organizationId,
        orgSlug: org.slug,
        slug: t.slug,
        title: t.title,
        published: t.published,
      });
    }
    return result;
  },
});

export const createTour = mutation({
  args: {
    token: v.string(),
    organizationId: v.id("organizations"),
    slug: v.string(),
    title: v.string(),
    published: v.optional(v.boolean()),
  },
  returns: v.id("tours"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!user.isSuperadmin) {
      const membership = await ctx.db
        .query("memberships")
        .withIndex("by_user_and_org", (q) =>
          q.eq("userId", user._id).eq("organizationId", args.organizationId)
        )
        .unique();
      if (!membership || membership.role !== "orgAdmin") {
        throw new Error("No autorizado para crear tours en esta organización");
      }
    }

    const org = await ctx.db.get(args.organizationId);
    if (!org) throw new Error("Organización no encontrada");

    const slug = normalizeSlug(args.slug);
    if (!isUrlSafeSlug(slug)) {
      throw new Error(
        "Slug de tour inválido (usa minúsculas, números y guiones)"
      );
    }
    // Uniqueness scoped to organization (multi-tenant). Legacy by_slug remains for lookups.
    const existingInOrg = await ctx.db
      .query("tours")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("organizationId", args.organizationId).eq("slug", slug)
      )
      .unique();
    if (existingInOrg) {
      throw new Error("Slug de tour ya existe en esta organización");
    }

    if (typeof org.maxTours === "number") {
      const existingTours = await ctx.db
        .query("tours")
        .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
        .collect();
      if (existingTours.length >= org.maxTours) {
        throw new Error(
          `Límite de tours alcanzado (${existingTours.length} de ${org.maxTours})`
        );
      }
    }

    const now = Date.now();
    const title = args.title.trim();
    const tourId = await ctx.db.insert("tours", {
      organizationId: args.organizationId,
      slug,
      title,
      published: args.published ?? false,
      accessibilityProfile: {
        keyboard: true,
        screenReader: true,
        highContrast: true,
        captions: true,
      },
      createdAt: now,
      updatedAt: now,
    });

    await upsertBrandingDoc(ctx, {
      tourId,
      organizationId: args.organizationId,
      branding: defaultBrandingForTour(title),
    });

    return tourId;
  },
});

export const canEditTour = query({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    now: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token, args.now).catch(() => null);
    if (!user) return false;
    return await userCanEditTour(ctx, user, args.tourId);
  },
});
