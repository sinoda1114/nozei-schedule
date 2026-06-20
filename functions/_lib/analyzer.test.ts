import { describe, expect, test } from 'vitest';
import { GeminiAnalyzer, StubAnalyzer, createAnalyzer, extractGeminiText } from './analyzer';

describe('extractGeminiText', () => {
  test('candidates[0] の parts.text を連結', () => {
    const res = {
      candidates: [{ content: { parts: [{ text: '[{"a":1}]' }] } }],
    };
    expect(extractGeminiText(res)).toBe('[{"a":1}]');
  });

  test('壊れた応答は空文字', () => {
    expect(extractGeminiText(null)).toBe('');
    expect(extractGeminiText({})).toBe('');
    expect(extractGeminiText({ candidates: [] })).toBe('');
  });
});

describe('createAnalyzer', () => {
  test('キー無しは StubAnalyzer', () => {
    expect(createAnalyzer({})).toBeInstanceOf(StubAnalyzer);
  });

  test('キーありは GeminiAnalyzer', () => {
    expect(createAnalyzer({ ANALYZER_API_KEY: 'x' })).toBeInstanceOf(GeminiAnalyzer);
  });
});

describe('StubAnalyzer', () => {
  test('画像なら画像サンプル候補を返す', async () => {
    const r = await new StubAnalyzer().analyze({
      bytes: new ArrayBuffer(1),
      contentType: 'image/png',
      fileName: 'a.png',
    });
    expect(r.items.length).toBeGreaterThanOrEqual(1);
    expect(r.items[0].label).toContain('画像');
  });

  test('動画なら動画サンプル候補を返す', async () => {
    const r = await new StubAnalyzer().analyze({
      bytes: new ArrayBuffer(1),
      contentType: 'video/mp4',
      fileName: 'a.mp4',
    });
    expect(r.items[0].label).toContain('動画');
  });
});
