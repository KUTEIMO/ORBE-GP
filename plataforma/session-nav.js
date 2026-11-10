/**
 * Orbe360 landing — role-aware session banner, CTAs & sign-out without static coupling.
 */
import { apiMutation, apiQuery, clearToken, fetchMe, getToken } from "/plataforma/convex-client.js";
import { controlWebHref, orgAdminHref, DEFAULT_TOUR_SLUG } from "/src/tourSlug.js";

function applyLoggedInCopy(authState) {
  const chip = document.getElementById("navSessionChip");
  const navAuth = document.getElementById("navAuthLink");
  const navLogout = document.getElementById("navLogoutBtn");
  const heroAuth = document.getElementById("heroAuthLink");
  const ctaAuth = document.getElementById("ctaAuthLink");
  const footAuth = document.getElementById("footAuthLink");
  if (!authState || !authState.me) return;

  const { me, roleKind, primaryHref, orgLabel, cwHref } = authState;
  const isEn = document.documentElement.lang === "en";

  const roleShort =
    roleKind === "platform"
      ? (isEn ? "Platform" : "Plataforma")
      : roleKind === "orgAdmin"
        ? (isEn ? "Org Admin" : "Admin Org")
        : (isEn ? "Editor" : "Editor");

  if (chip) {
    chip.textContent = `${me.name} · ${roleShort}`;
    chip.title = `${me.email} (${roleShort})`;
    chip.hidden = false;
  }
  if (navLogout) {
    navLogout.textContent = isEn ? "Log out" : "Salir";
    navLogout.hidden = false;
  }
  if (navAuth) {
    navAuth.removeAttribute("data-i18n");
    navAuth.href = primaryHref;
    navAuth.textContent =
      roleKind === "platform"
        ? (isEn ? "Platform Dashboard" : "Dashboard Plataforma")
        : roleKind === "orgAdmin"
          ? (isEn ? `Org Panel (${orgLabel})` : `Mi Panel (${orgLabel})`)
          : "Control Web";
  }
  if (heroAuth) {
    heroAuth.removeAttribute("data-i18n");
    heroAuth.href = roleKind === "platform" ? primaryHref : (cwHref || primaryHref);
    heroAuth.textContent =
      roleKind === "platform"
        ? (isEn ? "Open Platform Dashboard" : "Abrir Dashboard Plataforma")
        : roleKind === "orgAdmin"
          ? (isEn ? `Open Control Web (${orgLabel})` : `Abrir Control Web (${orgLabel})`)
          : (isEn ? "Open Control Web Editor" : "Abrir Editor Control Web");
  }
  if (ctaAuth) {
    ctaAuth.removeAttribute("data-i18n");
    ctaAuth.href = primaryHref;
    ctaAuth.textContent =
      roleKind === "platform"
        ? (isEn ? "Go to Platform Dashboard" : "Ir al Dashboard Plataforma")
        : roleKind === "orgAdmin"
          ? (isEn ? `Manage ${orgLabel}` : `Administrar ${orgLabel}`)
          : (isEn ? "Edit tours in Control Web" : "Editar en Control Web");
  }
  if (footAuth) {
    footAuth.removeAttribute("data-i18n");
    footAuth.href = "/plataforma/login.html?switch=1";
    footAuth.textContent = isEn ? `Account (${me.name})` : `Mi cuenta (${me.name})`;
  }
}

export async function initSessionAwareLanding() {
  const token = getToken();
  if (!token) return;
  try {
    const me = await fetchMe(token);
    if (!me) {
      clearToken();
      return;
    }

    let roleKind = "orgAdmin";
    let primaryHref = "/plataforma/login.html";
    let orgLabel = "Orbe360";
    let cwHref = "";

    if (me.isSuperadmin) {
      roleKind = "platform";
      primaryHref = "/plataforma/superadmin.html";
    } else {
      const memberships = Array.isArray(me.memberships) ? me.memberships : [];
      const adminMembership = memberships.find((m) => m.role === "orgAdmin");
      const primaryMembership = adminMembership || memberships[0];
      if (primaryMembership) {
        orgLabel = primaryMembership.orgName || primaryMembership.orgSlug;
        roleKind = adminMembership ? "orgAdmin" : "tourEditor";
        const orgTours = await apiQuery("organizations:listTours", {
          token,
          organizationId: primaryMembership.organizationId,
          now: Date.now(),
        }).catch(() => []);
        const firstTour =
          orgTours.find((t) => t.slug === DEFAULT_TOUR_SLUG) || orgTours[0];
        if (firstTour) {
          cwHref = controlWebHref({
            orgSlug: primaryMembership.orgSlug,
            tourSlug: firstTour.slug,
          });
        }
        primaryHref =
          roleKind === "orgAdmin"
            ? orgAdminHref(primaryMembership.orgSlug)
            : (cwHref || orgAdminHref(primaryMembership.orgSlug));
      }
    }

    const state = { me, roleKind, primaryHref, orgLabel, cwHref };
    applyLoggedInCopy(state);
    window.addEventListener("orbe:lang", () => applyLoggedInCopy(state));

    document.getElementById("navLogoutBtn")?.addEventListener("click", async () => {
      try {
        await apiMutation("auth:logout", { token });
      } catch (_e) {
        /* ignore remote logout errors */
      }
      clearToken();
      location.reload();
    });
  } catch (_e) {
    /* keep session token intact if Convex is offline */
  }
}

