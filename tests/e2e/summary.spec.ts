import { expect, test } from '@playwright/test';

// Summaryカードの表示退行テスト。
// overflow-hidden 等によるクリップが再発しないことをビューポートを変えて検証する。
const PASSPHRASE = 'test-pass-1234567890';

async function loginAndLoadSeed(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('recovery-input').fill(PASSPHRASE);
  await page.getByTestId('recovery-submit').click();
  await expect(page.getByTestId('topbar')).toBeVisible();
  // データがなければサンプルを読み込んで金額を表示させる
  const rows = page.getByTestId('schedule-row');
  if ((await rows.count()) === 0) {
    await page.getByTestId('load-seed').click();
    await expect(rows.first()).toBeVisible();
  }
}

/** 要素のテキストが親にクリップされていないか（scrollWidth > clientWidth）を検証 */
async function expectNoOverflow(locator: import('@playwright/test').Locator): Promise<void> {
  const overflowing = await locator.evaluate(
    (el) => el.scrollWidth > el.clientWidth + 1,
  );
  expect(overflowing, `"${await locator.textContent()}" がカードからはみ出しています`).toBe(false);
}

test.describe('Summaryカード', () => {
  test('デスクトップ(1280px): 4枚の金額が全てクリップなしで表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();
    expect(await values.count()).toBe(4);

    for (let i = 0; i < 4; i++) {
      await expectNoOverflow(values.nth(i));
    }
  });

  test('モバイル(375px): 4枚の金額が全てクリップなしで表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await expectNoOverflow(values.nth(i));
    }
  });

  test('ナロー(320px): 4枚の金額が全てクリップなしで表示される', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await expectNoOverflow(values.nth(i));
    }
  });

  test('集計セクションに4枚のカードが存在し各ラベルが表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndLoadSeed(page);

    const section = page.getByRole('region', { name: '集計' });
    await expect(section).toBeVisible();
    await expect(section.getByText('年間合計')).toBeVisible();
    await expect(section.getByText('確定分')).toBeVisible();
    await expect(section.getByText('予測分')).toBeVisible();
    await expect(section.getByText('残り（未払い）')).toBeVisible();
  });
});
