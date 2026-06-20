import { describe, expect, test } from 'vitest';
import { type ScheduleItem } from '../types';
import { timelineRangeLabel } from './Timeline';

function item(id: string, dueDate: string): ScheduleItem {
  return {
    id,
    dueDate,
    dueApprox: false,
    category: 'other',
    label: id,
    amount: 1000,
    amountApprox: false,
    status: 'confirmed',
    paid: false,
    paidDate: null,
    note: '',
  };
}

describe('timelineRangeLabel', () => {
  test('空配列なら空文字', () => {
    expect(timelineRangeLabel([])).toBe('');
  });

  test('同年内は末尾の年を省く', () => {
    const items = [item('a', '2026-06-30'), item('b', '2026-11-30')];
    expect(timelineRangeLabel(items)).toBe('2026年6月〜11月');
  });

  test('年をまたぐ場合は末尾に年を出す', () => {
    const items = [item('a', '2026-06-30'), item('b', '2027-01-31')];
    expect(timelineRangeLabel(items)).toBe('2026年6月〜2027年1月');
  });

  test('順不同でも昇順で範囲を出す', () => {
    const items = [item('b', '2027-01-31'), item('a', '2026-06-30')];
    expect(timelineRangeLabel(items)).toBe('2026年6月〜2027年1月');
  });
});
