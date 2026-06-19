// HTML文字列ビルダー群（純粋関数。状態は受け取るだけ）。
// ユーザー入力は escapeHtml で必ずエスケープし XSS を防ぐ。

import { computeTotals, daysUntil, isOverdue, nextUnpaid, sortByDue } from '../lib/calc';
import { formatDate, formatRelativeDays, formatYen } from '../lib/format';
import { CATEGORY_LABELS, type ScheduleItem } from '../types';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/** サマリーカード群 */
export function renderSummary(items: readonly ScheduleItem[]): string {
  const t = computeTotals(items);
  const unsetNote =
    t.unsetCount > 0 ? `<span class="card__note">未登録 ${t.unsetCount} 件</span>` : '';
  return `
    <section class="summary" aria-label="集計">
      <div class="card card--total">
        <p class="card__label">年間合計</p>
        <p class="card__value">${yen(t.total)}</p>
        ${unsetNote}
      </div>
      <div class="card">
        <p class="card__label">確定分</p>
        <p class="card__value">${yen(t.confirmed)}</p>
      </div>
      <div class="card">
        <p class="card__label">予測分</p>
        <p class="card__value card__value--est">${yen(t.estimated)}</p>
      </div>
      <div class="card card--remaining">
        <p class="card__label">残り（未払い）</p>
        <p class="card__value">${yen(t.remaining)}</p>
        <span class="card__note">支払済 ${yen(t.paid)}</span>
      </div>
    </section>
  `;
}

/** 「次の納付」ハイライト */
export function renderNext(items: readonly ScheduleItem[], today: string): string {
  const next = nextUnpaid(items, today);
  if (!next) {
    return `<section class="next next--done"><p>未払いの予定はありません 🎉</p></section>`;
  }
  const days = daysUntil(next.dueDate, today);
  const overdue = isOverdue(next, today);
  const rel = Number.isNaN(days) ? '' : formatRelativeDays(days);
  return `
    <section class="next ${overdue ? 'next--overdue' : ''}" aria-label="次の納付">
      <p class="next__eyebrow">次の納付${overdue ? '（期限超過）' : ''}</p>
      <div class="next__row">
        <div>
          <p class="next__title">${escapeHtml(next.label)}</p>
          <p class="next__date">${escapeHtml(formatDate(next.dueDate, next.dueApprox))} <span class="next__rel">${rel}</span></p>
        </div>
        <p class="next__amount">${escapeHtml(formatYen(next.amount, next.amountApprox))}</p>
      </div>
    </section>
  `;
}

function statusChip(item: ScheduleItem): string {
  return item.status === 'confirmed'
    ? '<span class="chip chip--confirmed">確定</span>'
    : '<span class="chip chip--estimated">予測</span>';
}

const CATEGORY_CLASSES: ReadonlySet<string> = new Set([
  'residence',
  'income',
  'business',
  'other',
]);

function rowClasses(item: ScheduleItem, today: string): string {
  // category は型・normalize で4値に限定されるが、CSSクラスへ展開するため念のためホワイトリスト確認
  const safeCat = CATEGORY_CLASSES.has(item.category) ? item.category : 'other';
  const classes = ['row', `row--${safeCat}`];
  if (item.paid) classes.push('row--paid');
  if (isOverdue(item, today)) classes.push('row--overdue');
  return classes.join(' ');
}

/** 明細1行 */
function renderRow(item: ScheduleItem, today: string): string {
  const days = daysUntil(item.dueDate, today);
  const rel = item.paid || Number.isNaN(days) ? '' : formatRelativeDays(days);
  return `
    <li class="${rowClasses(item, today)}" data-id="${escapeHtml(item.id)}">
      <label class="row__check">
        <input type="checkbox" class="js-toggle-paid" ${item.paid ? 'checked' : ''}
          aria-label="支払済みにする" />
      </label>
      <div class="row__main">
        <p class="row__label">${escapeHtml(item.label)}</p>
        <p class="row__meta">
          <span class="row__cat">${escapeHtml(CATEGORY_LABELS[item.category])}</span>
          ${item.note ? `<span class="row__note">${escapeHtml(item.note)}</span>` : ''}
        </p>
      </div>
      <div class="row__due">
        <span class="row__date">${escapeHtml(formatDate(item.dueDate, item.dueApprox))}</span>
        ${rel ? `<span class="row__rel">${rel}</span>` : ''}
      </div>
      <div class="row__amount">${escapeHtml(formatYen(item.amount, item.amountApprox))}</div>
      <div class="row__status">${statusChip(item)}</div>
      <div class="row__actions">
        <button type="button" class="icon-btn js-edit" aria-label="編集">編集</button>
        <button type="button" class="icon-btn icon-btn--danger js-delete" aria-label="削除">削除</button>
      </div>
    </li>
  `;
}

/** 明細リスト全体 */
export function renderList(items: readonly ScheduleItem[], today: string): string {
  if (items.length === 0) {
    return `
      <section class="empty">
        <p class="empty__title">まだ予定がありません</p>
        <p class="empty__hint">右上の「＋ 追加」で登録するか、サンプル（あなたの納税予定）を読み込めます。</p>
        <button type="button" class="btn btn--ghost js-load-seed">サンプルを読み込む</button>
      </section>
    `;
  }
  const rows = sortByDue(items)
    .map((i) => renderRow(i, today))
    .join('');
  return `<ul class="list" aria-label="納付予定一覧">${rows}</ul>`;
}
