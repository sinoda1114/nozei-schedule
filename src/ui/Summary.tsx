// 集計サマリーカード群（HeroUI Card）。
import { Card } from '@heroui/react';
import { type ReactNode } from 'react';
import { computeTotals } from '../lib/calc';
import { type ScheduleItem } from '../types';

function yen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function StatCard({
  label,
  value,
  note,
  valueClass,
  accent,
}: {
  label: string;
  value: string;
  note?: ReactNode;
  valueClass?: string;
  accent?: boolean;
}): ReactNode {
  return (
    <Card
      className={`relative p-3 shadow-none ${
        accent
          ? 'bg-accent-soft ring-1 ring-inset ring-[var(--accent)]/25 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--accent)]/60 before:to-transparent'
          : 'bg-surface ring-1 ring-inset ring-border'
      }`}
    >
      <p className="m-0 text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p
        data-testid="summary-value"
        className={`num m-0 mt-2 text-[clamp(0.75rem,2.3vw,1.4rem)] font-black leading-none tracking-tight whitespace-nowrap ${valueClass ?? ''}`}
      >
        {value}
      </p>
      {note}
    </Card>
  );
}

export function Summary({ items }: { items: readonly ScheduleItem[] }): ReactNode {
  const t = computeTotals(items);
  return (
    <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" aria-label="集計">
      <StatCard
        label="年間合計"
        value={yen(t.total)}
        accent
        note={
          t.unsetCount > 0 ? (
            <span className="mt-1 block text-[0.72rem] text-muted">未登録 {t.unsetCount} 件</span>
          ) : undefined
        }
      />
      <StatCard label="確定分" value={yen(t.confirmed)} />
      <StatCard
        label="予測分"
        value={yen(t.estimated)}
        valueClass="text-[var(--estimated)]"
      />
      <StatCard
        label="支払済み"
        value={yen(t.paid)}
        valueClass="text-[var(--paid)]"
        note={<span className="mt-1 block text-[0.72rem] text-muted">残り {yen(t.remaining)}</span>}
      />
    </section>
  );
}
