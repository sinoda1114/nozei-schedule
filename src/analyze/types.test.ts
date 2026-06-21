import { describe, expect, test } from 'vitest';
import {
  MAX_MEDIA_BYTES,
  MAX_PROPOSED_ITEMS,
  detectMediaType,
  isRealYmd,
  proposedToItem,
  sanitizeProposed,
  sanitizeProposedList,
  validateMedia,
  type ProposedItem,
} from './types';

describe('validateMedia', () => {
  test('JPG/PNG/MP4 は許可', () => {
    expect(validateMedia('image/jpeg', 1000).ok).toBe(true);
    expect(validateMedia('image/png', 1000).ok).toBe(true);
    expect(validateMedia('video/mp4', 1000).ok).toBe(true);
  });

  test('非対応MIMEは415', () => {
    const r = validateMedia('application/pdf', 1000);
    expect(r).toEqual({ ok: false, status: 415, error: 'unsupported media type' });
  });

  test('空ファイルは400', () => {
    expect(validateMedia('image/png', 0)).toMatchObject({ ok: false, status: 400 });
  });

  test('上限超過は413', () => {
    expect(validateMedia('image/png', MAX_MEDIA_BYTES + 1)).toMatchObject({
      ok: false,
      status: 413,
    });
  });
});

describe('detectMediaType', () => {
  test('マジックバイトから実体を判定', () => {
    expect(detectMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectMediaType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(
      'image/png',
    );
    // ....ftyp...
    expect(
      detectMediaType(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0])),
    ).toBe('video/mp4');
  });

  test('未知シグネチャは null', () => {
    expect(detectMediaType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // %PDF
    expect(detectMediaType(new Uint8Array([]))).toBeNull();
  });
});

describe('isRealYmd', () => {
  test('実在日付のみ true', () => {
    expect(isRealYmd('2026-06-30')).toBe(true);
    expect(isRealYmd('2026-02-31')).toBe(false); // 2月31日は存在しない
    expect(isRealYmd('2026-13-01')).toBe(false);
    expect(isRealYmd('2026/06/30')).toBe(false);
    expect(isRealYmd('')).toBe(false);
  });
});

describe('sanitizeProposed', () => {
  test('未知カテゴリは other、不正日付は空、負/非数の金額は null', () => {
    const p = sanitizeProposed({
      category: 'hacker',
      label: 'X',
      dueDate: '2026/06/30',
      amount: -5,
      status: 'estimated',
      confidence: 5,
    });
    expect(p.category).toBe('other');
    expect(p.dueDate).toBe('');
    expect(p.amount).toBeNull();
    expect(p.status).toBe('estimated');
    expect(p.confidence).toBe(1); // 0..1 にクランプ
  });

  test('正常値はそのまま（amountは整数化）', () => {
    const p = sanitizeProposed({
      category: 'income',
      label: '所得税 第1期',
      dueDate: '2026-07-31',
      amount: 88600.4,
      amountApprox: true,
      status: 'confirmed',
      note: 'メモ',
      confidence: 0.8,
    });
    expect(p).toMatchObject({
      category: 'income',
      label: '所得税 第1期',
      dueDate: '2026-07-31',
      amount: 88600,
      amountApprox: true,
      status: 'confirmed',
      note: 'メモ',
      confidence: 0.8,
    });
  });
});

describe('sanitizeProposedList', () => {
  test('配列以外は空配列', () => {
    expect(sanitizeProposedList(null)).toEqual([]);
    expect(sanitizeProposedList({})).toEqual([]);
  });

  test('label 空の候補は捨てる', () => {
    const list = sanitizeProposedList([
      { label: '有効', category: 'other', dueDate: '', status: 'confirmed' },
      { label: '   ', category: 'other', dueDate: '', status: 'confirmed' },
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('有効');
  });

  test('件数は上限で切る', () => {
    const many = Array.from({ length: MAX_PROPOSED_ITEMS + 5 }, (_, i) => ({
      label: `項目${i}`,
      category: 'other',
      dueDate: '',
      status: 'confirmed',
    }));
    expect(sanitizeProposedList(many)).toHaveLength(MAX_PROPOSED_ITEMS);
  });
});

describe('proposedToItem', () => {
  test('未払い・未支払日で ScheduleItem 化し、新規IDを採番', () => {
    const p: ProposedItem = {
      category: 'business',
      label: '個人事業税 第1期',
      dueDate: '2026-08-31',
      dueApprox: false,
      amount: 50000,
      amountApprox: false,
      status: 'confirmed',
      note: '',
      confidence: 0.9,
    };
    const item = proposedToItem(p);
    expect(item).toMatchObject({
      category: 'business',
      label: '個人事業税 第1期',
      dueDate: '2026-08-31',
      amount: 50000,
      status: 'confirmed',
      paid: false,
      paidDate: null,
    });
    expect(item.id).toMatch(/[0-9a-f-]{36}/);
  });
});
