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

async function convexFetch(kind, path, args) {
  const base = getConvexUrl();
  if (!base) {
    throw new Error(
      "Falta la URL de Convex. Ejecuta npx convex dev y configura plataforma/config.js"
    );
  }
  const response = await fetch(`${base}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await response.json();
  if (!response.ok || data.status === "error") {
    throw new Error(data.errorMessage || data.message || "Error Convex");
  }
  return data.value;
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
