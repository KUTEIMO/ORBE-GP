import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://127.0.0.1:8081/control-web/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

const status = await page.locator('#statusBar').textContent();
const scenes = await page.locator('.scene-item').count();
await page.locator('[data-mode="hotspots"]').click();
await page.locator('.scene-item').first().click();
await page.waitForTimeout(2500);
const canvas = await page.locator('#pano360 canvas').count();
const placeBtn = await page.locator('#btnPlaceHere').isEnabled();

console.log(JSON.stringify({
  status: status.trim().slice(0, 80),
  scenes,
  canvas,
  placeBtn,
  errors
}, null, 2));
await browser.close();
