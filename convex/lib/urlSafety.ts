import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

const CSS_HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const BLOCKED_SCHEME_RE = /^\s*(javascript|vbscript|data|file|blob):/i;

/**
 * Validate a user-supplied asset / link URL (`https://...` or site-relative `/...`).
 * Allows local `http://127.0.0.1` / `http://localhost` only for dev convenience.
 */
export function assertSafePublicUrl(raw: string, field: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${field} vacío`);
  }
  if (trimmed.includes("\\") || BLOCKED_SCHEME_RE.test(trimmed)) {
    throw new Error(`${field} contiene un esquema o carácter no permitido`);
  }
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const isHttps = parsed.protocol === "https:";
    const isLoopbackHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    if (isHttps || isLoopbackHttp) {
      return trimmed;
    }
  } catch {
    // Allow relative static tour paths such as media/... or assets/... without scheme
    if (/^[a-z0-9._/-]+$/i.test(trimmed) && !trimmed.includes("..")) {
      return trimmed;
    }
  }
  throw new Error(`${field} debe usar HTTPS o una ruta relativa segura`);
}

export function sanitizeOptionalSafeUrl(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  try {
    return assertSafePublicUrl(raw, "url");
  } catch {
    return undefined;
  }
}

export function assertOptionalCssHex(
  raw: string | undefined,
  field: string
): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  if (!CSS_HEX_RE.test(trimmed)) {
    throw new Error(`${field} debe ser un color CSS hex válido (#RGB o #RRGGBB)`);
  }
  return trimmed.toLowerCase();
}

export function sanitizeOptionalCssHex(raw: string | undefined): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  return CSS_HEX_RE.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

const STORAGE_LIMITS = {
  image: {
    maxBytes: 25 * 1024 * 1024,
    prefixes: ["image/"],
    exact: new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]),
  },
  audio: {
    maxBytes: 30 * 1024 * 1024,
    prefixes: ["audio/", "video/webm", "application/ogg"],
    exact: new Set<string>(),
  },
  text: {
    maxBytes: 2 * 1024 * 1024,
    prefixes: ["text/"],
    exact: new Set(["application/octet-stream"]),
  },
} as const;

export async function assertStorageFileMeta(
  ctx: MutationCtx,
  storageId: Id<"_storage">,
  kind: "image" | "audio" | "text"
): Promise<void> {
  const meta = await ctx.db.system.get("_storage", storageId);
  if (!meta) {
    throw new Error("Archivo no encontrado en almacenamiento");
  }
  const spec = STORAGE_LIMITS[kind];
  if (typeof meta.size === "number" && meta.size > spec.maxBytes) {
    throw new Error(`El archivo excede el tamaño máximo permitido (${Math.round(spec.maxBytes / (1024 * 1024))} MB)`);
  }
  const ct = (meta.contentType || "").toLowerCase().split(";")[0].trim();
  if (ct) {
    const allowed =
      spec.exact.has(ct) || spec.prefixes.some((p) => ct.startsWith(p));
    if (!allowed) {
      throw new Error(`Tipo MIME no permitido para ${kind}: ${ct}`);
    }
  }
}

