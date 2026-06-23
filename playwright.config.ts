import { defineConfig, devices } from '@playwright/test';

// パスキー儀式の E2E。webServer で build → wrangler pages dev を起動し、
// CDP の仮想認証器(Virtual Authenticator)で register/login を自動検証する。
// 前提: .dev.vars に APP_PASSPHRASE と SESSION_SECRET が設定されていること。

const PORT = 8791;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // WebAuthn は rpID に IP を許可しない。localhost で動かすこと（rpID=localhost）。
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    locale: 'ja-JP',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx wrangler pages dev dist --port ${PORT} --kv SCHEDULE_KV`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
