// 開発用: 純粋なレンダラ群をシードデータで実行し、実CSSを内包した
// 自己完結プレビューHTMLを生成する（ブラウザで見た目を確認するため）。
// 実行: npx vite-node scripts/preview.ts  → preview-dashboard.html

import { readFileSync, writeFileSync } from 'node:fs';
import { createSeedDoc } from '../src/lib/seed';
import { renderList, renderNext, renderSummary } from '../src/ui/views';
import { renderTimeline, timelineLegend, timelineRangeLabel } from '../src/ui/timeline';

const doc = createSeedDoc();
const today = '2026-06-19';
const css = readFileSync('src/style.css', 'utf8');

const topbar = `
  <header class="topbar">
    <div class="topbar__brand">
      <h1 class="topbar__title">納税スケジュール</h1>
      <p class="topbar__sub">個人事業 / 納付予定の管理</p>
    </div>
    <div class="topbar__actions">
      <span class="save-status">保存しました</span>
      <button type="button" class="btn btn--primary">＋ 追加</button>
      <div class="menu"><button type="button" class="btn btn--ghost">⋯</button></div>
    </div>
  </header>`;

const inner = `
  <div id="app">
    ${topbar}
    <main class="content">
      ${renderNext(doc.items, today)}
      ${renderSummary(doc.items)}
      <section class="panel">
        <h2 class="panel__title">年間スケジュール <span class="panel__range">${timelineRangeLabel(doc.items)}</span></h2>
        ${renderTimeline(doc.items, today)}
        <div class="timeline__legend">${timelineLegend()}</div>
      </section>
      ${renderList(doc.items, today)}
    </main>
    <footer class="footer"><span>最終更新: 2026/6/19 12:00</span></footer>
  </div>`;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>納税スケジュール（プレビュー）</title>
<style>${css}</style>
</head>
<body>${inner}</body>
</html>`;

writeFileSync('preview-dashboard.html', html);
console.log('wrote preview-dashboard.html');
