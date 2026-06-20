// 「次の納付」ハイライト（独自グラデーションのヒーローカード）。
import { type ReactNode } from 'react';
import { daysUntil, isOverdue, nextUnpaid } from '../lib/calc';
import { formatDate, formatRelativeDays, formatYen } from '../lib/format';
import { type ScheduleItem } from '../types';

export function NextPayment({
  items,
  today,
}: {
  items: readonly ScheduleItem[];
  today: string;
}): ReactNode {
  const next = nextUnpaid(items, today);

  if (!next) {
    return (
      <section
        className="mb-4 rounded-2xl border border-border bg-surface p-5 text-center text-muted shadow-sm"
        aria-label="次の納付"
      >
        <p className="m-0">未払いの予定はありません 🎉</p>
      </section>
    );
  }

  const days = daysUntil(next.dueDate, today);
  const overdue = isOverdue(next, today);
  const rel = Number.isNaN(days) ? '' : formatRelativeDays(days);
  const gradient = overdue
    ? 'linear-gradient(135deg, var(--next-overdue-from) 0%, var(--next-overdue-to) 100%)'
    : 'linear-gradient(135deg, var(--next-from) 0%, var(--next-to) 100%)';

  return (
    <section
      className="mb-4 rounded-2xl p-5 text-white shadow-md"
      style={{ background: gradient }}
      aria-label="次の納付"
    >
      <p className="m-0 mb-1.5 text-xs uppercase tracking-[0.08em] opacity-85">
        次の納付{overdue ? '（期限超過）' : ''}
      </p>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="m-0 text-lg font-bold">{next.label}</p>
          <p className="mt-0.5 text-sm opacity-90">
            {formatDate(next.dueDate, next.dueApprox)}
            {rel && <span className="ml-1.5 font-bold">{rel}</span>}
          </p>
        </div>
        <p className="m-0 whitespace-nowrap text-2xl font-extrabold tabular-nums">
          {formatYen(next.amount, next.amountApprox)}
        </p>
      </div>
    </section>
  );
}
