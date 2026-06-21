import { expect, test } from '@playwright/test';

// Summaryカードの表示退行テスト。
// 数値が折り返し・クリップなく1行で表示されることをビューポートを変えて検証する。
// - 折り返し検出: leading-none 前提で offsetHeight > fontSize * 1.5 なら折り返しあり
// - クリップ検出: Range API で実テキスト幅 > 要素幅
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

/**
 * 金額テキストが1行に収まっているかを検証する。
 * leading-none なので行折り返しは offsetHeight > fontSize*1.5 で検出。
 * テキスト幅は Range で計測して要素幅と比較しクリップも検出する。
 */
async function expectSingleLineNoClip(locator: import('@playwright/test').Locator): Promise<void> {
  const text = (await locator.textContent()) ?? '';
  const { wrapped, clipped } = await locator.evaluate((el: HTMLElement) => {
    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    const isWrapped = el.offsetHeight > fontSize * 1.5;

    const range = document.createRange();
    range.selectNodeContents(el);
    const textWidth = range.getBoundingClientRect().width;
    const isClipped = textWidth > el.clientWidth + 1;

    return { wrapped: isWrapped, clipped: isClipped };
  });

  expect(wrapped, `"${text}" が折り返しています（2行以上になっています）`).toBe(false);
  expect(clipped, `"${text}" がカード幅を超えています`).toBe(false);
}

test.describe('Summaryカード', () => {
  test('640px(sm境界): 4枚の金額が1行・クリップなしで表示される', async ({ page }) => {
    // sm:grid-cols-4 に切り替わる最小幅。ここが最もカードが狭くなる危険ゾーン。
    await page.setViewportSize({ width: 640, height: 800 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();
    expect(await values.count()).toBe(4);

    for (let i = 0; i < 4; i++) {
      await expectSingleLineNoClip(values.nth(i));
    }
  });

  test('デスクトップ(1280px): 4枚の金額が1行・クリップなしで表示される', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();
    expect(await values.count()).toBe(4);

    for (let i = 0; i < 4; i++) {
      await expectSingleLineNoClip(values.nth(i));
    }
  });

  test('モバイル(375px): 4枚の金額が1行・クリップなしで表示される', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await expectSingleLineNoClip(values.nth(i));
    }
  });

  test('ナロー(320px): 4枚の金額が1行・クリップなしで表示される', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await loginAndLoadSeed(page);

    const values = page.getByTestId('summary-value');
    await expect(values.first()).toBeVisible();

    for (let i = 0; i < 4; i++) {
      await expectSingleLineNoClip(values.nth(i));
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
