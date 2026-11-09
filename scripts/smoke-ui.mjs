import { chromium } from 'playwright';

const url = 'http://127.0.0.1:8081/?scene=r0010123-202503281729-yp00145909-jpg';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(2500);

const result = {
  title: await page.locator('#sceneTitle').textContent(),
  errors: [...errors],
  marzipano: await page.evaluate(() => Boolean(window.Marzipano)),
  appState: await page.evaluate(() => Boolean(window.appState?.config)),
  backdropHidden: await page.locator('#uiBackdrop').evaluate((el) => el.hasAttribute('hidden')),
  cuePE: await page.locator('#directionCue').evaluate((el) => getComputedStyle(el).pointerEvents),
  overlayPE: await page.locator('#loadingOverlay').evaluate((el) => getComputedStyle(el).pointerEvents),
  overlayDisplay: await page.locator('#loadingOverlay').evaluate((el) => getComputedStyle(el).display)
};

await page.locator('#menuToggle').click({ force: true });
await page.waitForTimeout(500);
result.menuOpen = await page.locator('#sceneMenu').evaluate((el) => el.classList.contains('scene-menu--open'));
result.backdropVisible = await page.locator('#uiBackdrop').evaluate((el) => el.classList.contains('ui-backdrop--visible'));
await page.locator('#menuToggle').click({ force: true });
await page.waitForTimeout(500);
result.menuClosed = !(await page.locator('#sceneMenu').evaluate((el) => el.classList.contains('scene-menu--open')));
result.backdropHiddenAfterMenu = await page.locator('#uiBackdrop').evaluate((el) => el.hasAttribute('hidden'));

const before = await page.locator('#sceneTitle').textContent();
await page.locator('#nextScene').click({ force: true });
await page.waitForTimeout(1200);
const after = await page.locator('#sceneTitle').textContent();
result.navWorks = before !== after;
result.titleAfterNav = after;

await page.evaluate(() => document.getElementById('helpToggle')?.click());
await page.waitForTimeout(400);
result.helpOpen = await page.locator('#helpDialog').evaluate((el) => el.open);
await page.evaluate(() => document.getElementById('helpDialog')?.close());

await page.evaluate(() => document.getElementById('accessibilityToggle')?.click());
await page.waitForTimeout(400);
result.a11y = await page.locator('#accessibilityMenu').evaluate((el) => ({
  hidden: el.hasAttribute('hidden'),
  openClass: el.classList.contains('accessibility-menu--open'),
  display: getComputedStyle(el).display
}));
await page.evaluate(() => document.getElementById('closeAccessibility')?.click());
await page.waitForTimeout(300);

result.hotspotCount = await page.locator('.hotspot').count();
if (result.hotspotCount > 0) {
  await page.evaluate(() => document.querySelector('.hotspot')?.click());
  await page.waitForTimeout(700);
  result.afterHotspot = await page.locator('#hotspotPanel').evaluate((el) => ({
    hidden: el.hasAttribute('hidden'),
    openClass: el.classList.contains('hotspot-panel--open'),
    display: getComputedStyle(el).display
  }));
}

result.errorsFinal = errors;
console.log(JSON.stringify(result, null, 2));
await browser.close();
