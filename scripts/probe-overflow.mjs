#!/usr/bin/env node
/** Sonda puntual: reproduce el overflow horizontal bajo condiciones reales
 *  (escala de texto accesible, escenas con nombres largos, anchos intermedios). */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] || "http://localhost:8081/unisimoncucuta/experienciavirtual/";
const outDir = process.argv[3] || "test-results/probe";
mkdirSync(outDir, { recursive: true });

const PROBE = `(() => {
  const vw = window.innerWidth;
  const de = document.documentElement;
  const bad = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.hotspot-inline-list')) continue; // scroller intencional
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    if (r.right - vw > 1) bad.push(el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\\s+/)[0]:'')+' right='+Math.round(r.right)+' w='+Math.round(r.width));
  }
  return {
    vw, layoutW: de.clientWidth, docScrollW: de.scrollWidth,
    visualW: window.visualViewport ? Math.round(window.visualViewport.width) : null,
    htmlFontSize: getComputedStyle(de).fontSize,
    fontScale: getComputedStyle(de).getPropertyValue('--font-scale'),
    over: Math.max(de.scrollWidth, document.body.scrollWidth) - vw,
    innerScrollers: [...document.querySelectorAll('.scene-menu__inner, .scene-menu, .tour-header, .action-buttons, .title-wrapper, .accessibility-options, .hotspot-panel__body')].map(e => ({
      sel: e.className.split(' ')[0], sw: e.scrollWidth, cw: e.clientWidth, dx: e.scrollWidth - e.clientWidth, ox: getComputedStyle(e).overflowX,
    })),
    offenders: bad.slice(0, 25),
  };
})()`;

const cases = [
  { name: "390-base", w: 390, h: 844, scale: 1 },
  { name: "390-fontscale-1.25", w: 390, h: 844, scale: 1.25 },
  { name: "390-fontscale-1.5", w: 390, h: 844, scale: 1.5 },
  { name: "360-fontscale-1.25", w: 360, h: 640, scale: 1.25 },
  { name: "768-tablet", w: 768, h: 1024, scale: 1 },
  { name: "820-between-breakpoints", w: 820, h: 1180, scale: 1 },
  { name: "740-just-above-720", w: 740, h: 900, scale: 1 },
  { name: "320-tiny-fontscale-1.25", w: 320, h: 568, scale: 1.25 },
];

const browser = await chromium.launch();
for (const c of cases) {
  const ctx = await browser.newContext({
    viewport: { width: c.w, height: c.h },
    isMobile: c.w < 900,
    hasTouch: c.w < 900,
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3500);
  if (c.scale !== 1) {
    await page.evaluate((s) => {
      document.documentElement.style.setProperty("--font-scale", String(s));
    }, c.scale);
    await page.waitForTimeout(400);
  }
  // Navegar a una escena de nombre largo (biblioteca) si existe, y abrir el menú
  await page.locator("#menuToggle").click();
  await page.waitForTimeout(600);
  const groups = page.locator(".scene-group__header");
  const n = await groups.count();
  for (let i = 0; i < Math.min(n, 3); i++) {
    await groups.nth(i).click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(400);
  const res = await page.evaluate(PROBE);
  console.log("=====", c.name, JSON.stringify({ vw: res.vw, over: res.over, docScrollW: res.docScrollW, html: res.htmlFontSize, nOffenders: res.offenders.length }));
  for (const s of res.innerScrollers) if (s.dx > 1) console.log("   inner-scroll:", JSON.stringify(s));
  for (const o of res.offenders) console.log("   over:", o);
  await page.screenshot({ path: path.join(outDir, `${c.name}.png`), fullPage: false });
  await ctx.close();
}
await browser.close();
