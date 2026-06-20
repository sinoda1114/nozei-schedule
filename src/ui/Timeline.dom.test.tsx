// @vitest-environment happy-dom
//
// Timeline / TimelineLegend のレンダリング回帰テスト（HeroUI 非依存・happy-dom）。
// 棒・未登録の中抜き・予測の破線・支払済✓・「次の納付」マーカー・凡例ラベルを検証する。

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { type ScheduleItem } from '../types';
import { Timeline, TimelineLegend } from './Timeline';

afterEach(cleanup);

function item(over: Partial<ScheduleItem>): ScheduleItem {
  return {
    id: 'x',
    dueDate: '2026-06-30',
    dueApprox: false,
    category: 'residence',
    label: 'テスト',
    amount: 10000,
    amountApprox: false,
    status: 'confirmed',
    paid: false,
    paidDate: null,
    note: '',
    ...over,
  };
}

const TODAY = '2026-06-20';

describe('Timeline', () => {
  test('空配列なら SVG を描画しない', () => {
    const { container } = render(<Timeline items={[]} today={TODAY} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  test('各項目の棒を描画し、未登録は中抜き(fill=none)＋「未登録」表示', () => {
    const items = [
      item({ id: 'a', dueDate: '2026-06-30', amount: 10000 }),
      item({ id: 'b', dueDate: '2026-11-30', amount: null }),
    ];
    const { container } = render(<Timeline items={items} today={TODAY} />);
    expect(container.querySelectorAll('rect').length).toBe(2);
    const hollow = [...container.querySelectorAll('rect')].some(
      (r) => r.getAttribute('fill') === 'none',
    );
    expect(hollow).toBe(true);
    expect(container.textContent).toContain('未登録');
    // 未払いの最早＝「次の納付」マーカー
    expect(container.textContent).toContain('次の納付');
  });

  test('予測は破線(stroke-dasharray="4 3")', () => {
    const items = [item({ id: 'a', amount: 10000, status: 'estimated' })];
    const { container } = render(<Timeline items={items} today={TODAY} />);
    expect(container.querySelector('rect')?.getAttribute('stroke-dasharray')).toBe('4 3');
  });

  test('支払済みは ✓ を表示', () => {
    const items = [item({ id: 'a', amount: 10000, paid: true, paidDate: '2026-06-01' })];
    const { container } = render(<Timeline items={items} today={TODAY} />);
    expect(container.textContent).toContain('✓');
  });
});

describe('TimelineLegend', () => {
  test('凡例の主要ラベルを描画する', () => {
    const { container } = render(<TimelineLegend />);
    expect(container.textContent).toContain('市県民税');
    expect(container.textContent).toContain('予測');
    expect(container.textContent).toContain('金額未登録');
  });
});
