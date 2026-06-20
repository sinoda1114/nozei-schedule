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
  },
});
