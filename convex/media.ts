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

  const tour = await ctx.db
    .query("tours")
    .withIndex("by_org_and_slug", (q) =>
      q.eq("organizationId", organizationId!).eq("slug", tourSlug)
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
    const zone = args.zone || existing?.zone;
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
        altText: title,
        updatedAt: now,
      });
      sceneId = existing._id;
    } else {
      const order = (
        await ctx.db
          .query("scenes")
          .withIndex("by_tour", (q) => q.eq("tourId", tour._id))
          .collect()
      ).length;
      sceneId = await ctx.db.insert("scenes", {
        tourId: tour._id,
        organizationId: tour.organizationId,
        fileKey,
        title,
        shortTitle,
        zone,
        order,
        imageUrl,
        storageId: args.storageId,
        altText: title,
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
