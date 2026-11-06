/**
 * Orbe360 marketing motion v1 — scroll storytelling, theme, dynamic bg.
 * CSS reveals + rAF; no anime.js on critical path (doc 62).
 */
import { applyI18n, getLang, setLang } from "./marketing-i18n.js";
import { initCookieConsent } from "./cookie-consent.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const THEME_KEY = "orbe_theme";

/* -- Theme (OS Preference + User Override) -- */
function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme, persist = false) {
  document.documentElement.setAttribute("data-theme", theme);
  if (persist) {
    localStorage.setItem(THEME_KEY, theme);
  }
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    const isEn = (document.documentElement.lang || getLang()) === "en";
    const label =
      theme === "dark"
        ? (isEn ? "Switch to light mode" : "Activar modo claro")
        : (isEn ? "Switch to dark mode" : "Activar modo oscuro");
    btn.setAttribute("aria-label", label);
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    applyTheme(stored, false);
  } else {
    applyTheme(getPreferredTheme(), false);
  }

  // Sincronizacion dinamica con preferencia de sistema/navegador
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSchemeChange = (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? "dark" : "light", false);
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", handleSchemeChange);
    } else if (mq.addListener) {
      mq.addListener(handleSchemeChange);
    }
  }

  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next, true);
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
    const pastHero = window.scrollY > 24;
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


/* == Dynamic Interactive Sedes Accordion == */
function initSedesAccordion() {
  const accordion = document.querySelector(".sedes-accordion");
  if (!accordion) return;
  const cards = accordion.querySelectorAll(".sede-card");
  if (!cards.length) return;

  let hoverTimer = null;

  function activateCard(card) {
    cards.forEach((c) => c.classList.remove("is-active"));
    card.classList.add("is-active");
    accordion.classList.add("has-interaction");
  }

  // Activar la primera tarjeta por defecto
  if (!accordion.querySelector(".sede-card.is-active")) {
    activateCard(cards[0]);
  }

  cards.forEach((card) => {
    card.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimer);
      // Suave retardo de 85ms: elimina la hipersensibilidad al pasar el cursor rapido
      hoverTimer = setTimeout(() => {
        activateCard(card);
      }, 85);
    });

    card.addEventListener("mouseleave", () => {
      clearTimeout(hoverTimer);
    });

    card.addEventListener("click", (e) => {
      // En desktop, si la tarjeta no esta activa, el primer click la expande
      if (window.innerWidth >= 900 && !card.classList.contains("is-active")) {
        e.preventDefault();
        activateCard(card);
      }
    });
  });

  // Al salir del acordeon, se mantiene abierta la ultima seleccionada
  accordion.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimer);
  });
}

/* == Ambient 3D Motion Canvas ("Burbujas Salvapantallas", Orbe Cursor & Geometria 3D) == */
function initAmbient3D() {
  const bgCanvas = document.getElementById("ambient3dCanvas");
  const cursorCanvas = document.getElementById("cursorOrbCanvas");
  if (!bgCanvas || reduceMotion) return;

  const bgCtx = bgCanvas.getContext("2d");
  const cursorCtx = cursorCanvas ? cursorCanvas.getContext("2d") : null;
  if (!bgCtx) return;

  let width = 0;
  let height = 0;
  let animationFrameId = null;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    bgCanvas.width = width;
    bgCanvas.height = height;
    if (cursorCanvas) {
      cursorCanvas.width = width;
      cursorCanvas.height = height;
    }
  }
  window.addEventListener("resize", resize, { passive: true });
  resize();

  const getDocHeight = () => Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
    6400
  );

  // Orbes distribuidos a lo largo de TODA la landing page (desde Hero hasta el Footer)
  // Rebotan suavemente contra los bordes de la pantalla (fisicas elasticas salvapantallas)
  // y se mantienen balanceados sin saturar.
  const orbs = [
    // 1. Hero
    {
      x: Math.max(160, width * 0.22),
      worldY: 340,
      minY: 50,
      maxY: 1020,
      vx: 1.15,
      vy: 0.82,
      radius: 175,
      hue: 202,
      sat: 92,
      light: 48,
      squishX: 1,
      squishY: 1
    },
    // 2. Transicion Hero - Problema / Logos
    {
      x: Math.max(180, width * 0.78),
      worldY: 1200,
      minY: 750,
      maxY: 1750,
      vx: -1.05,
      vy: 0.92,
      radius: 205,
      hue: 214,
      sat: 88,
      light: 46,
      squishX: 1,
      squishY: 1
    },
    // 3. Solucion / Plataforma
    {
      x: Math.max(160, width * 0.26),
      worldY: 2020,
      minY: 1550,
      maxY: 2550,
      vx: 1.22,
      vy: -0.88,
      radius: 190,
      hue: 196,
      sat: 94,
      light: 50,
      squishX: 1,
      squishY: 1
    },
    // 4. Flujo interactivo
    {
      x: Math.max(170, width * 0.76),
      worldY: 2820,
      minY: 2350,
      maxY: 3350,
      vx: -1.12,
      vy: 1.02,
      radius: 195,
      hue: 208,
      sat: 86,
      light: 46,
      squishX: 1,
      squishY: 1
    },
    // 5. Acordeon Sedes 360
    {
      x: Math.max(180, width * 0.32),
      worldY: 3620,
      minY: 3150,
      maxY: 4200,
      vx: 1.18,
      vy: -0.84,
      radius: 215,
      hue: 218,
      sat: 90,
      light: 48,
      squishX: 1,
      squishY: 1
    },
    // 6. Soluciones Empresa
    {
      x: Math.max(160, width * 0.72),
      worldY: 4420,
      minY: 3950,
      maxY: 5000,
      vx: -1.08,
      vy: 0.94,
      radius: 190,
      hue: 200,
      sat: 92,
      light: 48,
      squishX: 1,
      squishY: 1
    },
    // 7. Accesibilidad Universal WCAG
    {
      x: Math.max(160, width * 0.28),
      worldY: 5180,
      minY: 4700,
      maxY: 5750,
      vx: 1.12,
      vy: -0.96,
      radius: 185,
      hue: 194,
      sat: 94,
      light: 50,
      squishX: 1,
      squishY: 1
    },
    // 8. CTA Final & Footer (Llega hasta el final de la pagina)
    {
      x: Math.max(170, width * 0.58),
      worldY: 5950,
      minY: 5450,
      maxY: 6800,
      vx: -1.06,
      vy: 0.88,
      radius: 205,
      hue: 206,
      sat: 90,
      light: 46,
      squishX: 1,
      squishY: 1
    }
  ];

  // Orbe cursor interactivo (en capa superior z-index 999: siempre visible y fluido)
  const mouseOrb = {
    x: -200,
    y: -200,
    targetX: -200,
    targetY: -200,
    active: false,
    radius: 7.5,
    haloRadius: 42,
    trail: []
  };

  window.addEventListener(
    "mousemove",
    (e) => {
      mouseOrb.targetX = e.clientX;
      mouseOrb.targetY = e.clientY;
      mouseOrb.active = true;
    },
    { passive: true }
  );

  window.addEventListener(
    "mouseleave",
    () => {
      mouseOrb.active = false;
    },
    { passive: true }
  );

  // Geometria 3D espacial (anillo toroidal wireframe estilo Mobbin con perspectiva)
  const ringPoints = [];
  const ringSegments = 32;
  const ringRadius = 140;
  for (let i = 0; i < ringSegments; i++) {
    const theta = (i / ringSegments) * Math.PI * 2;
    ringPoints.push({
      x: Math.cos(theta) * ringRadius,
      y: Math.sin(theta) * ringRadius,
      z: Math.sin(theta * 2) * 38
    });
  }

  function render(time) {
    const now = time || 0;
    bgCtx.clearRect(0, 0, width, height);
    if (cursorCtx) {
      cursorCtx.clearRect(0, 0, width, height);
    }

    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const docHeight = getDocHeight();
    const maxScroll = Math.max(1, docHeight - height);
    const scrollProgress = scrollY / maxScroll;

    // Actualizar posicion del orbe seguidor con inercia
    if (mouseOrb.active) {
      mouseOrb.x += (mouseOrb.targetX - mouseOrb.x) * 0.18;
      mouseOrb.y += (mouseOrb.targetY - mouseOrb.y) * 0.18;
      mouseOrb.trail.unshift({ x: mouseOrb.x, y: mouseOrb.y });
      if (mouseOrb.trail.length > 7) mouseOrb.trail.pop();
    }

    // 1. Fisicas y Render de Orbes Salvapantallas (Rebotes y Deformacion elastica)
    orbs.forEach((orb, orbIdx) => {
      // Dinamizar el limite inferior del ultimo orbe segun el tamano real del documento
      if (orbIdx === orbs.length - 1) {
        orb.maxY = Math.max(docHeight - 120, 6200);
      }

      orb.x += orb.vx;
      orb.worldY += orb.vy;

      // Colision elastica con bordes laterales de la ventana
      if (orb.x - orb.radius <= 0) {
        orb.x = orb.radius;
        orb.vx = Math.abs(orb.vx);
        orb.squishX = 0.74;
        orb.squishY = 1.26;
      } else if (orb.x + orb.radius >= width) {
        orb.x = width - orb.radius;
        orb.vx = -Math.abs(orb.vx);
        orb.squishX = 0.74;
        orb.squishY = 1.26;
      }

      // Colision elastica con limites verticales de su zona de movimiento
      if (orb.worldY - orb.radius <= orb.minY) {
        orb.worldY = orb.minY + orb.radius;
        orb.vy = Math.abs(orb.vy);
        orb.squishY = 0.74;
        orb.squishX = 1.26;
      } else if (orb.worldY + orb.radius >= orb.maxY) {
        orb.worldY = orb.maxY - orb.radius;
        orb.vy = -Math.abs(orb.vy);
        orb.squishY = 0.74;
        orb.squishX = 1.26;
      }

      // Recuperacion elastica progresiva (amortiguacion armonica)
      orb.squishX += (1 - orb.squishX) * 0.08;
      orb.squishY += (1 - orb.squishY) * 0.08;

      const screenY = orb.worldY - scrollY;

      // Repulsion magnetica suave cuando el orbe cursor se acerca
      if (mouseOrb.active) {
        const dx = orb.x - mouseOrb.x;
        const dy = screenY - mouseOrb.y;
        const dist = Math.hypot(dx, dy);
        const repelRadius = orb.radius + 60;
        if (dist < repelRadius && dist > 1) {
          const repelForce = (1 - dist / repelRadius) * 2.8;
          orb.x += (dx / dist) * repelForce;
          orb.worldY += (dy / dist) * repelForce;
          orb.squishX = 0.94;
          orb.squishY = 1.06;
        }
      }

      // Descarte de renderizado fuera de viewport
      if (screenY + orb.radius < -120 || screenY - orb.radius > height + 120) {
        return;
      }

      // Renderizado esferico 3D con volumen y opacidad balanceada
      bgCtx.save();
      bgCtx.translate(orb.x, screenY);
      bgCtx.scale(orb.squishX, orb.squishY);

      const gradient = bgCtx.createRadialGradient(
        -orb.radius * 0.22,
        -orb.radius * 0.22,
        orb.radius * 0.05,
        0,
        0,
        orb.radius
      );

      // Opacidad sutilmente realzada para definicion nitida sin deslumbrar
      const alpha = isDark ? 0.44 : 0.28;
      gradient.addColorStop(0, `hsla(${orb.hue}, ${orb.sat}%, ${orb.light}%, ${alpha * 1.6})`);
      gradient.addColorStop(0.5, `hsla(${orb.hue + 14}, ${orb.sat}%, ${orb.light}%, ${alpha * 0.85})`);
      gradient.addColorStop(0.85, `hsla(${orb.hue + 24}, ${orb.sat}%, ${orb.light}%, ${alpha * 0.3})`);
      gradient.addColorStop(1, `hsla(${orb.hue + 32}, ${orb.sat}%, ${orb.light}%, 0)`);

      bgCtx.fillStyle = gradient;
      bgCtx.beginPath();
      bgCtx.arc(0, 0, orb.radius, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.restore();
    });

    // 2. Geometria Espacial 3D (Mobbin Spatial wireframe)
    const ringCenterY = height * 0.30 + Math.sin(now * 0.0007) * 35;
    const ringCenterX = width * 0.84 + Math.cos(now * 0.0005) * 40;

    const rotX = now * 0.00055 + scrollProgress * Math.PI * 2;
    const rotY = now * 0.00075 + scrollProgress * Math.PI * 1.6;
    const rotZ = now * 0.00028;

    const fov = 420;
    const projected = ringPoints.map((pt) => {
      const x1 = pt.x * Math.cos(rotY) + pt.z * Math.sin(rotY);
      const z1 = -pt.x * Math.sin(rotY) + pt.z * Math.cos(rotY);
      const y2 = pt.y * Math.cos(rotX) - z1 * Math.sin(rotX);
      const z2 = pt.y * Math.sin(rotX) + z1 * Math.cos(rotX);
      const x3 = x1 * Math.cos(rotZ) - y2 * Math.sin(rotZ);
      const y3 = x1 * Math.sin(rotZ) + y2 * Math.cos(rotZ);

      const scale = fov / (fov + z2 + 200);
      return {
        x: ringCenterX + x3 * scale,
        y: ringCenterY + y3 * scale,
        scale: scale,
        z: z2
      };
    });

    bgCtx.save();
    bgCtx.lineWidth = isDark ? 1.4 : 1.1;
    bgCtx.strokeStyle = isDark
      ? `rgba(56, 189, 248, ${0.28 + Math.sin(now * 0.001) * 0.08})`
      : `rgba(2, 132, 199, ${0.20 + Math.sin(now * 0.001) * 0.06})`;

    bgCtx.beginPath();
    for (let i = 0; i < projected.length; i++) {
      const p = projected[i];
      if (i === 0) bgCtx.moveTo(p.x, p.y);
      else bgCtx.lineTo(p.x, p.y);
    }
    bgCtx.closePath();
    bgCtx.stroke();

    projected.forEach((p, idx) => {
      if (idx % 2 === 0) {
        bgCtx.fillStyle = isDark ? "rgba(56, 189, 248, 0.42)" : "rgba(2, 132, 199, 0.32)";
        bgCtx.beginPath();
        bgCtx.arc(p.x, p.y, 2.2 * p.scale, 0, Math.PI * 2);
        bgCtx.fill();
      }
    });
    bgCtx.restore();

    // 3. Orbe Cursor Interactivo (En canvas superior cursorCtx: 100% visible sobre toda la interfaz)
    const cCtx = cursorCtx || bgCtx;
    if (mouseOrb.active && mouseOrb.x > -50) {
      // Estela luminosa
      for (let i = 0; i < mouseOrb.trail.length; i++) {
        const pt = mouseOrb.trail[i];
        const trAlpha = (1 - i / mouseOrb.trail.length) * (isDark ? 0.28 : 0.18);
        cCtx.save();
        cCtx.fillStyle = isDark ? `rgba(56, 189, 248, ${trAlpha})` : `rgba(2, 132, 199, ${trAlpha})`;
        cCtx.beginPath();
        cCtx.arc(pt.x, pt.y, Math.max(1, mouseOrb.radius * (1 - i / 7)), 0, Math.PI * 2);
        cCtx.fill();
        cCtx.restore();
      }

      // Halo difuso resplandeciente
      const haloGradient = cCtx.createRadialGradient(
        mouseOrb.x, mouseOrb.y, 2,
        mouseOrb.x, mouseOrb.y, mouseOrb.haloRadius
      );
      if (isDark) {
        haloGradient.addColorStop(0, "rgba(56, 189, 248, 0.48)");
        haloGradient.addColorStop(0.45, "rgba(14, 165, 233, 0.22)");
        haloGradient.addColorStop(1, "rgba(56, 189, 248, 0)");
      } else {
        haloGradient.addColorStop(0, "rgba(2, 132, 199, 0.42)");
        haloGradient.addColorStop(0.45, "rgba(56, 189, 248, 0.18)");
        haloGradient.addColorStop(1, "rgba(2, 132, 199, 0)");
      }

      cCtx.save();
      cCtx.fillStyle = haloGradient;
      cCtx.beginPath();
      cCtx.arc(mouseOrb.x, mouseOrb.y, mouseOrb.haloRadius, 0, Math.PI * 2);
      cCtx.fill();

      // Nucleo brillante
      cCtx.fillStyle = isDark ? "#ffffff" : "#0284c7";
      cCtx.shadowColor = isDark ? "#38bdf8" : "#0284c7";
      cCtx.shadowBlur = 12;
      cCtx.beginPath();
      cCtx.arc(mouseOrb.x, mouseOrb.y, mouseOrb.radius, 0, Math.PI * 2);
      cCtx.fill();
      cCtx.restore();
    }

    if (!document.hidden) {
      animationFrameId = requestAnimationFrame(render);
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(render);
    }
  });

  animationFrameId = requestAnimationFrame(render);
}
initSedesAccordion();
initAmbient3D();
