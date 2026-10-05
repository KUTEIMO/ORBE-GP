/**
 * Orbe360 marketing motion v1 — scroll storytelling, theme, dynamic bg.
 * CSS reveals + rAF; no anime.js on critical path (doc 62).
 */
import { applyI18n, getLang, setLang } from "./marketing-i18n.js";
import { initCookieConsent } from "./cookie-consent.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const THEME_KEY = "orbe_theme";

/* —— Theme —— */
function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    const lang = getLang();
    const label =
      theme === "dark"
        ? document.documentElement.lang === "en"
          ? "Switch to light mode"
          : "Activar modo claro"
        : document.documentElement.lang === "en"
          ? "Switch to dark mode"
          : "Activar modo oscuro";
    btn.setAttribute("aria-label", label);
  }
}

function initTheme() {
  applyTheme(getPreferredTheme());
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      applyTheme(current === "dark" ? "light" : "dark");
      applyI18n();
    });
  }
}

/* —— i18n —— */
function initI18n() {
  document.documentElement.lang = getLang();
  applyI18n();
  const btn = document.getElementById("langToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      setLang(getLang() === "es" ? "en" : "es");
    });
  }
}

/* —— Nav scroll state —— */
const nav = document.getElementById("publicNav");
if (nav) {
  const onScroll = () => {
    const pastHero = window.scrollY > Math.min(window.innerHeight * 0.45, 360);
    nav.classList.toggle("is-scrolled", pastHero);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

/* —— Scroll progress —— */
const progressBar = document.getElementById("scrollProgress");
function updateProgress() {
  if (!progressBar) return;
  const doc = document.documentElement;
  const scrollTop = doc.scrollTop || document.body.scrollTop;
  const height = doc.scrollHeight - doc.clientHeight;
  const pct = height > 0 ? Math.min(100, Math.round((scrollTop / height) * 100)) : 0;
  progressBar.style.setProperty("--mk-progress", `${pct}%`);
  progressBar.setAttribute("aria-valuenow", String(pct));
}
window.addEventListener("scroll", updateProgress, { passive: true });
updateProgress();

/* —— Reveals —— */
const heroReveals = document.querySelectorAll(".hero [data-reveal]");
if (reduceMotion) {
  document.querySelectorAll("[data-reveal]").forEach((el) => el.classList.add("is-in"));
} else {
  requestAnimationFrame(() => {
    heroReveals.forEach((el) => el.classList.add("is-in"));
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
        } else {
          entry.target.classList.remove("is-in");
        }
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
  );

  document.querySelectorAll("[data-reveal]").forEach((el) => {
    if (!el.closest(".hero")) io.observe(el);
  });
}

/* Stagger children in grids */
document.querySelectorAll("[data-stagger]").forEach((container) => {
  container.querySelectorAll("[data-reveal]").forEach((child, i) => {
    child.style.setProperty("--stagger-i", String(i));
  });
});

/* —— Parallax hero orb —— */
const parallaxEl = document.querySelector("[data-parallax]");
if (parallaxEl && !reduceMotion) {
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    const shift = Math.min(y * 0.14, 64);
    const scale = 1 - Math.min(y * 0.00035, 0.08);
    parallaxEl.style.transform = `translate3d(0, ${shift}px, 0) scale(${scale})`;
    ticking = false;
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
}

/* —— Dynamic background by story chapter —— */
const bgRoot = document.getElementById("storyBg");
const chapters = [...document.querySelectorAll("[data-story-chapter]")];

const CHAPTER_PALETTES = [
  { h: 205, s: 85, l: 42, accent: 199 }, // hero — deep sky
  { h: 12, s: 72, l: 48, accent: 205 }, // problema — warm alert
  { h: 200, s: 78, l: 52, accent: 199 }, // solución
  { h: 210, s: 55, l: 58, accent: 199 }, // flujo
  { h: 195, s: 70, l: 45, accent: 175 }, // a11y
  { h: 205, s: 65, l: 38, accent: 199 }, // caso
  { h: 215, s: 80, l: 32, accent: 199 }, // cta
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function applyBgPalette(index, blend = 1) {
  if (!bgRoot) return;
  const pal = CHAPTER_PALETTES[index] ?? CHAPTER_PALETTES[0];
  const prev = CHAPTER_PALETTES[Math.max(0, index - 1)] ?? pal;
  const t = reduceMotion ? 1 : blend;
  const h = lerp(prev.h, pal.h, t);
  const s = lerp(prev.s, pal.s, t);
  const l = lerp(prev.l, pal.l, t);
  const a = lerp(prev.accent, pal.accent, t);
  bgRoot.style.setProperty("--mk-bg-h", String(h));
  bgRoot.style.setProperty("--mk-bg-s", `${s}%`);
  bgRoot.style.setProperty("--mk-bg-l", `${l}%`);
  bgRoot.style.setProperty("--mk-bg-accent", String(a));
  bgRoot.dataset.chapter = String(index);
}

let activeChapter = 0;

function updateBgFromScroll() {
  if (!chapters.length) return;
  const mid = window.scrollY + window.innerHeight * 0.42;
  let best = 0;
  let bestDist = Infinity;
  chapters.forEach((sec) => {
    const rect = sec.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const center = top + rect.height * 0.5;
    const dist = Math.abs(mid - center);
    if (dist < bestDist) {
      bestDist = dist;
      best = Number(sec.getAttribute("data-story-chapter")) || 0;
    }
  });
  if (best !== activeChapter) {
    activeChapter = best;
    applyBgPalette(best);
  }
}

if (bgRoot && chapters.length) {
  applyBgPalette(0);
  const chapterIo = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRatio > 0.25) {
          const idx = Number(entry.target.getAttribute("data-story-chapter")) || 0;
          activeChapter = idx;
          applyBgPalette(idx);
        }
      }
    },
    { threshold: [0.25, 0.5, 0.75], rootMargin: "-20% 0px -20% 0px" }
  );
  chapters.forEach((sec) => chapterIo.observe(sec));
  window.addEventListener("scroll", updateBgFromScroll, { passive: true });
}

/* —— Active nav link —— */
const navLinks = document.querySelectorAll(".public-nav nav a[href^='#']");
const sectionIds = [...navLinks].map((a) => a.getAttribute("href")?.slice(1)).filter(Boolean);

function updateActiveNav() {
  const y = window.scrollY + 120;
  let current = sectionIds[0];
  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= y) current = id;
  }
  navLinks.forEach((a) => {
    const href = a.getAttribute("href")?.slice(1);
    a.classList.toggle("is-active", href === current);
  });
}
window.addEventListener("scroll", updateActiveNav, { passive: true });
updateActiveNav();

initTheme();
initI18n();
initCookieConsent();
