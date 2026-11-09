#!/usr/bin/env node
/** Verifica la hipótesis de CSS cacheado: renderiza la demo con y sin
 *  responsive.css para comparar contra la captura reportada por el usuario. */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] || "http://localhost:8081/unisimoncucuta/experienciavirtual/";
const outDir = process.argv[3] || "test-results/stale";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const variant of ["con-responsive", "sin-responsive"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  if (variant === "sin-responsive") {
    await page.route("**/responsive.css*", (r) => r.fulfill({ status: 200, contentType: "text/css", body: "/* simulado: caché antigua */" }));
  }
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(4000);
  await page.locator("#menuToggle").click();
  await page.waitForTimeout(700);
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const menu = document.getElementById("sceneMenu");
    const inner = document.querySelector(".scene-menu__inner");
    const hdr = document.querySelector(".tour-header");
    const r = menu.getBoundingClientRect();
    const hr = hdr.getBoundingClientRect();
    const acts = document.querySelector(".action-buttons").getBoundingClientRect();
    return {
      vw: window.innerWidth,
      docScrollW: de.scrollWidth,
      overflow: Math.max(de.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      htmlOverflowX: getComputedStyle(de).overflowX,
      menu: { left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width) },
      innerScrollX: inner.scrollWidth - inner.clientWidth,
      innerOverflowX: getComputedStyle(inner).overflowX,
      header: { h: Math.round(hr.height), scrollW: hdr.scrollWidth, clientW: hdr.clientWidth, dx: hdr.scrollWidth - hdr.clientWidth },
      actionsRight: Math.round(acts.right),
      cardRight: Math.round((document.querySelector(".scene-group")?.getBoundingClientRect().right) || 0),
    };
  });
  console.log(`\n### ${variant}`);
  console.log(JSON.stringify(m, null, 2));
  await page.screenshot({ path: path.join(outDir, `390-${variant}.png`) });
  await ctx.close();
}
await browser.close();
