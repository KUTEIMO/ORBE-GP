/**
 * Carrusel de sedes (landing #sedes).
 * Fuente de verdad: estado publicado + slug real = Convex (graph:listPublishedDemos).
 * El JSON solo aporta orden/texto/foto. Carga perezosa al abrir la sección.
 * Sin autoplay (WCAG 2.2.2). Scroll-snap nativo + botones + flechas de teclado.
 */
import { apiQuery } from "/plataforma/convex-client.js";
import { publicTourHref } from "/src/tourSlug.js";

const CATALOG_URL = "/plataforma/data/sedes-unisimon.json";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PLACEHOLDER_SVG = `
<svg viewBox="0 0 400 250" role="img" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="sedeSky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="var(--orbe-clay-surface-tint)"/>
      <stop offset="1" stop-color="var(--orbe-line)"/>
    </linearGradient>
  </defs>
  <rect width="400" height="250" fill="url(#sedeSky)"/>
  <circle cx="320" cy="60" r="22" fill="var(--orbe-signal)" opacity=".35"/>
  <path d="M60 190V105l60-28 60 28v85z" fill="var(--orbe-clay-surface)" stroke="var(--orbe-accent)" stroke-width="2" opacity=".9"/>
  <path d="M200 190V85l70-30 70 30v105z" fill="var(--orbe-clay-surface)" stroke="var(--orbe-accent)" stroke-width="2"/>
  <path d="M225 190v-38h22v38M265 190v-38h22v38M305 190v-38h22v38" fill="none" stroke="var(--orbe-accent)" stroke-width="2" opacity=".6"/>
  <path d="M30 190h340" stroke="var(--orbe-accent-deep)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

function slideHtml(sede, state, i, total) {
  const live = state.href;
  const media = sede.image
    ? `<img src="${esc(sede.image)}" alt="${esc(sede.alt || sede.label)}" width="1200" height="750" loading="lazy" decoding="async">`
    : `<div class="sede-card__ph">${PLACEHOLDER_SVG}</div>`;
  const cta = live
    ? `<a class="btn btn--primary sede-card__cta" href="${esc(state.href)}">Recorrer ${esc(sede.label)} →</a>`
    : `<span class="sede-card__soon" role="note">Tour próximamente</span>`;
  return `
  <li class="sede-card${live ? "" : " is-soon"}" role="group" aria-roledescription="diapositiva" aria-label="${esc(sede.label)}, ${i + 1} de ${total}" data-sede="${esc(sede.id)}">
    <div class="sede-card__media">${media}</div>
    <div class="sede-card__body">
      <p class="sede-card__eyebrow">Universidad Simón Bolívar · Cúcuta</p>
      <h3>${esc(sede.label)}</h3>
      <p>${esc(sede.blurb)}</p>
      ${cta}
    </div>
  </li>`;
}

async function resolveStates(catalog) {
  /** @type {Map<string,{slug:string,orgSlug:string}>} */
  let published = null;
  try {
    const demos = await apiQuery("graph:listPublishedDemos", {});
    if (Array.isArray(demos)) {
      published = new Map(demos.map((d) => [`${d.orgSlug}/${d.slug}`, d]));
    }
  } catch (_e) {
    published = null; // Convex inalcanzable: se confía en el catálogo
  }
  return catalog.sedes.map((s) => {
    if (!s.tourSlug) return { href: null };
    const key = `${catalog.orgSlug}/${s.tourSlug}`;
    if (published && !published.has(key)) return { href: null }; // no publicado en Convex
    return { href: publicTourHref({ orgSlug: catalog.orgSlug, tourSlug: s.tourSlug }) };
  });
}

function wire(root) {
  const track = root.querySelector(".sedes__track");
  const prev = root.querySelector("[data-sedes-prev]");
  const next = root.querySelector("[data-sedes-next]");
  const dots = [...root.querySelectorAll("[data-sedes-dot]")];
  const slides = [...track.children];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const current = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    slides.forEach((el, i) => {
      const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  };
  const go = (i) => {
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    track.scrollTo({ left: slides[idx].offsetLeft - track.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  };
  const sync = () => {
    const i = current();
    dots.forEach((d, k) => d.setAttribute("aria-current", k === i ? "true" : "false"));
    prev.disabled = i === 0;
    next.disabled = i === slides.length - 1;
  };

  prev.addEventListener("click", () => go(current() - 1));
  next.addEventListener("click", () => go(current() + 1));
  dots.forEach((d, k) => d.addEventListener("click", () => go(k)));
  track.addEventListener("scroll", () => requestAnimationFrame(sync), { passive: true });
  track.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(current() + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(current() - 1); }
  });
  sync();
}

let loaded = false;
export async function initSedesCarousel() {
  const panel = document.getElementById("sedes");
  const trigger = document.getElementById("demoCta");
  const ctaBand = document.getElementById("ctaBandCase");
  if (!panel || !trigger) return;

  const setOpen = async (open, { scroll = true } = {}) => {
    panel.hidden = !open;
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    if (!open) return;
    if (!loaded) {
      loaded = true;
      const host = panel.querySelector("[data-sedes-host]");
      host.setAttribute("aria-busy", "true");
      try {
        const res = await fetch(CATALOG_URL, { cache: "no-cache" });
        if (!res.ok) throw new Error(String(res.status));
        const catalog = await res.json();
        const states = await resolveStates(catalog);
        const n = catalog.sedes.length;
        host.innerHTML = `
          <div class="sedes__frame" role="region" aria-roledescription="carrusel" aria-label="Sedes de la Universidad Simón Bolívar en Cúcuta">
            <ul class="sedes__track" tabindex="0" aria-label="Sedes. Usa las flechas izquierda y derecha para navegar.">
              ${catalog.sedes.map((s, i) => slideHtml(s, states[i], i, n)).join("")}
            </ul>
            <div class="sedes__controls">
              <button type="button" class="icon-btn" data-sedes-prev aria-label="Sede anterior">←</button>
              <div class="sedes__dots">
                ${catalog.sedes.map((s, i) => `<button type="button" data-sedes-dot aria-label="Ir a ${esc(s.label)}"></button>`).join("")}
              </div>
              <button type="button" class="icon-btn" data-sedes-next aria-label="Sede siguiente">→</button>
            </div>
          </div>`;
        wire(host);
      } catch (_e) {
        host.innerHTML = `<p class="sedes__error">No pudimos cargar las sedes. <a href="/unisimoncucuta/experienciavirtual/">Ir al recorrido de la Sede 2</a>.</p>`;
        loaded = false;
      } finally {
        host.removeAttribute("aria-busy");
      }
    }
    if (scroll) panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  };

  const toggle = (e) => {
    e.preventDefault();
    const open = panel.hidden;
    setOpen(open);
    if (open) history.replaceState(null, "", "#sedes");
  };
  trigger.addEventListener("click", toggle);
  if (ctaBand) ctaBand.addEventListener("click", (e) => { e.preventDefault(); setOpen(true); history.replaceState(null, "", "#sedes"); });
  if (location.hash === "#sedes") setOpen(true, { scroll: false });
}
