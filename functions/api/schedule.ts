// Cloudflare Pages Function: /api/schedule
// GET  -> KV からスケジュールJSONを返す（updatedAt を含む）
// PUT  -> 受け取ったJSONを検証し、楽観ロックを通過した場合のみ KV に保存
//
// 認証: Authorization: Bearer <パスフレーズ> を APP_PASSPHRASE と
//       定数時間比較（SHA-256 ハッシュ同士の比較）で照合する。
//
// 並行制御: クライアントは「読み込んだ時点の updatedAt」を
//   X-Expected-UpdatedAt ヘッダで送る。KV 上の現在値と一致しない場合は
//   409 を返し、他端末の更新を握り潰さない（詳細は lib/concurrency.ts）。

import {
  EXPECTED_UPDATED_AT_HEADER,
  evaluatePrecondition,
  readStoredUpdatedAt,
} from '../../src/lib/concurrency';

interface Env {
  SCHEDULE_KV: KVNamespace;
  APP_PASSPHRASE?: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const KV_KEY = 'schedule:doc';
const MAX_BODY_BYTES = 256 * 1024; // 念のための上限（このアプリのデータは数KB）

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(digest);
}

/** 定数時間でバイト列を比較 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const expected = env.APP_PASSPHRASE;
  if (!expected) return false; // 未設定なら一切許可しない
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;
  const [ta, tb] = await Promise.all([sha256(token), sha256(expected)]);
  return timingSafeEqual(ta, tb);
}

function emptyDoc(): string {
  return JSON.stringify({ version: 1, updatedAt: new Date(0).toISOString(), items: [] });
}

const MAX_ITEMS = 500;
const MAX_STR = 200;
const MAX_NOTE = 1000;
const VALID_CATEGORIES = new Set(['residence', 'income', 'business', 'other']);

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
  if (!(await isAuthorized(request, env))) return json({ error: 'unauthorized' }, 401);
  const stored = await env.SCHEDULE_KV.get(KV_KEY);
  return new Response(stored ?? emptyDoc(), { status: 200, headers: JSON_HEADERS });
};

export const onRequestPut = async ({ request, env }: PagesContext): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return json({ error: 'unauthorized' }, 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload too large' }, 413);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!isValidDoc(parsed)) return json({ error: 'invalid schema' }, 422);

  // 楽観的並行制御: KV 上の現在 updatedAt とクライアントの期待値を照合する。
  // 不一致なら他端末が先に更新しているので上書きせず 409 を返す。
  const expected = request.headers.get(EXPECTED_UPDATED_AT_HEADER);
  const stored = await env.SCHEDULE_KV.get(KV_KEY);
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
  await env.SCHEDULE_KV.put(KV_KEY, JSON.stringify(doc));
  return json({ ok: true, updatedAt: doc.updatedAt });
};
