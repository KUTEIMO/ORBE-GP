import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  if (!fs.existsSync('mockups_finales')) fs.mkdirSync('mockups_finales');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('1. Landing page...');
  await page.goto('https://orbe360-unisimon.pages.dev/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'mockups_finales/01_landing_orbe360.png' });

  console.log('2. Tour 360 Sede 2...');
  await page.goto('https://orbe360-unisimon.pages.dev/unisimoncucuta/experienciavirtual/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'mockups_finales/02_visor_360_sede2.png' });

  console.log('3. Tour 360 con Menu de Escenas...');
  try {
    const menuBtn = page.locator('#sceneListToggle');
    if (await menuBtn.isVisible()) {
      await menuBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.error('Menu error:', e.message);
  }
  await page.screenshot({ path: 'mockups_finales/03_visor_menu_escenas.png' });

  console.log('4. Panel Accesibilidad...');
  try {
    const a11yBtn = page.locator('#btnA11yMenu, #a11yBtn, button[title*="accesibilidad" i]').first();
    if (await a11yBtn.isVisible()) {
      await a11yBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.error('A11y error:', e.message);
  }
  await page.screenshot({ path: 'mockups_finales/04_panel_accesibilidad.png' });

  console.log('5. Login Institucional...');
  await page.goto('https://orbe360-unisimon.pages.dev/plataforma/login.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'mockups_finales/05_login_plataforma.png' });

  console.log('6. Control Web Editor...');
  await page.goto('https://orbe360-unisimon.pages.dev/unisimoncucuta/experienciavirtual/control-web/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'mockups_finales/06_control_web_editor.png' });

  console.log('Done capturing mockups!');
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

