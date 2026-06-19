import { describe, expect, test } from 'vitest';
import {
  type AuthEnv,
  b64urlDecode,
  b64urlEncode,
  isAuthorized,
  issueChallengeToken,
  issueSession,
  verifyChallengeToken,
  verifyPassphrase,
  verifySession,
} from './auth';

const env: AuthEnv = {
  SCHEDULE_KV: {} as never,
  APP_PASSPHRASE: 'correct horse battery staple',
  SESSION_SECRET: 'test-session-secret-xxxxxxxxxxxxxxxx',
};

function bearer(token: string): Request {
  return new Request('https://nozei-schedule.pages.dev/api/schedule', {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('base64url', () => {
  test('encode→decode で元のバイト列に戻る', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    expect(Array.from(b64urlDecode(b64urlEncode(bytes)))).toEqual(Array.from(bytes));
  });
  test('URLセーフ（+,/,= を含まない）', () => {
    const s = b64urlEncode(new Uint8Array([251, 255, 191, 254]));
    expect(s).not.toMatch(/[+/=]/);
  });
});

describe('セッショントークン', () => {
  test('発行→検証が成立する', async () => {
    const now = 1_000_000;
    const token = await issueSession(env, now);
    expect(await verifySession(token, env, now)).toBe(true);
  });
  test('期限切れは false', async () => {
    const token = await issueSession(env, 1_000_000);
    // 31日後
    expect(await verifySession(token, env, 1_000_000 + 60 * 60 * 24 * 31)).toBe(false);
  });
  test('署名改ざんは false', async () => {
    const token = await issueSession(env, 1_000_000);
    const tampered = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    expect(await verifySession(tampered, env, 1_000_000)).toBe(false);
  });
  test('別シークレットでは検証できない', async () => {
    const token = await issueSession(env, 1_000_000);
    const other: AuthEnv = { ...env, SESSION_SECRET: 'different-secret' };
    expect(await verifySession(token, other, 1_000_000)).toBe(false);
  });
  test('SESSION_SECRET 未設定なら常に false', async () => {
    const noSecret: AuthEnv = { ...env, SESSION_SECRET: undefined };
    expect(await verifySession('a.b', noSecret)).toBe(false);
  });
});

describe('チャレンジトークン', () => {
  test('発行→同種別で検証しチャレンジを返す', async () => {
    const now = 1_000_000;
    const token = await issueChallengeToken(env, 'CHALLENGE_ABC', 'reg', now);
    expect(await verifyChallengeToken(token, env, 'reg', now)).toBe('CHALLENGE_ABC');
  });
  test('種別が違うと null（regトークンをauthで検証）', async () => {
    const now = 1_000_000;
    const token = await issueChallengeToken(env, 'X', 'reg', now);
    expect(await verifyChallengeToken(token, env, 'auth', now)).toBeNull();
  });
  test('期限切れは null', async () => {
    const token = await issueChallengeToken(env, 'X', 'auth', 1_000_000);
    expect(await verifyChallengeToken(token, env, 'auth', 1_000_000 + 301)).toBeNull();
  });
});

describe('verifyPassphrase', () => {
  test('一致で true', async () => {
    expect(await verifyPassphrase('correct horse battery staple', env)).toBe(true);
  });
  test('不一致で false', async () => {
    expect(await verifyPassphrase('wrong', env)).toBe(false);
  });
  test('APP_PASSPHRASE 未設定なら false', async () => {
    expect(await verifyPassphrase('x', { ...env, APP_PASSPHRASE: undefined })).toBe(false);
  });
});

describe('isAuthorized', () => {
  test('セッショントークンBearerを受理', async () => {
    const token = await issueSession(env);
    expect(await isAuthorized(bearer(token), env)).toBe(true);
  });
  test('旧パスフレーズ生Bearerを移行フォールバックで受理', async () => {
    expect(await isAuthorized(bearer('correct horse battery staple'), env)).toBe(true);
  });
  test('不正トークンは拒否', async () => {
    expect(await isAuthorized(bearer('garbage.token'), env)).toBe(false);
  });
  test('Authorizationヘッダ無しは拒否', async () => {
    const req = new Request('https://nozei-schedule.pages.dev/api/schedule');
    expect(await isAuthorized(req, env)).toBe(false);
  });
});
