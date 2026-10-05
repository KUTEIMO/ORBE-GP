/**
 * Orbe360 legal pages — theme + ES/EN toggle (shared with marketing).
 */
import { getLang, setLang } from "./marketing-i18n.js";

const THEME_KEY = "orbe_theme";

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById("themeToggle");
  if (btn) btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
}

function applyLangBlocks(lang) {
  document.querySelectorAll("[data-lang-block]").forEach((el) => {
    const blockLang = el.getAttribute("data-lang-block");
    el.hidden = blockLang !== lang;
  });
  document.documentElement.lang = lang;
  const langBtn = document.getElementById("langToggle");
  if (langBtn) langBtn.textContent = lang === "es" ? "EN" : "ES";
}

function initLegalShell() {
  applyTheme(getPreferredTheme());
  const lang = getLang();
  applyLangBlocks(lang);

  document.getElementById("themeToggle")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  document.getElementById("langToggle")?.addEventListener("click", () => {
    const next = getLang() === "es" ? "en" : "es";
    setLang(next);
    applyLangBlocks(next);
  });
}

initLegalShell();
