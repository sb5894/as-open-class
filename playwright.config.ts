import { defineConfig, devices } from '@playwright/test';
const previewURL = process.env.PLAYWRIGHT_BASE_URL;
export default defineConfig({
  testDir: './tests/browser', testMatch: '**/*.e2e.ts', fullyParallel: false,
  use: {
    baseURL: previewURL || 'http://127.0.0.1:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure',
    // Explicit opt-in for Windows WebKit's test certificate-store limitation.
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === 'true',
  },
  projects: [
    { name: 'android-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
  webServer: previewURL ? undefined : { command: 'npm.cmd run dev', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});
