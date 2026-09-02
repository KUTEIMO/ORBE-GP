import { v } from "convex/values";

/** Shared P1 visual fields — optional; legacy nav|info tours stay valid. */
export const hotspotIconKeyValidator = v.optional(
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
);

export const hotspotCategoryValidator = v.optional(
  v.union(
    v.literal("general"),
    v.literal("facilities"),
    v.literal("medical"),
    v.literal("transport"),
    v.literal("expo"),
    v.literal("navigation")
  )
);

export const hotspotAnimationPresetValidator = v.optional(
  v.union(v.literal("none"), v.literal("pulse"))
);

export const hotspotAccentColorValidator = v.optional(v.string());

/** Fields returned on public/admin graph hotspot objects. */
export const hotspotVisualReturnFields = {
  iconKey: hotspotIconKeyValidator,
  category: hotspotCategoryValidator,
  animationPreset: hotspotAnimationPresetValidator,
  accentColor: hotspotAccentColorValidator,
};

export type HotspotVisualFields = {
  iconKey?:
    | "nav"
    | "info"
    | "pin"
    | "bath"
    | "medical"
    | "transport"
    | "drone"
    | "expo"
    | "wardrobe";
  category?:
    | "general"
    | "facilities"
    | "medical"
    | "transport"
    | "expo"
    | "navigation";
  animationPreset?: "none" | "pulse";
  accentColor?: string;
};

export function pickHotspotVisual(
  h: HotspotVisualFields
): HotspotVisualFields {
  const out: HotspotVisualFields = {};
  if (h.iconKey) out.iconKey = h.iconKey;
  if (h.category) out.category = h.category;
  if (h.animationPreset) out.animationPreset = h.animationPreset;
  if (h.accentColor) out.accentColor = h.accentColor;
  return out;
}
