// Cloudflare Pages Function: /api/schedule
// GET  -> KV からスケジュールJSONを返す
// PUT  -> 受け取ったJSONを検証して KV に保存
//
// 認証: Authorization: Bearer <パスフレーズ> を APP_PASSPHRASE と
//       定数時間比較（SHA-256 ハッシュ同士の比較）で照合する。

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

/** 保存前の最小バリデーション。信用できる形だけ通す。 */
function isValidDoc(value: unknown): value is { items: unknown[] } {
  if (typeof value !== 'object' || value === null) return false;
  const items = (value as Record<string, unknown>).items;
  return Array.isArray(items);
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

  const doc = {
    version: typeof (parsed as Record<string, unknown>).version === 'number'
      ? (parsed as Record<string, number>).version
      : 1,
    updatedAt: new Date().toISOString(),
    items: (parsed as { items: unknown[] }).items,
  };
  await env.SCHEDULE_KV.put(KV_KEY, JSON.stringify(doc));
  return json({ ok: true, updatedAt: doc.updatedAt });
};
