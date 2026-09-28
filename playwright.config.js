// E2E tests. Locally: Chromium desktop + a touch-phone profile.
// Set ALL_BROWSERS=1 (as CI does) to also run Firefox and WebKit.
import { defineConfig, devices } from '@playwright/test';

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile/ },
  { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile/ },
];
if (process.env.ALL_BROWSERS) {
  projects.push(
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile/ },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] }, testMatch: /mobile/ },
  );
}

export default defineConfig({
  testDir: 'test/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173' },
  webServer: [
    { command: 'node scripts/serve.js . 4173', url: 'http://localhost:4173/test/fixtures/site/', reuseExistingServer: !process.env.CI },
    // The docs site, mounted at /minimarker/ like GitHub Pages
    { command: 'node scripts/serve.js docs 4174 /minimarker/', url: 'http://localhost:4174/minimarker/', reuseExistingServer: !process.env.CI },
  ],
  projects,
});
