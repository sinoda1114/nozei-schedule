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
      className="relative mb-6 overflow-hidden rounded-2xl p-6 text-white shadow-[0_12px_44px_-14px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] ring-1 ring-white/10 sm:p-7"
      style={{ background: gradient }}
      aria-label="次の納付"
    >
      {/* 右上から差すごく淡い光 → グラデーション面に立体感を足す */}
      <div
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-50 blur-2xl"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.18), transparent 70%)' }}
        aria-hidden="true"
      />
      <p className="relative m-0 mb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] opacity-70">
        次の納付{overdue ? '（期限超過）' : ''}
      </p>
      <div className="relative flex items-end justify-between gap-4">
        <div>
          <p className="m-0 text-lg font-bold leading-snug">{next.label}</p>
          <p className="mt-1 text-sm opacity-80">
            {formatDate(next.dueDate, next.dueApprox)}
            {rel && <span className="ml-2 font-bold opacity-100">{rel}</span>}
          </p>
        </div>
        <p className="num m-0 whitespace-nowrap text-[2.1rem] font-black leading-none tracking-tight">
          {formatYen(next.amount, next.amountApprox)}
        </p>
      </div>
    </section>
  );
}
