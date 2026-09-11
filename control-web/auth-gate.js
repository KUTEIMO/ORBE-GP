/**
 * Hard gate for Orbe360 Control Web (editors only).
 * Session = localStorage token (`orbe360.session`); authz = Convex membership.
 * Public visitor tours stay public; this surface must never load without access.
 */

export const SESSION_KEY = 'orbe360.session';

export function getSessionToken() {
  return localStorage.getItem(SESSION_KEY);
}

export function clearSessionToken() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Loop-safe login URL with return path back to Control Web.
 * Matches plataforma/login.html `?return=` (same-origin path only).
 */
export function controlWebLoginUrl(
  returnPath = `${location.pathname}${location.search}${location.hash}`
) {
  const path =
    returnPath.startsWith('/') &&
    !returnPath.startsWith('//') &&
    !returnPath.includes('://')
      ? returnPath
      : '/';
  if (path.includes('/plataforma/login')) {
    return '/plataforma/login.html';
  }
  return `/plataforma/login.html?return=${encodeURIComponent(path)}`;
}

function setGateMessage(htmlOrText, asHtml = false) {
  const gateEl = document.getElementById('cwAuthGate');
  if (!gateEl) return;
  if (asHtml) gateEl.innerHTML = htmlOrText;
  else gateEl.textContent = htmlOrText;
}

function paintDenied(orgSlug, tourSlug, reason) {
  document.body.classList.add('cw-denied');
  document.body.classList.remove('cw-locked', 'cw-authorized');
  const safeOrg = String(orgSlug || '').replace(/[<>&"]/g, '');
  const safeTour = String(tourSlug || '').replace(/[<>&"]/g, '');
  const detail =
    reason === 'tour_not_found'
      ? 'Tour no encontrado o no publicado para edición.'
      : reason === 'org_mismatch'
        ? 'El tour no pertenece a esa organización.'
        : 'Tu cuenta no tiene membresía de editor en esta organización.';
  setGateMessage(
    `<h2>Acceso denegado</h2>
     <p>${detail}</p>
     <p class="cw-auth-gate__meta"><code>/${safeOrg}/${safeTour}/control-web/</code></p>
     <p class="cw-auth-gate__actions">
       <a class="btn btn--primary" href="/plataforma/login.html">Cambiar de cuenta</a>
       <a class="btn" href="/">Orbe360</a>
     </p>`,
    true
  );
}

/**
 * Require session + tour editor membership for orgSlug+tourSlug.
 * On failure: redirect to login or paint deny UI (never loads editor data).
 *
 * @param {{ orgSlug: string|null, tourSlug: string|null, convexFetch: Function }} opts
 * @returns {Promise<{ ok: true, tourId: string, title?: string } | { ok: false, reason?: string }>}
 */
export async function requireControlWebAccess({ orgSlug, tourSlug, convexFetch }) {
  document.body.classList.add('cw-locked');
  document.body.classList.remove('cw-authorized', 'cw-denied');
  setGateMessage('Verificando acceso al editor…');

  if (!orgSlug || !tourSlug) {
    setGateMessage(
      'Falta contexto /{org}/{tour}/control-web/. Redirigiendo a login…'
    );
    location.replace(controlWebLoginUrl());
    return { ok: false, reason: 'missing_context' };
  }

  const token = getSessionToken();
  if (!token) {
    setGateMessage('Sesión requerida. Redirigiendo a login…');
    location.replace(controlWebLoginUrl());
    return { ok: false, reason: 'unauthenticated' };
  }

  try {
    const access = await convexFetch('query', 'tourAdmin:assertTourEditorAccess', {
      token,
      orgSlug,
      tourSlug,
      now: Date.now(),
    });

    if (!access?.ok) {
      const reason = access?.reason || 'forbidden';
      if (reason === 'unauthenticated') {
        clearSessionToken();
        location.replace(controlWebLoginUrl());
        return { ok: false, reason };
      }
      if (reason === 'superadmin_no_tour_edit') {
        setGateMessage('Superadmin no administra contenido de tours. Redirigiendo…');
        location.replace('/plataforma/superadmin.html');
        return { ok: false, reason };
      }
      paintDenied(orgSlug, tourSlug, reason);
      const focusTarget =
        document.querySelector('#cwAuthGate a.btn--primary') ||
        document.querySelector('#cwAuthGate a');
      if (focusTarget) {
        window.setTimeout(() => focusTarget.focus(), 0);
      }
      return { ok: false, reason };
    }

    document.body.classList.remove('cw-locked', 'cw-denied');
    document.body.classList.add('cw-authorized');
    const gateEl = document.getElementById('cwAuthGate');
    if (gateEl) gateEl.hidden = true;

    return {
      ok: true,
      tourId: access.tourId,
      title: access.title,
      orgSlug: access.orgSlug,
      tourSlug: access.tourSlug,
    };
  } catch (_e) {
    clearSessionToken();
    setGateMessage('Sesión inválida o error de red. Redirigiendo a login…');
    location.replace(controlWebLoginUrl());
    return { ok: false, reason: 'unauthenticated' };
  }
}
