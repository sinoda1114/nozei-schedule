// 表示用フォーマッタ（純粋関数・テスト対象）。

/**
 * 金額を日本円表記にする。
 * - null は「未登録」
 * - approx=true は「約」を前置
 */
export function formatYen(amount: number | null, approx = false): string {
  if (amount === null) return '未登録';
  const prefix = approx ? '約' : '';
  return `${prefix}¥${amount.toLocaleString('ja-JP')}`;
}

/** 'YYYY-MM-DD' を年月日に分解（不正値は null） */
export function parseYmd(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/**
 * 納付期限を表示する。
 * - approx=true は「YYYY/M月ごろ」
 * - それ以外は「YYYY/M/D」
 */
export function formatDate(iso: string, approx = false): string {
  const parts = parseYmd(iso);
  if (!parts) return iso;
  const { y, m, d } = parts;
  return approx ? `${y}/${m}月ごろ` : `${y}/${m}/${d}`;
}

/** 残り日数を「あとN日 / N日経過 / 本日」などの語にする */
export function formatRelativeDays(days: number): string {
  if (days === 0) return '本日';
  if (days > 0) return `あと${days}日`;
  return `${Math.abs(days)}日経過`;
}
