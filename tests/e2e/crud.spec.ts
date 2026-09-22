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
  const dialog = page.getByRole('dialog', { name: '予定を追加' });
  await expect(dialog).toBeVisible();

  // 入力（一意なラベルで衝突回避）
  const label = `E2E自動テスト納付-${Date.now()}`;
  await dialog.locator('input[name="label"]').fill(label);

  // 納付期限: DateSegment はセグメントが埋まると次へ自動送りするため、Tab を挟まず続けて打つ。
  // locale='ja-JP' なので YYYY/MM/DD 順。
  await dialog.getByRole('spinbutton').first().click();
  await page.keyboard.type('20270310');

  await dialog.locator('input[name="amount"]').fill('12345');

  // 送信
  await dialog.getByRole('button', { name: '追加' }).click();

  // 行が増え、入力したラベルと打鍵した日付がそのまま一覧に現れる
  const row = page.getByTestId('schedule-row').filter({ hasText: label });
  await expect(row).toContainText('2027/3/10');
  await expect(page.getByTestId('schedule-row')).toHaveCount(before + 1);

  // 保存ステータスが「保存しました」になる
  await expect(page.getByTestId('save-status')).toContainText('保存しました', { timeout: 15_000 });
});
