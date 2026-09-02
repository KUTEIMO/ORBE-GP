import { mutation, query, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import {
  getUserBySession,
  hashPassword,
  randomToken,
  requireSuperadmin,
  requireUser,
  verifyPassword,
} from "./lib/authHelpers";

const SESSION_MS = 1000 * 60 * 60 * 24 * 14; // 14 días
const LOGIN_WINDOW_MS = 1000 * 60 * 15; // 15 min
const LOGIN_MAX_ATTEMPTS = 8;

async function recordFailedLogin(ctx: MutationCtx, email: string): Promise<void> {
  const now = Date.now();
  const row = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (!row || now - row.windowStart > LOGIN_WINDOW_MS) {
    if (row) await ctx.db.delete(row._id);
    await ctx.db.insert("loginAttempts", {
      email,
      count: 1,
      windowStart: now,
    });
    return;
  }
  await ctx.db.patch(row._id, { count: row.count + 1 });
}

async function clearLoginAttempts(ctx: MutationCtx, email: string): Promise<void> {
  const row = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (row) await ctx.db.delete(row._id);
}

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      token: v.string(),
      user: v.object({
        id: v.id("platformUsers"),
        email: v.string(),
        name: v.string(),
        isSuperadmin: v.boolean(),
      }),
    }),
    v.object({
      ok: v.literal(false),
      error: v.string(),
    })
  ),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!email.includes("@") || args.password.length < 8) {
      // Sin escritura: se puede fallar sin rollback de intentos
      return { ok: false as const, error: "Credenciales inválidas" };
    }

    const limited = await getRateLimitError(ctx, email);
    if (limited) return { ok: false as const, error: limited };

    const user = await ctx.db
      .query("platformUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (!user || !user.active) {
      await hashPassword(args.password, "invalid-salt");
      await recordFailedLogin(ctx, email);
      return { ok: false as const, error: "Credenciales inválidas" };
    }

    const check = await verifyPassword(
      args.password,
      user.passwordSalt,
      user.passwordHash
    );
    if (!check.ok) {
      await recordFailedLogin(ctx, email);
      return { ok: false as const, error: "Credenciales inválidas" };
    }

    // Migrate legacy SHA-256 hashes to PBKDF2 on successful login.
    if (check.legacy) {
      const upgraded = await hashPassword(args.password, user.passwordSalt);
      await ctx.db.patch(user._id, { passwordHash: upgraded });
    }

    await clearLoginAttempts(ctx, email);

    const token = randomToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_MS,
    });

    return {
      ok: true as const,
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isSuperadmin: user.isSuperadmin,
      },
    };
  },
});

async function getRateLimitError(
  ctx: MutationCtx,
  email: string
): Promise<string | null> {
  const row = await ctx.db
    .query("loginAttempts")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
  if (!row) return null;
  const now = Date.now();
  if (now - row.windowStart > LOGIN_WINDOW_MS) return null;
  if (row.count >= LOGIN_MAX_ATTEMPTS) {
    return "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.";
  }
  return null;
}

export const logout = mutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();
    if (session) await ctx.db.delete(session._id);
    return null;
  },
});

export const me = query({
  args: {
    token: v.optional(v.string()),
    /** Client clock — prefer passing to keep session expiry deterministic in queries. */
    now: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("platformUsers"),
      email: v.string(),
      name: v.string(),
      isSuperadmin: v.boolean(),
      memberships: v.array(
        v.object({
          organizationId: v.id("organizations"),
          orgName: v.string(),
          orgSlug: v.string(),
          role: v.union(v.literal("orgAdmin"), v.literal("tourEditor")),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    const user = await getUserBySession(ctx, args.token, args.now);
    if (!user) return null;

    const memberships = await ctx.db
      .query("memberships")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const detailed = [];
    for (const m of memberships) {
      const org = await ctx.db.get(m.organizationId);
      if (!org) continue;
      detailed.push({
        organizationId: org._id,
        orgName: org.name,
        orgSlug: org.slug,
        role: m.role,
      });
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      isSuperadmin: user.isSuperadmin,
      memberships: detailed,
    };
  },
});

export const createAdminUser = mutation({
  args: {
    token: v.string(),
    email: v.string(),
    name: v.string(),
    password: v.string(),
    organizationId: v.id("organizations"),
    role: v.union(v.literal("orgAdmin"), v.literal("tourEditor")),
    isSuperadmin: v.optional(v.boolean()),
  },
  returns: v.id("platformUsers"),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token);
    const email = args.email.trim().toLowerCase();
    if (args.password.length < 10) {
      throw new Error("La contraseña debe tener al menos 10 caracteres");
    }
    if (!email.includes("@")) throw new Error("Email inválido");
    const existing = await ctx.db
      .query("platformUsers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
    if (existing) throw new Error("Ya existe un usuario con ese email");

    const salt = randomToken().slice(0, 16);
    const passwordHash = await hashPassword(args.password, salt);
    const userId = await ctx.db.insert("platformUsers", {
      email,
      name: args.name.trim(),
      passwordHash,
      passwordSalt: salt,
      isSuperadmin: Boolean(args.isSuperadmin),
      active: true,
      createdAt: Date.now(),
    });

    await ctx.db.insert("memberships", {
      userId,
      organizationId: args.organizationId,
      role: args.role,
      createdAt: Date.now(),
    });

    return userId;
  },
});

export const listUsers = query({
  args: {
    token: v.string(),
    now: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      id: v.id("platformUsers"),
      email: v.string(),
      name: v.string(),
      isSuperadmin: v.boolean(),
      active: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token, args.now);
    const users = await ctx.db.query("platformUsers").collect();
    return users.map((u) => ({
      id: u._id,
      email: u.email,
      name: u.name,
      isSuperadmin: u.isSuperadmin,
      active: u.active,
    }));
  },
});

export const requireSession = query({
  args: {
    token: v.string(),
    now: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    try {
      await requireUser(ctx, args.token, args.now);
      return true;
    } catch {
      return false;
    }
  },
});
