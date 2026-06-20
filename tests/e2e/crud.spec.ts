import { expect, test } from '@playwright/test';

// .dev.vars の APP_PASSPHRASE と一致させること
const PASSPHRASE = 'test-pass-1234567890';

test('リカバリコードログイン → 追加モーダルで明細を1件追加できる', async ({ page }) => {
  await page.goto('/');

  // ログイン
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();

  const before = await page.getByTestId('schedule-row').count();

  // 追加モーダルを開く
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 入力（一意なラベルで衝突回避）
  const label = `E2E自動テスト納付-${Date.now()}`;
  await dialog.locator('input[name="label"]').fill(label);
  await dialog.locator('input[name="dueDate"]').fill('2027-03-10');
  await dialog.locator('input[name="amount"]').fill('12345');

  // 送信
  await dialog.getByRole('button', { name: '追加' }).click();

  // 行が増え、入力したラベルが一覧に現れる
  await expect(page.getByText(label)).toBeVisible();
  await expect(page.getByTestId('schedule-row')).toHaveCount(before + 1);

  // 保存ステータスが「保存しました」になる
  await expect(page.getByTestId('save-status')).toContainText('保存しました', { timeout: 15_000 });
});
