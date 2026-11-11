import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  hashPassword,
  randomToken,
  requireSuperadmin,
} from "./lib/authHelpers";
import { ORBE_SANDBOX_BRANDING, upsertBrandingDoc } from "./lib/branding";
import type { Id } from "./_generated/dataModel";

const ORG_SLUG = "orbe";
const TOUR_SLUG = "sandbox";
/** Site-root absolute path — never relative (would resolve under /orbe/sandbox/…). */
const MEDIA_PREFIX = "/media/orbe/sandbox/panoramas";

/** Small representative subset — files must exist under MEDIA_PREFIX after seed script copy. */
const SANDBOX_SCENES = [
  {
    fileKey: "R0010060_202503281449_YP00145909.JPG",
    title: "Entrada principal",
    shortTitle: "Entrada",
    zone: "acceso",
  },
  {
    fileKey: "R0010061_202503281452_YP00145909.JPG",
    title: "Hall de ingreso",
    shortTitle: "Hall",
    zone: "acceso",
  },
  {
    fileKey: "R0010062_202503281454_YP00145909.JPG",
    title: "Pasillo principal",
    shortTitle: "Pasillo",
    zone: "circulacion",
  },
  {
    fileKey: "R0010066_202503281503_YP00145909.JPG",
    title: "Zona de descanso",
    shortTitle: "Descanso",
    zone: "servicios",
  },
] as const;

/**
 * Idempotent: org `orbe` + tour slug `sandbox` + Soft Clay branding + 4 scenes + sample
 * P1 hotspots. Visible name: «Espacio de pruebas Orbe» (slug unchanged — AGENTS.md).
 * Does NOT touch Unisimón / experienciavirtual.
 *
 * Requires superadmin session. Assets: run `node scripts/seed-orbe-sandbox.mjs`
 * (copies panoramas then calls this mutation).
 */
function sandboxEnvGet(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return proc?.env?.[name];
}

export const seedOrbeSandbox = mutation({
  args: {
    token: v.string(),
    adminPassword: v.optional(v.string()),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    tourId: v.id("tours"),
    orgSlug: v.string(),
    tourSlug: v.string(),
    scenesUpserted: v.number(),
    adminEmail: v.string(),
    createdOrg: v.boolean(),
    createdTour: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token);
    const now = Date.now();

    let createdOrg = false;
    const existingOrg = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", ORG_SLUG))
      .unique();
    let orgId: Id<"organizations">;
    if (!existingOrg) {
      orgId = await ctx.db.insert("organizations", {
        name: "Orbe360",
        slug: ORG_SLUG,
        description:
          "Organización first-party de Orbe360 para el espacio de pruebas del editor.",
        createdAt: now,
      });
      createdOrg = true;
    } else {
      orgId = existingOrg._id;
      await ctx.db.patch(orgId, {
        description:
          "Organización first-party de Orbe360 para el espacio de pruebas del editor.",
      });
    }

    let createdTour = false;
    const existingTour = await ctx.db
      .query("tours")
      .withIndex("by_org_and_slug", (q) =>
        q.eq("organizationId", orgId).eq("slug", TOUR_SLUG)
      )
      .unique();
    let tourId: Id<"tours">;
    if (!existingTour) {
      tourId = await ctx.db.insert("tours", {
        organizationId: orgId,
        slug: TOUR_SLUG,
        title: "Espacio de pruebas Orbe",
        shortTitle: "Pruebas",
        published: true,
        defaultSceneKey: SANDBOX_SCENES[0].fileKey,
        accessibilityProfile: {
          keyboard: true,
          screenReader: true,
          highContrast: true,
          captions: true,
        },
        createdAt: now,
        updatedAt: now,
      });
      createdTour = true;
    } else {
      tourId = existingTour._id;
      await ctx.db.patch(tourId, {
        title: "Espacio de pruebas Orbe",
        shortTitle: "Pruebas",
        published: true,
        defaultSceneKey: SANDBOX_SCENES[0].fileKey,
        updatedAt: now,
      });
    }

    await upsertBrandingDoc(ctx, {
      tourId,
      organizationId: orgId,
      branding: ORBE_SANDBOX_BRANDING,
    });

    const adminEmail = "admin@orbe.local";
    const existingAdmin = await ctx.db
      .query("platformUsers")
      .withIndex("by_email", (q) => q.eq("email", adminEmail))
      .unique();
    let adminId: Id<"platformUsers">;
    if (!existingAdmin) {
      const configuredPass =
        args.adminPassword ||
        sandboxEnvGet("SEED_SANDBOX_PASSWORD") ||
        (sandboxEnvGet("ALLOW_OPEN_SEED") === "1" ? "OrbeSandbox2026!" : undefined);
      if (!configuredPass || configuredPass.length < 10) {
        throw new Error(
          "Falta SEED_SANDBOX_PASSWORD (mínimo 10 caracteres) para crear admin@orbe.local."
        );
      }
      const salt = randomToken().slice(0, 16);
      const passwordHash = await hashPassword(configuredPass, salt);
      adminId = await ctx.db.insert("platformUsers", {
        email: adminEmail,
        name: "Admin Orbe",
        passwordHash,
        passwordSalt: salt,
        isSuperadmin: false,
        active: true,
        createdAt: now,
      });
    } else {
      adminId = existingAdmin._id;
    }
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_user_and_org", (q) =>
        q.eq("userId", adminId).eq("organizationId", orgId)
      )
      .unique();
    if (!membership) {
      await ctx.db.insert("memberships", {
        userId: adminId,
        organizationId: orgId,
        role: "orgAdmin",
        createdAt: now,
      });
    }

    const fileToSceneId = new Map<string, Id<"scenes">>();
    let scenesUpserted = 0;
    for (let i = 0; i < SANDBOX_SCENES.length; i++) {
      const spec = SANDBOX_SCENES[i];
      if (!spec) continue;
      const imageUrl = `${MEDIA_PREFIX}/${spec.fileKey}`;
      const existing = await ctx.db
        .query("scenes")
        .withIndex("by_tour_and_file", (q) =>
          q.eq("tourId", tourId).eq("fileKey", spec.fileKey)
        )
        .unique();
      let sceneId: Id<"scenes">;
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: spec.title,
          shortTitle: spec.shortTitle,
          zone: spec.zone,
          order: i,
          imageUrl,
          altText: spec.title,
          updatedAt: now,
        });
        sceneId = existing._id;
      } else {
        sceneId = await ctx.db.insert("scenes", {
          tourId,
          organizationId: orgId,
          fileKey: spec.fileKey,
          title: spec.title,
          shortTitle: spec.shortTitle,
          zone: spec.zone,
          order: i,
          imageUrl,
          altText: spec.title,
          createdAt: now,
          updatedAt: now,
        });
      }
      fileToSceneId.set(spec.fileKey, sceneId);
      scenesUpserted += 1;

      // Replace hotspots only for sandbox scenes we own (never Unisimón).
      const oldHs = await ctx.db
        .query("hotspots")
        .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
        .collect();
      for (const h of oldHs) await ctx.db.delete(h._id);
    }

    // Tiny sample nav: Entrada → Hall → Pasillo (not full campus graph).
    const oldConns = await ctx.db
      .query("connections")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .collect();
    for (const c of oldConns) await ctx.db.delete(c._id);

    const edges: Array<{ from: string; to: string; label: string; yaw: number }> =
      [
        {
          from: SANDBOX_SCENES[0].fileKey,
          to: SANDBOX_SCENES[1].fileKey,
          label: "Ir al Hall",
          yaw: 0.2,
        },
        {
          from: SANDBOX_SCENES[1].fileKey,
          to: SANDBOX_SCENES[2].fileKey,
          label: "Ir al Pasillo",
          yaw: 0.4,
        },
        {
          from: SANDBOX_SCENES[2].fileKey,
          to: SANDBOX_SCENES[3].fileKey,
          label: "Ir a Descanso",
          yaw: -0.3,
        },
      ];

    for (const edge of edges) {
      const fromId = fileToSceneId.get(edge.from);
      const toId = fileToSceneId.get(edge.to);
      if (!fromId || !toId) continue;
      const navKey = `sandbox-nav-${edge.from}-${edge.to}`;
      await ctx.db.insert("hotspots", {
        tourId,
        sceneId: fromId,
        clientKey: navKey,
        type: "nav",
        title: edge.label,
        yaw: edge.yaw,
        pitch: -0.05,
        direction: "forward",
        targetFileKey: edge.to,
        iconKey: "drone",
        category: "navigation",
        animationPreset: "none",
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("connections", {
        tourId,
        fromSceneId: fromId,
        toSceneId: toId,
        direction: "forward",
        label: edge.label,
        createdAt: now,
      });
    }

    // Demo info pins with P1 visuals on entrada (user can edit in Control Web).
    const entradaId = fileToSceneId.get(SANDBOX_SCENES[0].fileKey);
    const demos = [
      {
        clientKey: "sandbox-info-bath",
        title: "Baños",
        yaw: -0.8,
        pitch: -0.1,
        iconKey: "bath" as const,
        category: "facilities" as const,
        animationPreset: "pulse" as const,
      },
      {
        clientKey: "sandbox-info-medical",
        title: "Primeros auxilios",
        yaw: 1.1,
        pitch: -0.05,
        iconKey: "medical" as const,
        category: "medical" as const,
        animationPreset: "pulse" as const,
      },
      {
        clientKey: "sandbox-info-pin",
        title: "Punto de encuentro",
        yaw: 0.6,
        pitch: 0.05,
        iconKey: "pin" as const,
        category: "general" as const,
        animationPreset: "none" as const,
      },
    ];
    if (entradaId) {
      for (const d of demos) {
        await ctx.db.insert("hotspots", {
          tourId,
          sceneId: entradaId,
          clientKey: d.clientKey,
          type: "info",
          title: d.title,
          yaw: d.yaw,
          pitch: d.pitch,
          description: `${d.title}. Editable en Control Web.`,
          iconKey: d.iconKey,
          category: d.category,
          animationPreset: d.animationPreset,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return {
      organizationId: orgId,
      tourId,
      orgSlug: ORG_SLUG,
      tourSlug: TOUR_SLUG,
      scenesUpserted,
      adminEmail,
      createdOrg,
      createdTour,
    };
  },
});
