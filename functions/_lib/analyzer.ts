// 媒体(画像/動画)から納付予定の候補を抽出するアナライザ。
//
// - StubAnalyzer: キー無しのフォールバック（固定モック。テスト/CIで使用）。
// - GeminiAnalyzer: Gemini で画像/動画を解析して候補を抽出（キーは env から、コードに埋めない）。
// createAnalyzer(env) が ANALYZER_API_KEY の有無で両者を切り替える。差し替え点はこのファイルに閉じる。

import { INLINE_MAX_BYTES, type AnalyzeResult, sanitizeProposedList } from '../../src/analyze/types';

export interface MediaInput {
  bytes: ArrayBuffer;
  contentType: string;
  fileName: string;
}

export interface Analyzer {
  analyze(input: MediaInput): Promise<AnalyzeResult>;
}

/** キー無し時のフォールバック。固定のモック候補を返す（テスト/CIで決定的）。 */
export class StubAnalyzer implements Analyzer {
  async analyze(input: MediaInput): Promise<AnalyzeResult> {
    const kind = input.contentType.startsWith('video/') ? '動画' : '画像';
    return {
      items: [
        {
          category: 'residence',
          label: `（${kind}解析サンプル）市民税・県民税 第1期`,
          dueDate: '',
          dueApprox: false,
          amount: null,
          amountApprox: false,
          status: 'estimated',
          note: 'AI解析のスタブ結果です（APIキー未設定）。',
          confidence: 0,
        },
        {
          category: 'income',
          label: `（${kind}解析サンプル）所得税 予定納税 第1期`,
          dueDate: '',
          dueApprox: false,
          amount: null,
          amountApprox: false,
          status: 'estimated',
          note: 'AI解析のスタブ結果です（APIキー未設定）。',
          confidence: 0,
        },
      ],
    };
  }
}

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';

const EXTRACTION_PROMPT = `あなたは日本の税務書類(納付書・通知書・予定納税のお知らせ等)を読み取るアシスタントです。
渡された画像または動画から「納付予定」を抽出し、JSON配列で返してください。各要素は:
- category: "residence"(市県民税) / "income"(所得税・予定納税) / "business"(個人事業税) / "other" のいずれか
- label: 人が読む名称（例「市民税・県民税 第1期」）
- dueDate: 納付期限 "YYYY-MM-DD"。読み取れない場合は空文字 ""
- dueApprox: 期限が「〜月ごろ」等の概算なら true
- amount: 金額(整数,円)。読み取れない場合は null
- amountApprox: 「約」等の概算金額なら true
- status: 通知書等で確定なら "confirmed"、見込みなら "estimated"
- note: 補足（任意・空可）
- confidence: 0〜1 の読み取り確信度
書類に納付予定が無ければ空配列 [] を返す。憶測で値を作らないこと。`;

/** ArrayBuffer を base64 に（Workers/Node の btoa 前提・チャンク分割）。 */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      category: { type: 'STRING', enum: ['residence', 'income', 'business', 'other'] },
      label: { type: 'STRING' },
      dueDate: { type: 'STRING' },
      dueApprox: { type: 'BOOLEAN' },
      amount: { type: 'NUMBER', nullable: true },
      amountApprox: { type: 'BOOLEAN' },
      status: { type: 'STRING', enum: ['confirmed', 'estimated'] },
      note: { type: 'STRING' },
      confidence: { type: 'NUMBER' },
    },
    required: ['category', 'label', 'dueDate', 'status', 'confidence'],
  },
} as const;

/** Gemini generateContent のレスポンスから候補テキスト(JSON)を取り出す（純粋）。 */
export function extractGeminiText(response: unknown): string {
  const r = (response ?? {}) as {
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
  };
  const parts = r.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => (typeof p.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

const GENAI_BASE = 'https://generativelanguage.googleapis.com';

type MediaPart =
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

/** Gemini で画像/動画を解析して候補を返す。キー/モデルは env 由来でコードに埋めない。
 * 小さい画像は inlineData、大きい/動画は File API(アップロード→処理待ち→fileData参照)。 */
export class GeminiAnalyzer implements Analyzer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_GEMINI_MODEL,
  ) {}

  async analyze(input: MediaInput): Promise<AnalyzeResult> {
    const part = await this.buildMediaPart(input);
    const url = `${GENAI_BASE}/v1beta/models/${this.model}:generateContent`;
    const body = {
      contents: [{ parts: [{ text: EXTRACTION_PROMPT }, part] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`gemini error ${res.status}`);
    const text = extractGeminiText(await res.json());
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { items: [] };
    }
    return { items: sanitizeProposedList(parsed) };
  }

  /** inline か File API かを選んで media part を作る。 */
  private async buildMediaPart(input: MediaInput): Promise<MediaPart> {
    const useFileApi =
      input.contentType.startsWith('video/') || input.bytes.byteLength > INLINE_MAX_BYTES;
    if (!useFileApi) {
      return { inlineData: { mimeType: input.contentType, data: toBase64(input.bytes) } };
    }
    const fileUri = await this.uploadViaFileApi(input);
    return { fileData: { mimeType: input.contentType, fileUri } };
  }

  /** Gemini File API へ resumable アップロードし、ACTIVE になった file の uri を返す。 */
  private async uploadViaFileApi(input: MediaInput): Promise<string> {
    const numBytes = input.bytes.byteLength;
    // 1) 開始（メタデータ）→ アップロードURLを得る
    const start = await fetch(`${GENAI_BASE}/upload/v1beta/files`, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(numBytes),
        'X-Goog-Upload-Header-Content-Type': input.contentType,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ file: { display_name: input.fileName || 'upload' } }),
    });
    if (!start.ok) throw new Error(`gemini upload start ${start.status}`);
    const uploadUrl = start.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('gemini upload url missing');

    // 2) バイト本体をアップロード＆finalize
    const up = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'content-length': String(numBytes),
        'X-Goog-Upload-Offset': '0',
        'X-Goog-Upload-Command': 'upload, finalize',
      },
      body: input.bytes,
    });
    if (!up.ok) throw new Error(`gemini upload ${up.status}`);
    const upJson = (await up.json()) as { file?: { uri?: string; name?: string; state?: string } };
    const file = upJson.file;
    if (!file?.uri || !file?.name) throw new Error('gemini file uri missing');

    // 3) 動画は処理待ち（PROCESSING → ACTIVE）。最大 ~45秒。
    let state = file.state;
    for (let i = 0; state === 'PROCESSING' && i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await fetch(`${GENAI_BASE}/v1beta/${file.name}`, {
        headers: { 'x-goog-api-key': this.apiKey },
      });
      if (!st.ok) throw new Error(`gemini file state ${st.status}`);
      state = ((await st.json()) as { state?: string }).state;
    }
    if (state && state !== 'ACTIVE') throw new Error(`gemini file not active: ${state}`);
    return file.uri;
  }
}

/**
 * 環境に応じて Analyzer を選ぶ。
 * ANALYZER_API_KEY があれば Gemini、無ければ Stub（テスト/CIは決定的にスタブ）。
 */
export function createAnalyzer(env: { ANALYZER_API_KEY?: string; ANALYZER_MODEL?: string }): Analyzer {
  if (env.ANALYZER_API_KEY) {
    return new GeminiAnalyzer(env.ANALYZER_API_KEY, env.ANALYZER_MODEL || DEFAULT_GEMINI_MODEL);
  }
  return new StubAnalyzer();
}
