import { test, expect } from '@playwright/test';

test.describe('Landing i18n, Theme, Sedes & Legal Consistency', () => {
  test('alterna idioma ES/EN en toda la landing incluyendo Bento, Sedes, Soluciones y persiste', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#features-title')).toContainText(/Todo lo que necesitas/i);

    await page.locator('#langToggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#features-title')).toContainText(/Everything you need/i);
    await expect(page.locator('#tours-title')).toContainText(/Cúcuta Campus/i);
    await expect(page.locator('#sol-title')).toContainText(/Adapted to your industry/i);
    await expect(page.locator('[data-sede-card="sede-2"] .sede-card__link')).toContainText(/Enter 360° Tour/i);
    await expect(page.locator('[data-sede-card="sede-1"] .sede-card__link')).toContainText(/Coming soon/i);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#features-title')).toContainText(/Everything you need/i);

    await page.locator('#langToggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('alterna tema claro/oscuro y persiste en localStorage.orbe_theme', async ({ page }) => {
    await page.goto('/');
    const before = await page.locator('html').getAttribute('data-theme');
    await page.locator('#themeToggle').click();
    const after = await page.locator('html').getAttribute('data-theme');
    expect(after).not.toBe(before);
    expect(['dark', 'light']).toContain(after);

    const saved = await page.evaluate(() => localStorage.getItem('orbe_theme'));
    expect(saved).toBe(after);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', after);
  });

  test('Sede 2 alinea miniatura sede-2.jpg (200) y Sede 4 anónima no expone borrador privado', async ({ page, request }) => {
    await page.goto('/');
    const imgSrc = await page.locator('[data-sede-card="sede-2"] img').getAttribute('src');
    expect(imgSrc).toBe('/plataforma/assets/sedes/sede-2.jpg');
    expect((await request.get(imgSrc)).status()).toBe(200);

    const sede4 = page.locator('[data-sede-card="sede-4"]');
    await expect(sede4).toHaveAttribute('aria-disabled', 'true');
    await expect(sede4).not.toContainText(/Borrador privado/i);
    await expect(sede4).toContainText(/Próximamente|Coming soon/i);
  });

  test('accesibilidad.html usa iconos SVG sin símbolos ✓/⟳ y soporta EN/ES', async ({ page }) => {
    await page.goto('/plataforma/accesibilidad.html');
    const esText = await page.locator('.status-table').first().innerText();
    expect(esText).not.toMatch(/[✓⟳]/);
    await expect(page.locator('.status-table svg').first()).toBeVisible();

    await page.locator('#langToggle').click();
    await expect(page.locator('#verificacion-en')).toBeVisible();
    await expect(page.locator('#hero-title-en')).toContainText(/barrier-free/i);
  });

  for (const path of [
    '/plataforma/privacidad.html',
    '/plataforma/cookies.html',
    '/plataforma/tratamiento-datos.html',
    '/plataforma/terminos.html',
  ]) {
    test(`página legal ${path} carga 200, traduce EN/ES y omite jerga interna`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      const bodyText = await page.locator('main').innerText();
      expect(bodyText).not.toMatch(/trycloudflare\.com|demo académica/i);
      await page.locator('#langToggle').click();
      await expect(page.locator('[data-lang-block="en"]')).toBeVisible();
    });
  }
});

