import { test, expect } from '@playwright/test';

test.describe('Orbe360 smoke — routing P0', () => {
  test('raíz es marketing Orbe360 (no viewer)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('heading', { name: /La plataforma para tours 360 de tu empresa/i })).toBeVisible();
    await expect(page.locator('#panorama')).toHaveCount(0);
  });

  test('landing /plataforma/index.html redirige a /', async ({ page, baseURL }) => {
    const res = await page.request.get(`${baseURL}/plataforma/index.html`, {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const loc = res.headers().location || '';
    expect(loc).toMatch(/\/$/);
    expect(loc).not.toMatch(/plataforma/i);

    await page.goto('/plataforma/index.html');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: /La plataforma para tours 360 de tu empresa/i })).toBeVisible();
  });

  test('raíz / carga CSS de marketing (200)', async ({ page, request }) => {
    await page.goto('/');
    const cssHref = await page.locator('link[rel="stylesheet"][href*="marketing.css"]').getAttribute('href');
    expect(cssHref).toBe('/plataforma/marketing.css');
    const res = await request.get('/plataforma/marketing.css');
    expect(res.status()).toBe(200);
    const tokens = await request.get('/plataforma/tokens.css');
    expect(tokens.status()).toBe(200);
  });

  test('marketing anidado bajo tenant redirige a /', async ({ page, baseURL }) => {
    const nested =
      '/unisimoncucuta/experienciavirtual/plataforma/index.html';
    const res = await page.request.get(`${baseURL}${nested}`, {
      maxRedirects: 0,
    });
    expect([301, 302, 303, 307, 308]).toContain(res.status());
    const loc = res.headers().location || '';
    expect(loc).toMatch(/\/$/);
    expect(loc).not.toMatch(/unisimoncucuta|plataforma/i);
  });

  test('landing pública no filtra roles internos ni CTA admin', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Superadmin/i);
    expect(body).not.toMatch(/Admin de tour/i);
    expect(body).not.toMatch(/por ahora hay una demo/i);
    expect(body).not.toMatch(/Entrar al panel/i);
    expect(body).not.toMatch(/Acceso administrador/i);
    expect(body).not.toMatch(/Acceso administración/i);
    // Acceso solo en footer, no en nav principal / hero
    await expect(page.locator('.public-nav a[href*="login"]')).toHaveCount(0);
    await expect(page.locator('.hero a[href*="login"]')).toHaveCount(0);
    await expect(page.locator('.cta-band a[href*="login"]')).toHaveCount(0);
    await expect(page.locator('.site-foot a[href*="login"]')).toHaveCount(1);
    await expect(page.getByText(/Cliente · Universidad Simón Bolívar/i)).toBeVisible();
    await expect(page.locator('.category-strip .category')).toHaveCount(0);
    await expect(page.locator('.use-cases')).toBeVisible();
  });

  test('control-web sin sesión redirige a login', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/control-web/');
    await expect(page).toHaveURL(/\/plataforma\/login\.html/, { timeout: 15_000 });
    expect(page.url()).toMatch(/return=/);
    expect(decodeURIComponent(page.url())).toMatch(/control-web/);
  });

  test('control-web HTML incluye gate (cw-locked / cwAuthGate)', async ({ page, baseURL }) => {
    const res = await page.request.get(`${baseURL}/control-web/index.html`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/cw-locked|cwAuthGate/);
    expect(html).toMatch(/Orbe360 Control Web/);
    expect(html).toMatch(/btnSetFrontView|Vista principal|frontViewHint/);
    expect(html).not.toMatch(/Universidad Simón Bolívar/i);
    expect(html).not.toMatch(/PEVCI/i);
    const cssRes = await page.request.get(`${baseURL}/control-web/admin.css`);
    const css = await cssRes.text();
    expect(css).toMatch(/--cw-accent:\s*#0284c7/i);
  });

  test('tour canónico Unisimón carga y no expone Control Web', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#adminLink')).toHaveCount(0);
    await expect(page.locator('a[href*="control-web"]')).toHaveCount(0);
    const resolved = await page.evaluate(() => ({
      tour: window.__ORBE_TOUR_SLUG__,
      org: window.__ORBE_ORG_SLUG__,
    }));
    expect(resolved.tour).toBe('experienciavirtual');
    expect(resolved.org).toBe('unisimoncucuta');
  });

  test('TourBranding aplica CSS vars desde branding Convex (fixture piloto)', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    // After Convex load: seeded TourBranding fields paint the shell (data, not engine hardcode).
    await expect.poll(async () => page.title(), { timeout: 15_000 }).toMatch(/Unisimón|PEVCI/i);
    const colors = await page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const inlineBrand = document.documentElement.style.getPropertyValue('--brand').trim();
      return {
        brand: root.getPropertyValue('--brand').trim(),
        brandInline: inlineBrand,
        hotspot: root.getPropertyValue('--hotspot-accent').trim() || null,
        boot: document.documentElement.dataset.tourBrandBoot || null,
        applied: document.documentElement.dataset.tourBrand || null,
        primaryAttr: document.documentElement.dataset.tourBrandPrimary || null,
      };
    });
    // Engine early-boot is neutral; applied primary comes from TourBranding object.
    expect(colors.boot === 'neutral' || colors.boot === null || colors.applied === 'applied').toBeTruthy();
    expect(colors.applied).toBe('applied');
    expect(colors.brand.toLowerCase()).toBe(colors.primaryAttr);
    expect(colors.brandInline.toLowerCase()).toBe(colors.brand.toLowerCase());
    expect(colors.brand.toLowerCase()).not.toBe('#0284c7');
    // Seeded piloto fixture (Convex), not viewer hardcode:
    expect(colors.brand.toLowerCase()).toBe('#0a7a45');
    await expect(page.locator('#tourClientBrand')).toBeVisible();
    await expect(page.locator('#tourClientBrand')).toContainText(/Unisimón|Campus/i);
    await expect(page.locator('#poweredByOrbe')).toBeVisible();
    expect(await page.title()).not.toMatch(/Orbe360/i);
    const menuBg = await page.locator('#menuToggle').evaluate((el) =>
      getComputedStyle(el).backgroundColor
    );
    expect(menuBg).not.toMatch(/rgb\(\s*2,\s*132,\s*199\s*\)/);
    // Client name is primary chrome; Orbe is subtle powered-by only.
    await expect(page.locator('#tourClientBrand .tour-client-brand__name')).toBeVisible();
    const brandFontSize = await page.locator('#tourClientBrand .tour-client-brand__name').evaluate(
      (el) => parseFloat(getComputedStyle(el).fontSize)
    );
    const poweredSize = await page.locator('#poweredByOrbe').evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize)
    );
    expect(brandFontSize).toBeGreaterThan(poweredSize);
  });

  test('publicTourHref exige orgSlug (no default Unisimón)', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      const mod = await import('/src/tourSlug.js');
      let threw = false;
      try {
        mod.publicTourHref('otro-campus');
      } catch (_e) {
        threw = true;
      }
      const foreign = mod.publicTourHref({
        tourSlug: 'otro-campus',
        orgSlug: 'empresa-demo',
      });
      return {
        threw,
        foreign,
        hasUnisimon: foreign.includes('unisimoncucuta'),
      };
    });
    expect(result.threw).toBe(true);
    expect(result.hasUnisimon).toBe(false);
    expect(result.foreign).toBe('/empresa-demo/otro-campus/');
  });

  test('viewer no importa Soft Clay tokens de plataforma', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    const leaked = await page.evaluate(() => {
      const sheets = [...document.styleSheets];
      return sheets.some((s) => {
        try {
          return String(s.href || '').includes('/plataforma/tokens.css');
        } catch (_e) {
          return false;
        }
      });
    });
    expect(leaked).toBe(false);
    const orbeAccent = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--orbe-accent').trim()
    );
    expect(orbeAccent).toBe('');
  });

  test('deep link ?scene= bajo path canónico', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/?scene=entrada-principal');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    const resolved = await page.evaluate(() => window.__ORBE_TOUR_SLUG__);
    expect(resolved).toBe('experienciavirtual');
  });

  test('landing CTA usa path canónico', async ({ page }) => {
    await page.goto('/');
    const cta = page.locator('#demoCta');
    await expect(cta).toBeVisible();
    const href = await cta.getAttribute('href');
    expect(href).toMatch(/\/unisimoncucuta\/experienciavirtual\/?/);
  });

  test('compat ?slug= redirige a path canónico', async ({ page }) => {
    await page.goto('/?slug=unisimon-campus');
    await expect(page).toHaveURL(/\/unisimoncucuta\/experienciavirtual\/?/);
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
  });

  test('compat /index.html sigue sirviendo viewer', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    const resolved = await page.evaluate(() => window.__ORBE_TOUR_SLUG__);
    expect(resolved).toBe('experienciavirtual');
  });

  test('control-web bajo prefijo de tour redirige sin sesión', async ({ page }) => {
    await page.goto('/orbe/sandbox/control-web/');
    await expect(page).toHaveURL(/\/plataforma\/login\.html/, { timeout: 15_000 });
    const ret = new URL(page.url()).searchParams.get('return') || '';
    expect(ret).toMatch(/\/orbe\/sandbox\/control-web/);
  });

  test('org-admin canónico a nivel organización', async ({ page, baseURL }) => {
    const res = await page.request.get(
      `${baseURL}/unisimoncucuta/org-admin.html`
    );
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/publishSection/);
    expect(html).toMatch(/Evaluar checklist/);
    expect(html).toMatch(/accessibilityPublish:setTourPublished/);
    expect(html).toMatch(/Panel de organización/);
    expect(html).toMatch(/admin-tabs|role="tablist"/);
    expect(html).toMatch(/brandPreview|brand-preview/);
  });

  test('org-admin legacy bajo tour redirige a org-level', async ({ page, baseURL }) => {
    const res = await page.request.get(
      `${baseURL}/unisimoncucuta/experienciavirtual/org-admin.html`,
      { maxRedirects: 0 }
    );
    expect(res.status()).toBe(302);
    expect(res.headers()['location']).toBe('/unisimoncucuta/org-admin.html');
  });

  test('superadmin es dashboard con KPIs y seed avanzado', async ({ page, baseURL }) => {
    const res = await page.request.get(`${baseURL}/plataforma/superadmin.html`);
    expect(res.status()).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/Dashboard de plataforma/);
    expect(html).toMatch(/kpiRow|kpiOrgs/);
    expect(html).toMatch(/getPlatformStats|kpi-row/);
    expect(html).toMatch(/orgMaxTours|maxTours/);
    expect(html).toMatch(/Avanzado — seed/);
    expect(html).not.toMatch(/Panel Superadmin/);
  });

  test('org-admin expone sección de publicación (path físico)', async ({ page }) => {
    await page.goto('/plataforma/org-admin.html');
    const html = await page.evaluate(async () => {
      const res = await fetch('/plataforma/org-admin.html');
      return res.text();
    });
    expect(html).toMatch(/publishSection/);
    expect(html).toMatch(/Evaluar checklist/);
    expect(html).toMatch(/evaluateTourFromDb/);
    expect(html).toMatch(/accessibilityPublish:setTourPublished/);
    expect(html).not.toMatch(/syncSpatialBtn|Reset grafo campus/);
    expect(html).toMatch(/activeTourSelect/);
  });

  test('control-web index sin contexto org/tour no abre editor', async ({ page }) => {
    await page.goto('/control-web/index.html');
    await expect(page).toHaveURL(/\/plataforma\/login\.html/, { timeout: 15_000 });
  });

  test('viewer.js reaplica initialView en switchScene', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    const src = await page.evaluate(async () => {
      const res = await fetch('/src/viewer.js');
      return res.text();
    });
    expect(src).toMatch(/applySceneView/);
    expect(src).toMatch(/resolveInitialView/);
    expect(src).toMatch(/Reaplicar vista frontal|cada entrada/);
  });

  test('media Unisimón bajo tenant; root /panoramas y /assets = 410', async ({
    page,
    request,
  }) => {
    const pano =
      '/media/unisimoncucuta/experienciavirtual/panoramas/R0010060_202503281449_YP00145909.JPG';
    const ok = await request.get(pano);
    expect(ok.status()).toBe(200);

    const gonePano = await request.get(
      '/panoramas/R0010060_202503281449_YP00145909.JPG'
    );
    expect(gonePano.status()).toBe(410);

    const goneAssets = await request.get(
      '/assets/audio/scenes/entrada-principal.mp3'
    );
    expect(goneAssets.status()).toBe(410);

    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    const graph = await page.evaluate(async () => {
      const res = await fetch('tour-graph.json', { cache: 'no-store' });
      return res.json();
    });
    expect(Array.isArray(graph.connections)).toBe(true);
    expect(graph.connections.length).toBeGreaterThan(10);
  });

  test('Orbe sandbox aislado (4 escenas, media propia)', async ({ page, request }) => {
    const pano =
      '/media/orbe/sandbox/panoramas/R0010060_202503281449_YP00145909.JPG';
    expect((await request.get(pano)).status()).toBe(200);
    await page.goto('/orbe/sandbox/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 15_000 });
    const n = await page.evaluate(() => window.__ORBE_TOUR_SLUG__);
    expect(n).toBe('sandbox');
  });
});
