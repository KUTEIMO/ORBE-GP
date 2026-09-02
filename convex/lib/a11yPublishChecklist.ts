/**
 * T-P0-8 publish checklist (Convex-side, mirrors src/a11yPublishChecklist.js).
 */

export type SceneA11yInput = {
  id?: string;
  title?: string;
  srSummary?: string | null;
  narration?: string | null;
  transcript?: string | null;
  captionFile?: string | null;
  narrationOptional?: boolean;
  hotspots?: Array<{
    id?: string;
    type?: string;
    title?: string;
    narration?: string | null;
    transcript?: string | null;
    captionFile?: string | null;
    narrationOptional?: boolean;
  }>;
};

export type PublishChecklistResult = {
  ready: boolean;
  sceneCount: number;
  scenesWithSrSummary: number;
  scenesWithNarrationOrOptional: number;
  scenesWithTranscriptIfAudio: number;
  infoHotspotsChecked: number;
  infoHotspotsOk: number;
  blockingIssues: string[];
  warnings: string[];
};

function isPlaceholderNarration(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return true;
  const lower = url.trim().toLowerCase();
  if (!lower) return true;
  if (lower.includes("assets/audio/placeholder.mp3")) return true;
  if (lower.startsWith("data:audio/") && lower.includes("base64,")) {
    const payload = url.split("base64,")[1] || "";
    if (payload.length < 200) return true;
  }
  return false;
}

function hasNarrationRef(url: string | null | undefined): boolean {
  return Boolean(url && typeof url === "string" && url.trim() && !isPlaceholderNarration(url));
}

export function evaluateAccessibilityPublishChecklist(input: {
  scenes: SceneA11yInput[];
  requireCaptions?: boolean;
}): PublishChecklistResult {
  const scenes = Array.isArray(input?.scenes) ? input.scenes : [];
  const requireCaptions = Boolean(input?.requireCaptions);
  const blocking: string[] = [];
  const warnings: string[] = [];

  let scenesWithSrSummary = 0;
  let scenesWithNarrationOrOptional = 0;
  let scenesWithTranscriptIfAudio = 0;
  let infoHotspotsChecked = 0;
  let infoHotspotsOk = 0;

  if (scenes.length === 0) {
    blocking.push("El tour no tiene escenas para evaluar accesibilidad.");
  }

  for (const scene of scenes) {
    const label = scene.title || scene.id || "escena-sin-id";
    const sr = typeof scene.srSummary === "string" ? scene.srSummary.trim() : "";
    if (sr) scenesWithSrSummary += 1;
    else blocking.push(`Escena "${label}": falta srSummary (resumen corto para lector de pantalla).`);

    const optional = Boolean(scene.narrationOptional);
    const narrated = hasNarrationRef(scene.narration);

    if (narrated || optional) scenesWithNarrationOrOptional += 1;
    else {
      blocking.push(
        `Escena "${label}": sin narración ni narrationOptional=true (debe haber audio o marcarse opcional).`
      );
    }

    if (narrated) {
      const transcript = typeof scene.transcript === "string" ? scene.transcript.trim() : "";
      if (transcript) scenesWithTranscriptIfAudio += 1;
      else blocking.push(`Escena "${label}": hay narración pero falta transcript.`);
      const caption = typeof scene.captionFile === "string" ? scene.captionFile.trim() : "";
      if (!caption) {
        const msg = `Escena "${label}": hay narración pero falta captionFile (VTT).`;
        if (requireCaptions) blocking.push(msg);
        else warnings.push(msg);
      }
    } else if (optional) {
      scenesWithTranscriptIfAudio += 1;
    }

    const hotspots = Array.isArray(scene.hotspots) ? scene.hotspots : [];
    for (const hotspot of hotspots) {
      const tracked =
        Object.prototype.hasOwnProperty.call(hotspot, "narration") ||
        Object.prototype.hasOwnProperty.call(hotspot, "narrationOptional");
      if (!tracked) continue;
      if (hotspot.type && hotspot.type !== "info") continue;

      infoHotspotsChecked += 1;
      const hLabel = hotspot.title || hotspot.id || "hotspot";
      const hOptional = Boolean(hotspot.narrationOptional);
      const hNarrated = hasNarrationRef(hotspot.narration);
      if (!hNarrated && !hOptional) {
        blocking.push(`Hotspot "${hLabel}" en "${label}": sin narración ni narrationOptional=true.`);
        continue;
      }
      if (hNarrated) {
        const hTranscript = typeof hotspot.transcript === "string" ? hotspot.transcript.trim() : "";
        if (!hTranscript) {
          blocking.push(`Hotspot "${hLabel}" en "${label}": hay narración pero falta transcript.`);
          continue;
        }
      }
      infoHotspotsOk += 1;
    }
  }

  return {
    ready: blocking.length === 0 && scenes.length > 0,
    sceneCount: scenes.length,
    scenesWithSrSummary,
    scenesWithNarrationOrOptional,
    scenesWithTranscriptIfAudio,
    infoHotspotsChecked,
    infoHotspotsOk,
    blockingIssues: blocking,
    warnings,
  };
}
