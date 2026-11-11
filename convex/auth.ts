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
import { writeAuditLog } from "./audit";

const SESSION_MS = 1000 * 60 * 60 * 24 * 7; // 7 días
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
      .withIndex("by_user_and_org", (q) => q.eq("userId", user._id))
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
    const actor = await requireSuperadmin(ctx, args.token);
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

    await writeAuditLog(ctx, {
      user: actor,
      actorRole: "superadmin",
      organizationId: args.organizationId,
      action: "auth:createAdminUser",
      target: email,
      detail: `Rol: ${args.role}`,
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

export const listUsersDetailed = query({
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
      memberships: v.array(
        v.object({
          membershipId: v.id("memberships"),
          organizationId: v.id("organizations"),
          orgSlug: v.string(),
          orgName: v.string(),
          role: v.union(v.literal("orgAdmin"), v.literal("tourEditor")),
        })
      ),
    })
  ),
  handler: async (ctx, args) => {
    await requireSuperadmin(ctx, args.token, args.now);
    const users = await ctx.db.query("platformUsers").collect();
    const out = [];
    for (const u of users) {
      const ms = await ctx.db
        .query("memberships")
        .withIndex("by_user_and_org", (q) => q.eq("userId", u._id))
        .collect();
      const detailed = [];
      for (const m of ms) {
        const org = await ctx.db.get(m.organizationId);
        if (!org) continue;
        detailed.push({
          membershipId: m._id,
          organizationId: org._id,
          orgSlug: org.slug,
          orgName: org.name,
          role: m.role,
        });
      }
      out.push({
        id: u._id,
        email: u.email,
        name: u.name,
        isSuperadmin: u.isSuperadmin,
        active: u.active,
        memberships: detailed,
      });
    }
    return out;
  },
});

export const setUserActive = mutation({
  args: {
    token: v.string(),
    userId: v.id("platformUsers"),
    active: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSuperadmin(ctx, args.token);
    if (actor._id === args.userId && !args.active) {
      throw new Error("No puedes desactivar tu propia cuenta activa");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Usuario no encontrado");
    await ctx.db.patch(args.userId, { active: args.active });
    if (!args.active) {
      const sessions = await ctx.db
        .query("sessions")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const s of sessions) await ctx.db.delete(s._id);
    }
    await writeAuditLog(ctx, {
      user: actor,
      actorRole: "superadmin",
      action: args.active ? "auth:activateUser" : "auth:deactivateUser",
      target: target.email,
    });
    return null;
  },
});

export const setUserRole = mutation({
  args: {
    token: v.string(),
    membershipId: v.id("memberships"),
    role: v.union(v.literal("orgAdmin"), v.literal("tourEditor")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSuperadmin(ctx, args.token);
    const membership = await ctx.db.get(args.membershipId);
    if (!membership) throw new Error("Membresía no encontrada");
    const targetUser = await ctx.db.get(membership.userId);
    await ctx.db.patch(args.membershipId, { role: args.role });
    await writeAuditLog(ctx, {
      user: actor,
      actorRole: "superadmin",
      organizationId: membership.organizationId,
      action: "auth:setUserRole",
      target: targetUser?.email || String(membership.userId),
      detail: `Rol -> ${args.role}`,
    });
    return null;
  },
});

export const resetUserPassword = mutation({
  args: {
    token: v.string(),
    userId: v.id("platformUsers"),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requireSuperadmin(ctx, args.token);
    if (args.newPassword.length < 10) {
      throw new Error("La contraseña debe tener al menos 10 caracteres");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("Usuario no encontrado");
    const salt = randomToken().slice(0, 16);
    const passwordHash = await hashPassword(args.newPassword, salt);
    await ctx.db.patch(args.userId, { passwordHash, passwordSalt: salt });
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const s of sessions) await ctx.db.delete(s._id);
    await writeAuditLog(ctx, {
      user: actor,
      actorRole: "superadmin",
      action: "auth:resetUserPassword",
      target: target.email,
    });
    return null;
  },
});

export const changePassword = mutation({
  args: {
    token: v.string(),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    if (args.newPassword.length < 10) {
      throw new Error("La nueva contraseña debe tener al menos 10 caracteres");
    }
    const check = await verifyPassword(
      args.currentPassword,
      user.passwordSalt,
      user.passwordHash
    );
    if (!check.ok) {
      throw new Error("La contraseña actual no es correcta");
    }
    const salt = randomToken().slice(0, 16);
    const passwordHash = await hashPassword(args.newPassword, salt);
    await ctx.db.patch(user._id, { passwordHash, passwordSalt: salt });
    // Revoke other live sessions for hygiene; keep the active token alive.
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const s of sessions) {
      if (s.token !== args.token) await ctx.db.delete(s._id);
    }
    await writeAuditLog(ctx, {
      user,
      action: "auth:changePassword",
      target: user.email,
    });
    return null;
  },
});

export const updateProfile = mutation({
  args: {
    token: v.string(),
    name: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx, args.token);
    const cleanName = args.name.trim();
    if (cleanName.length < 2) {
      throw new Error("El nombre debe tener al menos 2 caracteres");
    }
    await ctx.db.patch(user._id, { name: cleanName });
    await writeAuditLog(ctx, {
      user,
      action: "auth:updateProfile",
      target: user.email,
      detail: cleanName,
    });
    return cleanName;
  },
});

export const revokeAllUserSessions = mutation({
  args: {
    token: v.string(),
    userId: v.optional(v.id("platformUsers")),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const actor = await requireUser(ctx, args.token);
    const targetId = args.userId ?? actor._id;
    if (targetId !== actor._id && !actor.isSuperadmin) {
      throw new Error("No autorizado para cerrar sesiones de otro usuario");
    }
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", targetId))
      .collect();
    let count = 0;
    for (const s of sessions) {
      await ctx.db.delete(s._id);
      count += 1;
    }
    await writeAuditLog(ctx, {
      user: actor,
      action: "auth:revokeSessions",
      target: String(targetId),
      detail: `${count} sesión(es) revocadas`,
    });
    return count;
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
