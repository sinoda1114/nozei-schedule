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
    <Card className={`p-3.5 ${accent ? 'bg-accent-soft' : ''}`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-extrabold tabular-nums tracking-tight ${valueClass ?? ''}`}>
        {value}
      </p>
      {note}
    </Card>
  );
}

export function Summary({ items }: { items: readonly ScheduleItem[] }): ReactNode {
  const t = computeTotals(items);
  return (
    <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="集計">
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
        label="残り（未払い）"
        value={yen(t.remaining)}
        note={<span className="mt-1 block text-[0.72rem] text-muted">支払済 {yen(t.paid)}</span>}
      />
    </section>
  );
}
