/** @type {import('@playwright/test').PlaywrightTestConfig} */
export default {
  testDir: './tests',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: process.env.WEB_URL || 'http://127.0.0.1:8081',
    headless: true,
  },
  webServer: {
    command: 'node scripts/dev-server.mjs',
    port: 8081,
    reuseExistingServer: true,
    timeout: 60_000,
  },
};
