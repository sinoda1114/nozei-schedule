// Cloudflare Pages Function: /api/schedule
// GET  -> KV からスケジュールJSONを返す（updatedAt を含む）
// PUT  -> 受け取ったJSONを検証し、楽観ロックを通過した場合のみ KV に保存
//
// 認証（2モード）:
//   CF Access モード: CF-Access-Authenticated-User-Email ヘッダーを使用（本番）
//   レガシーモード:   旧パスフレーズ/セッショントークン（レガシークライアント向け）
//   ローカル開発:     DEV_USER_EMAIL 環境変数で代替
//
// KV キー:
//   CF Access モード: schedule:doc:{email}（ユーザーごとに独立）
//   レガシーモード:   schedule:doc（後方互換・共有）
//
// 並行制御: クライアントは「読み込んだ時点の updatedAt」を
//   X-Expected-UpdatedAt ヘッダで送る。KV 上の現在値と一致しない場合は
//   409 を返し、他端末の更新を握り潰さない（詳細は lib/concurrency.ts）。

import {
  EXPECTED_UPDATED_AT_HEADER,
  evaluatePrecondition,
  readStoredUpdatedAt,
} from '../../src/lib/concurrency';
import { type AuthEnv, cfAccessEmail, isAuthorized, json } from '../_lib/auth';

interface PagesContext {
  request: Request;
  env: AuthEnv;
}

// CF Access モード: ユーザーごとのキー。レガシー（移行期間中）: 共有キー。
const KV_KEY_LEGACY = 'schedule:doc';
const kvKeyForUser = (email: string): string => `schedule:doc:${email}`;

const MAX_BODY_BYTES = 256 * 1024;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function emptyDoc(): string {
  return JSON.stringify({ version: 1, updatedAt: new Date(0).toISOString(), items: [] });
}

const MAX_ITEMS = 500;
const MAX_STR = 200;
const MAX_NOTE = 1000;
const VALID_CATEGORIES = new Set([
  'residence', 'income', 'business', 'property', 'vehicle', 'consumption', 'withholding', 'other',
]);

/**
 * リクエストを認証して KV キーを解決する。
 * - CF Access ヘッダーあり / DEV_USER_EMAIL あり → per-user キー
 * - 旧パスフレーズ認証成功 → レガシー共有キー（CF Access 設定前の移行期間フォールバック）
 * - 未認証 → null
 */
async function resolveKvKey(request: Request, env: AuthEnv): Promise<string | null> {
  const email = cfAccessEmail(request, env);
  if (email) return kvKeyForUser(email);
  if (await isAuthorized(request, env)) return KV_KEY_LEGACY;
  return null;
}

/** 保存前の最小バリデーション。items が配列かつ上限内かだけ確認する。 */
function isValidDoc(value: unknown): value is { items: unknown[]; version?: unknown } {
  if (typeof value !== 'object' || value === null) return false;
  const items = (value as Record<string, unknown>).items;
  return Array.isArray(items) && items.length <= MAX_ITEMS;
}

function clampStr(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

/** 各 item をサーバー側でも安全な形に正規化する（壊れた/巨大なデータを KV に入れない）。 */
function sanitizeItem(input: unknown): Record<string, unknown> {
  const o = (input ?? {}) as Record<string, unknown>;
  const category = typeof o.category === 'string' && VALID_CATEGORIES.has(o.category) ? o.category : 'other';
  const dueDate = typeof o.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.dueDate) ? o.dueDate : '';
  const paidDate =
    typeof o.paidDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.paidDate) ? o.paidDate : null;
  const amount =
    typeof o.amount === 'number' && Number.isFinite(o.amount) && o.amount >= 0
      ? Math.round(o.amount)
      : null;
  return {
    id: clampStr(o.id, 64) || crypto.randomUUID(),
    dueDate,
    dueApprox: o.dueApprox === true,
    category,
    label: clampStr(o.label, MAX_STR),
    amount,
    amountApprox: o.amountApprox === true,
    status: o.status === 'estimated' ? 'estimated' : 'confirmed',
    paid: o.paid === true,
    paidDate,
    note: clampStr(o.note, MAX_NOTE),
  };
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const kvKey = await resolveKvKey(request, env);
  if (!kvKey) return json({ error: 'unauthorized' }, 401);

  const stored = await env.SCHEDULE_KV.get(kvKey);
  return new Response(stored ?? emptyDoc(), { status: 200, headers: JSON_HEADERS });
};

export const onRequestPut = async ({ request, env }: PagesContext): Promise<Response> => {
  const kvKey = await resolveKvKey(request, env);
  if (!kvKey) return json({ error: 'unauthorized' }, 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!isValidDoc(parsed)) return json({ error: 'invalid schema' }, 422);

  // 楽観的並行制御
  const expected = request.headers.get(EXPECTED_UPDATED_AT_HEADER);
  const stored = await env.SCHEDULE_KV.get(kvKey);
  const current = readStoredUpdatedAt(stored);
  const precondition = evaluatePrecondition(expected, current);
  if (!precondition.ok) {
    return json({ error: precondition.error, currentUpdatedAt: current }, precondition.status);
  }

  const doc = {
    version: typeof parsed.version === 'number' ? parsed.version : 1,
    updatedAt: new Date().toISOString(),
    items: parsed.items.map(sanitizeItem),
  };
  await env.SCHEDULE_KV.put(kvKey, JSON.stringify(doc));
  return json({ ok: true, updatedAt: doc.updatedAt });
};
