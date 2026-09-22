// DatePicker コンポーネントの E2E テスト（TDD — RED から始める）
// テスト対象: src/ui/ItemFormModal.tsx の納付期限・支払日 DatePicker

import { expect, test } from '@playwright/test';

import { E2E_PASSPHRASE } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('recovery-input').fill(E2E_PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();
});

// ── 1. DateField がセグメント表示される ─────────────────────────────────────

test('1. 追加モーダルの納付期限にスピンボタンが表示される', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog', { name: '予定を追加' });
  await expect(dialog).toBeVisible();

  // DateField のセグメント（role=spinbutton）が最低1つ存在する
  const spinners = dialog.getByRole('spinbutton');
  await expect(spinners.first()).toBeVisible();
});

// ── 2. キーボードで日付を入力できる ─────────────────────────────────────────

test('2. キーボード入力で日付をセットして追加できる', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog', { name: '予定を追加' });
  await expect(dialog).toBeVisible();

  // 表示名
  const label = `E2E-DatePicker-KB-${Date.now()}`;
  await dialog.locator('input[name="label"]').fill(label);

  // 年セグメントをクリックしてキーボード入力
  await dialog.getByRole('spinbutton').first().click();

  // React Aria DateSegment: セグメントが埋まると次のセグメントへ自動で送られる。
  // Tab を挟むと送り先を1つ飛ばして月が未入力のままになるため、続けて打つ。
  // playwright.config.ts で locale='ja-JP' を設定済み → YYYY/MM/DD 順
  await page.keyboard.type('20270310');

  // 追加
  await dialog.getByRole('button', { name: '追加' }).click();

  // 一覧にラベルが表れ、打鍵した日付がそのまま入っている
  const row = page.getByTestId('schedule-row').filter({ hasText: label });
  await expect(row).toContainText('2027/3/10');
});

// ── 3. カレンダーポップアップが正しく開く ────────────────────────────────────

test('3. カレンダーアイコンをクリックするとカレンダーが dialog 付近に表示される', async ({
  page,
}) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog', { name: '予定を追加' });
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
  const dialog = page.getByRole('dialog', { name: '予定を追加' });
  await expect(dialog).toBeVisible();

  const trigger = dialog.locator('[data-slot="date-picker-trigger"]').first();
  await trigger.click();

  const calendar = page.locator('[role="application"]');
  await expect(calendar).toBeVisible({ timeout: 5_000 });

  // セルが空描画でなく日付番号を出していること。
  // getByRole の name は部分一致かつアクセシブル名が日付全文のため、'1' では前月末セルに当たる。
  // 表示テキストが当月内で一意になる 15 で確かめる（'1' は当月と翌月頭の2セルに当たる）。
  const cell = calendar.getByRole('gridcell').filter({ hasText: /^15$/ });
  await expect(cell).toHaveText('15', { timeout: 5_000 });
});

// ── 5. カレンダーから日付を選択して閉じる ────────────────────────────────────

test('5. カレンダーで日付をクリックするとポップアップが閉じて日付が入る', async ({ page }) => {
  await page.getByTestId('add-btn').click();
  const dialog = page.getByRole('dialog', { name: '予定を追加' });
  await expect(dialog).toBeVisible();

  const trigger = dialog.locator('[data-slot="date-picker-trigger"]').first();
  await trigger.click();

  const calendar = page.locator('[role="application"]');
  await expect(calendar).toBeVisible({ timeout: 5_000 });

  // 15 日をクリック（どの月でも 15 日は通常表示される）。
  // gridcell のアクセシブル名は子ボタンの aria-label 由来で「2026年9月15日火曜日」形式。
  // 日付番号では一致しないため、表示テキストで絞る。
  await calendar.getByRole('gridcell').filter({ hasText: /^15$/ }).click();

  // カレンダーが閉じる
  await expect(calendar).not.toBeVisible({ timeout: 5_000 });

  // クリックした 15 日が日セグメントに入っている
  const daySegment = dialog.getByRole('spinbutton', { name: /^日,/ });
  await expect(daySegment).toHaveAttribute('aria-valuenow', '15');
});
