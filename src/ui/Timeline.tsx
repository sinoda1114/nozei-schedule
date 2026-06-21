// 年間納付タイムライン（SVG）。棒の高さ=金額、色=税目、点線=予測、中抜き=金額未登録。
// 旧 ui/timeline.ts（HTML文字列）の純粋ロジックを React/JSX に移植したもの。

import { Fragment, type ReactNode } from 'react';
import { nextUnpaid, sortByDue } from '../lib/calc';
import { formatMonthDay, formatYen, parseYmd } from '../lib/format';
import { type ScheduleItem, type TaxCategory } from '../types';

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

function Bar({
  item,
  cx,
  barW,
  maxAmount,
  isNext,
}: {
  item: ScheduleItem;
  cx: number;
  barW: number;
  maxAmount: number;
  isNext: boolean;
}): ReactNode {
  const h = barHeight(item.amount, maxAmount);
  const y = BASE_Y - h;
  const x = cx - barW / 2;
  const hollow = item.amount === null;
  const color = CATEGORY_VAR[item.category];
  const labelY = y - 8;
  const amountLabel = hollow ? '未登録' : formatYen(item.amount, item.amountApprox);

  return (
    <Fragment>
      {isNext && (
        <text x={cx} y={labelY - 13} textAnchor="middle" className="tl-next">
          次の納付
        </text>
      )}
      <text x={cx} y={labelY} textAnchor="middle" className="tl-amount">
        {amountLabel}
      </text>
      {hollow ? (
        <rect
          x={x}
          y={y}
          width={barW}
          height={h}
          rx={3}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      ) : (
        <rect
          x={x}
          y={y}
          width={barW}
          height={h}
          rx={3}
          fill={color}
          opacity={item.paid ? 0.32 : 1}
          {...(item.status === 'estimated'
            ? { stroke: 'var(--estimated)', strokeWidth: 2, strokeDasharray: '4 3' }
            : {})}
        />
      )}
      {item.paid && (
        <text x={cx} y={y + h / 2 + 4} textAnchor="middle" className="tl-paid">
          ✓
        </text>
      )}
      <text x={cx} y={BASE_Y + 18} textAnchor="middle" className="tl-date">
        {formatMonthDay(item.dueDate, item.dueApprox)}
      </text>
    </Fragment>
  );
}

/** 期間ラベル「YYYY年M月〜(YYYY年)M月」。年は跨ぐ時だけ末尾に出す。 */
export function timelineRangeLabel(items: readonly ScheduleItem[]): string {
  const sorted = sortByDue(items);
  if (sorted.length === 0) return '';
  const first = parseYmd(sorted[0].dueDate);
  const last = parseYmd(sorted[sorted.length - 1].dueDate);
  if (!first || !last) return '';
  const start = `${first.y}年${first.m}月`;
  const end = first.y === last.y ? `${last.m}月` : `${last.y}年${last.m}月`;
  return `${start}〜${end}`;
}

/** タイムラインの凡例 */
export function TimelineLegend(): ReactNode {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-3 px-1 pt-2 text-xs text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[3px]" style={{ background: 'var(--cat-residence)' }} />
        市県民税
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[3px]" style={{ background: 'var(--cat-income)' }} />
        所得税
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3 rounded-[3px]" style={{ background: 'var(--cat-business)' }} />
        事業税
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-4"
          style={{ borderTop: '2px dashed var(--estimated)' }}
        />
        予測
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="size-3 rounded-[3px]"
          style={{ border: '1.5px dashed var(--ink-faint)' }}
        />
        金額未登録
      </span>
    </div>
  );
}

/** 年間タイムライン全体。データが無ければ null。 */
export function Timeline({
  items,
  today,
}: {
  items: readonly ScheduleItem[];
  today: string;
}): ReactNode {
  if (items.length === 0) return null;
  const sorted = sortByDue(items);
  const next = nextUnpaid(items, today);
  const amounts = sorted.map((i) => i.amount ?? 0);
  const maxAmount = Math.max(1, ...amounts);

  const count = sorted.length;
  const width = Math.max(520, count * 72);
  const padX = 12;
  const slot = (width - padX * 2) / count;
  const barW = Math.min(34, slot * 0.46);

  return (
    <section aria-label="年間納付タイムライン">
      <div className="overflow-x-auto overflow-y-hidden">
        <svg
          viewBox={`0 0 ${width} ${VIEW_H}`}
          style={{ minWidth: `${Math.round(width)}px`, width: '100%', display: 'block' }}
          role="img"
          aria-label="年間の納付予定。棒の高さが金額、色が税目を表す。"
        >
          <line x1={padX} y1={BASE_Y} x2={width - padX} y2={BASE_Y} className="tl-axis" />
          {sorted.map((item, i) => (
            <Bar
              key={item.id}
              item={item}
              cx={padX + slot * (i + 0.5)}
              barW={barW}
              maxAmount={maxAmount}
              isNext={item.id === next?.id}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}
