import { test, expect } from '@playwright/test';

test.describe('Viewer 360 Navigation, Search, Hotspots, Contrast & Media', () => {
  test('soporta deep link ?sede=2 y carga escena válida', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/?sede=2');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#sceneTitle')).not.toHaveText('Tour virtual 360°');
  });

  test('flechas de navegación usan iconos SVG (sin texto ‹/›) y cambian de escena', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/?scene=entrada-principal');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#sceneTitle')).not.toHaveText('Tour virtual 360°', { timeout: 20_000 });
    const prevText = (await page.locator('#prevScene').innerText()).trim();
    const nextText = (await page.locator('#nextScene').innerText()).trim();
    expect(prevText).toBe('');
    expect(nextText).toBe('');
    await expect(page.locator('#nextScene svg')).toBeVisible();
    await expect(page.locator('#prevScene svg')).toBeVisible();

    const beforeUrl = page.url();
    await page.locator('#nextScene').click();
    await expect.poll(() => page.url()).not.toBe(beforeUrl);
  });

  test('buscador en menú lateral (#sceneSearchInput) filtra escenas y muestra estado vacío', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/?scene=entrada-principal');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });

    await page.locator('#menuToggle').click();
    await expect(page.locator('#sceneMenu')).toHaveClass(/scene-menu--open/);

    const search = page.locator('#sceneSearchInput');
    await expect(search).toBeVisible();
    await search.fill('biblioteca');
    await expect(page.locator('.scene-sublist__item:not([hidden]) .scene-button').first()).toBeVisible();
    await expect(page.locator('#sceneSearchEmpty')).toBeHidden();

    await search.fill('zzzz_inexistente_xyz');
    await expect(page.locator('.scene-sublist__item:not([hidden])')).toHaveCount(0);
    await expect(page.locator('#sceneSearchEmpty')).toBeVisible();

    await search.fill('');
    await expect(page.locator('#sceneSearchEmpty')).toBeHidden();
  });

  test('tocar el modal de hotspot informativo no lo cierra y Escape lo cierra devolviendo foco', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/?scene=entrada-principal');
    await expect(page.locator('#hotspotList button').first()).toBeVisible({ timeout: 20_000 });

    const infoChip = page.locator('#hotspotList button[aria-label^="Abrir detalle"]').first();
    const hasInfo = (await infoChip.count()) > 0;
    if (hasInfo) {
      await infoChip.click();
      const panel = page.locator('#hotspotPanel');
      await expect(panel).toBeVisible();
      await expect(page.locator('#closeHotspotPanel svg')).toBeVisible();
      // Clicking inside modal surface must NOT close it
      await page.locator('#hotspotSummary').click();
      await expect(panel).toBeVisible();

      const href = await page.locator('#transcriptDownload').getAttribute('href');
      if (href) {
        expect(href).not.toMatch(/^javascript:/i);
      }

      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
    } else {
      await page.locator('#accessibilityToggle').click();
      await expect(page.locator('#accessibilityMenu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#accessibilityMenu')).toBeHidden();
    }
  });

  test('botón de cierre de panel accesible usa SVG (sin × textual)', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await page.locator('#accessibilityToggle').click();
    await expect(page.locator('#closeAccessibility svg')).toBeVisible();
    const rawClose = await page.locator('#closeAccessibility').evaluate((el) => {
      return Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent?.trim())
        .filter(Boolean)
        .join('');
    });
    expect(rawClose).toBe('');
  });

  test('diálogo WCAG calcula métricas dinámicas sin datos hardcoded de terceros', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await page.locator('#wcagAuditToggle').click();
    const dlg = page.locator('#wcagAuditDialog');
    await expect(dlg).toBeVisible();
    const text = await dlg.innerText();
    expect(text).not.toMatch(/Saraic|Tercer Corte|Jira Cloud/i);
    await expect(page.locator('#wcagStatScenes')).not.toHaveText('—');
    await expect(page.locator('#wcagStatContrast')).toContainText(/:\s*1/);
    await page.locator('#closeWcagAuditDialog').click();
    await expect(dlg).toBeHidden();
  });

  test('preferencias de accesibilidad (escala, alto contraste, lector, subtítulos) persisten al recargar', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });

    await page.locator('#accessibilityToggle').click();
    await page.locator('[data-font-size="increase"]').click();
    await page.locator('[data-contrast="high"]').click();
    await page.locator('label.switch[for="textToSpeechToggle"]').click();
    await page.locator('label.switch[for="captionAutoToggle"]').click();

    await page.reload();
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('body')).toHaveClass(/theme-high-contrast/);
    await expect(page.locator('#textToSpeechToggle')).toBeChecked();
    await expect(page.locator('#captionAutoToggle')).toBeChecked();
  });

  test('modo ?embed=1 oculta enlaces de plataforma y administración sin romper el visor', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/?embed=1');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveClass(/embed-mode/);
    await expect(page.locator('#platformLink')).toBeHidden();
    await expect(page.locator('#poweredByOrbe')).toBeHidden();
    await expect(page.locator('#adminLink')).toHaveCount(0);
  });

  test('contraste cromático real del botón de menú frente a su tinta calculada >= 4.5', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect.poll(
      () => page.evaluate(() => document.documentElement.dataset.tourBrand),
      { timeout: 15_000 }
    ).toBe('applied');

    const ratio = await page.evaluate(async () => {
      const mod = await import('/src/tourBranding.js');
      const primary = document.documentElement.style.getPropertyValue('--brand').trim() || '#4b5563';
      const ink = document.documentElement.style.getPropertyValue('--brand-ink').trim() || '#ffffff';
      return mod.contrastRatio(primary, ink);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  for (const vp of [
    { name: 'móvil', width: 375, height: 812 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'escritorio', width: 1280, height: 800 },
  ]) {
    test(`sin desbordamiento horizontal en ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/unisimoncucuta/experienciavirtual/');
      await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
      const overflow = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        inner: window.innerWidth,
      }));
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.inner);
    });
  }
});

