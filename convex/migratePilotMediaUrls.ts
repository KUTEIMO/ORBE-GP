/**
 * In-place rewrite of Unisimón scene/hotspot media URLs to tenant absolute paths.
 * Does NOT touch connections, hotspots geometry, or scene count — URLs only.
 *
 * Backup first: node scripts/backup-unisimon-graph.mjs
 * Run: npx convex run migratePilotMediaUrls:migratePilotMediaUrls
 */
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireSuperadmin } from "./lib/authHelpers";
import { findTourByOrgAndSlug } from "./lib/tourResolve";

const ORG = "unisimoncucuta";
const TOUR = "experienciavirtual";
const MEDIA = `/media/${ORG}/${TOUR}`;
const PANORAMA = `${MEDIA}/panoramas`;
const ASSETS = `${MEDIA}/assets`;

function rewritePanoramaUrl(url: string | undefined, fileKey: string): string {
  const fallback = `${PANORAMA}/${fileKey}`;
  if (!url || typeof url !== "string") return fallback;
  const u = url.trim();
  if (
    u.startsWith(`${PANORAMA}/`) ||
    u.startsWith(`/media/${ORG}/${TOUR}/panoramas/`)
  ) {
    return u.startsWith("/") ? u : `/${u}`;
  }
  // ../panoramas/X, panoramas/X, /panoramas/X, relative file only
  const m = u.match(/(?:^|\/)panoramas\/(.+)$/i);
  if (m?.[1]) return `${PANORAMA}/${m[1]}`;
  if (!u.includes("/") && u.toLowerCase().endsWith(".jpg")) {
    return `${PANORAMA}/${u}`;
  }
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) {
    return u;
  }
  return fallback;
}

function rewriteAssetUrl(url: string | undefined): string | undefined {
  if (!url || typeof url !== "string") return url;
  const u = url.trim();
  if (!u) return undefined;
  if (u.startsWith(ASSETS) || u.startsWith(`/media/${ORG}/${TOUR}/assets`)) {
    return u.startsWith("/") ? u : `/${u}`;
  }
  if (u.startsWith("assets/")) {
    return `${MEDIA}/${u}`;
  }
  // Already absolute other CDN — leave
  if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) {
    return u;
  }
  return u;
}

export const migratePilotMediaUrls = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    tourId: v.string(),
    scenesPatched: v.number(),
    hotspotsPatched: v.number(),
    brandingPatched: v.boolean(),
    sceneCount: v.number(),
    connectionCount: v.number(),
    sampleImageUrl: v.union(v.string(), v.null()),
    sampleNarrationUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token);
    const tour = await findTourByOrgAndSlug(ctx, {
      orgSlug: ORG,
      tourSlug: TOUR,
    });
    if (!tour) {
      throw new Error(`Tour ${ORG}/${TOUR} not found`);
    }

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();
    const hotspots = await ctx.db
      .query("hotspots")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();
    const connections = await ctx.db
      .query("connections")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .collect();

    let scenesPatched = 0;
    let hotspotsPatched = 0;
    let sampleImageUrl: string | null = null;
    let sampleNarrationUrl: string | null = null;

    for (const scene of scenes) {
      const nextImage = rewritePanoramaUrl(scene.imageUrl, scene.fileKey);
      const nextNarration = rewriteAssetUrl(scene.narrationUrl);
      const nextTranscript = rewriteAssetUrl(scene.transcriptUrl);
      const nextCaption = rewriteAssetUrl(scene.captionUrl);
      const nextTiming = rewriteAssetUrl(scene.timingUrl);

      const changed =
        nextImage !== scene.imageUrl ||
        nextNarration !== scene.narrationUrl ||
        nextTranscript !== scene.transcriptUrl ||
        nextCaption !== scene.captionUrl ||
        nextTiming !== scene.timingUrl;

      if (changed) {
        await ctx.db.patch(scene._id, {
          imageUrl: nextImage,
          ...(nextNarration !== undefined ? { narrationUrl: nextNarration } : {}),
          ...(nextTranscript !== undefined
            ? { transcriptUrl: nextTranscript }
            : {}),
          ...(nextCaption !== undefined ? { captionUrl: nextCaption } : {}),
          ...(nextTiming !== undefined ? { timingUrl: nextTiming } : {}),
        });
        scenesPatched += 1;
      }
      if (!sampleImageUrl) sampleImageUrl = nextImage;
      if (!sampleNarrationUrl && nextNarration) sampleNarrationUrl = nextNarration;
    }

    for (const h of hotspots) {
      const nextNarration = rewriteAssetUrl(h.narrationUrl);
      const nextTranscript = rewriteAssetUrl(h.transcriptUrl);
      const nextCaption = rewriteAssetUrl(h.captionUrl);
      const nextTiming = rewriteAssetUrl(h.timingUrl);
      const changed =
        nextNarration !== h.narrationUrl ||
        nextTranscript !== h.transcriptUrl ||
        nextCaption !== h.captionUrl ||
        nextTiming !== h.timingUrl;
      if (changed) {
        await ctx.db.patch(h._id, {
          ...(nextNarration !== undefined ? { narrationUrl: nextNarration } : {}),
          ...(nextTranscript !== undefined
            ? { transcriptUrl: nextTranscript }
            : {}),
          ...(nextCaption !== undefined ? { captionUrl: nextCaption } : {}),
          ...(nextTiming !== undefined ? { timingUrl: nextTiming } : {}),
        });
        hotspotsPatched += 1;
      }
    }

    let brandingPatched = false;
    const branding = await ctx.db
      .query("tourBrandings")
      .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
      .unique();
    if (branding?.fallbackImageUrl) {
      const next = rewritePanoramaUrl(
        branding.fallbackImageUrl,
        "R0010060_202503281449_YP00145909.JPG"
      );
      if (next !== branding.fallbackImageUrl) {
        await ctx.db.patch(branding._id, { fallbackImageUrl: next });
        brandingPatched = true;
      }
    }

    // Sanity: connections untouched
    if (connections.length === 0 && scenes.length > 1) {
      console.warn(
        "[migratePilotMediaUrls] warning: 0 connections (unexpected for piloto)"
      );
    }

    return {
      ok: true,
      tourId: tour._id,
      scenesPatched,
      hotspotsPatched,
      brandingPatched,
      sceneCount: scenes.length,
      connectionCount: connections.length,
      sampleImageUrl,
      sampleNarrationUrl,
    };
  },
});
