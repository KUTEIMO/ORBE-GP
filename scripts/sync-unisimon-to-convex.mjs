/**
 * Sincroniza backup curado (opcional --restore) y los 29 panoramas + a11y + conexiones
 * de Fotitos hacia un backend Convex (local 127.0.0.1:3210 o Convex Cloud HTTPS).
 *
 * Uso:
 *   node scripts/sync-unisimon-to-convex.mjs
 *   $env:CONVEX_URL="https://<deployment>.convex.cloud"; node scripts/sync-unisimon-to-convex.mjs --restore backups/local-full-backup-20261111.json
 */
import fs from "node:fs";
import {
  BLOQUE_D_CONNECTIONS,
  FOTITOS_SCENES,
  NEW_TOURS_TO_ENSURE,
  SPEAKER_SALOME,
} from "./fotitos-catalog.mjs";

const args = process.argv.slice(2);
function argValue(flag) {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
}

const CONVEX = (argValue("--url") || process.env.CONVEX_URL || "http://127.0.0.1:3210").replace(
  /\/+$/,
  ""
);
const RESTORE_FILE = argValue("--restore");

const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(CONVEX);

const SUPER_EMAIL = process.env.ORBE_SUPER_EMAIL || "superadmin@orbe360.local";
const SUPER_PASS =
  process.env.ORBE_SUPER_PASS || (isLocal ? "OrbeSuper2026!" : "");
const UNI_EMAIL = process.env.ORBE_UNI_EMAIL || "admin@unisimon.local";
const UNI_PASS =
  process.env.ORBE_UNI_PASS || (isLocal ? "UnisimonAdmin2026!" : "");
const ORBE_EMAIL = process.env.ORBE_SANDBOX_EMAIL || "admin@orbe.local";
const ORBE_PASS =
  process.env.ORBE_SANDBOX_PASS || (isLocal ? "OrbeSandbox2026!" : "");

if (!SUPER_PASS || !UNI_PASS) {
  throw new Error(
    "Define ORBE_SUPER_PASS y ORBE_UNI_PASS en el entorno para deployments remotos."
  );
}

async function convex(kind, path, fnArgs) {
  const res = await fetch(`${CONVEX}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args: fnArgs, format: "json" }),
  });
  const data = await res.json();
  if (!res.ok || data.status === "error") {
    throw new Error(`${path}: ${data.errorMessage || data.message || res.statusText}`);
  }
  return data.value;
}

function sceneObjToArray(scenesObj) {
  return Object.entries(scenesObj || {}).map(([fileKey, sc]) => ({
    fileKey,
    title: sc.title || fileKey,
    shortTitle: sc.shortTitle || sc.title || fileKey,
    zone: sc.zone,
    sede: sc.sede,
    speaker: sc.speaker,
    order: typeof sc.order === "number" ? sc.order : 0,
    imageUrl: sc.imageUrl,
    altText: sc.altText || sc.title || fileKey,
    longDescription: sc.longDescription,
    initialView: sc.initialView,
    hotspots: (sc.hotspots || []).map((h) => ({
      id: h.id,
      type: h.type === "nav" ? "nav" : "info",
      title: h.title,
      yaw: h.yaw ?? 0,
      pitch: h.pitch ?? 0,
      direction: h.direction,
      targetFile: h.targetFile,
      description: h.description,
      weight: h.weight,
      shortLabel: h.shortLabel,
      altText: h.altText,
      iconKey: h.iconKey,
      category: h.category,
      animationPreset: h.animationPreset,
      accentColor: h.accentColor,
    })),
  }));
}

function a11yPackageFromSnapshotScenes(tourSlug, scenesObj) {
  const scenes = {};
  const hotspots = {};
  for (const [fileKey, sc] of Object.entries(scenesObj || {})) {
    scenes[fileKey] = {
      fileKey,
      ...(sc.srSummary ? { srSummary: sc.srSummary } : {}),
      ...(sc.narration ? { narration: sc.narration } : {}),
      ...(typeof sc.narrationOptional === "boolean"
        ? { narrationOptional: sc.narrationOptional }
        : {}),
      ...(sc.transcript ? { transcript: sc.transcript } : {}),
      ...(sc.captionFile ? { captionFile: sc.captionFile } : {}),
      ...(sc.timingFile ? { timingFile: sc.timingFile } : {}),
    };
    for (const h of sc.hotspots || []) {
      if (h.type === "nav") continue;
      if (!h.srSummary && !h.narration && typeof h.narrationOptional !== "boolean") {
        continue;
      }
      hotspots[h.id] = {
        sceneKey: fileKey,
        ...(h.srSummary ? { srSummary: h.srSummary } : {}),
        ...(h.narration ? { narration: h.narration } : {}),
        ...(typeof h.narrationOptional === "boolean"
          ? { narrationOptional: h.narrationOptional }
          : {}),
        ...(h.transcript ? { transcript: h.transcript } : {}),
        ...(h.captionFile ? { captionFile: h.captionFile } : {}),
        ...(h.timingFile ? { timingFile: h.timingFile } : {}),
      };
    }
  }
  return { tourSlug, scenes, hotspots };
}

function pickCleanBranding(b, overrideFallback = null) {
  if (!b) return null;
  return {
    clientName: b.clientName,
    clientShortName: b.clientShortName,
    primaryColor: b.primaryColor,
    primaryStrong: b.primaryStrong,
    accentColor: b.accentColor,
    headerTitle: b.headerTitle,
    metaTitle: b.metaTitle,
    metaDescription: b.metaDescription,
    ...(b.logoUrl ? { logoUrl: b.logoUrl } : {}),
    ...(overrideFallback || b.fallbackImageUrl
      ? { fallbackImageUrl: overrideFallback || b.fallbackImageUrl }
      : {}),
    ...(typeof b.showPoweredByOrbe360 === "boolean"
      ? { showPoweredByOrbe360: b.showPoweredByOrbe360 }
      : {}),
  };
}

async function login(email, password) {
  const res = await convex("mutation", "auth:login", { email, password });
  if (!res?.ok || !res.token) {
    throw new Error(`Login falló para ${email}: ${res?.error || "sin token"}`);
  }
  return res.token;
}

async function ensureTour({ token, orgId, orgSlug, slug, title, published, branding }) {
  const existing = await convex("query", "organizations:listTours", {
    token,
    organizationId: orgId,
    now: Date.now(),
  });
  let found = existing.find((t) => t.slug === slug);
  if (!found) {
    const id = await convex("mutation", "organizations:createTour", {
      token,
      organizationId: orgId,
      slug,
      title,
      published: Boolean(published),
    });
    found = { id, slug, title, published: Boolean(published) };
  }
  if (branding) {
    await convex("mutation", "branding:saveBranding", {
      token,
      orgSlug,
      slug,
      branding,
    });
  }
  return found;
}

async function main() {
  const superTok = await login(SUPER_EMAIL, SUPER_PASS);
  const uniTok = await login(UNI_EMAIL, UNI_PASS);
  const orbeTok = ORBE_PASS ? await login(ORBE_EMAIL, ORBE_PASS).catch(() => null) : null;

  const orgs = await convex("query", "organizations:listOrganizations", {
    token: superTok,
    now: Date.now(),
  });
  const uniOrg = orgs.find((o) => o.slug === "unisimoncucuta");
  if (!uniOrg) throw new Error("Organización unisimoncucuta no encontrada.");

  // 1. Optional restore from local curated backup JSON (used when initializing Cloud Prod).
  if (RESTORE_FILE) {
    const backup = JSON.parse(fs.readFileSync(RESTORE_FILE, "utf8"));
    const uniBaseBrand = backup.snapshots["unisimoncucuta/experienciavirtual"]?.branding?.branding;

    for (const [key, entry] of Object.entries(backup.snapshots || {})) {
      const orgSlug = entry.orgSlug;
      const tourSlug = entry.tour.slug;
      const org = orgs.find((o) => o.slug === orgSlug);
      const tok = orgSlug === "unisimoncucuta" ? uniTok : orbeTok;
      if (!org || !tok) continue;

      const tourObj = await ensureTour({
        token: tok,
        orgId: org.id,
        orgSlug,
        slug: tourSlug,
        title: entry.tour.title,
        published: Boolean(entry.tour.published),
        branding: pickCleanBranding(entry.branding?.branding || uniBaseBrand),
      });

      const scenesArr = sceneObjToArray(entry.snapshot?.scenes);
      const conns = (entry.snapshot?.connections || []).map((c) => ({
        id: c.id,
        from: c.from,
        to: c.to,
        label: c.label,
        yaw: c.yaw,
        pitch: c.pitch,
        direction: c.direction,
        weight: c.weight,
      }));
      if (scenesArr.length > 0) {
        const saved = await convex("mutation", "tourAdmin:saveTourSnapshot", {
          token: tok,
          orgSlug,
          slug: tourSlug,
          scenes: scenesArr,
          connections: conns,
          allowEmptyConnections: conns.length === 0,
        });
        const a11yPkg = a11yPackageFromSnapshotScenes(tourSlug, entry.snapshot?.scenes);
        await convex("mutation", "accessibilityPublish:importA11yPackage", {
          token: tok,
          tourId: tourObj.id,
          package: a11yPkg,
          createMissing: false,
          saveSnapshot: true,
        });
        console.log(`[restore] ${key}:`, saved);
      }
      if (entry.tour.published && tourSlug !== "experienciavirtual") {
        await convex("mutation", "accessibilityPublish:setTourPublished", {
          token: tok,
          tourId: tourObj.id,
          published: true,
          forcePublish: true,
        });
      }
    }
  }

  // 2. Ensure Unisimón Sede 1, Sede 3, and Sede 4 draft tours exist cleanly with institutional branding.
  const evBrandRes = await convex("query", "branding:getBrandingForAdmin", {
    token: uniTok,
    orgSlug: "unisimoncucuta",
    slug: "experienciavirtual",
  });
  const baseUniBrand = evBrandRes?.branding;

  const extraToursToEnsure = [
    ...NEW_TOURS_TO_ENSURE,
    { slug: "sede-4", title: "Sede 4 — Bloque G", published: false },
  ];
  const tourIdBySlug = new Map();
  const uniToursBefore = await convex("query", "organizations:listTours", {
    token: uniTok,
    organizationId: uniOrg.id,
    now: Date.now(),
  });
  for (const t of uniToursBefore) tourIdBySlug.set(t.slug, t.id);

  for (const tMeta of extraToursToEnsure) {
    const facadeScene = FOTITOS_SCENES.find((s) => s.tourSlug === tMeta.slug);
    const fallbackUrl = facadeScene
      ? `/media/unisimoncucuta/${tMeta.slug}/panoramas/${facadeScene.fileKey}`
      : undefined;
    const brandForSede = baseUniBrand
      ? pickCleanBranding(
          {
            ...baseUniBrand,
            metaTitle: `${tMeta.title} — Unisimón Cúcuta`,
            metaDescription: `Recorrido virtual accesible 360° de ${tMeta.title} en la Universidad Simón Bolívar Cúcuta.`,
          },
          fallbackUrl
        )
      : null;
    const tObj = await ensureTour({
      token: uniTok,
      orgId: uniOrg.id,
      orgSlug: "unisimoncucuta",
      slug: tMeta.slug,
      title: tMeta.title,
      published: false,
      branding: brandForSede,
    });
    tourIdBySlug.set(tMeta.slug, tObj.id);
  }

  // 3. Upsert Fotitos scenes + info hotspots + Bloque D connections per tour.
  const scenesByTour = new Map();
  for (const s of FOTITOS_SCENES) {
    if (!scenesByTour.has(s.tourSlug)) scenesByTour.set(s.tourSlug, []);
    scenesByTour.get(s.tourSlug).push(s);
  }

  for (const [tourSlug, newList] of scenesByTour.entries()) {
    const snap = await convex("query", "tourAdmin:getAdminSnapshot", {
      token: uniTok,
      orgSlug: "unisimoncucuta",
      slug: tourSlug,
    });
    const existingMap = new Map(
      sceneObjToArray(snap?.scenes).map((sc) => [sc.fileKey, sc])
    );

    const a11yScenes = {};
    const a11yHotspots = {};

    for (const item of newList) {
      const baseAsset = `/media/unisimoncucuta/${tourSlug}/assets`;
      const prev = existingMap.get(item.fileKey);
      const prevNav = (prev?.hotspots || []).filter((h) => h.type === "nav");
      const infoHotspots = (item.infoHotspots || []).map((h) => ({
        id: h.id,
        type: "info",
        title: h.title,
        yaw: h.yaw,
        pitch: h.pitch,
        description: h.description,
        iconKey: h.iconKey || "info",
        category: h.category || "informativo",
      }));

      existingMap.set(item.fileKey, {
        fileKey: item.fileKey,
        title: item.title,
        shortTitle: item.shortTitle,
        zone: item.zone,
        sede: item.sede,
        speaker: SPEAKER_SALOME,
        order: item.order,
        imageUrl: `/media/unisimoncucuta/${tourSlug}/panoramas/${item.fileKey}`,
        altText: item.altText,
        longDescription: item.longDescription,
        initialView: item.initialView,
        hotspots: [...prevNav, ...infoHotspots],
      });

      a11yScenes[item.slug] = {
        fileKey: item.fileKey,
        srSummary: item.srSummary,
        narration: `${baseAsset}/audio/scenes/${item.slug}.mp3`,
        transcript: `${baseAsset}/transcripts/scenes/${item.slug}.txt`,
        captionFile: `${baseAsset}/captions/scenes/${item.slug}.vtt`,
        timingFile: `${baseAsset}/accessibility/timing/scenes/${item.slug}.json`,
        narrationOptional: false,
      };

      for (const h of item.infoHotspots || []) {
        a11yHotspots[h.id] = {
          sceneKey: item.fileKey,
          srSummary: h.description,
          narration: `${baseAsset}/audio/hotspots/${h.id}.mp3`,
          transcript: `${baseAsset}/transcripts/hotspots/${h.id}.txt`,
          captionFile: `${baseAsset}/captions/hotspots/${h.id}.vtt`,
          timingFile: `${baseAsset}/accessibility/timing/hotspots/${h.id}.json`,
          narrationOptional: false,
        };
      }
    }

    const baseConns = (snap?.connections || []).map((c) => ({
      id: c.id,
      from: c.from,
      to: c.to,
      label: c.label,
      yaw: c.yaw,
      pitch: c.pitch,
      direction: c.direction,
      weight: c.weight,
    }));

    const mergedConns = [...baseConns];
    if (tourSlug === "experienciavirtual") {
      const seenPair = new Set(baseConns.map((c) => `${c.from}=>${c.to}`));
      for (const edge of BLOQUE_D_CONNECTIONS) {
        const pairKey = `${edge.from}=>${edge.to}`;
        if (seenPair.has(pairKey)) continue;
        seenPair.add(pairKey);
        mergedConns.push({
          id: `conn-d-${edge.from.replace(/\.jpg$/i, "")}-${edge.to.replace(/\.jpg$/i, "")}`,
          from: edge.from,
          to: edge.to,
          label: edge.label,
          yaw: edge.yaw,
          pitch: edge.pitch,
          direction: edge.direction,
          weight: 1.25,
        });
      }
    }

    const saved = await convex("mutation", "tourAdmin:saveTourSnapshot", {
      token: uniTok,
      orgSlug: "unisimoncucuta",
      slug: tourSlug,
      scenes: Array.from(existingMap.values()),
      connections: mergedConns,
      allowEmptyConnections: mergedConns.length === 0,
    });

    const tourId = tourIdBySlug.get(tourSlug);
    const a11yRes = await convex("mutation", "accessibilityPublish:importA11yPackage", {
      token: uniTok,
      tourId,
      package: {
        tourSlug,
        scenes: a11yScenes,
        hotspots: a11yHotspots,
      },
      createMissing: false,
      saveSnapshot: true,
    });

    console.log(
      `[sync:${tourSlug}] scenes=${saved.scenesSaved} hotspots=${saved.hotspotsSaved} conns=${saved.connectionsSaved} a11yReady=${a11yRes.checklist?.ready} missing=${JSON.stringify(a11yRes.scenesMissing)}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

