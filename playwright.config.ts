import { randomBytes } from 'node:crypto';

import { defineConfig, devices } from '@playwright/test';

import { E2E_PASSPHRASE } from './tests/e2e/fixtures';

// パスキー儀式の E2E。webServer で build → wrangler pages dev を起動し、
// CDP の仮想認証器(Virtual Authenticator)で register/login を自動検証する。
//
// 認証情報は --binding でここから渡すため .dev.vars は不要（CI でもそのまま動く）。
// .dev.vars があっても --binding が優先される（wrangler 4.136.2 で実測）。
// この優先順位は公開仕様ではなく実装依存なので、wrangler を上げてローカルだけ
// ログインに失敗するようになったら、まずここを疑うこと。
// ANALYZER_API_KEY は空で上書きする。未設定であることが StubAnalyzer 使用の条件
// （functions/_lib/analyzer.ts の createAnalyzer）で、media-import の E2E が決定的に通る前提。

const PORT = 8791;

// セッション Cookie の HMAC 鍵。使い捨てサーバ専用なので実行ごとの乱数でよい。
const SESSION_SECRET = randomBytes(32).toString('hex');

const BINDINGS = [
  `APP_PASSPHRASE=${E2E_PASSPHRASE}`,
  `SESSION_SECRET=${SESSION_SECRET}`,
  'ANALYZER_API_KEY=',
]
  // 引用符は付けない。Playwright の webServer は Windows では cmd 経由で走り、
  // シングルクォートがリテラルとして値に混ざるため。
  // 代わりに、fixtures.ts がコメントで課している「シェル安全」の制約をここで強制する。
  // 破ったときに wrangler の不可解なエラーではなく、原因の分かる形で落とすため。
  .map((kv) => {
    if (/[^\w.=-]/.test(kv)) {
      throw new Error(`--binding の値にシェル安全でない文字が含まれています: ${kv}`);
    }
    return `--binding ${kv}`;
  })
  .join(' ');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // CI では標準CIが失敗時に playwright-report/ を artifact として上げるため、HTML も出す。
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    // WebAuthn は rpID に IP を許可しない。localhost で動かすこと（rpID=localhost）。
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    locale: 'ja-JP',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx wrangler pages dev dist --port ${PORT} --kv SCHEDULE_KV ${BINDINGS}`,
    url: `http://localhost:${PORT}`,
    // 既存サーバを再利用しない。再利用すると上の --binding が効かず、
    // 開発者の .dev.vars の値でログインに失敗して原因不明の赤になる
    // （この設定が認証情報の正本である以上、再利用の高速化より確実性を取る）。
    // ポートが塞がっていれば Playwright が起動失敗で明示的に落ちる。
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
