import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, randomToken, requireSuperadmin } from "./lib/authHelpers";
import {
  UNISIMON_BRANDING_SEED,
  brandingLooksLikeOrbePlatform,
  getBrandingByTourId,
  upsertBrandingDoc,
} from "./lib/branding";
import { applyA11yPackageToTour } from "./lib/applyA11yPackage";
import { applySpatialPackageToTour } from "./lib/applySpatialPackage";
import { CAMPUS_SPATIAL_PACKAGE } from "./lib/campusSpatialPackage";
import { FULL_CAMPUS_A11Y_PACKAGE } from "./lib/pilotA11yPackage";
import {
  PILOT_ORG_SLUG,
  PILOT_TOUR_SLUG,
  migratePilotSlugsIfNeeded,
} from "./lib/tourResolve";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/**
 * Best-effort sync: spatial graph first (nav/yaw), then full-campus TTS a11y.
 * Spatial preserves existing a11y; a11y pass re-applies narration URLs (Phase 9/10).
 */
async function syncCampusA11yIfPossible(
  ctx: MutationCtx,
  tourId: Id<"tours">
): Promise<void> {
  await applySpatialPackageToTour(ctx, tourId, CAMPUS_SPATIAL_PACKAGE);
  await applyA11yPackageToTour(ctx, tourId, FULL_CAMPUS_A11Y_PACKAGE, {
    createMissing: true,
  });
}

/**
 * Seed idempotente: org Unisimón + tour + 2 usuarios demo.
 *
 * Public / DB slugs (P0):
 * - organizations.slug = unisimoncucuta
 * - tours.slug         = experienciavirtual
 * Re-seed migrates legacy unisimon-cucuta / unisimon-campus **in place**
 * (patch only — never deletes scenes/hotspots/connections).
 *
 * Credenciales: NO se guardan en el repo. El bootstrap exige variables de entorno
 * en el deployment Convex (`npx convex env set …`) y falla si faltan:
 * - superadmin@orbe360.local → SEED_SUPERADMIN_PASSWORD
 * - admin@unisimon.local     → SEED_ORGADMIN_PASSWORD
 * Re-seed no resetea contraseñas de usuarios existentes.
 */
function envGet(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process;
  return proc?.env?.[name];
}

/**
 * Seed passwords come from Convex env vars, never from source.
 * Only read when creating a brand-new user, so re-seeding an existing
 * deployment never needs them.
 */
function requiredSeedPassword(envName: string): string {
  const value = envGet(envName);
  if (!value || value.length < 10) {
    throw new Error(
      `Falta ${envName} (mínimo 10 caracteres). ` +
        `Configúralo con: npx convex env set ${envName} '<contraseña>'`
    );
  }
  return value;
}

function assertBootstrapAllowed(bootstrapSecret: string | undefined): void {
  const allowOpen = envGet("ALLOW_OPEN_SEED") === "1";
  const expected = envGet("SEED_BOOTSTRAP_SECRET");
  if (allowOpen) return;
  if (expected && bootstrapSecret && bootstrapSecret === expected) return;
  throw new Error(
    "Seed inicial bloqueado. Configura ALLOW_OPEN_SEED=1 (solo local) " +
      "o SEED_BOOTSTRAP_SECRET + bootstrapSecret. Ver docs/producto/16-auditoria-fase1-seguridad.md"
  );
}

export const seedPlatform = mutation({
  args: {
    token: v.optional(v.string()),
    bootstrapSecret: v.optional(v.string()),
  },
  returns: v.object({
    organizationId: v.id("organizations"),
    tourId: v.id("tours"),
    superadminEmail: v.string(),
    orgAdminEmail: v.string(),
    alreadySeeded: v.boolean(),
  }),
  handler: async (ctx, args) => {
    // Migrate legacy piloto slugs without wiping graph.
    const migrated = await migratePilotSlugsIfNeeded(ctx);

    if (migrated.organizationId && migrated.tourId) {
      await requireSuperadmin(ctx, args.token);
      const existingBrand = await getBrandingByTourId(ctx, migrated.tourId);
      if (!existingBrand || brandingLooksLikeOrbePlatform(existingBrand)) {
        // Missing OR Orbe platform colors leaked into client TourBranding → restore USB.
        await upsertBrandingDoc(ctx, {
          tourId: migrated.tourId,
          organizationId: migrated.organizationId,
          branding: UNISIMON_BRANDING_SEED,
        });
      } else if (
        existingBrand.primaryColor.trim().toLowerCase() !==
        UNISIMON_BRANDING_SEED.primaryColor
      ) {
        // Piloto fixture must stay institutional green (#0a7a45) — repair drift without wiping graph.
        await upsertBrandingDoc(ctx, {
          tourId: migrated.tourId,
          organizationId: migrated.organizationId,
          branding: {
            ...UNISIMON_BRANDING_SEED,
            logoUrl: existingBrand.logoUrl || UNISIMON_BRANDING_SEED.logoUrl,
            fallbackImageUrl:
              existingBrand.fallbackImageUrl ||
              UNISIMON_BRANDING_SEED.fallbackImageUrl,
          },
        });
      }
      // Opt-in only: never re-apply campus spatial/a11y on re-seed.
      // Re-seed used to call syncCampusA11yIfPossible and wipe admin connections
      // with ~144 phantom auto-next/prev edges. Use Control Web / org-admin:
      // tourAdmin:syncCampusSpatialGraph + accessibilityPublish:syncCampusA11yPackage.
      return {
        organizationId: migrated.organizationId,
        tourId: migrated.tourId,
        superadminEmail: "superadmin@orbe360.local",
        orgAdminEmail: "admin@unisimon.local",
        alreadySeeded: true,
      };
    }

    if (migrated.organizationId && !migrated.tourId) {
      throw new Error(
        `Org ${PILOT_ORG_SLUG} sin tour ${PILOT_TOUR_SLUG} (ni legacy unisimon-campus)`
      );
    }

    const anyOrg = await ctx.db.query("organizations").first();
    if (anyOrg) {
      await requireSuperadmin(ctx, args.token);
    } else {
      assertBootstrapAllowed(args.bootstrapSecret);
    }

    const now = Date.now();
    const organizationId = await ctx.db.insert("organizations", {
      name: "Universidad Simón Bolívar — Cúcuta",
      slug: PILOT_ORG_SLUG,
      description: "Cliente piloto PEVCI / campus 360° inclusivo.",
      createdAt: now,
    });

    const tourId = await ctx.db.insert("tours", {
      organizationId,
      slug: PILOT_TOUR_SLUG,
      title: "Tour 360° Campus Unisimón Cúcuta",
      shortTitle: "Campus Unisimón",
      published: true,
      defaultSceneKey: "R0010060_202503281449_YP00145909.JPG",
      accessibilityProfile: {
        keyboard: true,
        screenReader: true,
        highContrast: true,
        captions: true,
      },
      createdAt: now,
      updatedAt: now,
    });

    async function createUser(
      email: string,
      name: string,
      password: string,
      isSuperadmin: boolean
    ) {
      const salt = randomToken().slice(0, 16);
      const passwordHash = await hashPassword(password, salt);
      return await ctx.db.insert("platformUsers", {
        email,
        name,
        passwordHash,
        passwordSalt: salt,
        isSuperadmin,
        active: true,
        createdAt: now,
      });
    }

    const superId = await createUser(
      "superadmin@orbe360.local",
      "Superadmin Orbe360",
      requiredSeedPassword("SEED_SUPERADMIN_PASSWORD"),
      true
    );
    void superId;
    const adminId = await createUser(
      "admin@unisimon.local",
      "Admin Tour Unisimón",
      requiredSeedPassword("SEED_ORGADMIN_PASSWORD"),
      false
    );

    await ctx.db.insert("memberships", {
      userId: adminId,
      organizationId,
      role: "orgAdmin",
      createdAt: now,
    });
    // Superadmin is platform ops only — no org membership / no tour content edits.

    await upsertBrandingDoc(ctx, {
      tourId,
      organizationId,
      branding: UNISIMON_BRANDING_SEED,
    });

    await syncCampusA11yIfPossible(ctx, tourId);

    return {
      organizationId,
      tourId,
      superadminEmail: "superadmin@orbe360.local",
      orgAdminEmail: "admin@unisimon.local",
      alreadySeeded: false,
    };
  },
});
