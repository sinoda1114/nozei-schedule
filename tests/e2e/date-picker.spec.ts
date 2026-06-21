// DatePicker コンポーネントの E2E テスト（TDD — RED から始める）
// テスト対象: src/ui/ItemFormModal.tsx の納付期限・支払日 DatePicker

import { expect, test } from '@playwright/test';

const PASSPHRASE = 'test-pass-1234567890';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();
});

// ── 1. DateField がセグメント表示される ─────────────────────────────────────

test('1. 追加モーダルの納付期限にスピンボタンが表示される', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // DateField のセグメント（role=spinbutton）が最低1つ存在する
  const spinners = dialog.getByRole('spinbutton');
  await expect(spinners.first()).toBeVisible();
});

// ── 2. キーボードで日付を入力できる ─────────────────────────────────────────

test('2. キーボード入力で日付をセットして追加できる', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // 表示名
  const label = `E2E-DatePicker-KB-${Date.now()}`;
  await dialog.locator('input[name="label"]').fill(label);

  // 最初のスピンボタン（年または月）をクリックしてキーボード入力
  const spinners = dialog.getByRole('spinbutton');
  await spinners.first().click();

  // React Aria DateSegment は順番に入力が進む
  // ロケールにより YYYY/MM/DD または MM/DD/YYYY の順になるが、
  // 年 4 桁 → Tab → 月 2 桁 → Tab → 日 2 桁 の流れで埋める
  await page.keyboard.type('2027');
  await page.keyboard.press('Tab');
  await page.keyboard.type('03');
  await page.keyboard.press('Tab');
  await page.keyboard.type('10');

  // 追加
  await dialog.getByRole('button', { name: '追加' }).click();

  // 一覧にラベルが表れる
  await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 });
});

// ── 3. カレンダーポップアップが正しく開く ────────────────────────────────────

test('3. カレンダーアイコンをクリックするとカレンダーが dialog 付近に表示される', async ({
  page,
}) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // カレンダートリガーボタンをクリック
  // DatePicker.Trigger には aria-label や data-slot="date-picker-trigger" が付く
  const trigger = dialog.locator('[data-slot="date-picker-trigger"]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  // カレンダーポップアップが表示される（role="application" は React Aria Calendar のデフォルト）
  const calendar = page.locator('[role="application"]');
  await expect(calendar).toBeVisible({ timeout: 5_000 });

  // ── カレンダーが画面左上に飛ばず、dialog 付近にある ──
  const dialogBox = await dialog.boundingBox();
  const calBox = await calendar.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(calBox).not.toBeNull();
  if (dialogBox && calBox) {
    // ポップアップの左端が dialog の左端から画面外にはみ出ていないこと（左上固定の症状を検出）
    // dialog の左端より 200px 以上左に飛んでいたら位置バグとみなす
    expect(calBox.x).toBeGreaterThan(dialogBox.x - 200);
    // ポップアップは dialog よりも大幅に上に出ていないこと
    expect(calBox.y).toBeGreaterThan(dialogBox.y - 100);
  }
});

// ── 4. カレンダーの日付セルに数字が表示される ────────────────────────────────

test('4. カレンダーの日付セルに日付番号が表示される', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const trigger = dialog.locator('[data-slot="date-picker-trigger"]').first();
  await trigger.click();

  const calendar = page.locator('[role="application"]');
  await expect(calendar).toBeVisible({ timeout: 5_000 });

  // gridcell に "1" が含まれる（1日が表示されている）
  const cell1 = calendar.getByRole('gridcell', { name: '1' }).first();
  await expect(cell1).toBeVisible({ timeout: 5_000 });
});

// ── 5. カレンダーから日付を選択して閉じる ────────────────────────────────────

test('5. カレンダーで日付をクリックするとポップアップが閉じて日付が入る', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const trigger = dialog.locator('[data-slot="date-picker-trigger"]').first();
  await trigger.click();

  const calendar = page.locator('[role="application"]');
  await expect(calendar).toBeVisible({ timeout: 5_000 });

  // 15 日をクリック（どの月でも 15 日は通常表示される）
  await calendar.getByRole('gridcell', { name: /^15$/ }).first().click();

  // カレンダーが閉じる
  await expect(calendar).not.toBeVisible({ timeout: 5_000 });

  // 日付フィールドに値が入っている（スピンボタンが placeholder でない）
  const yearSpinner = dialog.getByRole('spinbutton').first();
  const ariaValueNow = await yearSpinner.getAttribute('aria-valuenow');
  expect(ariaValueNow).not.toBeNull();
});
