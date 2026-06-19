import { describe, expect, test } from 'vitest';
import {
  EPOCH,
  evaluatePrecondition,
  readStoredUpdatedAt,
  type PreconditionResult,
} from './concurrency';

describe('readStoredUpdatedAt', () => {
  test('未保存(null)なら EPOCH を返す', () => {
    expect(readStoredUpdatedAt(null)).toBe(EPOCH);
  });

  test('正常な JSON から updatedAt を取り出す', () => {
    const stored = JSON.stringify({ version: 1, updatedAt: '2026-06-19T01:00:00.000Z', items: [] });
    expect(readStoredUpdatedAt(stored)).toBe('2026-06-19T01:00:00.000Z');
  });

  test('updatedAt を持たない JSON は EPOCH', () => {
    expect(readStoredUpdatedAt(JSON.stringify({ items: [] }))).toBe(EPOCH);
  });

  test('updatedAt が文字列でない場合は EPOCH', () => {
    expect(readStoredUpdatedAt(JSON.stringify({ updatedAt: 12345 }))).toBe(EPOCH);
  });

  test('壊れた JSON は EPOCH（例外を投げない）', () => {
    expect(readStoredUpdatedAt('{ not json')).toBe(EPOCH);
  });
});

describe('evaluatePrecondition', () => {
  const expectConflict = (r: PreconditionResult, status: 409 | 428): void => {
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(status);
  };

  test('期待値と現在値が一致すれば続行可(ok)', () => {
    const now = '2026-06-19T01:00:00.000Z';
    expect(evaluatePrecondition(now, now)).toEqual({ ok: true });
  });

  test('空ドキュメント(EPOCH)同士の初回保存は ok', () => {
    expect(evaluatePrecondition(EPOCH, EPOCH)).toEqual({ ok: true });
  });

  test('古い updatedAt（他端末が先に更新）は 409 競合', () => {
    const stale = '2026-06-19T01:00:00.000Z';
    const current = '2026-06-19T02:30:00.000Z';
    expectConflict(evaluatePrecondition(stale, current), 409);
  });

  test('ヘッダ未送出(null)は 428 Precondition Required', () => {
    expectConflict(evaluatePrecondition(null, '2026-06-19T02:30:00.000Z'), 428);
  });
});
