// アプリのブートストラップ・状態管理・イベント配線。

import './style.css';
import { createSeedDoc } from './lib/seed';
import { AuthError, ApiError, ConflictError, RemoteRepository, normalizeDoc } from './lib/repository';
import { DOC_VERSION, type ScheduleDoc, type ScheduleItem } from './types';
import { openItemForm } from './ui/form';
import { renderList, renderNext, renderSummary } from './ui/views';
import { renderTimeline, timelineLegend } from './ui/timeline';

const TOKEN_KEY = 'nozei.token';
const app = document.getElementById('app') as HTMLElement;

const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
const setToken = (t: string): void => localStorage.setItem(TOKEN_KEY, t);
const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

const repo = new RemoteRepository(getToken);

let globalListenersReady = false;

/** 再描画で作り直されないグローバルリスナーを1回だけ登録する。 */
function registerGlobalListeners(): void {
  if (globalListenersReady) return;
  globalListenersReady = true;
  // メニューの外側クリックで閉じる（現在の DOM を都度参照する）
  document.addEventListener('click', (e) => {
    if ((e.target as Element).closest('.menu')) return;
    const panel = app.querySelector('.menu__panel') as HTMLElement | null;
    const btn = app.querySelector('.js-menu-btn') as HTMLElement | null;
    if (panel) panel.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

// ---- アプリ状態（単一の真実） ----
let doc: ScheduleDoc = { version: DOC_VERSION, updatedAt: new Date(0).toISOString(), items: [] };

// 最後にサーバーが確定した updatedAt。楽観ロックの「期待値」として保存時に送る。
// ローカル編集で doc.updatedAt は先走って書き換わるため、これは別管理する。
let baseUpdatedAt = new Date(0).toISOString();

const today = (): string => {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
};

// ---- ブートストラップ ----
async function boot(): Promise<void> {
  registerGlobalListeners();
  app.setAttribute('aria-busy', 'true');
  app.innerHTML = `<div class="loading">読み込み中…</div>`;
  try {
    doc = await repo.load();
    baseUpdatedAt = doc.updatedAt; // サーバー確定値を楽観ロックの基準に取り込む
    renderApp();
  } catch (err) {
    if (err instanceof AuthError) renderGate();
    else renderFatal(err instanceof Error ? err.message : '不明なエラー');
  } finally {
    app.setAttribute('aria-busy', 'false');
  }
}

// ---- パスフレーズ入力ゲート ----
function renderGate(message = ''): void {
  app.innerHTML = `
    <main class="gate">
      <div class="gate__card">
        <h1 class="gate__title">納税スケジュール</h1>
        <p class="gate__lead">アクセス用パスフレーズを入力してください。</p>
        <form class="gate__form js-gate-form">
          <input type="password" class="field__input" name="pass" autocomplete="current-password"
            placeholder="パスフレーズ" required />
          <button type="submit" class="btn btn--primary">接続</button>
        </form>
        ${message ? `<p class="form__error">${escapeText(message)}</p>` : ''}
      </div>
    </main>
  `;
  const form = app.querySelector('.js-gate-form') as HTMLFormElement;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = String(new FormData(form).get('pass') ?? '').trim();
    if (!pass) return;
    setToken(pass);
    void boot();
  });
}

function renderFatal(message: string): void {
  app.innerHTML = `
    <main class="gate">
      <div class="gate__card">
        <h1 class="gate__title">接続エラー</h1>
        <p class="form__error">${escapeText(message)}</p>
        <button type="button" class="btn btn--primary js-retry">再試行</button>
      </div>
    </main>
  `;
  (app.querySelector('.js-retry') as HTMLElement).addEventListener('click', () => void boot());
}

// ---- メイン画面 ----
function renderApp(): void {
  const t = today();
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar__brand">
        <h1 class="topbar__title">納税スケジュール</h1>
        <p class="topbar__sub">個人事業 / 納付予定の管理</p>
      </div>
      <div class="topbar__actions">
        <span class="save-status js-save-status" aria-live="polite"></span>
        <button type="button" class="btn btn--primary js-add">＋ 追加</button>
        <div class="menu">
          <button type="button" class="btn btn--ghost js-menu-btn" aria-haspopup="true" aria-expanded="false">⋯</button>
          <div class="menu__panel" hidden>
            <p class="menu__section">データのバックアップ</p>
            <button type="button" class="menu__item js-export">バックアップを保存（JSON）</button>
            <button type="button" class="menu__item js-import">バックアップから復元（JSON）</button>
            <button type="button" class="menu__item js-reload">サーバーから再読込</button>
            <p class="menu__section">アカウント</p>
            <button type="button" class="menu__item menu__item--danger js-logout">パスフレーズを変更</button>
          </div>
        </div>
      </div>
    </header>
    <main class="content">
      ${renderNext(doc.items, t)}
      ${renderSummary(doc.items)}
      ${doc.items.length > 0 ? `<section class="panel"><h2 class="panel__title">年間スケジュール</h2>${renderTimeline(doc.items, t)}<div class="timeline__legend">${timelineLegend()}</div></section>` : ''}
      ${renderList(doc.items, t)}
    </main>
    <footer class="footer">
      <span>最終更新: ${escapeText(formatUpdatedAt(doc.updatedAt))}</span>
    </footer>
    <input type="file" accept="application/json" class="js-import-file" hidden />
  `;
  wireAppEvents();
}

function rerender(): void {
  // 完全再描画（データ量が小さいので十分）。
  renderApp();
}

// ---- イベント配線 ----
function wireAppEvents(): void {
  (app.querySelector('.js-add') as HTMLElement).addEventListener('click', onAdd);

  const menuBtn = app.querySelector('.js-menu-btn') as HTMLElement;
  const menuPanel = app.querySelector('.menu__panel') as HTMLElement;
  const closeMenu = (): void => {
    menuPanel.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  };
  menuBtn.addEventListener('click', () => {
    const open = menuPanel.hidden;
    menuPanel.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  // 外側クリックで閉じる処理は boot 時に1回だけ登録する（再描画ごとの多重登録を防ぐ）

  // メニュー項目を押したら必ず閉じてからアクションを実行する
  (app.querySelector('.js-export') as HTMLElement).addEventListener('click', () => {
    closeMenu();
    onExport();
  });
  (app.querySelector('.js-import') as HTMLElement).addEventListener('click', () => {
    closeMenu();
    (app.querySelector('.js-import-file') as HTMLInputElement).click();
  });
  (app.querySelector('.js-import-file') as HTMLInputElement).addEventListener('change', onImportFile);
  (app.querySelector('.js-reload') as HTMLElement).addEventListener('click', () => {
    closeMenu();
    void boot();
  });
  (app.querySelector('.js-logout') as HTMLElement).addEventListener('click', () => {
    closeMenu();
    clearToken();
    renderGate('新しいパスフレーズを入力してください。');
  });

  const seedBtn = app.querySelector('.js-load-seed');
  if (seedBtn) seedBtn.addEventListener('click', onLoadSeed);

  // 明細行のイベント（委譲）
  app.querySelectorAll<HTMLElement>('.row').forEach((row) => {
    const id = row.dataset.id ?? '';
    (row.querySelector('.js-toggle-paid') as HTMLInputElement)?.addEventListener('change', (e) =>
      onTogglePaid(id, (e.target as HTMLInputElement).checked),
    );
    (row.querySelector('.js-edit') as HTMLElement)?.addEventListener('click', () => onEdit(id));
    (row.querySelector('.js-delete') as HTMLElement)?.addEventListener('click', () => onDelete(id));
  });
}

// ---- ミューテーション（すべて保存まで行う） ----
async function commit(next: ScheduleItem[]): Promise<void> {
  doc = { version: DOC_VERSION, updatedAt: new Date().toISOString(), items: next };
  rerender();
  await persist();
}

async function persist(): Promise<void> {
  setSaveStatus('保存中…');
  try {
    const confirmedUpdatedAt = await repo.save(doc, baseUpdatedAt);
    // サーバー確定値で基準と表示を揃える（次回保存の期待値になる）。
    baseUpdatedAt = confirmedUpdatedAt;
    doc = { ...doc, updatedAt: confirmedUpdatedAt };
    setSaveStatus('保存しました');
    window.setTimeout(() => setSaveStatus(''), 1800);
  } catch (err) {
    if (err instanceof AuthError) {
      renderGate('認証が切れました。パスフレーズを再入力してください。');
      return;
    }
    if (err instanceof ConflictError) {
      // 他端末が先に更新済み。この変更は保存されていない。
      // 自動マージはせず、最新を読み込み直して再編集を促す（最小フロー）。
      setSaveStatus('⚠ 他の端末で更新されました');
      window.alert(
        '他の端末でデータが更新されていたため、この変更は保存できませんでした。\n' +
          '最新の状態を読み込み直します。お手数ですが、もう一度編集してください。',
      );
      await boot();
      return;
    }
    const msg = err instanceof ApiError ? err.message : '保存に失敗しました';
    setSaveStatus(`⚠ ${msg}`);
  }
}

function setSaveStatus(text: string): void {
  const el = app.querySelector('.js-save-status');
  if (el) el.textContent = text;
}

async function onAdd(): Promise<void> {
  const item = await openItemForm();
  if (item) await commit([...doc.items, item]);
}

async function onEdit(id: string): Promise<void> {
  const target = doc.items.find((i) => i.id === id);
  if (!target) return;
  const updated = await openItemForm(target);
  if (updated) await commit(doc.items.map((i) => (i.id === id ? updated : i)));
}

async function onDelete(id: string): Promise<void> {
  const target = doc.items.find((i) => i.id === id);
  if (!target) return;
  if (!window.confirm(`「${target.label}」を削除しますか？`)) {
    rerender(); // チェック状態などを元に戻す
    return;
  }
  await commit(doc.items.filter((i) => i.id !== id));
}

async function onTogglePaid(id: string, paid: boolean): Promise<void> {
  const next = doc.items.map((i) =>
    i.id === id ? { ...i, paid, paidDate: paid ? (i.paidDate ?? today()) : null } : i,
  );
  await commit(next);
}

async function onLoadSeed(): Promise<void> {
  const seed = createSeedDoc();
  await commit(seed.items);
}

// ---- エクスポート / インポート ----
function onExport(): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nozei-schedule-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function onImportFile(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text) as { items?: unknown };
    if (!Array.isArray(parsed.items)) throw new Error('items 配列がありません');
    if (!window.confirm('現在のデータを読み込んだ内容で置き換えます。よろしいですか？')) return;
    // 外部JSONは信用せず正規化してから取り込む
    doc = normalizeDoc(parsed);
    rerender();
    await persist();
  } catch (err) {
    setSaveStatus(`⚠ 読み込み失敗: ${err instanceof Error ? err.message : ''}`);
  }
}

// ---- ユーティリティ ----
function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—';
  return d.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}

function escapeText(value: string): string {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

void boot();
