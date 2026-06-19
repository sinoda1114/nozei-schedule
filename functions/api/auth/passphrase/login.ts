// POST /api/auth/passphrase/login
// パスフレーズでログインしてセッショントークンを発行（フォールバック/リカバリ経路）。

import { type AuthEnv, issueSession, json, verifyPassphrase } from '../../../_lib/auth';

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.SESSION_SECRET) return json({ error: 'server misconfigured: SESSION_SECRET' }, 500);
  let body: { passphrase?: unknown };
  try {
    body = (await request.json()) as { passphrase?: unknown };
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  const passphrase = typeof body.passphrase === 'string' ? body.passphrase : '';
  if (!(await verifyPassphrase(passphrase, env))) return json({ error: 'unauthorized' }, 401);
  const sessionToken = await issueSession(env);
  return json({ sessionToken });
};
