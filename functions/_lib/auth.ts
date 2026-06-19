// 共有認証ライブラリ（Pages Functions 横断）。
// 認証方式: ログイン成功で HMAC 署名セッショントークンを発行し、以後 Bearer で送る。
// 移行期間は「セッション or 旧パスフレーズ(生)」の両方を受理してロックアウトを防ぐ。
//
// _lib/ は先頭アンダースコアのため Pages はルートとして公開しない（共有コード置き場）。

export interface AuthEnv {
  SCHEDULE_KV: KVNamespace;
  APP_PASSPHRASE?: string;
  SESSION_SECRET?: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30日

// ---- base64url ----
export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function b64urlFromString(s: string): string {
  return b64urlEncode(enc.encode(s));
}

function stringFromB64url(s: string): string {
  return dec.decode(b64urlDecode(s));
}

// ---- ハッシュ・定数時間比較 ----
export async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return new Uint8Array(digest);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  // 長さ差も漏らさないよう両者を SHA-256 化して固定長で比較
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  return timingSafeEqual(ha, hb);
}

// ---- HMAC-SHA256（base64url） ----
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return b64urlEncode(new Uint8Array(sig));
}

// ---- セッショントークン（ステートレス・HMAC署名） ----
interface SessionPayload {
  sub: 'owner';
  iat: number;
  exp: number;
}

export async function issueSession(env: AuthEnv, now = Math.floor(Date.now() / 1000)): Promise<string> {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET 未設定');
  const payload: SessionPayload = { sub: 'owner', iat: now, exp: now + SESSION_TTL_SEC };
  const body = b64urlFromString(JSON.stringify(payload));
  const sig = await hmac(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

export async function verifySession(
  token: string,
  env: AuthEnv,
  now = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!env.SESSION_SECRET) return false;
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(env.SESSION_SECRET, body);
  if (!(await timingSafeEqualStr(sig, expected))) return false;
  try {
    const payload = JSON.parse(stringFromB64url(body)) as SessionPayload;
    return payload.sub === 'owner' && typeof payload.exp === 'number' && payload.exp > now;
  } catch {
    return false;
  }
}

// ---- WebAuthn チャレンジトークン（KVに持たずHMAC署名でステートレスに往復） ----
type ChallengeType = 'reg' | 'auth';
interface ChallengePayload {
  ch: string; // simplewebauthn が返す base64url チャレンジ
  t: ChallengeType;
  exp: number;
}
const CHALLENGE_TTL_SEC = 300; // 5分

export async function issueChallengeToken(
  env: AuthEnv,
  challenge: string,
  type: ChallengeType,
  now = Math.floor(Date.now() / 1000),
): Promise<string> {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET 未設定');
  const payload: ChallengePayload = { ch: challenge, t: type, exp: now + CHALLENGE_TTL_SEC };
  const body = b64urlFromString(JSON.stringify(payload));
  const sig = await hmac(env.SESSION_SECRET, body);
  return `${body}.${sig}`;
}

/** 検証成功でチャレンジ文字列を返す。無効/期限切れ/種別不一致は null。 */
export async function verifyChallengeToken(
  token: string,
  env: AuthEnv,
  type: ChallengeType,
  now = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  if (!env.SESSION_SECRET || !token) return null;
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await hmac(env.SESSION_SECRET, body);
  if (!(await timingSafeEqualStr(sig, expected))) return null;
  try {
    const payload = JSON.parse(stringFromB64url(body)) as ChallengePayload;
    if (payload.t !== type || typeof payload.exp !== 'number' || payload.exp <= now) return null;
    return typeof payload.ch === 'string' ? payload.ch : null;
  } catch {
    return null;
  }
}

// ---- パスフレーズ照合（旧方式・フォールバック/リカバリ） ----
export async function verifyPassphrase(token: string, env: AuthEnv): Promise<boolean> {
  const expected = env.APP_PASSPHRASE;
  if (!expected || !token) return false;
  const [ta, tb] = await Promise.all([sha256(token), sha256(expected)]);
  return timingSafeEqual(ta, tb);
}

// ---- リクエストから Bearer 抽出 ----
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  return token || null;
}

/**
 * API アクセス可否。セッショントークン優先、無効なら移行用に旧パスフレーズ(生Bearer)も受理。
 * 旧パスフレーズ受理は移行完了後に external フラグで切れるよう独立関数にしている。
 */
export async function isAuthorized(request: Request, env: AuthEnv): Promise<boolean> {
  const token = bearerToken(request);
  if (!token) return false;
  if (await verifySession(token, env)) return true;
  if (await verifyPassphrase(token, env)) return true; // 移行フォールバック
  return false;
}

// ---- WebAuthn の RP 設定（リクエストのホストから導出。localhost/pages.dev 両対応） ----
export function rpConfig(request: Request): { rpID: string; origin: string; rpName: string } {
  const url = new URL(request.url);
  return { rpID: url.hostname, origin: url.origin, rpName: '納税スケジュール' };
}

// ---- 共通レスポンス ----
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export function unauthorized(): Response {
  return json({ error: 'unauthorized' }, 401);
}
