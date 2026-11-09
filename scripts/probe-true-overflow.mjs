#!/usr/bin/env node
/** Mide el overflow horizontal REAL quitando el parche `overflow-x:hidden`
 *  de html/body. Ese parche oculta el síntoma en Chromium pero no en todos los
 *  motores móviles, y además recorta contenido (tarjetas/texto cortados). */
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:8081/unisimoncucuta/experienciavirtual/";

const UNCLIP = `
(() => {
  const s = document.createElement('style');
  s.id = '__unclip';
  s.textContent = 'html,body{overflow-x:visible !important}';
  document.head.appendChild(s);
})()`;

const PROBE = `(() => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.hotspot-inline-list')) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right - vw > 1 || r.left < -1) {
      bad.push({ sel: el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\\s+/)[0]:''),
        left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), pos: cs.position, tf: cs.transform === 'none' ? '' : 'transformed' });
    }
  }
  return {
    vw,
    docScrollW: de.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    over: Math.max(de.scrollWidth, document.body.scrollWidth) - vw,
    canPanRight: de.scrollWidth > vw,
    offenders: bad.slice(0, 20),
  };
})()`;

const cases = [
  { name: "390x844 menu cerrado", w: 390, h: 844, openMenu: false },
  { name: "390x844 menu abierto", w: 390, h: 844, openMenu: true },
  { name: "360x640 menu abierto", w: 360, h: 640, openMenu: true },
  { name: "360x640 menu abierto + texto 150%", w: 360, h: 640, openMenu: true, scale: 1.5 },
  { name: "844x390 landscape", w: 844, h: 390, openMenu: true },
];

const browser = await chromium.launch();
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: c.w, height: c.h }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  await page.evaluate(UNCLIP);
  if (c.scale) await page.evaluate((s) => document.documentElement.style.setProperty("--font-scale", String(s)), c.scale);
  if (c.openMenu) {
    await page.locator("#menuToggle").click();
    await page.waitForTimeout(600);
    const g = page.locator(".scene-group__header");
    const n = await g.count();
    for (let i = 0; i < Math.min(n, 2); i++) { await g.nth(i).click(); await page.waitForTimeout(150); }
  }
  await page.waitForTimeout(500);
  const r = await page.evaluate(PROBE);
  console.log(`\n### ${c.name}`);
  console.log(`   vw=${r.vw}  docScrollWidth=${r.docScrollW}  OVERFLOW REAL = ${r.over}px  (pan horizontal posible: ${r.canPanRight})`);
  for (const o of r.offenders) console.log("   ", JSON.stringify(o));
  await ctx.close();
}
await browser.close();
