import { expect, test } from '@playwright/test';

// スマホ幅でのレイアウト崩れ回帰テスト。
// 既知の崩れ: 明細行が固定多カラムのままで、ラベルが1文字ずつ折返し＋「削除」が画面外へはみ出す。
const PASSPHRASE = 'test-pass-1234567890';

// iPhone 相当の縦長ビューポート
test.use({ viewport: { width: 390, height: 844 } });

test('スマホ幅で横スクロール(はみ出し)が発生せず、行の操作ボタンが画面内に収まる', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();

  // 行が無ければサンプル投入
  if ((await page.getByTestId('schedule-row').count()) === 0) {
    await page.getByTestId('load-seed').click();
    await expect(page.getByTestId('schedule-row').first()).toBeVisible();
  }

  // 1) ページ全体に横方向のはみ出しが無い（scrollWidth が clientWidth を超えない）
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `横はみ出し ${overflow}px`).toBeLessThanOrEqual(1);

  // 2) 先頭行の「削除」ボタンが横方向で画面内に収まっている（右端が切れていない）
  const firstRow = page.getByTestId('schedule-row').first();
  const del = firstRow.getByRole('button', { name: '削除' });
  await del.scrollIntoViewIfNeeded();
  const delBox = await del.boundingBox();
  expect(delBox, '削除ボタンのboundingBoxが取得できない').not.toBeNull();
  expect(delBox!.x, '削除ボタンが左にはみ出し').toBeGreaterThanOrEqual(0);
  expect(delBox!.x + delBox!.width, '削除ボタンの右端が画面外').toBeLessThanOrEqual(391);

  // 3) ラベルが極端に縦長(1文字折返し)になっていない＝行の高さが過大でない
  const rowBox = await firstRow.boundingBox();
  expect(rowBox, '行のboundingBoxが取得できない').not.toBeNull();
  expect(rowBox!.height, `行の高さ ${rowBox!.height}px が過大`).toBeLessThan(200);
});
