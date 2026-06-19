import { describe, expect, test } from 'vitest';
import { formatDate, formatRelativeDays, formatYen, parseYmd } from './format';

describe('formatYen', () => {
  test('金額を3桁区切りの円表記にする', () => {
    expect(formatYen(82500)).toBe('¥82,500');
  });

  test('null は未登録', () => {
    expect(formatYen(null)).toBe('未登録');
  });

  test('approx=true は「約」を前置', () => {
    expect(formatYen(87500, true)).toBe('約¥87,500');
  });

  test('0円も表示できる', () => {
    expect(formatYen(0)).toBe('¥0');
  });
});

describe('parseYmd', () => {
  test('正しい日付を分解する', () => {
    expect(parseYmd('2026-06-28')).toEqual({ y: 2026, m: 6, d: 28 });
  });

  test('不正な形式は null', () => {
    expect(parseYmd('2026/6/28')).toBeNull();
    expect(parseYmd('')).toBeNull();
  });

  test('範囲外の月日は null', () => {
    expect(parseYmd('2026-13-01')).toBeNull();
    expect(parseYmd('2026-06-32')).toBeNull();
  });
});

describe('formatDate', () => {
  test('通常は YYYY/M/D', () => {
    expect(formatDate('2026-06-28')).toBe('2026/6/28');
  });

  test('approx=true は YYYY/M月ごろ', () => {
    expect(formatDate('2026-08-31', true)).toBe('2026/8月ごろ');
  });
});

describe('formatRelativeDays', () => {
  test('未来日数', () => {
    expect(formatRelativeDays(9)).toBe('あと9日');
  });
  test('当日', () => {
    expect(formatRelativeDays(0)).toBe('本日');
  });
  test('経過', () => {
    expect(formatRelativeDays(-3)).toBe('3日経過');
  });
});
