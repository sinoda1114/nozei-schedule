// 解析エンドポイント /api/analyze のフロント側クライアント。
// 失敗時は日本語メッセージの Error を投げる。

import { type ProposedItem } from './types';

export async function analyzeFile(token: string, file: File): Promise<ProposedItem[]> {
  const form = new FormData();
  form.append('file', file);

  let res: Response;
  try {
    res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    throw new Error('サーバーに接続できませんでした');
  }

  if (res.status === 401) throw new Error('認証の有効期限が切れました。再度ログインしてください。');
  if (res.status === 415) throw new Error('対応していない形式です（JPG / PNG / MP4 のみ）');
  if (res.status === 413) throw new Error('ファイルが大きすぎます');
  if (!res.ok) throw new Error('解析に失敗しました');

  const data = (await res.json().catch(() => ({}))) as { items?: ProposedItem[] };
  return Array.isArray(data.items) ? data.items : [];
}
