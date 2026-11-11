import { test, expect } from '@playwright/test';

const CONVEX = process.env.CONVEX_URL || 'http://127.0.0.1:3210';
const ORBE_EMAIL = process.env.ORBE_TEST_ORBE_EMAIL || 'admin@orbe.local';
const ORBE_PASS = process.env.ORBE_TEST_ORBE_PASS || 'OrbeSandbox2026!';

async function loginOrbe() {
  const res = await fetch(`${CONVEX}/api/mutation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path: 'auth:login',
      args: { email: ORBE_EMAIL, password: ORBE_PASS },
      format: 'json',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.value?.token) {
    throw new Error(data?.value?.error || data?.errorMessage || 'orbe login failed');
  }
  return data.value.token;
}

test.describe('Control Web Editor E2E & HTTP Hardening', () => {
  test('editor autorizado en orbe/sandbox carga escenas, modo hotspots y evita jerga Convex', async ({ page }) => {
    const token = await loginOrbe();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), token);

    await page.goto('/orbe/sandbox/control-web/');
    await expect(page.locator('body')).toHaveClass(/cw-authorized/, { timeout: 15_000 });
    await expect(page.locator('#sceneList .scene-item').first()).toBeVisible({ timeout: 15_000 });

    await page.locator('#sceneList .scene-item').first().click();
    await expect(page.locator('#editorBody')).toBeVisible({ timeout: 15_000 });

    await page.locator('button[data-mode="hotspots"]').click();
    await expect(page.locator('#chipInfo')).toBeEnabled();
    await expect(page.locator('#btnPlaceHere')).toBeEnabled();

    await page.locator('#chipInfo').click();
    await page.locator('#btnPlaceHere').click();
    await expect(page.locator('#dirtyBadge')).toBeVisible();
    const listText = await page.locator('#hotspotList').innerText();
    expect(listText).not.toMatch(/audio OK|VTT OK/i);

    const a11yBtn = page.locator('#hotspotList [data-action="a11y"]').first();
    await a11yBtn.click();
    const studio = page.locator('#a11yStudioDialog');
    await expect(studio).toBeVisible();

    // Invalid VTT keeps status honest without losing prior cues
    const rawDetails = studio.locator('details.studio-raw-vtt');
    await rawDetails.locator('summary').click();
    await page.locator('#a11yRawVtt').fill('INVALID_VTT_TEXT_ONLY');
    await page.locator('#a11yRawVtt').dispatchEvent('change');
    await expect(page.locator('#a11yStudioStatus')).toContainText(/Formato WebVTT inválido/i);

    await page.locator('#btnCloseA11yStudio').click();
    await expect(studio).toBeHidden();
  });

  test('control-web carga rutas root-absolute para CSS/JS y no conserva verde #009b3a', async ({ request }) => {
    const htmlRes = await request.get('/control-web/index.html');
    const html = await htmlRes.text();
    expect(html).toContain('href="/control-web/admin.css"');
    expect(html).toContain('src="/orbe-config.js"');
    expect(html).toContain('src="/control-web/admin.js"');

    const cssRes = await request.get('/control-web/admin.css');
    const css = await cssRes.text();
    expect(css).not.toMatch(/rgba\(\s*0\s*,\s*155\s*,\s*58|#009b3a/i);
  });

  test('control-web redirect sin trailing slash (/orbe/sandbox/control-web) redirige a /control-web/', async ({ request }) => {
    const res = await request.get('/orbe/sandbox/control-web', { maxRedirects: 0 });
    expect([301, 302, 308]).toContain(res.status());
    expect(res.headers().location).toMatch(/\/orbe\/sandbox\/control-web\/$/);
  });

  for (const blocked of [
    '/.env',
    '/.env.local',
    '/convex/auth.ts',
    '/docs/README.md',
    '/dist/index.html',
    '/functions/[[path]].js',
    '/deploy/README.md',
    '/skills-lock.json',
    '/entregables-corte-2/CUENTAS_Y_CREDENCIALES_PROYECTO.txt',
  ]) {
    test(`dev-server bloquea archivo interno ${blocked} (403/404)`, async ({ request }) => {
      const res = await request.get(blocked);
      expect([403, 404]).toContain(res.status());
    });
  }
});

