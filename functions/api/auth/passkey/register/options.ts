// POST /api/auth/passkey/register/options
// 端末登録(attestation)用オプションを発行。所有者(=既存セッション/パスフレーズ)のみ可。

import { generateRegistrationOptions } from '@simplewebauthn/server';
import {
  type AuthEnv,
  isAuthorized,
  issueChallengeToken,
  json,
  rpConfig,
  unauthorized,
} from '../../../../_lib/auth';
import { listCredentials } from '../../../../_lib/passkey';

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return unauthorized();
  if (!env.SESSION_SECRET) return json({ error: 'server misconfigured' }, 500);

  const { rpID, rpName } = rpConfig(request);
  const existing = await listCredentials(env);

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: 'owner',
    userID: new TextEncoder().encode('owner'),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: c.transports as never,
    })),
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' },
  });

  const challengeToken = await issueChallengeToken(env, options.challenge, 'reg');
  return json({ options, challengeToken });
};
