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

/** Helper: communicate directly with Convex HTTP API without offline shadows. */
async function convexFetch(kind, path, args) {
  const base = getConvexUrl();
  if (!base) {
    throw new Error(
      "URL de Convex no configurada (__CONVEX_URL__ vacío). Verifica plataforma/config.js."
    );
  }
  let response;
  try {
    const url = `${base}/api/${kind}`;
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
    });
  } catch (networkErr) {
    throw new Error(
      "No se pudo conectar con el servidor de datos. Verifica que el servicio esté activo e inténtalo de nuevo.",
      { cause: networkErr }
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new Error(`Respuesta inválida del servidor (${response.status}).`, {
      cause: parseErr,
    });
  }
  if (!response.ok || data?.status === "error") {
    throw new Error(data?.errorMessage || data?.message || `Error del servidor (${response.status})`);
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
