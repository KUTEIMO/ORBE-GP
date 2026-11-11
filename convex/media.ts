import { mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, userCanEditTour } from "./lib/authHelpers";
import type { Doc, Id } from "./_generated/dataModel";
import {
  canonicalizeTourSlug,
  findOrganizationBySlug,
  normalizeSlug,
} from "./lib/tourResolve";
import { assertStorageFileMeta } from "./lib/urlSafety";
import { writeAuditLog } from "./audit";

const MAX_FILE_KEY_LEN = 180;

function sanitizeFileKey(raw: string): string {
  const base =
    raw
      .trim()
      .replace(/\\/g, "/")
      .split("/")
      .pop() || "panorama.jpg";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, MAX_FILE_KEY_LEN);
  return cleaned || `panorama-${Date.now()}.jpg`;
}

/**
 * Resolve tour by (organizationId | orgSlug) + tourSlug.
 * Never use global tours.by_slug alone (collides across orgs).
 */
async function resolveTourForMedia(
  ctx: MutationCtx,
  args: {
    tourSlug: string;
    organizationId?: Id<"organizations">;
    orgSlug?: string;
  }
): Promise<Doc<"tours">> {
  const tourSlug = canonicalizeTourSlug(normalizeSlug(args.tourSlug));
  if (!tourSlug) throw new Error("tourSlug requerido");

  let organizationId = args.organizationId;
  if (!organizationId && args.orgSlug) {
    const org = await findOrganizationBySlug(ctx, args.orgSlug);
    if (!org) throw new Error("Organización no encontrada");
    organizationId = org._id;
  }
  if (!organizationId) {
    throw new Error(
      "organizationId u orgSlug requerido (media no resuelve por slug global)"
    );
  }
  const orgId = organizationId;

  const tour = await ctx.db
    .query("tours")
    .withIndex("by_org_and_slug", (q) =>
      q.eq("organizationId", orgId).eq("slug", tourSlug)
    )
    .unique();
  if (!tour) throw new Error("Tour no encontrado en esta organización");
  return tour;
}

/**
 * Logical object key for future object-storage/CDN migration.
 * Convex File Storage uses opaque storageIds today; this path is the
 * portable ownership contract: orgs/{organizationId}/tours/{tourId}/panoramas/{fileKey}
 */
export function buildPanoramaObjectKey(
  organizationId: Id<"organizations">,
  tourId: Id<"tours">,
  fileKey: string
): string {
  return `orgs/${organizationId}/tours/${tourId}/panoramas/${fileKey}`;
}

/**
 * Genera URL de subida scoped a un tour (authz = membership / superadmin).
 * Retorna ownership explícito para que el cliente y futuros backends
 * (R2/S3) no asuman carpetas compartidas sin tenant.
 */
export const generateUploadUrl = mutation({
  args: {
    token: v.string(),
    tourSlug: v.string(),
    /** Required with tourSlug — prefer this over orgSlug when known. */
    organizationId: v.optional(v.id("organizations")),
    /** Alternative to organizationId when only path slug is known. */
    orgSlug: v.optional(v.string()),
  },
  returns: v.object({
    uploadUrl: v.string(),
    tourId: v.id("tours"),
    organizationId: v.id("organizations"),
    objectKeyPrefix: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const tour = await resolveTourForMedia(ctx, {
      tourSlug: args.tourSlug,
      organizationId: args.organizationId,
      orgSlug: args.orgSlug,
    });
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado para subir media a este tour");
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return {
      uploadUrl,
      tourId: tour._id,
      organizationId: tour.organizationId,
      objectKeyPrefix: `orgs/${tour.organizationId}/tours/${tour._id}/panoramas`,
    };
  },
});

export const attachPanoramaToScene = mutation({
  args: {
    token: v.string(),
    tourSlug: v.string(),
    fileKey: v.string(),
    storageId: v.id("_storage"),
    title: v.optional(v.string()),
    shortTitle: v.optional(v.string()),
    zone: v.optional(v.string()),
    sede: v.optional(v.string()),
    altText: v.optional(v.string()),
    longDescription: v.optional(v.string()),
    organizationId: v.optional(v.id("organizations")),
    orgSlug: v.optional(v.string()),
  },
  returns: v.object({
    sceneId: v.id("scenes"),
    fileKey: v.string(),
    imageUrl: v.string(),
    organizationId: v.id("organizations"),
    tourId: v.id("tours"),
    objectKey: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const tour = await resolveTourForMedia(ctx, {
      tourSlug: args.tourSlug,
      organizationId: args.organizationId,
      orgSlug: args.orgSlug,
    });
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado");
    }

    await assertStorageFileMeta(ctx, args.storageId, "image");
    const fileKey = sanitizeFileKey(args.fileKey);
    const objectKey = buildPanoramaObjectKey(
      tour.organizationId,
      tour._id,
      fileKey
    );
    const imageUrl = await ctx.storage.getUrl(args.storageId);
    if (!imageUrl) throw new Error("No se pudo resolver URL del archivo");

    const existing = await ctx.db
      .query("scenes")
      .withIndex("by_tour_and_file", (q) =>
        q.eq("tourId", tour._id).eq("fileKey", fileKey)
      )
      .unique();

    const now = Date.now();
    const title = args.title || existing?.title || fileKey;
    const shortTitle = args.shortTitle || existing?.shortTitle || title;
    const zone = args.zone !== undefined ? args.zone : existing?.zone;
    const sede = args.sede !== undefined ? args.sede : existing?.sede;
    const altText =
      args.altText !== undefined ? args.altText : existing?.altText || title;
    const longDescription =
      args.longDescription !== undefined
        ? args.longDescription
        : existing?.longDescription;
    let sceneId;
    if (existing) {
      // Never allow cross-tenant scene patch: existing must already belong to this tour/org.
      if (existing.organizationId !== tour.organizationId) {
        throw new Error("Escena pertenece a otra organización");
      }
      await ctx.db.patch(existing._id, {
        imageUrl,
        storageId: args.storageId,
        title,
        shortTitle,
        zone,
        sede,
        altText,
        longDescription,
        updatedAt: now,
      });
      sceneId = existing._id;
    } else {
      const allScenes = await ctx.db
        .query("scenes")
        .withIndex("by_tour_and_file", (q) => q.eq("tourId", tour._id))
        .collect();
      const maxOrder = allScenes.reduce(
        (m, s) => (s.order > m ? s.order : m),
        -1
      );
      sceneId = await ctx.db.insert("scenes", {
        tourId: tour._id,
        organizationId: tour.organizationId,
        fileKey,
        title,
        shortTitle,
        zone,
        sede,
        order: maxOrder + 1,
        imageUrl,
        storageId: args.storageId,
        altText,
        longDescription,
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.insert("assets", {
      organizationId: tour.organizationId,
      tourId: tour._id,
      kind: "panorama",
      label: title,
      url: imageUrl,
      storageId: args.storageId,
      objectKey,
      createdAt: now,
    });

    await ctx.db.patch(tour._id, { updatedAt: now });
    await writeAuditLog(ctx, {
      user,
      organizationId: tour.organizationId,
      tourId: tour._id,
      action: "media:attachPanorama",
      target: fileKey,
      detail: title,
    });
    return {
      sceneId,
      fileKey,
      imageUrl,
      organizationId: tour.organizationId,
      tourId: tour._id,
      objectKey,
    };
  },
});

const a11yPatchReturnValidator = v.object({
  srSummary: v.optional(v.string()),
  narrationUrl: v.optional(v.string()),
  narrationOptional: v.optional(v.boolean()),
  transcriptUrl: v.optional(v.string()),
  captionUrl: v.optional(v.string()),
  timingUrl: v.optional(v.string()),
});

export const attachSceneA11y = mutation({
  args: {
    token: v.string(),
    tourSlug: v.string(),
    orgSlug: v.string(),
    fileKey: v.string(),
    srSummary: v.optional(v.string()),
    narrationOptional: v.optional(v.boolean()),
    narrationStorageId: v.optional(v.id("_storage")),
    captionStorageId: v.optional(v.id("_storage")),
    transcriptStorageId: v.optional(v.id("_storage")),
    timingStorageId: v.optional(v.id("_storage")),
    clearNarration: v.optional(v.boolean()),
    clearCaption: v.optional(v.boolean()),
  },
  returns: a11yPatchReturnValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const tour = await resolveTourForMedia(ctx, {
      tourSlug: args.tourSlug,
      orgSlug: args.orgSlug,
    });
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado para editar accesibilidad de este tour");
    }

    const scene = await ctx.db
      .query("scenes")
      .withIndex("by_tour_and_file", (q) =>
        q.eq("tourId", tour._id).eq("fileKey", args.fileKey)
      )
      .unique();
    if (!scene) throw new Error(`Escena no encontrada: ${args.fileKey}`);

    if (args.narrationStorageId) {
      await assertStorageFileMeta(ctx, args.narrationStorageId, "audio");
    }
    if (args.captionStorageId) {
      await assertStorageFileMeta(ctx, args.captionStorageId, "text");
    }
    if (args.transcriptStorageId) {
      await assertStorageFileMeta(ctx, args.transcriptStorageId, "text");
    }
    if (args.timingStorageId) {
      await assertStorageFileMeta(ctx, args.timingStorageId, "text");
    }

    const now = Date.now();
    const narrationUrl = args.clearNarration
      ? undefined
      : args.narrationStorageId
        ? (await ctx.storage.getUrl(args.narrationStorageId)) ?? undefined
        : scene.narrationUrl;
    const captionUrl = args.captionStorageId
      ? (await ctx.storage.getUrl(args.captionStorageId)) ?? undefined
      : args.clearCaption
        ? undefined
        : scene.captionUrl;
    const transcriptUrl = args.transcriptStorageId
      ? (await ctx.storage.getUrl(args.transcriptStorageId)) ?? undefined
      : scene.transcriptUrl;
    const timingUrl = args.timingStorageId
      ? (await ctx.storage.getUrl(args.timingStorageId)) ?? undefined
      : args.clearCaption
        ? undefined
        : scene.timingUrl;
    const srSummary =
      typeof args.srSummary === "string"
        ? args.srSummary.trim() || undefined
        : scene.srSummary;
    const narrationOptional =
      typeof args.narrationOptional === "boolean"
        ? args.narrationOptional
        : scene.narrationOptional;

    await ctx.db.patch(scene._id, {
      srSummary,
      narrationOptional,
      narrationUrl,
      captionUrl,
      transcriptUrl,
      timingUrl,
      updatedAt: now,
    });

    if (args.narrationStorageId && narrationUrl) {
      await ctx.db.insert("assets", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        kind: "audio",
        label: `${scene.title} (narración)`,
        url: narrationUrl,
        storageId: args.narrationStorageId,
        objectKey: `orgs/${tour.organizationId}/tours/${tour._id}/assets/audio/${scene.fileKey}`,
        createdAt: now,
      });
    }
    if (args.captionStorageId && captionUrl) {
      await ctx.db.insert("assets", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        kind: "caption",
        label: `${scene.title} (VTT)`,
        url: captionUrl,
        storageId: args.captionStorageId,
        objectKey: `orgs/${tour.organizationId}/tours/${tour._id}/assets/captions/${scene.fileKey}.vtt`,
        createdAt: now,
      });
    }
    if (args.transcriptStorageId && transcriptUrl) {
      await ctx.db.insert("assets", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        kind: "transcript",
        label: `${scene.title} (TXT)`,
        url: transcriptUrl,
        storageId: args.transcriptStorageId,
        objectKey: `orgs/${tour.organizationId}/tours/${tour._id}/assets/transcripts/${scene.fileKey}.txt`,
        createdAt: now,
      });
    }

    await ctx.db.patch(tour._id, { updatedAt: now });
    return {
      srSummary,
      narrationUrl,
      narrationOptional,
      transcriptUrl,
      captionUrl,
      timingUrl,
    };
  },
});

export const attachHotspotA11y = mutation({
  args: {
    token: v.string(),
    tourSlug: v.string(),
    orgSlug: v.string(),
    hotspotClientKey: v.string(),
    srSummary: v.optional(v.string()),
    narrationOptional: v.optional(v.boolean()),
    narrationStorageId: v.optional(v.id("_storage")),
    captionStorageId: v.optional(v.id("_storage")),
    transcriptStorageId: v.optional(v.id("_storage")),
    timingStorageId: v.optional(v.id("_storage")),
    clearNarration: v.optional(v.boolean()),
    clearCaption: v.optional(v.boolean()),
  },
  returns: a11yPatchReturnValidator,
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const tour = await resolveTourForMedia(ctx, {
      tourSlug: args.tourSlug,
      orgSlug: args.orgSlug,
    });
    if (!(await userCanEditTour(ctx, user, tour._id))) {
      throw new Error("No autorizado para editar accesibilidad de este tour");
    }

    const hotspot = await ctx.db
      .query("hotspots")
      .withIndex("by_client_key", (q) =>
        q.eq("tourId", tour._id).eq("clientKey", args.hotspotClientKey)
      )
      .unique();
    if (!hotspot) {
      throw new Error(
        `Hotspot no encontrado en Convex (${args.hotspotClientKey}). Pulsa "Guardar cambios" primero si acabas de crearlo.`
      );
    }

    if (args.narrationStorageId) {
      await assertStorageFileMeta(ctx, args.narrationStorageId, "audio");
    }
    if (args.captionStorageId) {
      await assertStorageFileMeta(ctx, args.captionStorageId, "text");
    }
    if (args.transcriptStorageId) {
      await assertStorageFileMeta(ctx, args.transcriptStorageId, "text");
    }
    if (args.timingStorageId) {
      await assertStorageFileMeta(ctx, args.timingStorageId, "text");
    }

    const now = Date.now();
    const narrationUrl = args.clearNarration
      ? undefined
      : args.narrationStorageId
        ? (await ctx.storage.getUrl(args.narrationStorageId)) ?? undefined
        : hotspot.narrationUrl;
    const captionUrl = args.captionStorageId
      ? (await ctx.storage.getUrl(args.captionStorageId)) ?? undefined
      : args.clearCaption
        ? undefined
        : hotspot.captionUrl;
    const transcriptUrl = args.transcriptStorageId
      ? (await ctx.storage.getUrl(args.transcriptStorageId)) ?? undefined
      : hotspot.transcriptUrl;
    const timingUrl = args.timingStorageId
      ? (await ctx.storage.getUrl(args.timingStorageId)) ?? undefined
      : args.clearCaption
        ? undefined
        : hotspot.timingUrl;
    const srSummary =
      typeof args.srSummary === "string"
        ? args.srSummary.trim() || undefined
        : hotspot.srSummary;
    const narrationOptional =
      typeof args.narrationOptional === "boolean"
        ? args.narrationOptional
        : hotspot.narrationOptional;

    await ctx.db.patch(hotspot._id, {
      srSummary,
      narrationOptional,
      narrationUrl,
      captionUrl,
      transcriptUrl,
      timingUrl,
      updatedAt: now,
    });

    if (args.narrationStorageId && narrationUrl) {
      await ctx.db.insert("assets", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        kind: "audio",
        label: `${hotspot.title} (narración)`,
        url: narrationUrl,
        storageId: args.narrationStorageId,
        objectKey: `orgs/${tour.organizationId}/tours/${tour._id}/assets/hotspots/${hotspot.clientKey}`,
        createdAt: now,
      });
    }
    if (args.captionStorageId && captionUrl) {
      await ctx.db.insert("assets", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        kind: "caption",
        label: `${hotspot.title} (VTT)`,
        url: captionUrl,
        storageId: args.captionStorageId,
        objectKey: `orgs/${tour.organizationId}/tours/${tour._id}/assets/hotspots/${hotspot.clientKey}.vtt`,
        createdAt: now,
      });
    }
    if (args.transcriptStorageId && transcriptUrl) {
      await ctx.db.insert("assets", {
        organizationId: tour.organizationId,
        tourId: tour._id,
        kind: "transcript",
        label: `${hotspot.title} (TXT)`,
        url: transcriptUrl,
        storageId: args.transcriptStorageId,
        objectKey: `orgs/${tour.organizationId}/tours/${tour._id}/assets/hotspots/${hotspot.clientKey}.txt`,
        createdAt: now,
      });
    }

    await ctx.db.patch(tour._id, { updatedAt: now });
    await writeAuditLog(ctx, {
      user,
      organizationId: tour.organizationId,
      tourId: tour._id,
      action: "media:attachHotspotA11y",
      target: hotspot.clientKey,
      detail: hotspot.title,
    });
    return {
      srSummary,
      narrationUrl,
      narrationOptional,
      transcriptUrl,
      captionUrl,
      timingUrl,
    };
  },
});
