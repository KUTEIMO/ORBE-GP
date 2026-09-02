import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Plataforma multi-organización de tours 360° inclusivos.
 * Primer seed: Unisimón Cúcuta (PEVCI).
 */
export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    /**
     * Soft tour quota for the org (superadmin-set).
     * Absent / undefined = unlimited. Enforced in createTour.
     */
    maxTours: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_slug", ["slug"]),

  platformUsers: defineTable({
    email: v.string(),
    name: v.string(),
    passwordHash: v.string(),
    passwordSalt: v.string(),
    isSuperadmin: v.boolean(),
    active: v.boolean(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  memberships: defineTable({
    userId: v.id("platformUsers"),
    organizationId: v.id("organizations"),
    role: v.union(v.literal("orgAdmin"), v.literal("tourEditor")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_org", ["organizationId"])
    .index("by_user_and_org", ["userId", "organizationId"]),

  sessions: defineTable({
    userId: v.id("platformUsers"),
    token: v.string(),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  /** Anti fuerza-bruta login (Sprint 4). */
  loginAttempts: defineTable({
    email: v.string(),
    count: v.number(),
    windowStart: v.number(),
  }).index("by_email", ["email"]),

  tours: defineTable({
    organizationId: v.id("organizations"),
    slug: v.string(),
    title: v.string(),
    shortTitle: v.optional(v.string()),
    published: v.boolean(),
    defaultSceneKey: v.optional(v.string()),
    accessibilityProfile: v.optional(
      v.object({
        keyboard: v.boolean(),
        screenReader: v.boolean(),
        highContrast: v.boolean(),
        captions: v.boolean(),
        /** T-P0-8 — last publish-readiness evaluation (not a marketing boolean alone). */
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_org", ["organizationId"])
    .index("by_org_and_slug", ["organizationId", "slug"])
    .index("by_published", ["published"]),

  scenes: defineTable({
    tourId: v.id("tours"),
    organizationId: v.id("organizations"),
    fileKey: v.string(),
    title: v.string(),
    shortTitle: v.string(),
    zone: v.optional(v.string()),
    order: v.number(),
    imageUrl: v.string(),
    altText: v.string(),
    longDescription: v.optional(v.string()),
    /** Short SR announcement (Canal 1); not the long editorial description. */
    srSummary: v.optional(v.string()),
    /** Relative or CDN URL to narration audio; null/absent = none. */
    narrationUrl: v.optional(v.string()),
    narrationOptional: v.optional(v.boolean()),
    transcriptUrl: v.optional(v.string()),
    captionUrl: v.optional(v.string()),
    timingUrl: v.optional(v.string()),
    /**
     * Vista frontal / Adelante del visitante (radians).
     * Hotspot yaw/pitch stay in image coords — this only sets look-at on enter.
     * Missing ⇒ { yaw: 0, pitch: 0, fov: π/2 }.
     */
    initialView: v.optional(
      v.object({
        yaw: v.number(),
        pitch: v.number(),
        fov: v.optional(v.number()),
      })
    ),
    storageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tour", ["tourId"])
    .index("by_tour_and_file", ["tourId", "fileKey"]),

  hotspots: defineTable({
    tourId: v.id("tours"),
    sceneId: v.id("scenes"),
    clientKey: v.string(),
    type: v.union(v.literal("nav"), v.literal("info")),
    title: v.string(),
    yaw: v.number(),
    pitch: v.number(),
    direction: v.optional(v.string()),
    targetSceneId: v.optional(v.id("scenes")),
    targetFileKey: v.optional(v.string()),
    description: v.optional(v.string()),
    srSummary: v.optional(v.string()),
    narrationUrl: v.optional(v.string()),
    narrationOptional: v.optional(v.boolean()),
    transcriptUrl: v.optional(v.string()),
    captionUrl: v.optional(v.string()),
    timingUrl: v.optional(v.string()),
    weight: v.optional(v.number()),
    /** P1 visual: catalog key (baño, pin, medical, …). Absent → type default. */
    iconKey: v.optional(
      v.union(
        v.literal("nav"),
        v.literal("info"),
        v.literal("pin"),
        v.literal("bath"),
        v.literal("medical"),
        v.literal("transport"),
        v.literal("drone"),
        v.literal("expo"),
        v.literal("wardrobe")
      )
    ),
    /** P1 visual: category for chip color / future HUD filters. */
    category: v.optional(
      v.union(
        v.literal("general"),
        v.literal("facilities"),
        v.literal("medical"),
        v.literal("transport"),
        v.literal("expo"),
        v.literal("navigation")
      )
    ),
    /** P1 visual: CSS animation preset (`none` | `pulse`). */
    animationPreset: v.optional(
      v.union(v.literal("none"), v.literal("pulse"))
    ),
    /** Optional CSS hex override for chip accent. */
    accentColor: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_tour", ["tourId"])
    .index("by_client_key", ["tourId", "clientKey"]),

  connections: defineTable({
    tourId: v.id("tours"),
    fromSceneId: v.id("scenes"),
    toSceneId: v.id("scenes"),
    hotspotId: v.optional(v.id("hotspots")),
    direction: v.optional(v.string()),
    label: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tour", ["tourId"])
    .index("by_from", ["fromSceneId"]),

  assets: defineTable({
    organizationId: v.id("organizations"),
    tourId: v.optional(v.id("tours")),
    kind: v.union(
      v.literal("panorama"),
      v.literal("thumb"),
      v.literal("audio"),
      v.literal("transcript"),
      v.literal("caption"),
      v.literal("other")
    ),
    label: v.string(),
    url: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    /** Portable key for future R2/S3/CDN: orgs/{orgId}/tours/{tourId}/… */
    objectKey: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tour", ["tourId"])
    .index("by_org", ["organizationId"])
    .index("by_object_key", ["objectKey"]),

  /**
   * White-label identity of a client tour (not Orbe360 platform chrome).
   * Platform tokens live in plataforma/tokens.css; viewer chrome reads these fields.
   */
  tourBrandings: defineTable({
    tourId: v.id("tours"),
    organizationId: v.id("organizations"),
    clientName: v.string(),
    clientShortName: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    /** CSS hex, e.g. #0a7a45 — applied as --brand on the viewer (per-tour data) */
    primaryColor: v.string(),
    primaryStrong: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    metaTitle: v.string(),
    metaDescription: v.string(),
    showPoweredByOrbe360: v.boolean(),
    fallbackImageUrl: v.optional(v.string()),
    headerTitle: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tour", ["tourId"])
    .index("by_org", ["organizationId"]),
});
