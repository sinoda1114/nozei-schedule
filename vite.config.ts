import { defineConfig } from 'vitest/config';

// 静的フロントエンドのビルド設定。
// 出力は dist/ に吐き、Cloudflare Pages がこれを配信し、
// functions/ ディレクトリを Pages Functions として自動的に拾う。
export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
  test: {
    // vitest（ユニット/DOM）は src と functions のみ。tests/e2e の Playwright spec は除外。
    include: ['src/**/*.test.ts', 'functions/**/*.test.ts'],
  },
});
