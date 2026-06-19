// POST /api/auth/passkey/login/verify
// assertion を検証し、成功でセッショントークンを発行。

import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import {
  type AuthEnv,
  b64urlDecode,
  issueSession,
  json,
  rpConfig,
  unauthorized,
  verifyChallengeToken,
} from '../../../../_lib/auth';
import { getCredential, putCredential } from '../../../../_lib/passkey';

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.SESSION_SECRET) return json({ error: 'server misconfigured' }, 500);

  let body: { response?: AuthenticationResponseJSON; challengeToken?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!body.response || !body.challengeToken) return json({ error: 'bad request' }, 400);

  const challenge = await verifyChallengeToken(body.challengeToken, env, 'auth');
  if (!challenge) return json({ error: 'challenge expired' }, 400);

  // 認証失敗は credential の存在を漏らさないよう一律 401 unauthorized に統一する
  const stored = await getCredential(env, body.response.id);
  if (!stored) return unauthorized();

  const { rpID, origin } = rpConfig(request);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.id,
        publicKey: b64urlDecode(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports as never,
      },
    });
  } catch {
    return unauthorized();
  }
  if (!verification.verified) return unauthorized();

  // 署名カウンタを更新（リプレイ/クローン検出のため）
  stored.counter = verification.authenticationInfo.newCounter;
  await putCredential(env, stored);

  const sessionToken = await issueSession(env);
  return json({ sessionToken });
};
