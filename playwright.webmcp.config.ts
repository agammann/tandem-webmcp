import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e', testMatch: '**/native-webmcp.spec.ts', workers: 1, timeout: 60000,
  outputDir: process.env.PLAYWRIGHT_OUTPUT_DIR || 'test-results/native-webmcp',
  expect: { timeout: 8000 },
  use: {
    baseURL: process.env.TANDEM_WEBMCP_URL || 'http://localhost:3032',
    channel: process.env.TANDEM_WEBMCP_BROWSER ? undefined : process.env.TANDEM_WEBMCP_CHANNEL || 'chrome',
    launchOptions: {
      executablePath: process.env.TANDEM_WEBMCP_BROWSER,
      args: ['--enable-features=WebMCP'], ignoreDefaultArgs: ['--disable-back-forward-cache'],
    },
    trace: 'retain-on-failure',
  },
  webServer: process.env.TANDEM_WEBMCP_URL ? undefined : {
    command: 'pnpm preview --port 3032', url: 'http://localhost:3032', reuseExistingServer: false, timeout: 120000,
  },
});
