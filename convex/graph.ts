import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  brandingPublicValidator,
  getBrandingByTourId,
  sanitizePublicBranding,
  toBrandingPublic,
} from "./lib/branding";
import { findTourByOrgAndSlug } from "./lib/tourResolve";
import { getUserBySession, userCanEditTour } from "./lib/authHelpers";
import {
  hotspotVisualReturnFields,
  pickHotspotVisual,
} from "./lib/hotspotVisual";
import { sanitizeOptionalSafeUrl } from "./lib/urlSafety";

/**
 * Public TourBranding — Orbe platform accents stripped for any tour (not piloto-only).
 */
function publicBrandingForTour(
  orgSlug: string | undefined,
  brandingDoc: Awaited<ReturnType<typeof getBrandingByTourId>>
) {
  const raw = brandingDoc ? toBrandingPublic(brandingDoc) : undefined;
  return sanitizePublicBranding(raw, {
    allowOrbePlatformChrome: orgSlug === "orbe",
  });
}
/**
 * Grafo público del tour para el viewer Marzipano.
 * Shape compatible con mergeTourGraph / accessibleScenes.
 * Includes TourBranding when present (white-label identity ≠ Orbe360 platform).
 *
 * Resolve:
 * - Preferred: orgSlug + tourSlug (path /{org}/{tour}/)
 * - Compat: slug alone (legacy ?slug= / aliases)
 * Only returns published tours.
 */
export const getTourGraph = query({
  args: {
    slug: v.optional(v.string()),
    orgSlug: v.optional(v.string()),
    tourSlug: v.optional(v.string()),
    token: v.optional(v.string()),
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      isDraftPreview: v.optional(v.boolean()),
      tour: v.object({
        id: v.id("tours"),
        slug: v.string(),
        title: v.string(),
        published: v.boolean(),
        defaultSceneKey: v.optional(v.string()),
        accessibilityProfile: v.optional(
          v.object({
            keyboard: v.boolean(),
            screenReader: v.boolean(),
            highContrast: v.boolean(),
            captions: v.boolean(),
            publishChecklist: v.optional(
              v.object({
                ready: v.boolean(),
                checkedAt: v.number(),
                sceneCount: v.number(),
                scenesWithSrSummary: v.number(),
                scenesWithNarrationOrOptional: v.number(),
                scenesWithTranscriptIfAudio: v.number(),
                blockingIssues: v.array(v.string()),
                warnings: v.optional(v.array(v.string())),
              })
            ),
          })
        ),
      }),
      organization: v.object({
        name: v.string(),
        slug: v.string(),
      }),
      branding: v.optional(brandingPublicValidator),
      scenes: v.array(
        v.object({
          id: v.id("scenes"),
          fileKey: v.string(),
          title: v.string(),
          shortTitle: v.string(),
          zone: v.optional(v.string()),
          sede: v.optional(v.string()),
          speaker: v.optional(v.string()),
          order: v.number(),
          imageUrl: v.string(),
          altText: v.string(),
          longDescription: v.optional(v.string()),
          srSummary: v.optional(v.string()),
          narration: v.optional(v.string()),
          narrationOptional: v.optional(v.boolean()),
          transcript: v.optional(v.string()),
          captionFile: v.optional(v.string()),
          timingFile: v.optional(v.string()),
          initialView: v.optional(
            v.object({
              yaw: v.number(),
              pitch: v.number(),
              fov: v.optional(v.number()),
            })
          ),
          hotspots: v.array(
            v.object({
              id: v.string(),
              type: v.union(v.literal("nav"), v.literal("info")),
              title: v.string(),
              shortLabel: v.optional(v.string()),
              yaw: v.number(),
              pitch: v.number(),
              direction: v.optional(v.string()),
              targetFile: v.optional(v.string()),
              description: v.optional(v.string()),
              srSummary: v.optional(v.string()),
              narration: v.optional(v.string()),
              narrationOptional: v.optional(v.boolean()),
              transcript: v.optional(v.string()),
              captionFile: v.optional(v.string()),
              timingFile: v.optional(v.string()),
              weight: v.optional(v.number()),
              ...hotspotVisualReturnFields,
            })
          ),
        })
      ),
      connections: v.array(
        v.object({
          fromFile: v.string(),
          toFile: v.string(),
          direction: v.optional(v.string()),
          label: v.optional(v.string()),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const tourSlug = args.tourSlug || args.slug;
    if (!tourSlug) return null;

    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: args.orgSlug,
      tourSlug,
      slug: args.slug,
    });
    if (!tour || tour.archived) return null;
    let isDraftPreview = false;
    if (!tour.published) {
      if (!args.token) return null;
      const user = await getUserBySession(ctx, args.token, args.now);
      if (!user || !(await userCanEditTour(ctx, user, tour._id))) {
        return null;
      }
      isDraftPreview = true;
    }

    const org = await ctx.db.get(tour.organizationId);
    if (!org) return null;

    const brandingDoc = await getBrandingByTourId(ctx, tour._id);
    const branding = publicBrandingForTour(org.slug, brandingDoc);

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_tour_and_file", (q) => q.eq("tourId", tour._id))
      .collect();

    const sceneById = new Map(scenes.map((s) => [s._id, s]));

    const allHotspots = await ctx.db
      .query("hotspots")
      .withIndex("by_client_key", (q) => q.eq("tourId", tour._id))
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

    // Connections = edge SoT. Build public nav from connections (coords from
    // matching hotspot when present); keep info hotspots from DB; never expose
    // campus phantom nav that is not listed as a connection.
    const edgesByFrom = new Map<string, typeof connections>();
    for (const c of connections) {
      const from = sceneById.get(c.fromSceneId);
      if (!from) continue;
      const list = edgesByFrom.get(from.fileKey) || [];
      list.push(c);
      edgesByFrom.set(from.fileKey, list);
    }

    const resultScenes = [];
    for (const scene of scenes.sort((a, b) => a.order - b.order)) {
      const stored = hotspotsByScene.get(String(scene._id)) ?? [];
      const infoHotspots = stored.filter((h) => h.type !== "nav");
      const navPool = stored.filter((h) => h.type === "nav");
      const usedNavIds = new Set<string>();
      const edges = edgesByFrom.get(scene.fileKey) || [];

      const navHotspots =
        connections.length > 0
          ? edges.map((c) => {
              const to = sceneById.get(c.toSceneId);
              const toFile = to?.fileKey || "";
              const match =
                (c.hotspotId
                  ? navPool.find((h) => String(h._id) === String(c.hotspotId) || h.clientKey === String(c.hotspotId))
                  : undefined) ||
                navPool.find(
                  (h) => !usedNavIds.has(h.clientKey) && h.targetFileKey === toFile
                );
              if (match) usedNavIds.add(match.clientKey);
              return {
                id: match?.clientKey || `conn-${scene.fileKey}-${toFile}`,
                type: "nav" as const,
                title: match?.title || c.label || "Ir a escena",
                shortLabel: match?.shortLabel,
                yaw: match?.yaw ?? 0,
                pitch: match?.pitch ?? -0.05,
                direction: match?.direction || c.direction,
                targetFile: toFile || undefined,
                description: match?.description || c.label,
                srSummary: match?.srSummary,
                narration: sanitizeOptionalSafeUrl(match?.narrationUrl),
                narrationOptional: match?.narrationOptional,
                transcript: sanitizeOptionalSafeUrl(match?.transcriptUrl),
                captionFile: sanitizeOptionalSafeUrl(match?.captionUrl),
                timingFile: sanitizeOptionalSafeUrl(match?.timingUrl),
                weight: match?.weight,
                ...pickHotspotVisual(match || {}),
              };
            })
          : navPool.map((h) => ({
              id: h.clientKey,
              type: h.type,
              title: h.title,
              shortLabel: h.shortLabel,
              yaw: h.yaw,
              pitch: h.pitch,
              direction: h.direction,
              targetFile: h.targetFileKey,
              description: h.description,
              srSummary: h.srSummary,
              narration: sanitizeOptionalSafeUrl(h.narrationUrl),
              narrationOptional: h.narrationOptional,
              transcript: sanitizeOptionalSafeUrl(h.transcriptUrl),
              captionFile: sanitizeOptionalSafeUrl(h.captionUrl),
              timingFile: sanitizeOptionalSafeUrl(h.timingUrl),
              weight: h.weight,
              ...pickHotspotVisual(h),
            }));

      const hotspots = [
        ...infoHotspots.map((h) => ({
          id: h.clientKey,
          type: h.type,
          title: h.title,
          shortLabel: h.shortLabel,
          yaw: h.yaw,
          pitch: h.pitch,
          direction: h.direction,
          targetFile: h.targetFileKey,
          description: h.description,
          srSummary: h.srSummary,
          narration: sanitizeOptionalSafeUrl(h.narrationUrl),
          narrationOptional: h.narrationOptional,
          transcript: sanitizeOptionalSafeUrl(h.transcriptUrl),
          captionFile: sanitizeOptionalSafeUrl(h.captionUrl),
          timingFile: sanitizeOptionalSafeUrl(h.timingUrl),
          weight: h.weight,
          ...pickHotspotVisual(h),
        })),
        ...navHotspots,
      ];

      resultScenes.push({
        id: scene._id,
        fileKey: scene.fileKey,
        title: scene.title,
        shortTitle: scene.shortTitle,
        zone: scene.zone,
        sede: scene.sede,
        speaker: scene.speaker,
        order: scene.order,
        imageUrl: sanitizeOptionalSafeUrl(scene.imageUrl) || scene.imageUrl,
        altText: scene.altText,
        longDescription: scene.longDescription,
        srSummary: scene.srSummary,
        narration: sanitizeOptionalSafeUrl(scene.narrationUrl),
        narrationOptional: scene.narrationOptional,
        transcript: sanitizeOptionalSafeUrl(scene.transcriptUrl),
        captionFile: sanitizeOptionalSafeUrl(scene.captionUrl),
        timingFile: sanitizeOptionalSafeUrl(scene.timingUrl),
        initialView: scene.initialView,
        hotspots,
      });
    }

    return {
      ...(isDraftPreview ? { isDraftPreview: true } : {}),
      tour: {
        id: tour._id,
        slug: tour.slug,
        title: tour.title,
        published: tour.published,
        defaultSceneKey: tour.defaultSceneKey,
        accessibilityProfile: tour.accessibilityProfile,
      },
      organization: {
        name: org.name,
        slug: org.slug,
      },
      branding,
      scenes: resultScenes,
      connections: connections.map((c) => {
        const from = sceneById.get(c.fromSceneId);
        const to = sceneById.get(c.toSceneId);
        return {
          fromFile: from?.fileKey ?? "",
          toFile: to?.fileKey ?? "",
          direction: c.direction,
          label: c.label,
        };
      }),
    };
  },
});

/**
 * Resolve published tour by public path segments (no graph payload).
 */
export const resolvePublicTour = query({
  args: {
    orgSlug: v.string(),
    tourSlug: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      tourId: v.id("tours"),
      tourSlug: v.string(),
      orgSlug: v.string(),
      title: v.string(),
      published: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: args.orgSlug,
      tourSlug: args.tourSlug,
    });
    if (!tour || !tour.published || tour.archived) return null;
    const org = await ctx.db.get(tour.organizationId);
    if (!org) return null;
    return {
      tourId: tour._id,
      tourSlug: tour.slug,
      orgSlug: org.slug,
      title: tour.title,
      published: tour.published,
    };
  },
});

export const listPublishedDemos = query({
  args: {},
  returns: v.array(
    v.object({
      slug: v.string(),
      orgSlug: v.string(),
      title: v.string(),
      orgName: v.string(),
      clientName: v.optional(v.string()),
      clientShortName: v.optional(v.string()),
      primaryColor: v.optional(v.string()),
      metaDescription: v.optional(v.string()),
      headerTitle: v.optional(v.string()),
      fallbackImageUrl: v.optional(v.string()),
    })
  ),
  handler: async (ctx) => {
    const tours = await ctx.db
      .query("tours")
      .withIndex("by_published", (q) => q.eq("published", true))
      .collect();
    const demos = [];
    for (const t of tours) {
      if (t.archived) continue;
      const org = await ctx.db.get(t.organizationId);
      const brandDoc = await getBrandingByTourId(ctx, t._id);
      const branding = sanitizePublicBranding(
        brandDoc ? toBrandingPublic(brandDoc) : undefined,
        { allowOrbePlatformChrome: org?.slug === "orbe" }
      );
      demos.push({
        slug: t.slug,
        orgSlug: org?.slug ?? "",
        title: branding?.headerTitle || branding?.clientShortName || t.title,
        orgName: branding?.clientName || org?.name || "Organización",
        clientName: branding?.clientName,
        clientShortName: branding?.clientShortName,
        primaryColor: branding?.primaryColor,
        metaDescription: branding?.metaDescription,
        headerTitle: branding?.headerTitle,
        fallbackImageUrl: branding?.fallbackImageUrl,
      });
    }
    return demos;
  },
});
