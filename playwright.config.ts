import { defineConfig } from '@playwright/test';

const responsiveProjects = [
  { name: 'mobile-compact', viewport: { width: 320, height: 568 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
  { name: 'mobile-wide', viewport: { width: 412, height: 915 } },
  { name: 'mobile-landscape', viewport: { width: 667, height: 375 } },
  { name: 'tablet-portrait', viewport: { width: 768, height: 1024 } },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 } },
  { name: 'notebook', viewport: { width: 1280, height: 720 } },
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'desktop-large', viewport: { width: 1920, height: 1080 } },
  { name: 'ultrawide', viewport: { width: 2560, height: 1080 } },
] as const;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  outputDir: 'test-results/playwright',
  projects: [
    {
      name: 'functional',
      testIgnore: /(responsiveness|responsive-foundation)\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    ...responsiveProjects.map(({ name, viewport }) => ({
      name,
      testMatch: /(responsiveness|responsive-foundation)\.spec\.ts/,
      use: { viewport },
    })),
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:web -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
