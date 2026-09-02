import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** PBKDF2 via Web Crypto (Convex runtime). Prefer over plain SHA-256. */
const PBKDF2_ITERS = 100_000;
const HASH_PREFIX = "pbkdf2:";

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function pbkdf2Hex(
  password: string,
  salt: string,
  iterations: number
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return [...new Uint8Array(bits)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash for new users / upgrades.
 * Format: `pbkdf2:<iterations>:<hex>`
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const hex = await pbkdf2Hex(password, salt, PBKDF2_ITERS);
  return `${HASH_PREFIX}${PBKDF2_ITERS}:${hex}`;
}

/**
 * Verify stored hash. Supports legacy SHA-256(salt:password) hex
 * and current PBKDF2 prefix format. `legacy: true` → rehash on login.
 */
export async function verifyPassword(
  password: string,
  salt: string,
  storedHash: string
): Promise<{ ok: boolean; legacy: boolean }> {
  if (storedHash.startsWith(HASH_PREFIX)) {
    const rest = storedHash.slice(HASH_PREFIX.length);
    const colon = rest.indexOf(":");
    if (colon <= 0) return { ok: false, legacy: false };
    const iterations = Number(rest.slice(0, colon));
    const hex = rest.slice(colon + 1);
    if (!hex || !Number.isFinite(iterations) || iterations < 10_000) {
      return { ok: false, legacy: false };
    }
    const computed = await pbkdf2Hex(password, salt, iterations);
    return { ok: timingSafeEqualHex(computed, hex), legacy: false };
  }

  const legacyHash = await sha256Hex(password, salt);
  return { ok: timingSafeEqualHex(legacyHash, storedHash), legacy: true };
}

export function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve user from session token.
 * Queries should pass `now` from the client to avoid Date.now() in query paths.
 * Mutations may omit `now` (server clock is fine for writes).
 */
export async function getUserBySession(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  now?: number
): Promise<Doc<"platformUsers"> | null> {
  if (!token) return null;
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
  const clock =
    typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  if (!session || session.expiresAt < clock) return null;
  const user = await ctx.db.get(session.userId);
  // Deactivating a user must invalidate live sessions everywhere, not only on the
  // requireUser path (auth:me used to keep answering for disabled accounts).
  if (!user || !user.active) return null;
  return user;
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  now?: number
): Promise<Doc<"platformUsers">> {
  const user = await getUserBySession(ctx, token, now);
  if (!user || !user.active) throw new Error("No autenticado");
  return user;
}

export async function requireSuperadmin(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  now?: number
): Promise<Doc<"platformUsers">> {
  const user = await requireUser(ctx, token, now);
  if (!user.isSuperadmin) throw new Error("Se requiere superadmin");
  return user;
}

/**
 * Tour content editing (Control Web, branding, a11y publish, spatial sync).
 * Superadmin is platform ops only — create orgs/tours and assign users —
 * and must NOT edit tour content day-to-day. Requires org membership
 * (orgAdmin or tourEditor) — **any** user with a membership row, including
 * accounts created later via auth:createAdminUser. No email allowlists.
 */
export async function userCanEditTour(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"platformUsers">,
  tourId: Id<"tours">
): Promise<boolean> {
  if (user.isSuperadmin) return false;
  const tour = await ctx.db.get(tourId);
  if (!tour) return false;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", user._id).eq("organizationId", tour.organizationId)
    )
    .unique();
  // Any membership role (orgAdmin | tourEditor) grants tour edit for that org.
  return Boolean(membership);
}

/** Alias used by admin tooling docs — same as requireUser. */
export async function getCurrentUser(
  ctx: QueryCtx | MutationCtx,
  token: string | null | undefined,
  now?: number
): Promise<Doc<"platformUsers">> {
  return await requireUser(ctx, token, now);
}

/**
 * Org membership for listing / scoping.
 * Superadmin may see all orgs for platform ops (not for tour content edits).
 */
export async function userBelongsToOrg(
  ctx: QueryCtx | MutationCtx,
  user: Doc<"platformUsers">,
  organizationId: Id<"organizations">
): Promise<boolean> {
  if (user.isSuperadmin) return true;
  const membership = await ctx.db
    .query("memberships")
    .withIndex("by_user_and_org", (q) =>
      q.eq("userId", user._id).eq("organizationId", organizationId)
    )
    .unique();
  return Boolean(membership);
}
