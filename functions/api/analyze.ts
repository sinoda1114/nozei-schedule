// Cloudflare Pages Function: /api/analyze
// POST multipart/form-data (field "file": JPG/PNG/MP4)
//   -> 媒体を解析し、納付予定の候補(ProposedItem[])を返す。
//
// 認証: _lib/auth の isAuthorized（セッショントークン）。
// 解析: いまは StubAnalyzer（モック）。キー秘匿のためサーバ側で実行する設計。
//       APIキー(ANALYZER_API_KEY)は後で Pages secret として設定し createAnalyzer で分岐する。

import { createAnalyzer } from '../_lib/analyzer';
import { type AuthEnv, cfAccessEmail, isAuthorized, json } from '../_lib/auth';
import { MAX_MEDIA_BYTES, detectMediaType, validateMedia } from '../../src/analyze/types';

interface AnalyzeEnv extends AuthEnv {
  /** 解析プロバイダ(Gemini)の APIキー。未設定ならスタブ動作。 */
  ANALYZER_API_KEY?: string;
  /** 解析モデル（既定 gemini-3.1-flash-lite）。 */
  ANALYZER_MODEL?: string;
}

interface PagesContext {
  request: Request;
  env: AnalyzeEnv;
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const authenticated = cfAccessEmail(request, env) !== null || (await isAuthorized(request, env));
  if (!authenticated) return json({ error: 'unauthorized' }, 401);

  // multipart 全体をパースする前に Content-Length で粗く弾く（巨大ボディのパース回避）。
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_MEDIA_BYTES + 64 * 1024) {
    return json({ error: 'payload too large' }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'invalid form data' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'file is required' }, 400);

  const v = validateMedia(file.type, file.size);
  if (!v.ok) return json({ error: v.error }, v.status);

  const bytes = await file.arrayBuffer();

  // 申告 MIME を信用せず、先頭バイトの実体と一致するか検証する。
  const sniffed = detectMediaType(new Uint8Array(bytes.slice(0, 16)));
  if (sniffed !== file.type) {
    return json({ error: 'media content does not match its type' }, 415);
  }

  const analyzer = createAnalyzer(env);
  const result = await analyzer.analyze({
    bytes,
    contentType: file.type,
    fileName: file.name,
  });

  return json(result, 200);
};
