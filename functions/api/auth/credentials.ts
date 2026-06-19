// GET /api/auth/credentials  -> 登録済みパスキー一覧（所有者のみ）
// （DELETE は Phase 2 で /api/auth/credentials/[id].ts として追加）

import { type AuthEnv, isAuthorized, json, unauthorized } from '../../_lib/auth';
import { listCredentials } from '../../_lib/passkey';

interface Ctx {
  request: Request;
  env: AuthEnv;
}

export const onRequestGet = async ({ request, env }: Ctx): Promise<Response> => {
  if (!(await isAuthorized(request, env))) return unauthorized();
  const creds = await listCredentials(env);
  return json({
    credentials: creds.map((c) => ({ id: c.id, label: c.label, createdAt: c.createdAt })),
  });
};
