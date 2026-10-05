/**
 * Orbe360 cookie / storage consent banner.
 * Stores preference in localStorage.orbe_cookie_consent (JSON).
 * No third-party analytics scripts are loaded today; banner is informational.
 */
const CONSENT_KEY = "orbe_cookie_consent";

export function getCookieConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCookieConsent(value) {
  const payload = {
    essential: true,
    analytics: false,
    choice: value.choice,
    at: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(payload));
  return payload;
}

function t(key, lang) {
  const es = {
    title: "Datos y almacenamiento local",
    body: "Orbe360 guarda preferencias en tu navegador (tema, idioma, sesión si inicias sesión). No usamos cookies de analítica ni publicidad. Consulta la política de cookies.",
    accept: "Aceptar",
    reject: "Solo esenciales",
    policy: "Ver política",
    close: "Cerrar aviso",
  };
  const en = {
    title: "Data & local storage",
    body: "Orbe360 stores preferences in your browser (theme, language, session if you sign in). We do not use analytics or advertising cookies. See the cookie policy.",
    accept: "Accept",
    reject: "Essential only",
    policy: "View policy",
    close: "Dismiss notice",
  };
  return (lang === "en" ? en : es)[key] ?? key;
}

function getLang() {
  const stored = localStorage.getItem("orbe_lang");
  if (stored === "en" || stored === "es") return stored;
  return (navigator.language || "es").slice(0, 2) === "en" ? "en" : "es";
}

function trapFocus(banner, onEscape) {
  const focusable = banner.querySelectorAll(
    'button, a[href], [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return () => {};
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  banner.addEventListener("keydown", onKey);
  first.focus();
  return () => banner.removeEventListener("keydown", onKey);
}

export function initCookieConsent() {
  if (getCookieConsent()) return;

  const lang = getLang();
  const banner = document.createElement("aside");
  banner.className = "cookie-banner";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-modal", "false");
  banner.setAttribute("aria-labelledby", "cookieBannerTitle");
  banner.innerHTML = `
    <div class="cookie-banner__inner">
      <p class="cookie-banner__title" id="cookieBannerTitle">${t("title", lang)}</p>
      <p class="cookie-banner__body">${t("body", lang)}</p>
      <div class="cookie-banner__actions">
        <button type="button" class="btn btn--primary cookie-banner__accept">${t("accept", lang)}</button>
        <button type="button" class="btn btn--ghost cookie-banner__reject">${t("reject", lang)}</button>
        <a class="cookie-banner__link" href="/plataforma/cookies.html">${t("policy", lang)}</a>
      </div>
    </div>`;

  document.body.appendChild(banner);
  document.body.classList.add("has-cookie-banner");

  const dismiss = (choice) => {
    setCookieConsent({ choice });
    banner.remove();
    document.body.classList.remove("has-cookie-banner");
    untrap?.();
  };

  let untrap = trapFocus(banner, () => dismiss("dismiss"));

  banner.querySelector(".cookie-banner__accept")?.addEventListener("click", () =>
    dismiss("accepted")
  );
  banner.querySelector(".cookie-banner__reject")?.addEventListener("click", () =>
    dismiss("essential_only")
  );

  window.addEventListener("orbe:lang", (e) => {
    const l = e.detail === "en" ? "en" : "es";
    banner.querySelector("#cookieBannerTitle").textContent = t("title", l);
    banner.querySelector(".cookie-banner__body").textContent = t("body", l);
    banner.querySelector(".cookie-banner__accept").textContent = t("accept", l);
    banner.querySelector(".cookie-banner__reject").textContent = t("reject", l);
    banner.querySelector(".cookie-banner__link").textContent = t("policy", l);
  });
}
