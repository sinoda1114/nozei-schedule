import { expect, test } from '@playwright/test';

// .dev.vars の APP_PASSPHRASE と一致させること
const PASSPHRASE = 'test-pass-1234567890';

test('リカバリコードログイン → この端末をパスキー登録 → ログアウト → パスキーでログイン', async ({
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

  await page.goto('/');

  // --- 1) リカバリコード（旧パスフレーズ）でログイン ---
  await expect(page.getByTestId('gate-form')).toBeVisible();
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();

  // --- 2) この端末をパスキー登録 ---
  await page.getByTestId('menu-btn').click();
  await page.getByRole('menuitem', { name: 'この端末をパスキー登録' }).click();
  await expect(page.getByTestId('save-status')).toContainText('登録しました', { timeout: 15_000 });

  // 仮想認証器に資格情報が1つ以上登録されたことを確認
  const after = await client.send('WebAuthn.getCredentials', { authenticatorId });
  expect(after.credentials.length).toBeGreaterThanOrEqual(1);

  // --- 3) ログアウト ---
  await page.getByTestId('menu-btn').click();
  await page.getByRole('menuitem', { name: 'ログアウト' }).click();
  await expect(page.getByTestId('gate-form')).toBeVisible();

  // --- 4) パスキーでログイン（仮想認証器が自動応答） ---
  await page.getByTestId('passkey-login').click();
  await expect(page.getByTestId('topbar')).toBeVisible();

  // ログイン後、エラーメッセージが表示されていないこと
  await expect(page.getByTestId('gate-error')).toHaveCount(0);
});
