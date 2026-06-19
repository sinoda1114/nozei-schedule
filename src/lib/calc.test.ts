import { describe, expect, test } from 'vitest';
import { computeTotals, daysUntil, isOverdue, nextUnpaid, sortByDue } from './calc';
import type { ScheduleItem } from '../types';

function item(overrides: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: Math.random().toString(36).slice(2),
    dueDate: '2026-06-28',
    dueApprox: false,
    category: 'residence',
    label: 'テスト',
    amount: 10000,
    amountApprox: false,
    status: 'confirmed',
    paid: false,
    paidDate: null,
    note: '',
    ...overrides,
  };
}

describe('sortByDue', () => {
  test('納付期限の昇順で並べ替え、元配列は変更しない', () => {
    const a = item({ dueDate: '2026-10-30', label: 'C' });
    const b = item({ dueDate: '2026-06-28', label: 'A' });
    const c = item({ dueDate: '2026-08-28', label: 'B' });
    const input = [a, b, c];
    const sorted = sortByDue(input);
    expect(sorted.map((i) => i.label)).toEqual(['A', 'B', 'C']);
    expect(input.map((i) => i.label)).toEqual(['C', 'A', 'B']); // 非破壊
  });
});

describe('computeTotals', () => {
  test('確定・予測・支払・未払・未登録を集計する', () => {
    const items = [
      item({ amount: 82500, status: 'confirmed', paid: true }),
      item({ amount: 80000, status: 'confirmed', paid: false }),
      item({ amount: 87500, status: 'estimated', paid: false }),
      item({ amount: null, status: 'confirmed', paid: false }),
    ];
    const t = computeTotals(items);
    expect(t.total).toBe(250000);
    expect(t.confirmed).toBe(162500);
    expect(t.estimated).toBe(87500);
    expect(t.paid).toBe(82500);
    expect(t.remaining).toBe(167500);
    expect(t.unsetCount).toBe(1);
    expect(t.count).toBe(4);
  });

  test('空配列はすべて0', () => {
    expect(computeTotals([])).toEqual({
      total: 0,
      confirmed: 0,
      estimated: 0,
      paid: 0,
      remaining: 0,
      unsetCount: 0,
      count: 0,
    });
  });
});

describe('daysUntil', () => {
  test('未来は正、過去は負', () => {
    expect(daysUntil('2026-06-28', '2026-06-19')).toBe(9);
    expect(daysUntil('2026-06-10', '2026-06-19')).toBe(-9);
    expect(daysUntil('2026-06-19', '2026-06-19')).toBe(0);
  });
});

describe('isOverdue', () => {
  test('未払いかつ期限超過は true', () => {
    expect(isOverdue(item({ dueDate: '2026-06-10', paid: false }), '2026-06-19')).toBe(true);
  });
  test('支払済みは false', () => {
    expect(isOverdue(item({ dueDate: '2026-06-10', paid: true }), '2026-06-19')).toBe(false);
  });
  test('期限前は false', () => {
    expect(isOverdue(item({ dueDate: '2026-06-28', paid: false }), '2026-06-19')).toBe(false);
  });
});

describe('nextUnpaid', () => {
  test('未来の最も早い未払いを返す', () => {
    const items = [
      item({ dueDate: '2026-10-30', label: '10月', paid: false }),
      item({ dueDate: '2026-06-28', label: '6月', paid: false }),
      item({ dueDate: '2026-07-27', label: '7月', paid: true }),
    ];
    expect(nextUnpaid(items, '2026-06-19')?.label).toBe('6月');
  });

  test('未来が無ければ最も古い未払い（超過分）を返す', () => {
    const items = [item({ dueDate: '2026-06-10', label: '超過', paid: false })];
    expect(nextUnpaid(items, '2026-06-19')?.label).toBe('超過');
  });

  test('全て支払済みなら null', () => {
    const items = [item({ paid: true })];
    expect(nextUnpaid(items, '2026-06-19')).toBeNull();
  });
});
