import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';

// 静的フロントエンドのビルド設定。
// 出力は dist/ に吐き、Cloudflare Pages がこれを配信し、
// functions/ ディレクトリを Pages Functions として自動的に拾う。
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
    include: ['src/**/*.test.{ts,tsx}', 'functions/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text-summary'],
      // ラチェット方式: 実測値（Stmts 77.5 / Branch 79.5 / Funcs 85 / Lines 81.5）の
      // 少し下に設定し、カバレッジの退行だけを CI で止める。向上したら随時引き上げる
      thresholds: {
        statements: 72,
        branches: 75,
        functions: 80,
        lines: 76,
      },
    },
  },
});
