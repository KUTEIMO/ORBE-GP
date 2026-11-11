import { test, expect } from '@playwright/test';

const CONVEX = process.env.CONVEX_URL || 'http://127.0.0.1:3210';
const SUPER_EMAIL = process.env.ORBE_TEST_SUPER_EMAIL || 'superadmin@orbe360.local';
const SUPER_PASS = process.env.ORBE_TEST_SUPER_PASS || 'OrbeSuper2026!';
const UNI_EMAIL = process.env.ORBE_TEST_UNI_EMAIL || 'admin@unisimon.local';
const UNI_PASS = process.env.ORBE_TEST_UNI_PASS || 'UnisimonAdmin2026!';

async function convexCall(kind, path, args) {
  const res = await fetch(`${CONVEX}/api/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const data = await res.json();
  if (!res.ok || data.status === 'error') {
    throw new Error(data.errorMessage || data.message || 'convex error');
  }
  return data.value;
}

async function loginToken(email, password) {
  const res = await convexCall('mutation', 'auth:login', { email, password });
  if (!res?.ok || !res.token) throw new Error(res?.error || 'login failed');
  return res.token;
}

test.describe('Multi-Role Auth, Return Sanitizing, Panels & Isolation E2E', () => {
  let superToken = null;
  let editorToken = null;
  const qaEditorEmail = `qa-test-editor-${Date.now()}@orbe-authz.test`;
  const qaEditorPass = 'QaEditorPass2026!';

  test.beforeAll(async () => {
    superToken = await loginToken(SUPER_EMAIL, SUPER_PASS);
    const orgs = await convexCall('query', 'organizations:listOrganizations', {
      token: superToken,
      now: Date.now(),
    });
    const orbeOrg = orgs.find((o) => o.slug === 'orbe');
    if (orbeOrg) {
      await convexCall('mutation', 'auth:createAdminUser', {
        token: superToken,
        organizationId: orbeOrg.id,
        name: 'QA Editor UI',
        email: qaEditorEmail,
        password: qaEditorPass,
        role: 'tourEditor',
      });
      editorToken = await loginToken(qaEditorEmail, qaEditorPass);
    }
  });

  test.afterAll(async () => {
    if (superToken) {
      await convexCall('mutation', 'cleanupQa:cleanupQaArtifacts', {
        token: superToken,
        dryRun: false,
      }).catch(() => {});
      await convexCall('mutation', 'auth:logout', { token: superToken }).catch(() => {});
    }
  });

  test('login rechaza open-redirect con barra invertida (/\\evil.com) y redirige seguro', async ({ page }) => {
    await page.goto('/plataforma/login.html?return=%2F%5Cevil.com');
    await expect(page.locator('#loginForm')).toBeVisible();
    await page.locator('#email').fill(UNI_EMAIL);
    await page.locator('#password').fill(UNI_PASS);
    await page.locator('#submitBtn').click();

    await expect(page).toHaveURL(/\/unisimoncucuta\/org-admin\.html/, { timeout: 15_000 });
  });

  test('login rechaza retorno cross-org (/orbe/sandbox/control-web/) para admin Unisimón', async ({ page }) => {
    await page.goto('/plataforma/login.html?return=%2Forbe%2Fsandbox%2Fcontrol-web%2F');
    await expect(page.locator('#loginForm')).toBeVisible();
    await page.locator('#email').fill(UNI_EMAIL);
    await page.locator('#password').fill(UNI_PASS);
    await page.locator('#submitBtn').click();

    await expect(page).toHaveURL(/\/unisimoncucuta\/org-admin\.html/, { timeout: 15_000 });
  });

  test('admin@unisimon accede a org-admin, métricas, bitácora y mi cuenta; branding preview calcula contraste', async ({ page }) => {
    const token = await loginToken(UNI_EMAIL, UNI_PASS);
    await page.goto('/plataforma/login.html');
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), token);

    await page.goto('/unisimoncucuta/org-admin.html');
    await expect(page.locator('#whoami')).toContainText(/Administrador de organización/, { timeout: 15_000 });

    await page.locator('#tab-branding').click();
    await expect(page.locator('#brandPreview')).toBeVisible();
    await expect
      .poll(() =>
        page
          .locator('#brandPreview')
          .evaluate((el) => el.style.getPropertyValue('--preview-ink').trim())
      )
      .toMatch(/^#(ffffff|09110d)$/);

    await page.locator('#tab-metrics').click();
    await expect(page.locator('#panel-metrics')).toBeVisible();
    await expect(page.locator('#exportMetricsCsvBtn')).toBeVisible();
    await expect(page.locator('#metricViews')).not.toHaveText('—', { timeout: 10_000 });

    await page.locator('#tab-account').click();
    await expect(page.locator('#profileName')).toBeVisible();
    await expect(page.locator('#revokeSessionsBtn')).toBeVisible();
  });

  test('admin@unisimon no puede abrir org-admin ni Control Web de orbe', async ({ page }) => {
    const token = await loginToken(UNI_EMAIL, UNI_PASS);
    await page.goto('/plataforma/login.html');
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), token);

    await page.goto('/orbe/org-admin.html');
    await expect(page).toHaveURL(/\/unisimoncucuta\/org-admin\.html\?deniedOrg=orbe/, { timeout: 15_000 });

    await page.goto('/orbe/sandbox/control-web/');
    await expect(page.locator('#cwAuthGate')).toContainText(/Acceso denegado/i, { timeout: 15_000 });
  });

  test('superadmin no puede editar Control Web ni Org Admin y accede a dashboard con Usuarios/Bitácora', async ({ page }) => {
    await page.goto('/plataforma/login.html');
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), superToken);

    await page.goto('/unisimoncucuta/experienciavirtual/control-web/');
    await expect(page).toHaveURL(/superadmin\.html\?notice=superadmin_no_tour_edit/, { timeout: 15_000 });

    await expect(page.locator('#seedBtn')).toHaveCount(0);
    await expect(page.locator('#kpiOrgs')).not.toHaveText('—', { timeout: 10_000 });

    await page.locator('#tab-users').click();
    await expect(page.locator('#manageUserPanel')).toBeVisible();
    await expect(page.locator('#manageUserSelect')).toBeVisible();

    await page.locator('#tab-audit').click();
    await expect(page.locator('#auditLogList')).toBeVisible();

    await page.locator('#tab-account').click();
    await expect(page.locator('#saProfileForm')).toBeVisible();
    await expect(page.locator('#saPasswordForm')).toBeVisible();
  });

  test('viewer oculta #adminLink para superadmin y tenant ajeno, y solo lo muestra al editor autorizado', async ({ page }) => {
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), superToken);
    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#adminLink')).toHaveCount(0);

    const uniToken = await loginToken(UNI_EMAIL, UNI_PASS);
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), uniToken);

    await page.goto('/orbe/sandbox/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#adminLink')).toHaveCount(0);

    await page.goto('/unisimoncucuta/experienciavirtual/');
    await expect(page.locator('#panorama')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#adminLink')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#adminLink')).toHaveAttribute('href', '/unisimoncucuta/experienciavirtual/control-web/');
  });

  test('tourEditor ve panel org sin Branding, Publicación ni Crear Tour', async ({ page }) => {
    expect(editorToken).toBeTruthy();
    await page.goto('/');
    await page.evaluate((t) => localStorage.setItem('orbe360.session', t), editorToken);
    await page.goto('/orbe/org-admin.html');
    await expect(page.locator('#whoami')).toContainText(/Editor de tour/, { timeout: 15_000 });
    await expect(page.locator('#tab-branding')).toBeHidden();
    await expect(page.locator('#tab-publish')).toBeHidden();
    await expect(page.locator('#createTourDetails')).toBeHidden();
    await expect(page.locator('#tourManageBar')).toBeHidden();
    await expect(page.locator('[data-brand], [data-pub]')).toHaveCount(0);
  });
});

