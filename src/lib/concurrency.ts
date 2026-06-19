// 楽観的並行制御（optimistic concurrency control）の純粋ロジック。
//
// KV はアトミックな compare-and-swap を持たないため、
// 「クライアントが読み込んだ時点の updatedAt」を保存時に送ってもらい、
// KV 上の現在の updatedAt と一致する場合のみ上書きを許可することで
// last-write-wins（後勝ちで他端末の変更を握り潰す）問題を緩和する。
//
// 注意（KV の制約 / 残存リスク）:
//   1. KV は compare-and-swap を持たないため「読み取り→照合→書き込み」はアトミックでない。
//      同じ updatedAt を持つ2つの PUT がほぼ同時に来ると、同一 colo 内であっても両方が
//      照合を通過し、後勝ちになり得る（本方式は競合確率を大きく下げる緩和策であり、
//      同時更新の完全な相互排他は保証しない）。
//   2. KV の書き込みは別リージョンへの伝播が最大 ~60 秒程度遅延しうるため、異なる地域の
//      2端末がその窓内でほぼ同時編集した場合も両者が照合を通過し得る。
//   完全な直列化が必要になれば Durable Objects（単一書き込み主体）への移行が選択肢。
//   本アプリ（単一ユーザー・低頻度編集）では本方式で競合ウィンドウを実用上十分に狭められる。
//   なお照合は updatedAt の「等値比較」で行うため、ミリ秒精度のトークンでも、時刻が前進する
//   限り stale なトークンと完全一致する値が再生成されることは実質的に起きない。

/** 空ドキュメント／未保存時の updatedAt 基準値。 */
export const EPOCH = new Date(0).toISOString();

/** 楽観ロックで送る独自ヘッダ名（If-Unmodified-Since 相当）。 */
export const EXPECTED_UPDATED_AT_HEADER = 'X-Expected-UpdatedAt';

/**
 * KV に保存済みの生 JSON 文字列から updatedAt を取り出す。
 * 未保存（null）・updatedAt 欠落・壊れた JSON はいずれも EPOCH 扱い。
 */
export function readStoredUpdatedAt(stored: string | null): string {
  if (!stored) return EPOCH;
  try {
    const parsed = JSON.parse(stored) as { updatedAt?: unknown };
    return typeof parsed.updatedAt === 'string' ? parsed.updatedAt : EPOCH;
  } catch {
    return EPOCH;
  }
}

export type PreconditionResult =
  | { ok: true }
  | { ok: false; status: 409 | 428; error: string };

/**
 * 保存前の前提条件を判定する純粋関数。
 * - expected が null（ヘッダ未送出）→ 428 Precondition Required
 *   （盲目的な上書きを許さない。クライアントは再読込が必要）
 * - expected が現在値と不一致 → 409 Conflict（他端末が先に更新済み）
 * - 一致 → 続行可
 *
 * @param expected クライアントが読み込んだ時点の updatedAt（ヘッダ未送出なら null）
 * @param current  KV 上の現在の updatedAt（readStoredUpdatedAt の戻り値）
 */
export function evaluatePrecondition(expected: string | null, current: string): PreconditionResult {
  if (expected === null) {
    return {
      ok: false,
      status: 428,
      error: 'precondition required: missing expected version header',
    };
  }
  if (expected !== current) {
    return {
      ok: false,
      status: 409,
      error: 'conflict: the schedule was updated on another device',
    };
  }
  return { ok: true };
}
