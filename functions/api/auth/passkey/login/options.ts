// POST /api/auth/passkey/login/options
// 認証(assertion)用オプションを発行。未認証で呼べる（これがログイン）。

import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { type AuthEnv, issueChallengeToken, json, rpConfig } from '../../../../_lib/auth';
import { listCredentials } from '../../../../_lib/passkey';

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.SESSION_SECRET) return json({ error: 'server misconfigured' }, 500);

  const { rpID } = rpConfig(request);
  const creds = await listCredentials(env);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.id, transports: c.transports as never })),
    userVerification: 'required',
  });

  const challengeToken = await issueChallengeToken(env, options.challenge, 'auth');
  return json({ options, challengeToken });
};
