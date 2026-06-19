// スケジュールの集計・並べ替え・期限判定（純粋関数・テスト対象）。

import type { ScheduleItem } from '../types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' を UTC 日付の数値(epoch ms)に。不正は NaN */
function toEpoch(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 納付期限の昇順でソートした新しい配列を返す（元配列は変更しない） */
export function sortByDue(items: readonly ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    const ea = toEpoch(a.dueDate);
    const eb = toEpoch(b.dueDate);
    if (ea !== eb) return ea - eb;
    return a.label.localeCompare(b.label, 'ja');
  });
}

export interface Totals {
  /** 全件の金額合計（未登録は0扱い） */
  total: number;
  /** 確定分の合計 */
  confirmed: number;
  /** 予測分の合計 */
  estimated: number;
  /** 支払済みの合計 */
  paid: number;
  /** 未払いの合計 */
  remaining: number;
  /** 金額未登録の件数 */
  unsetCount: number;
  /** 全件数 */
  count: number;
}

export function computeTotals(items: readonly ScheduleItem[]): Totals {
  const acc: Totals = {
    total: 0,
    confirmed: 0,
    estimated: 0,
    paid: 0,
    remaining: 0,
    unsetCount: 0,
    count: items.length,
  };
  for (const item of items) {
    const amount = item.amount ?? 0;
    if (item.amount === null) acc.unsetCount += 1;
    acc.total += amount;
    if (item.status === 'confirmed') acc.confirmed += amount;
    else acc.estimated += amount;
    if (item.paid) acc.paid += amount;
    else acc.remaining += amount;
  }
  return acc;
}

/** today('YYYY-MM-DD') 基準の残り日数（負なら経過）。不正値は NaN */
export function daysUntil(dueDate: string, today: string): number {
  const due = toEpoch(dueDate);
  const now = toEpoch(today);
  if (Number.isNaN(due) || Number.isNaN(now)) return NaN;
  return Math.round((due - now) / MS_PER_DAY);
}

/** 未払いかつ期限超過か */
export function isOverdue(item: ScheduleItem, today: string): boolean {
  if (item.paid) return false;
  const days = daysUntil(item.dueDate, today);
  return !Number.isNaN(days) && days < 0;
}

/**
 * 次に納付すべき項目（未払いのうち期限が最も早いもの）。
 * 期限超過のものも含めて最も早い未払いを返す。無ければ null。
 */
export function nextUnpaid(items: readonly ScheduleItem[], today: string): ScheduleItem | null {
  const unpaid = sortByDue(items).filter((i) => !i.paid);
  if (unpaid.length === 0) return null;
  // 期限が未来のものを優先し、無ければ最も古い未払い（超過分）を返す。
  const upcoming = unpaid.find((i) => {
    const d = daysUntil(i.dueDate, today);
    return !Number.isNaN(d) && d >= 0;
  });
  return upcoming ?? unpaid[0];
}
