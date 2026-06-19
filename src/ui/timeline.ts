// 年間納付タイムライン（SVG）。棒の高さ=金額、色=税目、点線=予測、中抜き=金額未登録。
// 純粋関数。状態は受け取るだけ。色はアプリの CSS 変数を参照しダーク/ライト両対応。

import { isOverdue, nextUnpaid, sortByDue } from '../lib/calc';
import { formatDate, formatYen } from '../lib/format';
import { type ScheduleItem, type TaxCategory } from '../types';
import { escapeHtml } from './views';

const CATEGORY_VAR: Record<TaxCategory, string> = {
  residence: 'var(--cat-residence)',
  income: 'var(--cat-income)',
  business: 'var(--cat-business)',
  other: 'var(--cat-other)',
};

const BASE_Y = 150;
const TOP_Y = 30;
const MAX_BAR_H = BASE_Y - TOP_Y;
const VIEW_H = 196;

/** 棒の高さを金額から算出（null は中抜きの小さな棒） */
function barHeight(amount: number | null, maxAmount: number): number {
  if (amount === null) return 20;
  return Math.max(8, Math.round((amount / maxAmount) * MAX_BAR_H));
}

function bar(
  item: ScheduleItem,
  cx: number,
  barW: number,
  maxAmount: number,
  isNext: boolean,
  today: string,
): string {
  const h = barHeight(item.amount, maxAmount);
  const y = BASE_Y - h;
  const x = cx - barW / 2;
  const overdue = isOverdue(item, today);
  const hollow = item.amount === null;
  const color = overdue ? 'var(--overdue)' : CATEGORY_VAR[item.category];

  const estimatedAttrs =
    item.status === 'estimated' ? ' stroke="var(--estimated)" stroke-width="2" stroke-dasharray="4 3"' : '';
  const rect = hollow
    ? `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3"/>`
    : `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${color}"${estimatedAttrs} opacity="${item.paid ? '0.32' : '1'}"/>`;

  const amountLabel = hollow ? '未登録' : formatYen(item.amount, item.amountApprox);
  const labelY = y - 8;
  const paidMark = item.paid
    ? `<text x="${cx}" y="${y + h / 2 + 4}" text-anchor="middle" class="tl-paid">✓</text>`
    : '';
  const nextMark = isNext
    ? `<text x="${cx}" y="${labelY - 13}" text-anchor="middle" class="tl-next">次の納付</text>`
    : '';

  return `
    ${nextMark}
    <text x="${cx}" y="${labelY}" text-anchor="middle" class="tl-amount">${escapeHtml(amountLabel)}</text>
    ${rect}
    ${paidMark}
    <text x="${cx}" y="${BASE_Y + 18}" text-anchor="middle" class="tl-date">${escapeHtml(formatDate(item.dueDate, item.dueApprox))}</text>
  `;
}

/** タイムラインの凡例 */
export function timelineLegend(): string {
  return `
    <span class="legend__item"><span class="legend__dot" style="background:var(--cat-residence)"></span>市県民税</span>
    <span class="legend__item"><span class="legend__dot" style="background:var(--cat-income)"></span>所得税</span>
    <span class="legend__item"><span class="legend__dot" style="background:var(--cat-business)"></span>事業税</span>
    <span class="legend__item"><span class="legend__line"></span>予測</span>
    <span class="legend__item"><span class="legend__hollow"></span>金額未登録</span>
  `;
}

/** 年間タイムライン全体。データが無ければ空文字。 */
export function renderTimeline(items: readonly ScheduleItem[], today: string): string {
  if (items.length === 0) return '';
  const sorted = sortByDue(items);
  const next = nextUnpaid(items, today);
  const amounts = sorted.map((i) => i.amount ?? 0);
  const maxAmount = Math.max(1, ...amounts);

  const count = sorted.length;
  const width = Math.max(520, count * 72);
  const padX = 12;
  const slot = (width - padX * 2) / count;
  const barW = Math.min(34, slot * 0.46);

  const bars = sorted
    .map((item, i) => bar(item, padX + slot * (i + 0.5), barW, maxAmount, item.id === next?.id, today))
    .join('');

  return `
    <section class="timeline" aria-label="年間納付タイムライン">
      <div class="timeline__scroll">
        <svg viewBox="0 0 ${width} ${VIEW_H}" style="min-width:${Math.round(width)}px; width:100%"
          role="img" aria-label="年間の納付予定。棒の高さが金額、色が税目を表す。">
          <line x1="${padX}" y1="${BASE_Y}" x2="${width - padX}" y2="${BASE_Y}" class="tl-axis"/>
          ${bars}
        </svg>
      </div>
    </section>
  `;
}
