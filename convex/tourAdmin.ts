import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  getUserBySession,
  requireUser,
  userCanEditTour,
} from "./lib/authHelpers";
import { applySpatialPackageToTour } from "./lib/applySpatialPackage";
import {
  CAMPUS_SPATIAL_CONNECTION_COUNT,
  CAMPUS_SPATIAL_HOTSPOT_COUNT,
  CAMPUS_SPATIAL_NAV_COUNT,
  CAMPUS_SPATIAL_PACKAGE,
  CAMPUS_SPATIAL_SCENE_COUNT,
  CAMPUS_SPATIAL_TOUR_SLUG,
} from "./lib/campusSpatialPackage";
import { findTourByOrgAndSlug, canonicalizeOrgSlug } from "./lib/tourResolve";
import type { Id } from "./_generated/dataModel";
import {
  hotspotAccentColorValidator,
  hotspotAnimationPresetValidator,
  hotspotCategoryValidator,
  hotspotIconKeyValidator,
  pickHotspotVisual,
} from "./lib/hotspotVisual";

/**
 * Client gate for Control Web / tour admin tooling.
 * Does not leak tour graph — only ok + minimal metadata when authorized.
 */
export const assertTourEditorAccess = query({
  args: {
    token: v.string(),
    orgSlug: v.string(),
    tourSlug: v.string(),
    now: v.optional(v.number()),
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.optional(
      v.union(
        v.literal("unauthenticated"),
        v.literal("superadmin_no_tour_edit"),
        v.literal("tour_not_found"),
        v.literal("forbidden"),
        v.literal("org_mismatch")
      )
    ),
    tourId: v.optional(v.id("tours")),
    title: v.optional(v.string()),
    orgSlug: v.optional(v.string()),
    tourSlug: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getUserBySession(ctx, args.token, args.now);
    if (!user || !user.active) {
      return { ok: false as const, reason: "unauthenticated" as const };
    }
    if (user.isSuperadmin) {
      return { ok: false as const, reason: "superadmin_no_tour_edit" as const };
    }

    const wantOrg = canonicalizeOrgSlug(args.orgSlug);
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: wantOrg,
      tourSlug: args.tourSlug,
      slug: args.tourSlug,
    });
    if (!tour) {
      return { ok: false as const, reason: "tour_not_found" as const };
    }

    const org = await ctx.db.get(tour.organizationId);
    if (!org || canonicalizeOrgSlug(org.slug) !== wantOrg) {
      return { ok: false as const, reason: "org_mismatch" as const };
    }

    if (!(await userCanEditTour(ctx, user, tour._id))) {
      return { ok: false as const, reason: "forbidden" as const };
    }

    return {
      ok: true as const,
      tourId: tour._id,
      title: tour.title,
      orgSlug: org.slug,
      tourSlug: tour.slug,
    };
  },
});

const hotspotValidator = v.object({
  id: v.string(),
  type: v.union(v.literal("nav"), v.literal("info")),
  title: v.string(),
  yaw: v.number(),
  pitch: v.number(),
  direction: v.optional(v.string()),
  targetFile: v.optional(v.string()),
  description: v.optional(v.string()),
  weight: v.optional(v.number()),
  shortLabel: v.optional(v.string()),
  altText: v.optional(v.string()),
  iconKey: hotspotIconKeyValidator,
  category: hotspotCategoryValidator,
  animationPreset: hotspotAnimationPresetValidator,
  accentColor: hotspotAccentColorValidator,
});

const initialViewValidator = v.object({
  yaw: v.number(),
  pitch: v.number(),
  fov: v.optional(v.number()),
});

const scenePatchValidator = v.object({
  fileKey: v.string(),
  title: v.string(),
  shortTitle: v.string(),
  zone: v.optional(v.string()),
  order: v.number(),
  imageUrl: v.string(),
  altText: v.string(),
  longDescription: v.optional(v.string()),
  initialView: v.optional(initialViewValidator),
  hotspots: v.array(hotspotValidator),
});

/**
 * Snapshot editable compatible con Control Web (tour.graph.v1 + escenas).
 */
export const getAdminSnapshot = query({
  args: {
    token: v.string(),
    slug: v.string(),
    /** Required — multi-tenant isolation (no global slug lookup for admin). */
    orgSlug: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      tourId: v.id("tours"),
      slug: v.string(),
      title: v.string(),
      scenes: v.any(),
      connections: v.array(
        v.object({
          id: v.string(),
          from: v.string(),
          to: v.string(),
          label: v.optional(v.string()),
          yaw: v.optional(v.number()),
          pitch: v.optional(v.number()),
          direction: v.optional(v.string()),
          weight: v.optional(v.number()),
        })
      ),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const want = canonicalizeOrgSlug(args.orgSlug);
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: want,
      tourSlug: args.slug,
      slug: args.slug,
    });
    if (!tour) return null;
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado para este tour");
    }
    const org = await ctx.db.get(tour.organizationId);
    if (!org || canonicalizeOrgSlug(org.slug) !== want) {
      throw new Error("Tour no pertenece a la organización solicitada");
    }

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();

    const allHotspots = await ctx.db
      .query("hotspots")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();
    const hotspotsByScene = new Map<string, typeof allHotspots>();
    for (const h of allHotspots) {
      const key = String(h.sceneId);
      const list = hotspotsByScene.get(key);
      if (list) list.push(h);
      else hotspotsByScene.set(key, [h]);
    }

    const connections = await ctx.db
      .query("connections")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();
    const sceneById = new Map(scenes.map((s) => [s._id, s]));
    const edgesByFrom = new Map<string, typeof connections>();
    for (const c of connections) {
      const from = sceneById.get(c.fromSceneId);
      if (!from) continue;
      const list = edgesByFrom.get(from.fileKey) || [];
      list.push(c);
      edgesByFrom.set(from.fileKey, list);
    }

    const sceneMap: Record<
      string,
      {
        hotspots: Array<{
          id: string;
          type: "nav" | "info";
          title: string;
          yaw: number;
          pitch: number;
          direction?: string;
          targetFile?: string;
          description?: string;
          weight?: number;
          shortLabel?: string;
          altText?: string;
        }>;
        title?: string;
        shortTitle?: string;
        zone?: string;
        imageUrl?: string;
        order?: number;
        initialView?: { yaw: number; pitch: number; fov?: number };
      }
    > = {};

    for (const scene of scenes) {
      const stored = hotspotsByScene.get(String(scene._id)) ?? [];
      const info = stored.filter((h) => h.type !== "nav");
      const navByTarget = new Map(
        stored
          .filter((h) => h.type === "nav" && h.targetFileKey)
          .map((h) => [h.targetFileKey as string, h])
      );
      const edges = edgesByFrom.get(scene.fileKey) || [];
      const nav =
        connections.length > 0
          ? edges.map((c) => {
              const to = sceneById.get(c.toSceneId);
              const toFile = to?.fileKey || "";
              const match = toFile ? navByTarget.get(toFile) : undefined;
              return {
                id: match?.clientKey || `conn-${scene.fileKey}-${toFile}`,
                type: "nav" as const,
                title: match?.title || c.label || "Ir a escena",
                yaw: match?.yaw ?? 0,
                pitch: match?.pitch ?? -0.05,
                direction: match?.direction || c.direction,
                targetFile: toFile || undefined,
                description: match?.description || c.label,
                weight: match?.weight,
                ...pickHotspotVisual(match || {}),
              };
            })
          : stored
              .filter((h) => h.type === "nav")
              .map((h) => ({
                id: h.clientKey,
                type: "nav" as const,
                title: h.title,
                yaw: h.yaw,
                pitch: h.pitch,
                direction: h.direction,
                targetFile: h.targetFileKey,
                description: h.description,
                weight: h.weight,
                ...pickHotspotVisual(h),
              }));

      sceneMap[scene.fileKey] = {
        title: scene.title,
        shortTitle: scene.shortTitle,
        zone: scene.zone,
        imageUrl: scene.imageUrl,
        order: scene.order,
        initialView: scene.initialView,
        hotspots: [
          ...info.map((h) => ({
            id: h.clientKey,
            type: h.type,
            title: h.title,
            yaw: h.yaw,
            pitch: h.pitch,
            direction: h.direction,
            targetFile: h.targetFileKey,
            description: h.description,
            weight: h.weight,
            ...pickHotspotVisual(h),
          })),
          ...nav,
        ],
      };
    }

    const byId = sceneById;

    return {
      tourId: tour._id,
      slug: tour.slug,
      title: tour.title,
      scenes: sceneMap,
      connections: connections.map((c) => {
        const from = byId.get(c.fromSceneId);
        const to = byId.get(c.toSceneId);
        const fromFile = from?.fileKey ?? "";
        const toFile = to?.fileKey ?? "";
        const match = fromFile
          ? (hotspotsByScene.get(String(c.fromSceneId)) || []).find(
              (h) =>
                h.type === "nav" &&
                (h.targetFileKey === toFile ||
                  (c.hotspotId && String(c.hotspotId) === h.clientKey))
            )
          : undefined;
        return {
          id: match?.clientKey || (c.hotspotId ? String(c.hotspotId) : `${c.fromSceneId}-${c.toSceneId}`),
          from: fromFile,
          to: toFile,
          label: c.label,
          direction: c.direction,
          yaw: match?.yaw,
          pitch: match?.pitch,
          weight: match?.weight,
        };
      }),
      updatedAt: tour.updatedAt,
    };
  },
});

/**
 * Guarda snapshot completo del tour (reemplaza hotspots/conexiones del tour).
 */
export const saveTourSnapshot = mutation({
  args: {
    token: v.string(),
    slug: v.string(),
    /** Required — multi-tenant isolation. */
    orgSlug: v.string(),
    scenes: v.array(scenePatchValidator),
    connections: v.array(
      v.object({
        id: v.optional(v.string()),
        from: v.string(),
        to: v.string(),
        label: v.optional(v.string()),
        yaw: v.optional(v.number()),
        pitch: v.optional(v.number()),
        direction: v.optional(v.string()),
        weight: v.optional(v.number()),
      })
    ),
    /** Explicit confirm to publish zero connections over an existing curated graph. */
    allowEmptyConnections: v.optional(v.boolean()),
  },
  returns: v.object({
    scenesSaved: v.number(),
    hotspotsSaved: v.number(),
    connectionsSaved: v.number(),
  }),
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
      throw new Error("No autorizado para guardar este tour");
    }
    const org = await ctx.db.get(tour.organizationId);
    if (!org || canonicalizeOrgSlug(org.slug) !== want) {
      throw new Error("Tour no pertenece a la organización solicitada");
    }

    // Guard: empty tour-graph.json / failed Control Web seed must not wipe curated edges.
    if (
      args.connections.length === 0 &&
      args.scenes.length > 3 &&
      !args.allowEmptyConnections
    ) {
      const existingConnections = await ctx.db
        .query("connections")
        .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
        .collect();
      if (existingConnections.length > 0) {
        throw new Error(
          `Refusing to wipe ${existingConnections.length} connections with an empty snapshot. ` +
            `Import a backup or confirm allowEmptyConnections.`
        );
      }
    }

    const now = Date.now();
    const fileToSceneId = new Map<string, Id<"scenes">>();

    // Upsert scenes
    for (const patch of args.scenes) {
      const existing = await ctx.db
        .query("scenes")
        .withIndex("by_tour_and_file", (q) =>
          q.eq("tourId", tour._id).eq("fileKey", patch.fileKey)
        )
        .unique();

      let sceneId: Id<"scenes">;
      if (existing) {
        // No pisar URL de File Storage ni /media/{org}/{tour}/… con ruta relativa legacy.
        const patchLooksLocal =
          !/^https?:\/\//i.test(patch.imageUrl) &&
          !patch.imageUrl.startsWith("/media/") &&
          (patch.imageUrl.includes("panoramas/") || patch.imageUrl.startsWith("../"));
        const keepStored =
          Boolean(existing.storageId) &&
          (/^https?:\/\//i.test(existing.imageUrl) ||
            existing.imageUrl.startsWith("/media/")) &&
          patchLooksLocal;
        // Selective patch: never wipe a11y URLs (srSummary, narrationUrl, …).
        await ctx.db.patch(existing._id, {
          title: patch.title,
          shortTitle: patch.shortTitle,
          zone: patch.zone,
          order: patch.order,
          imageUrl: keepStored ? existing.imageUrl : patch.imageUrl,
          altText: patch.altText,
          longDescription: patch.longDescription,
          ...(patch.initialView ? { initialView: patch.initialView } : {}),
          updatedAt: now,
        });
        sceneId = existing._id;
      } else {
        sceneId = await ctx.db.insert("scenes", {
          tourId: tour._id,
          organizationId: tour.organizationId,
          fileKey: patch.fileKey,
          title: patch.title,
          shortTitle: patch.shortTitle,
          zone: patch.zone,
          order: patch.order,
          imageUrl: patch.imageUrl,
          altText: patch.altText,
          longDescription: patch.longDescription,
          ...(patch.initialView ? { initialView: patch.initialView } : {}),
          createdAt: now,
          updatedAt: now,
        });
      }
      fileToSceneId.set(patch.fileKey, sceneId);

      // Replace hotspots for scene — preserve a11y URLs by clientKey (Phase 10).
      // Connections are SoT for which nav edges exist (admin deletes in the graph win).
      const oldHs = await ctx.db
        .query("hotspots")
        .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
        .collect();
      const a11yByKey = new Map<
        string,
        {
          srSummary?: string;
          narrationUrl?: string;
          narrationOptional?: boolean;
          transcriptUrl?: string;
          captionUrl?: string;
          timingUrl?: string;
        }
      >();
      for (const h of oldHs) {
        a11yByKey.set(h.clientKey, {
          srSummary: h.srSummary,
          narrationUrl: h.narrationUrl,
          narrationOptional: h.narrationOptional,
          transcriptUrl: h.transcriptUrl,
          captionUrl: h.captionUrl,
          timingUrl: h.timingUrl,
        });
      }
      for (const h of oldHs) await ctx.db.delete(h._id);

      const infoHotspots = patch.hotspots.filter((h) => h.type !== "nav");
      const navByTarget = new Map(
        patch.hotspots
          .filter((h) => h.type === "nav" && h.targetFile)
          .map((h) => [h.targetFile as string, h])
      );
      const navById = new Map(
        patch.hotspots.filter((h) => h.type === "nav").map((h) => [h.id, h])
      );
      const edges = args.connections.filter((c) => c.from === patch.fileKey);

      // Connections array is SoT for nav edges on save (graph panel deletes win).
      const hotspotsToWrite =
        args.connections.length > 0
          ? [
              ...infoHotspots,
              ...edges.map((edge) => {
                const existing =
                  (edge.id ? navById.get(edge.id) : undefined) ||
                  navByTarget.get(edge.to);
                if (existing) {
                  return {
                    ...existing,
                    type: "nav" as const,
                    targetFile: edge.to,
                    title: existing.title || edge.label || "Ir a escena",
                    direction: edge.direction ?? existing.direction,
                    yaw:
                      typeof existing.yaw === "number"
                        ? existing.yaw
                        : typeof edge.yaw === "number"
                          ? edge.yaw
                          : 0,
                    pitch:
                      typeof existing.pitch === "number"
                        ? existing.pitch
                        : typeof edge.pitch === "number"
                          ? edge.pitch
                          : -0.05,
                    weight: edge.weight ?? existing.weight,
                  };
                }
                return {
                  id: edge.id || `conn-${edge.from}-${edge.to}`,
                  type: "nav" as const,
                  title: edge.label || "Ir a escena",
                  yaw: typeof edge.yaw === "number" ? edge.yaw : 0,
                  pitch: typeof edge.pitch === "number" ? edge.pitch : -0.05,
                  direction: edge.direction,
                  targetFile: edge.to,
                  weight: edge.weight,
                  description: edge.label,
                };
              }),
            ]
          : patch.hotspots;

      for (const h of hotspotsToWrite) {
        const a11y = a11yByKey.get(h.id) || {};
        const visual = pickHotspotVisual(h);
        await ctx.db.insert("hotspots", {
          tourId: tour._id,
          sceneId,
          clientKey: h.id,
          type: h.type,
          title: h.title,
          yaw: h.yaw,
          pitch: h.pitch,
          direction: h.direction,
          targetFileKey: h.targetFile,
          description: h.description,
          weight: h.weight,
          ...visual,
          ...a11y,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Drop phantom nav on scenes not included in this snapshot when this save
    // carries a real scene list (Control Web full save). Never run on empty
    // scenes payloads (auth probes / no-op).
    if (args.scenes.length > 0) {
      const allowedNav = new Set(
        args.connections.map((c) => `${c.from}=>${c.to}`)
      );
      const allScenes = await ctx.db
        .query("scenes")
        .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
        .collect();
      for (const scene of allScenes) {
        if (fileToSceneId.has(scene.fileKey)) continue;
        const hs = await ctx.db
          .query("hotspots")
          .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
          .collect();
        for (const h of hs) {
          if (h.type !== "nav") continue;
          const key = `${scene.fileKey}=>${h.targetFileKey || ""}`;
          if (!allowedNav.has(key)) await ctx.db.delete(h._id);
        }
      }
    }

    // Resolve targetSceneId for nav hotspots
    const allHotspots = await ctx.db
      .query("hotspots")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();
    for (const h of allHotspots) {
      if (h.type === "nav" && h.targetFileKey) {
        const targetId = fileToSceneId.get(h.targetFileKey);
        if (targetId) await ctx.db.patch(h._id, { targetSceneId: targetId });
      }
    }

    // Replace connections
    const oldConns = await ctx.db
      .query("connections")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();
    for (const c of oldConns) await ctx.db.delete(c._id);

    let connectionsSaved = 0;
    for (const c of args.connections) {
      const fromId = fileToSceneId.get(c.from);
      const toId = fileToSceneId.get(c.to);
      if (!fromId || !toId) continue;
      await ctx.db.insert("connections", {
        tourId: tour._id,
        fromSceneId: fromId,
        toSceneId: toId,
        direction: c.direction,
        label: c.label,
        createdAt: now,
      });
      connectionsSaved += 1;
    }

    await ctx.db.patch(tour._id, { updatedAt: now });

    const hotspotCount = args.scenes.reduce((n, s) => n + s.hotspots.length, 0);
    return {
      scenesSaved: args.scenes.length,
      hotspotsSaved: hotspotCount,
      connectionsSaved,
    };
  },
});

const spatialResultValidator = {
  scenesUpserted: v.number(),
  scenesCreated: v.number(),
  hotspotsUpserted: v.number(),
  hotspotsCreated: v.number(),
  hotspotsPreservedA11y: v.number(),
  connectionsSaved: v.number(),
  navHotspots: v.number(),
};

/**
 * Phase 10: sync Unisimón spatial graph (yaw/pitch/nav/connections) from
 * embedded static sources into Convex. Preserves existing a11y URLs.
 * Authz: org membership (orgAdmin / tourEditor). Superadmin cannot call this —
 * use seed:seedPlatform for platform bootstrap.
 */
export const syncCampusSpatialGraph = mutation({
  args: {
    token: v.string(),
    tourId: v.optional(v.id("tours")),
    slug: v.optional(v.string()),
  },
  returns: v.object({
    tourId: v.id("tours"),
    slug: v.string(),
    ...spatialResultValidator,
    packageMeta: v.object({
      scenes: v.number(),
      hotspots: v.number(),
      nav: v.number(),
      connections: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    let tourId = args.tourId;
    if (!tourId) {
      const slug = args.slug || CAMPUS_SPATIAL_TOUR_SLUG;
      const tour = await findTourByOrgAndSlug(ctx, { slug });
      if (!tour) throw new Error(`Tour no encontrado: ${slug}`);
      tourId = tour._id;
    }
    if (!(await userCanEditTour(ctx, user, tourId))) {
      throw new Error("No autorizado para sincronizar el grafo espacial");
    }
    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour no encontrado");

    const result = await applySpatialPackageToTour(
      ctx,
      tourId,
      CAMPUS_SPATIAL_PACKAGE
    );
    return {
      tourId,
      slug: tour.slug,
      ...result,
      packageMeta: {
        scenes: CAMPUS_SPATIAL_SCENE_COUNT,
        hotspots: CAMPUS_SPATIAL_HOTSPOT_COUNT,
        nav: CAMPUS_SPATIAL_NAV_COUNT,
        connections: CAMPUS_SPATIAL_CONNECTION_COUNT,
      },
    };
  },
});

/** Metadata for admin/QA: expected spatial embed sizes. */
export const getCampusSpatialPackageMeta = query({
  args: {},
  returns: v.object({
    tourSlug: v.string(),
    sceneCount: v.number(),
    hotspotCount: v.number(),
    navCount: v.number(),
    connectionCount: v.number(),
  }),
  handler: async () => ({
    tourSlug: CAMPUS_SPATIAL_TOUR_SLUG,
    sceneCount: CAMPUS_SPATIAL_SCENE_COUNT,
    hotspotCount: CAMPUS_SPATIAL_HOTSPOT_COUNT,
    navCount: CAMPUS_SPATIAL_NAV_COUNT,
    connectionCount: CAMPUS_SPATIAL_CONNECTION_COUNT,
  }),
});
