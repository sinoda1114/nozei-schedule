// パスキー認証情報(credential)の KV ストレージ層。
// キー: cred:<credentialID(base64url)> 値: StoredCredential(JSON)

import type { AuthEnv } from './auth';

export interface StoredCredential {
  /** credentialID (base64url) */
  id: string;
  /** 公開鍵 (base64url) */
  publicKey: string;
  /** 署名カウンタ（クローン検出用） */
  counter: number;
  /** authenticator transports ヒント */
  transports?: string[];
  /** ユーザーが付ける端末名（例: MacBook Touch ID） */
  label: string;
  createdAt: string;
}

const PREFIX = 'cred:';

export async function listCredentials(env: AuthEnv): Promise<StoredCredential[]> {
  const list = await env.SCHEDULE_KV.list({ prefix: PREFIX });
  const out: StoredCredential[] = [];
  for (const key of list.keys) {
    const raw = await env.SCHEDULE_KV.get(key.name);
    if (raw) {
      try {
        out.push(JSON.parse(raw) as StoredCredential);
      } catch {
        // 壊れたエントリは無視
      }
    }
  }
  return out;
}

export async function getCredential(env: AuthEnv, id: string): Promise<StoredCredential | null> {
  const raw = await env.SCHEDULE_KV.get(PREFIX + id);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCredential;
  } catch {
    return null;
  }
}

export async function putCredential(env: AuthEnv, cred: StoredCredential): Promise<void> {
  await env.SCHEDULE_KV.put(PREFIX + cred.id, JSON.stringify(cred));
}

export async function deleteCredential(env: AuthEnv, id: string): Promise<void> {
  await env.SCHEDULE_KV.delete(PREFIX + id);
}

export async function countCredentials(env: AuthEnv): Promise<number> {
  const list = await env.SCHEDULE_KV.list({ prefix: PREFIX });
  return list.keys.length;
}
