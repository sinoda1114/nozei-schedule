import { expect, test } from '@playwright/test';

// .dev.vars の APP_PASSPHRASE と一致させること
const PASSPHRASE = 'test-pass-1234567890';

test('パスフレーズログイン → この端末をパスキー登録 → ログアウト → パスキーでログイン', async ({
  page,
}) => {
  // --- CDP 仮想認証器をセットアップ（指紋/Touch ID の代わり） ---
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });

  // 端末名プロンプト(window.prompt)を自動承認
  page.on('dialog', (dialog) => {
    void dialog.accept('E2E Device');
  });

  await page.goto('/');

  // --- 1) パスフレーズでログイン ---
  await expect(page.locator('.gate')).toBeVisible();
  await page.fill('.js-gate-form input[name="pass"]', PASSPHRASE);
  await page.click('.js-gate-form button[type="submit"]');
  await expect(page.locator('.topbar')).toBeVisible();

  // --- 2) この端末をパスキー登録 ---
  await page.click('.js-menu-btn');
  await page.click('.js-register-passkey');
  await expect(page.locator('.js-save-status')).toContainText('登録しました', { timeout: 15_000 });

  // 仮想認証器に資格情報が1つ以上登録されたことを確認
  const after = await client.send('WebAuthn.getCredentials', { authenticatorId });
  expect(after.credentials.length).toBeGreaterThanOrEqual(1);

  // --- 3) ログアウト ---
  await page.click('.js-menu-btn');
  await page.click('.js-logout');
  await expect(page.locator('.gate')).toBeVisible();

  // --- 4) パスキーでログイン（仮想認証器が自動応答） ---
  await page.click('.js-passkey-login');
  await expect(page.locator('.topbar')).toBeVisible();

  // ログイン後、エラーメッセージが表示されていないこと
  await expect(page.locator('.js-gate-error')).toHaveCount(0);
});
