/**
 * Apply campus spatial package onto Convex scenes/hotspots/connections.
 * Preserves existing a11y fields (narrationUrl, transcriptUrl, srSummary, …).
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { CampusSpatialPackage, SpatialHotspot } from "./campusSpatialPackage";

export type ApplySpatialPackageResult = {
  scenesUpserted: number;
  scenesCreated: number;
  hotspotsUpserted: number;
  hotspotsCreated: number;
  hotspotsPreservedA11y: number;
  connectionsSaved: number;
  navHotspots: number;
};

type A11ySnap = {
  srSummary?: string;
  narrationUrl?: string;
  narrationOptional?: boolean;
  transcriptUrl?: string;
  captionUrl?: string;
  timingUrl?: string;
};

function snapA11y(doc: {
  srSummary?: string;
  narrationUrl?: string;
  narrationOptional?: boolean;
  transcriptUrl?: string;
  captionUrl?: string;
  timingUrl?: string;
}): A11ySnap {
  const out: A11ySnap = {};
  if (doc.srSummary) out.srSummary = doc.srSummary;
  if (doc.narrationUrl) out.narrationUrl = doc.narrationUrl;
  if (typeof doc.narrationOptional === "boolean") {
    out.narrationOptional = doc.narrationOptional;
  }
  if (doc.transcriptUrl) out.transcriptUrl = doc.transcriptUrl;
  if (doc.captionUrl) out.captionUrl = doc.captionUrl;
  if (doc.timingUrl) out.timingUrl = doc.timingUrl;
  return out;
}

function hasA11y(snap: A11ySnap): boolean {
  return Boolean(
    snap.srSummary ||
      snap.narrationUrl ||
      snap.transcriptUrl ||
      snap.captionUrl ||
      snap.timingUrl ||
      typeof snap.narrationOptional === "boolean"
  );
}

export async function applySpatialPackageToTour(
  ctx: MutationCtx,
  tourId: Id<"tours">,
  pkg: CampusSpatialPackage
): Promise<ApplySpatialPackageResult> {
  const tour = await ctx.db.get(tourId);
  if (!tour) throw new Error("Tour no encontrado");

  const now = Date.now();
  let scenes = await ctx.db
    .query("scenes")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  const byFileKey = new Map(scenes.map((s) => [s.fileKey, s]));

  let scenesUpserted = 0;
  let scenesCreated = 0;
  let hotspotsUpserted = 0;
  let hotspotsCreated = 0;
  let hotspotsPreservedA11y = 0;
  let navHotspots = 0;

  const fileToSceneId = new Map<string, Id<"scenes">>();

  for (const patch of pkg.scenes) {
    let scene = byFileKey.get(patch.fileKey);
    if (scene) {
      const a11y = snapA11y(scene);
      // Prefer stored CDN image when present; otherwise take spatial package path.
      const keepStored =
        Boolean(scene.storageId) && /^https?:\/\//i.test(scene.imageUrl);
      await ctx.db.patch(scene._id, {
        title: patch.title,
        shortTitle: patch.shortTitle,
        zone: patch.zone,
        order: patch.order,
        imageUrl: keepStored ? scene.imageUrl : patch.imageUrl,
        altText: patch.altText,
        longDescription: patch.longDescription ?? scene.longDescription,
        // Re-apply a11y so accidental wipes never happen via this path
        ...a11y,
        updatedAt: now,
      });
      scenesUpserted += 1;
    } else {
      const sceneId = await ctx.db.insert("scenes", {
        tourId,
        organizationId: tour.organizationId,
        fileKey: patch.fileKey,
        title: patch.title,
        shortTitle: patch.shortTitle,
        zone: patch.zone,
        order: patch.order,
        imageUrl: patch.imageUrl,
        altText: patch.altText,
        longDescription: patch.longDescription,
        createdAt: now,
        updatedAt: now,
      });
      scene = (await ctx.db.get(sceneId))!;
      byFileKey.set(patch.fileKey, scene);
      scenesCreated += 1;
      scenesUpserted += 1;
    }
    fileToSceneId.set(patch.fileKey, scene._id);

    // Snapshot existing hotspots (a11y) before replace
    const oldHs = await ctx.db
      .query("hotspots")
      .withIndex("by_scene", (q) => q.eq("sceneId", scene._id))
      .collect();
    const a11yByKey = new Map<string, A11ySnap>();
    for (const h of oldHs) {
      const snap = snapA11y(h);
      if (hasA11y(snap)) a11yByKey.set(h.clientKey, snap);
    }

    const desiredIds = new Set(patch.hotspots.map((h) => h.id));
    // Keep a11y-only hotspots not present in spatial package (e.g. Phase 9 info keys).
    const orphans: Array<{ clientKey: string; snap: A11ySnap; old: (typeof oldHs)[0] }> =
      [];
    for (const h of oldHs) {
      if (!desiredIds.has(h.clientKey) && a11yByKey.has(h.clientKey)) {
        orphans.push({ clientKey: h.clientKey, snap: a11yByKey.get(h.clientKey)!, old: h });
      }
    }

    for (const h of oldHs) await ctx.db.delete(h._id);

    const insertHotspot = async (
      h: SpatialHotspot | { id: string; type: "nav" | "info"; title: string; yaw: number; pitch: number; description?: string; targetFile?: string; direction?: string; weight?: number },
      a11y?: A11ySnap
    ) => {
      const preserved = a11y && hasA11y(a11y);
      if (preserved) hotspotsPreservedA11y += 1;
      if (h.type === "nav") navHotspots += 1;
      await ctx.db.insert("hotspots", {
        tourId,
        sceneId: scene!._id,
        clientKey: h.id,
        type: h.type,
        title: h.title,
        yaw: h.yaw,
        pitch: h.pitch,
        direction: "direction" in h ? h.direction : undefined,
        targetFileKey: "targetFile" in h ? h.targetFile : undefined,
        description: h.description,
        weight: "weight" in h ? h.weight : undefined,
        ...(a11y || {}),
        createdAt: now,
        updatedAt: now,
      });
      if (a11yByKey.has(h.id) || (oldHs.length > 0 && desiredIds.has(h.id))) {
        // counted as upsert vs create below
      }
    };

    for (const h of patch.hotspots) {
      const prior = a11yByKey.get(h.id);
      if (prior) {
        await insertHotspot(h, prior);
        hotspotsUpserted += 1;
      } else {
        await insertHotspot(h);
        hotspotsCreated += 1;
        hotspotsUpserted += 1;
      }
    }

    for (const orphan of orphans) {
      await insertHotspot(
        {
          id: orphan.clientKey,
          type: orphan.old.type,
          title: orphan.old.title,
          yaw: orphan.old.yaw,
          pitch: orphan.old.pitch,
          direction: orphan.old.direction,
          targetFile: orphan.old.targetFileKey,
          description: orphan.old.description,
          weight: orphan.old.weight,
        },
        orphan.snap
      );
      hotspotsUpserted += 1;
      hotspotsPreservedA11y += 1;
    }
  }

  // Resolve targetSceneId for nav hotspots
  const allHotspots = await ctx.db
    .query("hotspots")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const h of allHotspots) {
    if (h.type === "nav" && h.targetFileKey) {
      const targetId = fileToSceneId.get(h.targetFileKey);
      if (targetId) await ctx.db.patch(h._id, { targetSceneId: targetId });
    }
  }

  // Replace connections for tour
  const oldConns = await ctx.db
    .query("connections")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  for (const c of oldConns) await ctx.db.delete(c._id);

  let connectionsSaved = 0;
  for (const c of pkg.connections) {
    const fromId = fileToSceneId.get(c.from);
    const toId = fileToSceneId.get(c.to);
    if (!fromId || !toId) continue;
    await ctx.db.insert("connections", {
      tourId,
      fromSceneId: fromId,
      toSceneId: toId,
      direction: c.direction,
      label: c.label,
      createdAt: now,
    });
    connectionsSaved += 1;
  }

  await ctx.db.patch(tourId, { updatedAt: now });

  return {
    scenesUpserted,
    scenesCreated,
    hotspotsUpserted,
    hotspotsCreated,
    hotspotsPreservedA11y,
    connectionsSaved,
    navHotspots,
  };
}
