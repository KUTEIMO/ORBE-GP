#!/usr/bin/env node
/** Contraste WCAG 2.1 medido (no estimado) sobre el shell del tour.
 *  Compone alfa correctamente (Porter-Duff "source-over") subiendo por el árbol
 *  hasta encontrar un fondo opaco, y tiene en cuenta `opacity` heredada. */
import { chromium } from "playwright";

const base = process.argv[2] || "http://localhost:8081/unisimoncucuta/experienciavirtual/";

const PROBE = `(() => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(',').map(s => parseFloat(s.trim()));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  // source-over: F sobre B
  const over = (F, B) => {
    const a = F.a + B.a * (1 - F.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (F.r * F.a + B.r * B.a * (1 - F.a)) / a,
      g: (F.g * F.a + B.g * B.a * (1 - F.a)) / a,
      b: (F.b * F.a + B.b * B.a * (1 - F.a)) / a,
      a,
    };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  // opacity acumulada de ancestros (afecta al color efectivo del texto)
  const chainOpacity = (el) => {
    let o = 1, cur = el;
    while (cur && cur.nodeType === 1) { o *= parseFloat(getComputedStyle(cur).opacity || '1'); cur = cur.parentElement; }
    return o;
  };
  const PAGE_BASE = { r: 5, g: 8, b: 7, a: 1 }; // body base #050807
  const effectiveBg = (el) => {
    let acc = { r: 0, g: 0, b: 0, a: 0 };
    let cur = el.parentElement ? el : el;
    // incluir el propio fondo del elemento
    let node = el;
    while (node && node.nodeType === 1) {
      const cs = getComputedStyle(node);
      const bg = parse(cs.backgroundColor);
      const nodeOpacity = parseFloat(cs.opacity || '1');
      if (bg && bg.a > 0) {
        const eff = { ...bg, a: bg.a * nodeOpacity };
        acc = over(acc, eff);
        if (acc.a >= 0.995) return acc;
      }
      node = node.parentElement;
    }
    return over(acc, PAGE_BASE);
  };

  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.closest('.sr-only') || el.classList.contains('sr-only')) continue;
    if (el.matches('[disabled]') || el.closest('[disabled]')) continue;
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim().length > 1) { hasText = true; break; }
    if (!hasText) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const bg = effectiveBg(el);
    let fg = parse(cs.color);
    if (!fg) continue;
    const co = chainOpacity(el);
    fg = over({ ...fg, a: fg.a * co }, bg);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const required = large ? 3 : 4.5;
    const cr = ratio(fg, bg);
    out.push({
      sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''),
      text: (el.textContent || '').trim().slice(0, 42),
      color: cs.color, chainOpacity: Math.round(co * 100) / 100,
      bg: 'rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')',
      px: Math.round(size * 10) / 10, weight,
      ratio: Math.round(cr * 100) / 100, required, pass: cr >= required,
    });
  }
  const seen = new Set(); const dedup = [];
  for (const o of out) { const k = o.sel + '|' + o.color + '|' + o.bg + '|' + o.px; if (seen.has(k)) continue; seen.add(k); dedup.push(o); }
  return dedup;
})()`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(4000);

const states = [];
states.push(["base", async () => {}]);
states.push(["menu", async () => {
  await page.locator("#menuToggle").click(); await page.waitForTimeout(500);
  const g = page.locator(".scene-group__header"); if (await g.count()) { await g.first().click(); await page.waitForTimeout(300); }
}]);
states.push(["a11y", async () => {
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("#accessibilityToggle").click(); await page.waitForTimeout(500);
}]);
states.push(["poi", async () => {
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const c = page.locator(".hotspot-inline-button").last();
  if (await c.count()) { await c.click().catch(() => {}); await page.waitForTimeout(900); }
}]);
states.push(["alto-contraste", async () => {
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("#accessibilityToggle").click(); await page.waitForTimeout(400);
  await page.locator('[data-contrast="high"]').click(); await page.waitForTimeout(400);
}]);

const all = new Map();
for (const [name, fn] of states) {
  await fn();
  const rows = await page.evaluate(PROBE);
  for (const r of rows) {
    const k = r.sel + "|" + r.color + "|" + r.bg + "|" + r.px;
    if (!all.has(k)) all.set(k, { ...r, states: new Set([name]) });
    else all.get(k).states.add(name);
  }
}
await browser.close();

const rows = [...all.values()].map((r) => ({ ...r, states: [...r.states].join(",") }));
const fails = rows.filter((r) => !r.pass).sort((a, b) => a.ratio - b.ratio);
const passes = rows.filter((r) => r.pass).sort((a, b) => a.ratio - b.ratio);

console.log(`\n=== FALLOS WCAG AA (${fails.length}) ===`);
for (const f of fails) {
  console.log(`  ${String(f.ratio).padStart(5)}:1  (req ${f.required})  ${f.px}px/${f.weight}  ${f.sel}`);
  console.log(`          color=${f.color} opacidadCadena=${f.chainOpacity} fondo=${f.bg}  estados=${f.states}`);
  console.log(`          texto="${f.text}"`);
}
console.log(`\n=== APROBADOS más ajustados (top 12 de ${passes.length}) ===`);
for (const p of passes.slice(0, 12)) {
  console.log(`  ${String(p.ratio).padStart(5)}:1  (req ${p.required})  ${p.px}px  ${p.sel}  fondo=${p.bg}`);
}
