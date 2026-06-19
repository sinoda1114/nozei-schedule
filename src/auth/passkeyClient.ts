// フロント側の認証クライアント。ログイン/パスキー登録の儀式をまとめる。
// ログインは「セッショントークン文字列」を返す。失敗時は Error を投げる。

import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

const AUTH = '/api/auth';

/** このブラウザが WebAuthn(パスキー)に対応しているか */
export function passkeySupported(): boolean {
  return browserSupportsWebAuthn();
}

async function postJson(url: string, body: unknown, token?: string | null): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function readSessionToken(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { sessionToken?: unknown };
  if (typeof data.sessionToken !== 'string' || !data.sessionToken) {
    throw new Error('セッションの取得に失敗しました');
  }
  return data.sessionToken;
}

type RegistrationOptionsJSON = Parameters<typeof startRegistration>[0]['optionsJSON'];
type AuthenticationOptionsJSON = Parameters<typeof startAuthentication>[0]['optionsJSON'];

/** パスキーでログイン → セッショントークン */
export async function loginWithPasskey(): Promise<string> {
  const optRes = await postJson(`${AUTH}/passkey/login/options`, {});
  if (!optRes.ok) throw new Error('パスキーの準備に失敗しました');
  const { options, challengeToken } = (await optRes.json()) as {
    options: AuthenticationOptionsJSON;
    challengeToken: string;
  };
  const response = await startAuthentication({ optionsJSON: options });
  const verRes = await postJson(`${AUTH}/passkey/login/verify`, { response, challengeToken });
  if (!verRes.ok) throw new Error('パスキー認証に失敗しました');
  return readSessionToken(verRes);
}

/** パスフレーズでログイン → セッショントークン */
export async function loginWithPassphrase(passphrase: string): Promise<string> {
  const res = await postJson(`${AUTH}/passphrase/login`, { passphrase });
  if (res.status === 401) throw new Error('パスフレーズが違います');
  if (!res.ok) throw new Error('ログインに失敗しました');
  return readSessionToken(res);
}

/** いまログイン中の token でこの端末をパスキー登録 */
export async function registerThisDevice(token: string, label: string): Promise<void> {
  const optRes = await postJson(`${AUTH}/passkey/register/options`, {}, token);
  if (!optRes.ok) throw new Error('登録の準備に失敗しました');
  const { options, challengeToken } = (await optRes.json()) as {
    options: RegistrationOptionsJSON;
    challengeToken: string;
  };
  const response = await startRegistration({ optionsJSON: options });
  const verRes = await postJson(
    `${AUTH}/passkey/register/verify`,
    { response, challengeToken, label },
    token,
  );
  if (!verRes.ok) throw new Error('パスキー登録に失敗しました');
}
