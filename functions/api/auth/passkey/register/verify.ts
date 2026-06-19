// POST /api/auth/passkey/register/verify
// attestation を検証し credential を KV に保存。所有者のみ可。

import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  type AuthEnv,
  b64urlEncode,
  isAuthorized,
  json,
  rpConfig,
  unauthorized,
  verifyChallengeToken,
} from '../../../../_lib/auth';
import { putCredential } from '../../../../_lib/passkey';

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return unauthorized();

  let body: { response?: RegistrationResponseJSON; challengeToken?: string; label?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: 'invalid json' }, 400);
  }
  if (!body.response || !body.challengeToken) return json({ error: 'bad request' }, 400);

  const challenge = await verifyChallengeToken(body.challengeToken, env, 'reg');
  if (!challenge) return json({ error: 'challenge expired' }, 400);

  const { rpID, origin } = rpConfig(request);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch {
    return json({ error: 'verification failed' }, 400);
  }
  if (!verification.verified || !verification.registrationInfo) {
    return json({ error: 'not verified' }, 400);
  }

  const cred = verification.registrationInfo.credential;
  const label =
    typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 40) : '端末';
  await putCredential(env, {
    id: cred.id,
    publicKey: b64urlEncode(cred.publicKey),
    counter: cred.counter,
    transports: cred.transports,
    label,
    createdAt: new Date().toISOString(),
  });

  return json({ ok: true, id: cred.id, label });
};
