import { expect, test } from '@playwright/test';

// 画像/動画からの取り込みフロー（側）E2E。
// バックエンドは APIキー未設定時の StubAnalyzer を使うため、キー無しで決定的に通る（CI安全）。
const PASSPHRASE = 'test-pass-1234567890';

// 1x1 透明PNG（内容はスタブが無視。アップロード経路の検証用）。
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

test('画像/動画から取り込み: アップロード→確認モーダル→選択して追加', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();

  const before = await page.getByTestId('schedule-row').count();

  // 隠しファイル入力に直接セット（ネイティブダイアログを介さない標準手法）
  await page.getByTestId('media-input').setInputFiles({
    name: 'notice.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  });

  // 確認モーダルに候補が出る（スタブは2件）
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const candidates = page.getByTestId('analyze-candidate');
  expect(await candidates.count()).toBeGreaterThanOrEqual(1);
  const added = await candidates.count();

  // 全件取り込む
  await page.getByTestId('analyze-confirm').click();

  // 行が候補数ぶん増え、保存される
  await expect(page.getByTestId('schedule-row')).toHaveCount(before + added);
  await expect(page.getByTestId('save-status')).toContainText('保存しました', { timeout: 15_000 });
});

test('メニューに「画像/動画から取り込み」項目がある', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();

  await page.getByTestId('menu-btn').click();
  await expect(page.getByRole('menuitem', { name: '画像/動画から取り込み' })).toBeVisible();
});
