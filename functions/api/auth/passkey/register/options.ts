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

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return unauthorized();
  if (!env.SESSION_SECRET) return json({ error: 'server misconfigured' }, 500);

  const { rpID, rpName } = rpConfig(request);

  // excludeCredentials は意図的に渡さない。
  // 他端末の credential ID を渡すと Android の Credential Manager が
  // "An unknown error occurred while talking to the credential manager" を返すため。
  // 重複登録の防止より、複数端末での登録成功を優先する（個人・単一ユーザー前提）。
  // user.id は端末ごとにランダムにする。固定値だと Google パスワードマネージャーが
  // 既存パスキー(別端末)と重複と判定し "unknown error while talking to the credential
  // manager" で作成失敗することがあるため。認証は credential ID で照合し userHandle は
  // 使わないので、ランダム化しても支障はない。
  const userID = crypto.getRandomValues(new Uint8Array(16));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: 'owner',
    userID,
    attestationType: 'none',
    // authenticatorAttachment:'platform' で「この端末の内蔵生体（指紋/Touch ID）」に固定。
    // 未指定だと Android が NFC/USBセキュリティキー等の外付け選択肢を出してしまうため。
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      residentKey: 'preferred',
      userVerification: 'required',
    },
  });

  const challengeToken = await issueChallengeToken(env, options.challenge, 'reg');
  return json({ options, challengeToken });
};
