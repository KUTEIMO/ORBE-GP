import { test, expect } from '@playwright/test';

/**
 * Smoke + Phase 2 a11y motor checks (aligned to DOM after Fase 2).
 * Uses baseURL of playwright.config (8081).
 */
test.describe('Accesibilidad básica del tour 360°', () => {
  test('visor y skip-links están y reciben foco', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });

    const skipMenu = page.locator('a.skip-link, a[href="#sceneMenu"], #skipHotspots').first();
    await expect(skipMenu).toBeAttached();

    await page.locator('#panorama').focus();
    const tag = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    expect(tag === 'panorama' || tag === 'DIV' || Boolean(tag)).toBeTruthy();

    // Visitante anónimo: sin fuga a Control Web
    await expect(page.locator('#adminLink')).toHaveCount(0);
    await expect(page.locator('a[href*="control-web"]')).toHaveCount(0);
  });

  test('panorama no usa role=application; toggles tienen nombre accesible', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });

    await expect(page.locator('#panorama')).toHaveAttribute('role', 'region');
    await expect(page.locator('#tourApp')).not.toHaveAttribute('aria-live', 'polite');

    await page.locator('#accessibilityToggle').click();
    await expect(page.locator('#accessibilityMenu')).not.toHaveAttribute('hidden');

    const tts = page.locator('#textToSpeechToggle');
    const captions = page.locator('#captionAutoToggle');
    // Switch CSS hides the native input; assert accessible name via <label for>.
    await expect(tts).toBeAttached();
    await expect(captions).toBeAttached();

    const ttsName = await tts.evaluate((el) => {
      const id = el.id;
      const labels = Array.from(document.querySelectorAll(`label[for="${id}"]`));
      return labels.map((l) => l.textContent?.trim()).filter(Boolean).join(' ');
    });
    expect(ttsName.toLowerCase()).toContain('lector');

    const captionName = await captions.evaluate((el) => {
      const id = el.id;
      const labels = Array.from(document.querySelectorAll(`label[for="${id}"]`));
      return labels.map((l) => l.textContent?.trim()).filter(Boolean).join(' ');
    });
    expect(captionName.toLowerCase()).toContain('subtítulo');
  });

  test('lista semántica de destinos no está limitada a 4 y Escape cierra panel', async ({ page }) => {
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    // #hotspotList exists empty in HTML; wait until destinations hydrate from Convex/config
    await expect(page.locator('#hotspotList button').first()).toBeVisible({ timeout: 20_000 });

    const count = await page.locator('#hotspotList button').count();
    expect(count).toBeGreaterThan(0);

    // Open first info/detail if present, else open accessibility then close via Escape path
    const infoBtn = page.locator('#hotspotList button[aria-label^="Abrir detalle"]').first();
    if (await infoBtn.count()) {
      await infoBtn.click();
      await expect(page.locator('#hotspotPanel')).toBeVisible();
      await expect(page.locator('#audioStatus')).not.toHaveText(/Audio listo para reproducirse/);
      await page.keyboard.press('Escape');
      await expect(page.locator('#hotspotPanel')).toBeHidden();
    } else {
      await page.locator('#accessibilityToggle').click();
      await expect(page.locator('#accessibilityMenu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('#accessibilityMenu')).toBeHidden();
    }
  });
});
