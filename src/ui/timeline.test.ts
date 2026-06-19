import { describe, expect, test } from 'vitest';
import { renderTimeline, timelineLegend, timelineRangeLabel } from './timeline';
import { createSeedDoc } from '../lib/seed';
import type { ScheduleItem } from '../types';

function item(o: Partial<ScheduleItem>): ScheduleItem {
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
    ...o,
  };
}

describe('renderTimeline', () => {
  test('空配列は空文字を返す', () => {
    expect(renderTimeline([], '2026-06-19')).toBe('');
  });

  test('件数ぶんの棒(rect)を生成する', () => {
    const doc = createSeedDoc();
    const svg = renderTimeline(doc.items, '2026-06-19');
    const rects = svg.match(/<rect/g) ?? [];
    expect(rects.length).toBe(doc.items.length); // 8件 → 8本
    expect(svg).toContain('<svg');
    expect(svg).toContain('role="img"');
  });

  test('未払いの先頭に「次の納付」マーカーが1つ付く', () => {
    const doc = createSeedDoc();
    const svg = renderTimeline(doc.items, '2026-06-19');
    expect((svg.match(/次の納付/g) ?? []).length).toBe(1);
  });

  test('金額未登録(null)は中抜き(fill="none")で描画する', () => {
    const svg = renderTimeline([item({ amount: null })], '2026-06-19');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('未登録');
  });

  test('予測(estimated)は破線(stroke-dasharray)で描画する', () => {
    const svg = renderTimeline([item({ status: 'estimated', amount: 50000 })], '2026-06-19');
    expect(svg).toContain('stroke-dasharray');
  });

  test('全件支払済みなら「次の納付」マーカーは出ない', () => {
    const svg = renderTimeline([item({ paid: true })], '2026-06-19');
    expect(svg).not.toContain('次の納付');
  });
});

describe('軸ラベルの年表記', () => {
  test('日付ラベル(tl-date)に年(20xx)を含めない', () => {
    const doc = createSeedDoc();
    const svg = renderTimeline(doc.items, '2026-06-19');
    const dateLabels = svg.match(/class="tl-date">([^<]*)</g) ?? [];
    expect(dateLabels.length).toBe(doc.items.length);
    for (const label of dateLabels) {
      expect(label).not.toMatch(/20\d{2}/);
    }
    expect(svg).toContain('>6/28<');
  });
});

describe('timelineRangeLabel', () => {
  test('年を跨ぐ期間は両端の年を出す', () => {
    expect(timelineRangeLabel(createSeedDoc().items)).toBe('2026年6月〜2027年1月');
  });
  test('同年なら末尾の年は省く', () => {
    const items = [
      item({ dueDate: '2026-06-28' }),
      item({ dueDate: '2026-11-30' }),
    ];
    expect(timelineRangeLabel(items)).toBe('2026年6月〜11月');
  });
  test('空配列は空文字', () => {
    expect(timelineRangeLabel([])).toBe('');
  });
});

describe('timelineLegend', () => {
  test('5種類の凡例を返す', () => {
    const html = timelineLegend();
    for (const label of ['市県民税', '所得税', '事業税', '予測', '金額未登録']) {
      expect(html).toContain(label);
    }
  });
});
