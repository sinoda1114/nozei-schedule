// @vitest-environment happy-dom
//
// アプリ全体を実際にブート(main.ts)して DOM 操作で挙動を検証する E2E 的テスト。
// fetch / localStorage をモックし、認証ゲート→描画→メニュー開閉→追加フォームを通す。

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSeedDoc } from '../lib/seed';
import type { ScheduleDoc } from '../types';

let getStatus = 200;
let getDoc: ScheduleDoc = createSeedDoc();

const fetchMock = vi.fn(async (_url: string, opts?: { method?: string }) => {
  const method = (opts?.method ?? 'GET').toUpperCase();
  if (method === 'PUT') {
    return {
      status: 200,
      ok: true,
      json: async () => ({ ok: true, updatedAt: new Date().toISOString() }),
    };
  }
  return {
    status: getStatus,
    ok: getStatus >= 200 && getStatus < 300,
    json: async () => getDoc,
  };
});

/** アプリをブートして初回描画完了まで待つ。 */
async function loadApp(opts: { status?: number; doc?: ScheduleDoc } = {}): Promise<void> {
  getStatus = opts.status ?? 200;
  getDoc = opts.doc ?? createSeedDoc();
  document.body.innerHTML = '<div id="app" aria-busy="true"></div>';
  localStorage.setItem('nozei.token', 'tok');
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  await import('../main');
}

beforeEach(() => {
  fetchMock.mockClear();
});

afterEach(() => {
  document.querySelectorAll('.modal-overlay').forEach((n) => n.remove());
  document.body.innerHTML = '';
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('認証ゲート', () => {
  test('401 ならログインゲート（リカバリコード入力）を表示する', async () => {
    await loadApp({ status: 401 });
    await vi.waitFor(() => {
      expect(document.querySelector('.gate input[type="password"]')).not.toBeNull();
    });
    expect(document.querySelector('.topbar')).toBeNull();
  });

  test('200 ならアプリ本体（タイムライン・明細）を描画する', async () => {
    await loadApp({ status: 200, doc: createSeedDoc() });
    await vi.waitFor(() => {
      expect(document.querySelector('.topbar')).not.toBeNull();
    });
    expect(document.querySelectorAll('.row').length).toBe(8);
    expect(document.querySelector('.timeline svg')).not.toBeNull();
  });
});

describe('⋯メニューの開閉（常時表示バグの回帰防止）', () => {
  test('初期状態は hidden=true（隠れている）', async () => {
    await loadApp();
    await vi.waitFor(() => expect(document.querySelector('.menu__panel')).not.toBeNull());
    const panel = document.querySelector('.menu__panel') as HTMLElement;
    expect(panel.hidden).toBe(true);
  });

  test('⋯クリックで開き、もう一度で閉じる', async () => {
    await loadApp();
    await vi.waitFor(() => expect(document.querySelector('.js-menu-btn')).not.toBeNull());
    const btn = document.querySelector('.js-menu-btn') as HTMLElement;
    const panel = document.querySelector('.menu__panel') as HTMLElement;
    btn.click();
    expect(panel.hidden).toBe(false);
    btn.click();
    expect(panel.hidden).toBe(true);
  });

  test('メニュー項目クリックで閉じる', async () => {
    await loadApp();
    await vi.waitFor(() => expect(document.querySelector('.js-reload')).not.toBeNull());
    const btn = document.querySelector('.js-menu-btn') as HTMLElement;
    const panel = document.querySelector('.menu__panel') as HTMLElement;
    btn.click();
    expect(panel.hidden).toBe(false);
    // 「サーバーから再読込」を押すと closeMenu() が同期で走り即座に閉じる
    (document.querySelector('.js-reload') as HTMLElement).click();
    expect(panel.hidden).toBe(true);
  });

  test('メニュー外側クリックで閉じる', async () => {
    await loadApp();
    await vi.waitFor(() => expect(document.querySelector('.js-menu-btn')).not.toBeNull());
    const btn = document.querySelector('.js-menu-btn') as HTMLElement;
    const panel = document.querySelector('.menu__panel') as HTMLElement;
    btn.click();
    expect(panel.hidden).toBe(false);
    document.body.click();
    expect(panel.hidden).toBe(true);
  });
});

describe('追加フォーム（項目入力で追加できる）', () => {
  test('「＋追加」でフォームが開き、入力→送信で明細が増えサーバー保存される', async () => {
    await loadApp({ doc: createSeedDoc() });
    await vi.waitFor(() => expect(document.querySelector('.js-add')).not.toBeNull());

    (document.querySelector('.js-add') as HTMLElement).click();
    await vi.waitFor(() => expect(document.querySelector('.modal-overlay form')).not.toBeNull());

    const form = document.querySelector('.modal-overlay form') as HTMLFormElement;
    (form.elements.namedItem('label') as HTMLInputElement).value = 'テスト納付XYZ';
    (form.elements.namedItem('dueDate') as HTMLInputElement).value = '2027-03-10';
    (form.elements.namedItem('amount') as HTMLInputElement).value = '12345';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      const labels = [...document.querySelectorAll('.row__label')].map((n) => n.textContent);
      expect(labels).toContain('テスト納付XYZ');
    });
    expect(document.querySelectorAll('.row').length).toBe(9);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});
