// 媒体(画像/動画)解析の共有型と純粋ヘルパ。
// フロント(src)とサーバ(functions)の両方から import される（functions → ../../src/analyze/types）。

import { type ScheduleItem, type TaxCategory } from '../types';

/** 受け付ける媒体の MIME 種別。 */
export const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'video/mp4'] as const;
export type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

/** 最大サイズ（50MB）。inline(約20MB上限)を超える動画は Gemini File API 経由で扱う。
 * これ以上の大容量は将来クライアント直アップロード(R2/File API)へ（側では未対応）。 */
export const MAX_MEDIA_BYTES = 50 * 1024 * 1024;

/** inline で送る上限（これを超える or 動画は File API 経由）。Gemini inline 総量 約20MB に余裕を見て 15MB。 */
export const INLINE_MAX_BYTES = 15 * 1024 * 1024;

/** 先頭バイトのマジックナンバーから実体の MIME を判定（申告 MIME を信用しないため）。 */
export function detectMediaType(bytes: Uint8Array): SupportedMediaType | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  // MP4: バイト4〜7 が 'ftyp'
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  ) {
    return 'video/mp4';
  }
  return null;
}

/** 実在する日付か（'2026-02-31' のような不正値を弾く）。 */
export function isRealYmd(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** 取り込み候補の最大件数（外部出力の暴発に備える上限）。 */
export const MAX_PROPOSED_ITEMS = 20;

/** 解析で得た1候補。ScheduleItem のうち AI が埋められる部分集合 + 確信度。 */
export interface ProposedItem {
  category: TaxCategory;
  label: string;
  /** 'YYYY-MM-DD'。不明なら ''。 */
  dueDate: string;
  dueApprox: boolean;
  amount: number | null;
  amountApprox: boolean;
  status: 'confirmed' | 'estimated';
  note: string;
  /** 0..1 の確信度（UI で目安表示）。 */
  confidence: number;
}

export interface AnalyzeResult {
  items: ProposedItem[];
}

export type MediaValidation = { ok: true } | { ok: false; status: number; error: string };

/** MIME 種別とサイズの検証（純粋）。サーバ側で本文を読む前に弾く。 */
export function validateMedia(contentType: string, size: number): MediaValidation {
  if (!SUPPORTED_MEDIA_TYPES.includes(contentType as SupportedMediaType)) {
    return { ok: false, status: 415, error: 'unsupported media type' };
  }
  if (size <= 0) {
    return { ok: false, status: 400, error: 'empty file' };
  }
  if (size > MAX_MEDIA_BYTES) {
    return { ok: false, status: 413, error: 'payload too large' };
  }
  return { ok: true };
}

const VALID_CATEGORIES: ReadonlySet<string> = new Set([
  'residence',
  'income',
  'business',
  'other',
]);
/** 解析プロバイダの生出力(1件)を安全な ProposedItem に正規化する（外部出力は信用しない）。 */
export function sanitizeProposed(raw: unknown): ProposedItem {
  const o = (raw ?? {}) as Record<string, unknown>;
  const category =
    typeof o.category === 'string' && VALID_CATEGORIES.has(o.category)
      ? (o.category as TaxCategory)
      : 'other';
  const dueDate = typeof o.dueDate === 'string' && isRealYmd(o.dueDate) ? o.dueDate : '';
  const amount =
    typeof o.amount === 'number' && Number.isFinite(o.amount) && o.amount >= 0
      ? Math.round(o.amount)
      : null;
  const confidence =
    typeof o.confidence === 'number' && Number.isFinite(o.confidence)
      ? Math.min(1, Math.max(0, o.confidence))
      : 0;
  return {
    category,
    label: typeof o.label === 'string' ? o.label.slice(0, 200) : '',
    dueDate,
    dueApprox: o.dueApprox === true,
    amount,
    amountApprox: o.amountApprox === true,
    status: o.status === 'estimated' ? 'estimated' : 'confirmed',
    note: typeof o.note === 'string' ? o.note.slice(0, 1000) : '',
    confidence,
  };
}

/** 候補配列を正規化。配列でなければ空配列。label 空は捨て、上限件数で切る。 */
export function sanitizeProposedList(raw: unknown): ProposedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeProposed)
    .filter((p) => p.label.trim() !== '')
    .slice(0, MAX_PROPOSED_ITEMS);
}

/** 解析候補を ScheduleItem に変換（採用時に新規IDを採番。未払い・未支払日で確定）。 */
export function proposedToItem(p: ProposedItem): ScheduleItem {
  return {
    id: crypto.randomUUID(),
    dueDate: p.dueDate,
    dueApprox: p.dueApprox,
    category: p.category,
    label: p.label,
    amount: p.amount,
    amountApprox: p.amountApprox,
    status: p.status,
    paid: false,
    paidDate: null,
    note: p.note,
  };
}
