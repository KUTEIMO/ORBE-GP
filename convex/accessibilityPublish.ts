import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { requireUser, userCanEditTour } from "./lib/authHelpers";
import {
  evaluateAccessibilityPublishChecklist,
  type SceneA11yInput,
} from "./lib/a11yPublishChecklist";
import { applyA11yPackageToTour } from "./lib/applyA11yPackage";
import {
  FULL_CAMPUS_A11Y_PACKAGE,
  FULL_CAMPUS_A11Y_HOTSPOT_COUNT,
  FULL_CAMPUS_A11Y_SCENE_COUNT,
  PILOT_A11Y_TOUR_SLUG,
  type A11yPackagePayload,
} from "./lib/pilotA11yPackage";

const sceneA11yValidator = v.object({
  id: v.optional(v.string()),
  title: v.optional(v.string()),
  srSummary: v.optional(v.union(v.string(), v.null())),
  narration: v.optional(v.union(v.string(), v.null())),
  transcript: v.optional(v.union(v.string(), v.null())),
  captionFile: v.optional(v.union(v.string(), v.null())),
  narrationOptional: v.optional(v.boolean()),
  hotspots: v.optional(
    v.array(
      v.object({
        id: v.optional(v.string()),
        type: v.optional(v.string()),
        title: v.optional(v.string()),
        narration: v.optional(v.union(v.string(), v.null())),
        transcript: v.optional(v.union(v.string(), v.null())),
        captionFile: v.optional(v.union(v.string(), v.null())),
        narrationOptional: v.optional(v.boolean()),
      })
    )
  ),
});

const checklistResultValidator = v.object({
  ready: v.boolean(),
  sceneCount: v.number(),
  scenesWithSrSummary: v.number(),
  scenesWithNarrationOrOptional: v.number(),
  scenesWithTranscriptIfAudio: v.number(),
  infoHotspotsChecked: v.number(),
  infoHotspotsOk: v.number(),
  blockingIssues: v.array(v.string()),
  warnings: v.array(v.string()),
  checkedAt: v.number(),
});

const packageSceneEntryValidator = v.object({
  fileKey: v.optional(v.string()),
  srSummary: v.optional(v.string()),
  narrationOptional: v.optional(v.boolean()),
  narration: v.optional(v.string()),
  transcript: v.optional(v.string()),
  captionFile: v.optional(v.string()),
  timingFile: v.optional(v.string()),
  scriptFile: v.optional(v.string()),
  aliasOf: v.optional(v.string()),
});

const packageHotspotEntryValidator = v.object({
  sceneKey: v.optional(v.string()),
  srSummary: v.optional(v.string()),
  narrationOptional: v.optional(v.boolean()),
  narration: v.optional(v.string()),
  transcript: v.optional(v.string()),
  captionFile: v.optional(v.string()),
  timingFile: v.optional(v.string()),
  scriptFile: v.optional(v.string()),
});

const applyResultFields = {
  scenesUpdated: v.number(),
  hotspotsUpdated: v.number(),
  scenesCreated: v.number(),
  hotspotsCreated: v.number(),
  scenesMissing: v.array(v.string()),
  hotspotsMissing: v.array(v.string()),
  scenesSkippedAlias: v.array(v.string()),
  checklist: checklistResultValidator,
};

type DbCtx = QueryCtx | MutationCtx;

type SceneDoc = {
  _id: Id<"scenes">;
  fileKey: string;
  title: string;
  srSummary?: string;
  narrationUrl?: string;
  narrationOptional?: boolean;
  transcriptUrl?: string;
  captionUrl?: string;
  timingUrl?: string;
};

/** Scene participates in publish checklist only if it has real a11y metadata. */
function sceneHasA11yTracking(scene: SceneDoc): boolean {
  if (scene.srSummary && scene.srSummary.trim()) return true;
  if (scene.narrationUrl && scene.narrationUrl.trim()) return true;
  if (scene.transcriptUrl && scene.transcriptUrl.trim()) return true;
  if (scene.captionUrl && scene.captionUrl.trim()) return true;
  if (scene.timingUrl && scene.timingUrl.trim()) return true;
  if (scene.narrationOptional === true) return true;
  return false;
}

/**
 * Build checklist input from Convex scene/hotspot a11y fields (canonical SoT).
 * Spatial-only scenes (no a11y fields) are excluded — pilot scope after sync.
 * Empty tracked set → ready NO (never invent readiness).
 */
async function buildPackageScenesFromDb(
  ctx: DbCtx,
  tourId: Id<"tours">
): Promise<SceneA11yInput[]> {
  const scenes = await ctx.db
    .query("scenes")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  const allHotspots = await ctx.db
    .query("hotspots")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();

  const byScene = new Map<string, typeof allHotspots>();
  for (const h of allHotspots) {
    const key = String(h.sceneId);
    const list = byScene.get(key);
    if (list) list.push(h);
    else byScene.set(key, [h]);
  }

  const tracked = scenes.filter(sceneHasA11yTracking);

  return tracked.map((scene) => {
    const hotspots = byScene.get(String(scene._id)) ?? [];
    return {
      id: scene.fileKey,
      title: scene.title,
      srSummary: scene.srSummary ?? null,
      narration: scene.narrationUrl ?? null,
      transcript: scene.transcriptUrl ?? null,
      captionFile: scene.captionUrl ?? null,
      narrationOptional: scene.narrationOptional ?? false,
      hotspots: hotspots
        .filter((h) => h.type === "info")
        .filter((h) => h.narrationUrl || typeof h.narrationOptional === "boolean")
        .map((h) => ({
          id: h.clientKey,
          type: h.type,
          title: h.title,
          narration: h.narrationUrl ?? null,
          transcript: h.transcriptUrl ?? null,
          captionFile: h.captionUrl ?? null,
          narrationOptional: h.narrationOptional,
        })),
    };
  });
}

async function persistChecklistSnapshot(
  ctx: MutationCtx,
  tourId: Id<"tours">,
  result: ReturnType<typeof evaluateAccessibilityPublishChecklist>
): Promise<number> {
  const tour = await ctx.db.get(tourId);
  if (!tour) throw new Error("Tour no encontrado");
  const checkedAt = Date.now();
  const profile = tour.accessibilityProfile ?? {
    keyboard: true,
    screenReader: true,
    highContrast: true,
    captions: true,
  };
  await ctx.db.patch(tourId, {
    accessibilityProfile: {
      ...profile,
      publishChecklist: {
        ready: result.ready,
        checkedAt,
        sceneCount: result.sceneCount,
        scenesWithSrSummary: result.scenesWithSrSummary,
        scenesWithNarrationOrOptional: result.scenesWithNarrationOrOptional,
        scenesWithTranscriptIfAudio: result.scenesWithTranscriptIfAudio,
        blockingIssues: result.blockingIssues,
        warnings: result.warnings,
      },
    },
    updatedAt: checkedAt,
  });
  return checkedAt;
}

/**
 * Evaluate an a11y content package (authoring / import preview) without publishing.
 * Not the publish gate — use evaluateTourFromDb after sync.
 */
export const evaluatePackage = query({
  args: {
    scenes: v.array(sceneA11yValidator),
    requireCaptions: v.optional(v.boolean()),
  },
  returns: checklistResultValidator,
  handler: async (_ctx, args) => {
    const result = evaluateAccessibilityPublishChecklist({
      scenes: args.scenes as SceneA11yInput[],
      requireCaptions: args.requireCaptions,
    });
    return { ...result, checkedAt: 0 };
  },
});

/**
 * Canonical publish checklist from Convex scene/hotspot a11y fields (authz: tour editor).
 */
export const evaluateTourFromDb = query({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    requireCaptions: v.optional(v.boolean()),
  },
  returns: checklistResultValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await userCanEditTour(ctx, user, args.tourId))) {
      throw new Error("No autorizado para este tour");
    }

    const packageScenes = await buildPackageScenesFromDb(ctx, args.tourId);
    const result = evaluateAccessibilityPublishChecklist({
      scenes: packageScenes,
      requireCaptions: args.requireCaptions,
    });
    return { ...result, checkedAt: 0 };
  },
});

/**
 * Persist checklist snapshot on the tour (does not publish by itself).
 * Prefer deriving from DB; optional scenes arg is for preview/import tooling only.
 */
export const saveChecklistSnapshot = mutation({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    scenes: v.optional(v.array(sceneA11yValidator)),
    requireCaptions: v.optional(v.boolean()),
  },
  returns: checklistResultValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await userCanEditTour(ctx, user, args.tourId))) {
      throw new Error("No autorizado para este tour");
    }

    const scenesInput =
      args.scenes && args.scenes.length > 0
        ? (args.scenes as SceneA11yInput[])
        : await buildPackageScenesFromDb(ctx, args.tourId);

    const result = evaluateAccessibilityPublishChecklist({
      scenes: scenesInput,
      requireCaptions: args.requireCaptions,
    });
    const checkedAt = await persistChecklistSnapshot(ctx, args.tourId, result);
    return { ...result, checkedAt };
  },
});

/**
 * Import a11y package metadata into Convex scenes/hotspots (authz: tour editor).
 * Static package = authoring/TTS input; after import, DB is publish SoT.
 */
export const importA11yPackage = mutation({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    package: v.object({
      tourSlug: v.optional(v.string()),
      scenes: v.optional(v.record(v.string(), packageSceneEntryValidator)),
      hotspots: v.optional(v.record(v.string(), packageHotspotEntryValidator)),
    }),
    saveSnapshot: v.optional(v.boolean()),
    /** Create scene/hotspot stubs when fileKey/clientKey missing (piloto bootstrap). */
    createMissing: v.optional(v.boolean()),
  },
  returns: v.object(applyResultFields),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await userCanEditTour(ctx, user, args.tourId))) {
      throw new Error("No autorizado para este tour");
    }

    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new Error("Tour no encontrado");

    const pkg = args.package as A11yPackagePayload;
    if (pkg.tourSlug && pkg.tourSlug !== tour.slug) {
      throw new Error(
        `Paquete tourSlug "${pkg.tourSlug}" no coincide con tour "${tour.slug}"`
      );
    }

    const applied = await applyA11yPackageToTour(ctx, args.tourId, pkg, {
      createMissing: args.createMissing === true,
    });
    const packageScenes = await buildPackageScenesFromDb(ctx, args.tourId);
    const result = evaluateAccessibilityPublishChecklist({
      scenes: packageScenes,
      requireCaptions: false,
    });
    let checkedAt = 0;
    if (args.saveSnapshot !== false) {
      checkedAt = await persistChecklistSnapshot(ctx, args.tourId, result);
    }
    return {
      ...applied,
      checklist: { ...result, checkedAt },
    };
  },
});

async function syncEmbeddedCampusPackage(
  ctx: MutationCtx,
  tourId: Id<"tours">,
  saveSnapshot: boolean | undefined
) {
  const tour = await ctx.db.get(tourId);
  if (!tour) throw new Error("Tour no encontrado");
  if (tour.slug !== PILOT_A11Y_TOUR_SLUG) {
    throw new Error(
      `sync campus a11y solo aplica a ${PILOT_A11Y_TOUR_SLUG}`
    );
  }

  const applied = await applyA11yPackageToTour(
    ctx,
    tourId,
    FULL_CAMPUS_A11Y_PACKAGE,
    { createMissing: true }
  );
  const packageScenes = await buildPackageScenesFromDb(ctx, tourId);
  const result = evaluateAccessibilityPublishChecklist({
    scenes: packageScenes,
    requireCaptions: false,
  });
  let checkedAt = 0;
  if (saveSnapshot !== false) {
    checkedAt = await persistChecklistSnapshot(ctx, tourId, result);
  }
  return {
    ...applied,
    checklist: { ...result, checkedAt },
  };
}

/**
 * Sync embedded Unisimón full-campus TTS package into the tour (Phase 9).
 * Creates missing scene/hotspot stubs so DB becomes publish SoT.
 * Preferred name; use instead of syncPilotA11yPackage for new callers.
 */
export const syncCampusA11yPackage = mutation({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    saveSnapshot: v.optional(v.boolean()),
  },
  returns: v.object(applyResultFields),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await userCanEditTour(ctx, user, args.tourId))) {
      throw new Error("No autorizado para este tour");
    }
    return await syncEmbeddedCampusPackage(ctx, args.tourId, args.saveSnapshot);
  },
});

/**
 * @deprecated Phase 9 alias of syncCampusA11yPackage (full campus TTS, not 4-scene piloto).
 * Kept so seed / org-admin / QA callers keep working.
 */
export const syncPilotA11yPackage = mutation({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    saveSnapshot: v.optional(v.boolean()),
  },
  returns: v.object(applyResultFields),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await userCanEditTour(ctx, user, args.tourId))) {
      throw new Error("No autorizado para este tour");
    }
    return await syncEmbeddedCampusPackage(ctx, args.tourId, args.saveSnapshot);
  },
});

/** Metadata for admin/docs: expected full-campus embed sizes. */
export const getCampusA11yPackageMeta = query({
  args: {},
  returns: v.object({
    tourSlug: v.string(),
    sceneCount: v.number(),
    hotspotCount: v.number(),
  }),
  handler: async () => ({
    tourSlug: PILOT_A11Y_TOUR_SLUG,
    sceneCount: FULL_CAMPUS_A11Y_SCENE_COUNT,
    hotspotCount: FULL_CAMPUS_A11Y_HOTSPOT_COUNT,
  }),
});

/**
 * Publish / unpublish tour. Accessible claim always evaluates Convex DB fields
 * (never static package alone). forcePublish = spatial publish without a11y claim pass.
 */
export const setTourPublished = mutation({
  args: {
    token: v.string(),
    tourId: v.id("tours"),
    published: v.boolean(),
    /** If true, evaluate DB checklist and refuse publish when not ready. */
    requireAccessible: v.optional(v.boolean()),
    /**
     * @deprecated Phase 8: ignored for publish gate. Canonical SoT is Convex DB.
     * Kept optional so old clients do not break; prefer importA11yPackage first.
     */
    scenes: v.optional(v.array(sceneA11yValidator)),
    requireCaptions: v.optional(v.boolean()),
    /** Spatial publish without claiming a11y package complete. */
    forcePublish: v.optional(v.boolean()),
  },
  returns: v.object({
    published: v.boolean(),
    checklist: v.union(checklistResultValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (!(await userCanEditTour(ctx, user, args.tourId))) {
      throw new Error("No autorizado para este tour");
    }

    const tour = await ctx.db.get(args.tourId);
    if (!tour) throw new Error("Tour no encontrado");

    let checklist: {
      ready: boolean;
      sceneCount: number;
      scenesWithSrSummary: number;
      scenesWithNarrationOrOptional: number;
      scenesWithTranscriptIfAudio: number;
      infoHotspotsChecked: number;
      infoHotspotsOk: number;
      blockingIssues: string[];
      warnings: string[];
      checkedAt: number;
    } | null = null;

    if (args.published && args.requireAccessible) {
      // Canonical SoT: Convex fields only (Phase 8). Client `scenes` ignored.
      const scenesInput = await buildPackageScenesFromDb(ctx, args.tourId);
      const result = evaluateAccessibilityPublishChecklist({
        scenes: scenesInput,
        requireCaptions: args.requireCaptions,
      });
      const checkedAt = await persistChecklistSnapshot(ctx, args.tourId, result);
      checklist = { ...result, checkedAt };

      if (!result.ready && !args.forcePublish) {
        throw new Error(
          `Tour no listo para publicar como accesible: ${result.blockingIssues.slice(0, 3).join(" | ")}`
        );
      }
    }

    const now = Date.now();
    await ctx.db.patch(args.tourId, {
      published: args.published,
      updatedAt: now,
    });

    return { published: args.published, checklist };
  },
});
