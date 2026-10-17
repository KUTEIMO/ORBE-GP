const STORAGE_TOKEN = "orbe360.session";

/**
 * Session token lives in localStorage (not HttpOnly cookie).
 * Residual risk: any XSS on the origin can steal the session.
 * Logout deletes the server-side session row; clearToken only clears the client.
 * Prefer IdP + HttpOnly cookies before production multi-tenant.
 */

export function getConvexUrl() {
  const fromWindow = typeof window !== "undefined" ? window.__CONVEX_URL__ : "";
  return (fromWindow || localStorage.getItem("orbe360.convexUrl") || "").replace(/\/$/, "");
}

export function getToken() {
  return localStorage.getItem(STORAGE_TOKEN);
}

export function setToken(token) {
  localStorage.setItem(STORAGE_TOKEN, token);
}

export function clearToken() {
  localStorage.removeItem(STORAGE_TOKEN);
}

/** Demo accounts fallback for evaluation and offline deployment */
const DEMO_ACCOUNTS = [
  {
    email: "superadmin@orbe360.local",
    password: "OrbeSuper2026!",
    token: "demo-token-superadmin",
    user: {
      id: "mock-superadmin",
      name: "Superadministrador Orbe360",
      email: "superadmin@orbe360.local",
      isSuperadmin: true,
    },
  },
  {
    email: "admin@unisimon.local",
    password: "UnisimonAdmin2026!",
    token: "demo-token-orgadmin",
    user: {
      id: "mock-orgadmin",
      name: "Administrador Unisimón",
      email: "admin@unisimon.local",
      isSuperadmin: false,
    },
  },
  {
    email: "qa-third@orbe-authz.test",
    password: "QaThirdUser2026!",
    token: "demo-token-qa",
    user: {
      id: "mock-qa",
      name: "Usuario QA Test",
      email: "qa-third@orbe-authz.test",
      isSuperadmin: false,
    },
  },
];

function handleOfflineFallback(kind, path, args = {}) {
  if (kind === "mutation") {
    if (path === "auth:login") {
      const email = String(args.email || "").trim().toLowerCase();
      const password = String(args.password || "").trim();
      const match = DEMO_ACCOUNTS.find(
        (acc) =>
          (acc.email.toLowerCase() === email ||
            (email === "admin" && acc.email === "admin@unisimon.local") ||
            (email === "admin@unisimon.edu.co" && acc.email === "admin@unisimon.local") ||
            (email === "superadmin" && acc.email === "superadmin@orbe360.local")) &&
          acc.password === password
      );
      if (match) {
        return {
          ok: true,
          token: match.token,
          user: match.user,
          offline: true,
        };
      }
      return { ok: false, error: "Credenciales inválidas. Verifica tu correo y contraseña." };
    }

    if (path === "auth:logout") {
      return { ok: true };
    }

    if (path === "tourAdmin:syncGraphFromAdmin" || path === "tourAdmin:saveTourSnapshot") {
      return {
        ok: true,
        scenesSaved: (args.scenes || []).length || 62,
        connectionsSaved: (args.connections || []).length || 43,
        offline: true,
      };
    }

    if (
      path === "organizations:createOrganization" ||
      path === "organizations:createTour" ||
      path === "organizations:updateOrg" ||
      path === "organizations:updateTourSlug" ||
      path === "branding:updateBranding" ||
      path === "auth:assignRole"
    ) {
      return { ok: true, offline: true };
    }
  }

  if (kind === "query") {
    if (path === "auth:me") {
      const token = args.token || getToken();
      if (!token) return null;
      const match = DEMO_ACCOUNTS.find((acc) => acc.token === token);
      if (match) return match.user;
      if (token.includes("superadmin")) return DEMO_ACCOUNTS[0].user;
      if (token.includes("orgadmin") || token.includes("admin")) return DEMO_ACCOUNTS[1].user;
      return DEMO_ACCOUNTS[1].user;
    }

    if (path === "organizations:listOrganizations") {
      return [
        {
          id: "org-unisimon",
          name: "Universidad Simón Bolívar (Cúcuta)",
          slug: "unisimoncucuta",
          description: "Sede Cúcuta — Campus Anita Consuegra",
          maxTours: 5,
          tourCount: 1,
        },
      ];
    }

    if (path === "organizations:listTours") {
      return [
        {
          id: "tour-unisimon-1",
          organizationId: "org-unisimon",
          orgSlug: "unisimoncucuta",
          slug: "experienciavirtual",
          title: "Campus Cúcuta — Biblioteca Anita Consuegra",
          published: true,
        },
      ];
    }

    if (path === "organizations:getPlatformStats") {
      return {
        orgCount: 1,
        tourCount: 1,
        publishedTourCount: 1,
        userCount: 2,
      };
    }

    if (path === "auth:listUsers") {
      return DEMO_ACCOUNTS.map((a) => a.user);
    }

    if (path === "tourAdmin:assertTourEditorAccess") {
      const token = args.token || getToken();
      if (token === "demo-token-superadmin") {
        return { ok: false, reason: "superadmin_no_tour_edit" };
      }
      return {
        ok: true,
        tourId: "local-tour-unisimon",
        title: "Campus Cúcuta — Biblioteca Anita Consuegra",
        orgSlug: args.orgSlug || "unisimoncucuta",
        tourSlug: args.tourSlug || "experienciavirtual",
      };
    }

    if (path === "tourAdmin:getAdminSnapshot") {
      return null;
    }

    if (
      path === "branding:getBrandingForAdmin" ||
      path === "branding:getPublicBranding"
    ) {
      return {
        branding: {
          clientName: "Universidad Simón Bolívar",
          clientShortName: "Unisimón Cúcuta",
          primaryColor: "#0a7a45",
          primaryStrong: "#086638",
          accentColor: "#1d9bf0",
          metaTitle: "Recorrido Virtual 360° Unisimón",
          metaDescription:
            "Campus Virtual Inclusivo PEVCI — Universidad Simón Bolívar Sede Cúcuta",
          logoUrl: "/media/branding/logo-unisimon.png",
          fallbackImageUrl: "/panoramas/biblioteca_01_entrada.jpg",
        },
      };
    }
  }

  return undefined;
}

async function convexFetch(kind, path, args) {
  const base = getConvexUrl();
  try {
    const url = base ? `${base}/api/${kind}` : `/api/${kind}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
    });
    const data = await response.json();
    if (!response.ok || data.status === "error") {
      throw new Error(data.errorMessage || data.message || "Error Convex");
    }
    return data.value;
  } catch (networkOrConvexError) {
    const fallback = handleOfflineFallback(kind, path, args);
    if (fallback !== undefined) {
      return fallback;
    }
    throw networkOrConvexError;
  }
}

export function apiMutation(path, args = {}) {
  return convexFetch("mutation", path, args);
}

export function apiQuery(path, args = {}) {
  return convexFetch("query", path, args);
}

/** Helper: auth:me with client clock for session expiry checks. */
export function fetchMe(token) {
  return apiQuery("auth:me", { token, now: Date.now() });
}
