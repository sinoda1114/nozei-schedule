// 納付予定一覧（HeroUI Card 行 + Chip + Checkbox + Button）。
import { Button, Card, Checkbox, Chip } from '@heroui/react';
import { type ReactNode } from 'react';
import { daysUntil, isOverdue, sortByDue } from '../lib/calc';
import { formatDate, formatRelativeDays, formatYen } from '../lib/format';
import { CATEGORY_LABELS, type ScheduleItem, type TaxCategory } from '../types';

const CATEGORY_VAR: Record<TaxCategory, string> = {
  residence:   'var(--cat-residence)',
  income:      'var(--cat-income)',
  business:    'var(--cat-business)',
  property:    'var(--cat-property)',
  vehicle:     'var(--cat-vehicle)',
  consumption: 'var(--cat-consumption)',
  withholding: 'var(--cat-withholding)',
  other:       'var(--cat-other)',
};

interface RowHandlers {
  onTogglePaid: (id: string, paid: boolean) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function StatusChip({ item }: { item: ScheduleItem }): ReactNode {
  return item.status === 'confirmed' ? (
    <Chip color="accent" variant="soft" size="sm">
      確定
    </Chip>
  ) : (
    <Chip color="warning" variant="soft" size="sm">
      予測
    </Chip>
  );
}

function Row({ item, today, on }: { item: ScheduleItem; today: string; on: RowHandlers }): ReactNode {
  const days = daysUntil(item.dueDate, today);
  const overdue = isOverdue(item, today);
  const rel = item.paid || Number.isNaN(days) ? '' : formatRelativeDays(days);

  return (
    <Card
      data-id={item.id}
      data-testid="schedule-row"
      className={`sched-row border-l-4 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.25)] ring-1 ring-inset ring-border/60 transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_24px_-8px_rgba(0,0,0,0.5)] hover:ring-border ${item.paid ? 'opacity-55' : ''}`}
      style={{
        borderLeftColor: CATEGORY_VAR[item.category],
        ...(overdue
          ? { background: 'color-mix(in oklch, var(--overdue) 11%, var(--surface))' }
          : {}),
      }}
    >
      <div className="sched-row__check">
        <Checkbox
          isSelected={item.paid}
          onChange={(v) => on.onTogglePaid(item.id, v)}
          aria-label="支払済みにする"
          data-testid="toggle-paid"
        />
      </div>

      <div className="sched-row__main min-w-0">
        <p
          className={`m-0 truncate font-bold ${item.paid ? 'line-through decoration-muted' : ''}`}
          data-testid="row-label"
        >
          {item.label}
        </p>
        <p className="m-0 mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted">
          <span>{CATEGORY_LABELS[item.category]}</span>
          {item.note && <span className="min-w-0 truncate">{item.note}</span>}
        </p>
      </div>

      <div className="sched-row__due whitespace-nowrap text-right text-sm leading-tight">
        <span className="block font-semibold tabular-nums">
          {formatDate(item.dueDate, item.dueApprox)}
        </span>
        {rel && (
          <span className={`text-[0.72rem] ${overdue ? 'font-bold text-[var(--overdue)]' : 'text-muted'}`}>
            {rel}
          </span>
        )}
      </div>

      <div className="sched-row__amount whitespace-nowrap text-right font-bold tabular-nums">
        {formatYen(item.amount, item.amountApprox)}
      </div>

      <div className="sched-row__status">
        <StatusChip item={item} />
      </div>

      <div className="sched-row__actions flex gap-1">
        <Button size="sm" variant="ghost" onPress={() => on.onEdit(item.id)} aria-label="編集">
          編集
        </Button>
        <Button
          size="sm"
          variant="danger-soft"
          onPress={() => on.onDelete(item.id)}
          aria-label="削除"
        >
          削除
        </Button>
      </div>
    </Card>
  );
}

export function ScheduleList({
  items,
  today,
  onLoadSeed,
  ...handlers
}: {
  items: readonly ScheduleItem[];
  today: string;
  onLoadSeed: () => void;
} & RowHandlers): ReactNode {
  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-border p-12 text-center">
        <p className="m-0 text-lg font-bold">まだ予定がありません</p>
        <p className="mb-4 mt-1.5 text-sm text-muted">
          右上の「＋ 追加」で登録するか、サンプル（あなたの納税予定）を読み込めます。
        </p>
        <Button variant="ghost" onPress={onLoadSeed} data-testid="load-seed">
          サンプルを読み込む
        </Button>
      </section>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0" aria-label="納付予定一覧">
      {sortByDue(items).map((item) => (
        <li key={item.id}>
          <Row item={item} today={today} on={handlers} />
        </li>
      ))}
    </ul>
  );
}
