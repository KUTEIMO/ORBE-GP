#!/usr/bin/env node
/**
 * Auditoría responsive + accesibilidad del motor de tours (shell compartido).
 *
 * Detecta:
 *  - Overflow horizontal del documento y de cada elemento visible.
 *  - Targets táctiles por debajo de 44x44.
 *  - Contraste WCAG AA calculado sobre pares texto/fondo reales.
 *  - Problemas ARIA/semánticos básicos.
 *
 * Uso:
 *   node scripts/audit-responsive-a11y.mjs [baseUrl] [--shot=dir]
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const baseUrl =
  process.argv.find((a) => a.startsWith("http")) ||
  "http://localhost:8081/unisimoncucuta/experienciavirtual/";
const shotArg = process.argv.find((a) => a.startsWith("--shot="));
const shotDir = shotArg ? shotArg.slice("--shot=".length) : null;
if (shotDir) mkdirSync(shotDir, { recursive: true });

const VIEWPORTS = [
  { name: "iphone12-390x844", width: 390, height: 844, mobile: true },
  { name: "small-360x640", width: 360, height: 640, mobile: true },
  { name: "tiny-320x568", width: 320, height: 568, mobile: true },
  { name: "landscape-844x390", width: 844, height: 390, mobile: true },
  { name: "tablet-768x1024", width: 768, height: 1024, mobile: true },
  { name: "desktop-1440x900", width: 1440, height: 900, mobile: false },
];

const OVERFLOW_PROBE = `
(() => {
  const de = document.documentElement;
  const vw = window.innerWidth;
  const doc = {
    innerWidth: vw,
    scrollWidth: de.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    horizontalOverflow: Math.max(de.scrollWidth, document.body.scrollWidth) - vw,
  };
  const offenders = [];
  const all = document.querySelectorAll('body *');
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const overRight = r.right - vw;
    const overLeft = -r.left;
    if (overRight > 1 || overLeft > 1) {
      // Ignore intentionally offscreen drawers (translated out of view)
      const transformed = cs.transform && cs.transform !== 'none';
      offenders.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,3).join('.') : ''),
        left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
        overRight: Math.round(overRight), overLeft: Math.round(overLeft),
        transform: transformed ? cs.transform : 'none',
        position: cs.position,
        scrollW: el.scrollWidth, clientW: el.clientWidth,
        selfScroll: el.scrollWidth - el.clientWidth,
        overflowX: cs.overflowX,
      });
    }
  }
  // clipped text: element whose scrollWidth exceeds clientWidth and has text
  const clipped = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!el.childElementCount && el.textContent && el.textContent.trim().length > 3) {
      if (el.scrollWidth - el.clientWidth > 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && cs.textOverflow !== 'ellipsis') {
        clipped.push({
          sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
          text: el.textContent.trim().slice(0, 60),
          scrollW: el.scrollWidth, clientW: el.clientWidth,
        });
      }
    }
  }
  return { doc, offenders: offenders.slice(0, 40), clipped: clipped.slice(0, 20) };
})()
`;

const TOUCH_PROBE = `
(() => {
  const out = [];
  const sel = 'button, a[href], input, select, [role="button"], [tabindex]:not([tabindex="-1"])';
  for (const el of document.querySelectorAll(sel)) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.width < 44 || r.height < 44) {
      out.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/)[0] : ''),
        w: Math.round(r.width), h: Math.round(r.height),
        label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
      });
    }
  }
  return out.slice(0, 40);
})()
`;

const CONTRAST_PROBE = `
(() => {
  function parse(c) {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(fg, bg) {
    const a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function lum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function effectiveBg(el) {
    let cur = el, acc = null;
    while (cur && cur !== document.documentElement.parentNode) {
      const cs = getComputedStyle(cur);
      const bg = parse(cs.backgroundColor);
      if (bg && bg.a > 0) {
        acc = acc ? over(acc, bg) : bg;
        if (acc.a >= 0.999) return acc;
      }
      cur = cur.parentElement;
    }
    const base = { r: 5, g: 8, b: 7, a: 1 }; // body base #050807
    return acc ? over(acc, base) : base;
  }
  const results = [];
  const nodes = document.querySelectorAll('body *');
  for (const el of nodes) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.15) continue;
    // only elements with their own direct text
    let hasText = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent.trim().length > 1) { hasText = true; break; }
    }
    if (!hasText) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    let fg = parse(cs.color);
    if (!fg) continue;
    const bg = effectiveBg(el);
    if (fg.a < 1) fg = over(fg, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const req = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    if (cr < req) {
      results.push({
        sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
        text: (el.textContent || '').trim().slice(0, 45),
        color: cs.color, bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
        fontSize: size, weight, ratio: Math.round(cr * 100) / 100, required: req,
      });
    }
  }
  const dedup = [];
  const seen = new Set();
  for (const r of results) {
    const k = r.sel + '|' + r.color + '|' + r.bg;
    if (seen.has(k)) continue;
    seen.add(k); dedup.push(r);
  }
  return dedup.slice(0, 40);
})()
`;

const ARIA_PROBE = `
(() => {
  const issues = [];
  const push = (sev, msg) => issues.push({ sev, msg });
  // buttons without accessible name
  for (const el of document.querySelectorAll('button, a[href], [role="button"]')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim();
    if (!name) push('alta', 'Control sin nombre accesible: ' + el.outerHTML.slice(0, 90));
  }
  // images without alt
  for (const img of document.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) push('alta', 'img sin alt: ' + (img.getAttribute('src') || '').slice(0, 70));
  }
  // aria-expanded coherence
  for (const el of document.querySelectorAll('[aria-controls]')) {
    const id = el.getAttribute('aria-controls');
    if (id && !document.getElementById(id)) push('media', 'aria-controls apunta a id inexistente: ' + id);
  }
  // duplicated ids
  const ids = {};
  for (const el of document.querySelectorAll('[id]')) { ids[el.id] = (ids[el.id] || 0) + 1; }
  for (const [k, v] of Object.entries(ids)) if (v > 1) push('media', 'id duplicado: ' + k);
  // heading order
  const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(h => getComputedStyle(h).display !== 'none');
  let prev = 0;
  for (const h of hs) {
    const lvl = parseInt(h.tagName[1], 10);
    if (prev && lvl > prev + 1) push('baja', 'Salto de nivel de encabezado: ' + h.tagName + ' tras h' + prev + ' ("' + h.textContent.trim().slice(0, 40) + '")');
    prev = lvl;
  }
  // live regions
  const live = [...document.querySelectorAll('[aria-live]')].map(e => e.id || e.className);
  // focusable elements inside hidden containers
  for (const host of document.querySelectorAll('[hidden], [aria-hidden="true"]')) {
    const f = host.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
    if (f.length && getComputedStyle(host).display !== 'none') {
      push('alta', 'Contenedor oculto con ' + f.length + ' elementos enfocables alcanzables: ' + (host.id || host.className));
    }
  }
  return { issues, live };
})()
`;

async function tabOrder(page) {
  return page.evaluate(() => {
    const sel = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
    return [...document.querySelectorAll(sel)]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        if (el.closest('[hidden]')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })
      .map((el) => (el.id || el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40));
  });
}

const report = { baseUrl, when: new Date().toISOString(), viewports: {} };

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
        : undefined,
    });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
    });
    await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);

    const entry = { viewport: vp, states: {}, consoleErrors };

    // State: closed
    entry.states.closed = {
      overflow: await page.evaluate(OVERFLOW_PROBE),
      touch: await page.evaluate(TOUCH_PROBE),
      contrast: await page.evaluate(CONTRAST_PROBE),
      aria: await page.evaluate(ARIA_PROBE),
      tabOrder: await tabOrder(page),
    };
    if (shotDir) await page.screenshot({ path: path.join(shotDir, `${vp.name}-01-closed.png`) });

    // State: scene menu open
    const toggle = page.locator("#menuToggle");
    if (await toggle.count()) {
      await toggle.click();
      await page.waitForTimeout(700);
      entry.states.menuOpen = {
        overflow: await page.evaluate(OVERFLOW_PROBE),
        touch: await page.evaluate(TOUCH_PROBE),
        contrast: await page.evaluate(CONTRAST_PROBE),
        tabOrder: await tabOrder(page),
      };
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `${vp.name}-02-menu.png`) });
      // Expand first group to see scene buttons
      const grp = page.locator(".scene-group__header").first();
      if (await grp.count()) {
        await grp.click();
        await page.waitForTimeout(400);
        entry.states.menuGroupOpen = { overflow: await page.evaluate(OVERFLOW_PROBE) };
        if (shotDir) await page.screenshot({ path: path.join(shotDir, `${vp.name}-03-menu-group.png`) });
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      entry.states.afterEscape = {
        menuExpanded: await page.evaluate(() => document.getElementById("sceneMenu")?.getAttribute("aria-expanded")),
        focus: await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName),
      };
    }

    // State: accessibility panel open
    const a11y = page.locator("#accessibilityToggle");
    if (await a11y.count() && await a11y.isVisible()) {
      await a11y.click();
      await page.waitForTimeout(600);
      entry.states.a11yOpen = {
        overflow: await page.evaluate(OVERFLOW_PROBE),
        touch: await page.evaluate(TOUCH_PROBE),
        contrast: await page.evaluate(CONTRAST_PROBE),
        tabOrder: await tabOrder(page),
      };
      if (shotDir) await page.screenshot({ path: path.join(shotDir, `${vp.name}-04-a11y.png`) });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      entry.states.a11yAfterEscape = await page.evaluate(() => ({
        hidden: document.getElementById("accessibilityMenu")?.hasAttribute("hidden"),
        focus: document.activeElement?.id || document.activeElement?.tagName,
      }));
    }

    // State: hotspot panel (open first info POI chip if present)
    const chip = page.locator(".hotspot-inline-button").first();
    if (await chip.count()) {
      try {
        await chip.click({ timeout: 4000 });
        await page.waitForTimeout(900);
        entry.states.poiOpen = {
          panelVisible: await page.evaluate(() => !document.getElementById("hotspotPanel")?.hasAttribute("hidden")),
          overflow: await page.evaluate(OVERFLOW_PROBE),
          touch: await page.evaluate(TOUCH_PROBE),
        };
        if (shotDir) await page.screenshot({ path: path.join(shotDir, `${vp.name}-05-poi.png`) });
      } catch (e) {
        entry.states.poiOpen = { error: String(e).slice(0, 120) };
      }
    }

    // Reduced motion
    await ctx.close();

    const rmCtx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      reducedMotion: "reduce",
    });
    const rmPage = await rmCtx.newPage();
    await rmPage.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await rmPage.waitForTimeout(2500);
    entry.reducedMotion = await rmPage.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none") continue;
        const animated = cs.animationName !== "none" && parseFloat(cs.animationDuration) > 0.05;
        const transitioned = cs.transitionProperty !== "none" && cs.transitionProperty !== "all" && parseFloat(cs.transitionDuration) > 0.05;
        if (animated) bad.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""), animation: cs.animationName, dur: cs.animationDuration });
        else if (transitioned && parseFloat(cs.transitionDuration) > 0.2) bad.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/)[0] : ""), transition: cs.transitionProperty, dur: cs.transitionDuration });
      }
      const seen = new Set(); const out = [];
      for (const b of bad) { if (seen.has(b.sel)) continue; seen.add(b.sel); out.push(b); }
      return out.slice(0, 20);
    });
    await rmCtx.close();

    report.viewports[vp.name] = entry;
    const d = entry.states.closed.overflow.doc;
    const m = entry.states.menuOpen?.overflow?.doc;
    console.log(
      `${vp.name.padEnd(22)} closed=${d.horizontalOverflow}px offenders=${entry.states.closed.overflow.offenders.length}` +
        (m ? ` | menu=${m.horizontalOverflow}px offenders=${entry.states.menuOpen.overflow.offenders.length}` : "") +
        ` | touch<44=${entry.states.closed.touch.length} contrast=${entry.states.closed.contrast.length}`
    );
  }
} finally {
  await browser.close();
}

const outFile = shotDir ? path.join(shotDir, "report.json") : "responsive-a11y-report.json";
const { writeFileSync } = await import("node:fs");
writeFileSync(outFile, JSON.stringify(report, null, 2), "utf8");
console.log("\nReporte:", outFile);
