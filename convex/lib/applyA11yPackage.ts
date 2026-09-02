/**
 * Apply a11y package metadata onto Convex scenes/hotspots (by fileKey / clientKey).
 * Optionally create missing stubs so DB can become publish SoT without Control Web
 * (spatial yaw/pitch/nav richness still belongs to Control Web).
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { A11yPackagePayload } from "./pilotA11yPackage";

export type ApplyA11yPackageResult = {
  scenesUpdated: number;
  hotspotsUpdated: number;
  scenesCreated: number;
  hotspotsCreated: number;
  scenesMissing: string[];
  hotspotsMissing: string[];
  scenesSkippedAlias: string[];
};

function nonEmpty(s: string | undefined | null): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = s.trim();
  return t ? t : undefined;
}

function titleFromKey(sceneKey: string): string {
  return sceneKey
    .split("-")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function applyA11yPackageToTour(
  ctx: MutationCtx,
  tourId: Id<"tours">,
  pkg: A11yPackagePayload,
  options?: { createMissing?: boolean }
): Promise<ApplyA11yPackageResult> {
  const createMissing = Boolean(options?.createMissing);
  const tour = await ctx.db.get(tourId);
  if (!tour) throw new Error("Tour no encontrado");

  let scenes = await ctx.db
    .query("scenes")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  let hotspots = await ctx.db
    .query("hotspots")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();

  const byFileKey = new Map(scenes.map((s) => [s.fileKey, s]));
  const byClientKey = new Map(hotspots.map((h) => [h.clientKey, h]));
  /** sceneKey (package id) → fileKey for hotspot parenting */
  const sceneKeyToFileKey = new Map<string, string>();

  const scenesMissing: string[] = [];
  const scenesSkippedAlias: string[] = [];
  const hotspotsMissing: string[] = [];
  let scenesUpdated = 0;
  let hotspotsUpdated = 0;
  let scenesCreated = 0;
  let hotspotsCreated = 0;
  const now = Date.now();
  let orderBase = scenes.reduce((m, s) => Math.max(m, s.order), 0);

  for (const [sceneKey, entry] of Object.entries(pkg.scenes || {})) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.aliasOf) {
      scenesSkippedAlias.push(sceneKey);
      continue;
    }
    const fileKey = nonEmpty(entry.fileKey);
    if (!fileKey) {
      scenesMissing.push(sceneKey);
      continue;
    }
    sceneKeyToFileKey.set(sceneKey, fileKey);

    let scene = byFileKey.get(fileKey);
    if (!scene && createMissing) {
      orderBase += 1;
      const sr = nonEmpty(entry.srSummary) || titleFromKey(sceneKey);
      const sceneId = await ctx.db.insert("scenes", {
        tourId,
        organizationId: tour.organizationId,
        fileKey,
        title: titleFromKey(sceneKey),
        shortTitle: titleFromKey(sceneKey),
        zone: "campus",
        order: orderBase,
        imageUrl: `images/${fileKey}`,
        altText: sr,
        srSummary: nonEmpty(entry.srSummary),
        narrationUrl: nonEmpty(entry.narration),
        narrationOptional: entry.narrationOptional,
        transcriptUrl: nonEmpty(entry.transcript),
        captionUrl: nonEmpty(entry.captionFile),
        timingUrl: nonEmpty(entry.timingFile),
        createdAt: now,
        updatedAt: now,
      });
      scene = (await ctx.db.get(sceneId))!;
      byFileKey.set(fileKey, scene);
      scenesCreated += 1;
      scenesUpdated += 1;
      continue;
    }

    if (!scene) {
      scenesMissing.push(sceneKey);
      continue;
    }

    const patch: {
      srSummary?: string;
      narrationUrl?: string;
      narrationOptional?: boolean;
      transcriptUrl?: string;
      captionUrl?: string;
      timingUrl?: string;
      updatedAt: number;
    } = { updatedAt: now };

    const sr = nonEmpty(entry.srSummary);
    if (sr) patch.srSummary = sr;
    const narr = nonEmpty(entry.narration);
    if (narr) patch.narrationUrl = narr;
    if (typeof entry.narrationOptional === "boolean") {
      patch.narrationOptional = entry.narrationOptional;
    }
    const transcript = nonEmpty(entry.transcript);
    if (transcript) patch.transcriptUrl = transcript;
    const caption = nonEmpty(entry.captionFile);
    if (caption) patch.captionUrl = caption;
    const timing = nonEmpty(entry.timingFile);
    if (timing) patch.timingUrl = timing;

    await ctx.db.patch(scene._id, patch);
    scenesUpdated += 1;
  }

  // Refresh hotspot map after scene creates
  hotspots = await ctx.db
    .query("hotspots")
    .withIndex("by_tour", (q) => q.eq("tourId", tourId))
    .collect();
  byClientKey.clear();
  for (const h of hotspots) byClientKey.set(h.clientKey, h);

  for (const [hotspotId, entry] of Object.entries(pkg.hotspots || {})) {
    if (!entry || typeof entry !== "object") continue;
    let hotspot = byClientKey.get(hotspotId);

    if (!hotspot && createMissing) {
      const parentKey = nonEmpty(entry.sceneKey);
      const parentFile = parentKey
        ? sceneKeyToFileKey.get(parentKey) || undefined
        : undefined;
      const parentScene = parentFile ? byFileKey.get(parentFile) : undefined;
      if (!parentScene) {
        hotspotsMissing.push(hotspotId);
        continue;
      }
      const hotspotDocId = await ctx.db.insert("hotspots", {
        tourId,
        sceneId: parentScene._id,
        clientKey: hotspotId,
        type: "info",
        title: nonEmpty(entry.srSummary) || titleFromKey(hotspotId),
        yaw: 0,
        pitch: 0,
        description: nonEmpty(entry.srSummary),
        srSummary: nonEmpty(entry.srSummary),
        narrationUrl: nonEmpty(entry.narration),
        narrationOptional: entry.narrationOptional,
        transcriptUrl: nonEmpty(entry.transcript),
        captionUrl: nonEmpty(entry.captionFile),
        timingUrl: nonEmpty(entry.timingFile),
        createdAt: now,
        updatedAt: now,
      });
      hotspot = (await ctx.db.get(hotspotDocId))!;
      byClientKey.set(hotspotId, hotspot);
      hotspotsCreated += 1;
      hotspotsUpdated += 1;
      continue;
    }

    if (!hotspot) {
      hotspotsMissing.push(hotspotId);
      continue;
    }

    const patch: {
      srSummary?: string;
      narrationUrl?: string;
      narrationOptional?: boolean;
      transcriptUrl?: string;
      captionUrl?: string;
      timingUrl?: string;
    } = {};

    const sr = nonEmpty(entry.srSummary);
    if (sr) patch.srSummary = sr;
    const narr = nonEmpty(entry.narration);
    if (narr) patch.narrationUrl = narr;
    if (typeof entry.narrationOptional === "boolean") {
      patch.narrationOptional = entry.narrationOptional;
    }
    const transcript = nonEmpty(entry.transcript);
    if (transcript) patch.transcriptUrl = transcript;
    const caption = nonEmpty(entry.captionFile);
    if (caption) patch.captionUrl = caption;
    const timing = nonEmpty(entry.timingFile);
    if (timing) patch.timingUrl = timing;

    await ctx.db.patch(hotspot._id, patch);
    hotspotsUpdated += 1;
  }

  return {
    scenesUpdated,
    hotspotsUpdated,
    scenesCreated,
    hotspotsCreated,
    scenesMissing,
    hotspotsMissing,
    scenesSkippedAlias,
  };
}
