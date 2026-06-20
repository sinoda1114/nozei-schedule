# Nozei Schedule — プロジェクト指示

Nozei Schedule（Cloudflare Pages + Vite + TS）の AI 向けプロジェクト指示。

## 運用ルール（HOW）の正本

このプロジェクトの開発フロー（worktree / PR / 2 段ゲート / デプロイ規律 / GitHub 正本 / Issue・Project タスク管理 / 供給網デフォルト）は、**本リポの `notes/`** を正本とする。
同じ挙動規律は `~/.claude` グローバルにも既定として入っているため、自分の端末の全 PJ に自動適用される。
**ここには挙動の再説明を書かない**（重複・ドリフト防止）。このファイルは**このプロジェクト固有の値だけ**を持つ。

- 開発フロー詳細: `notes/dev-workflow-multiagent.md`
- タスク管理詳細: `notes/task-management-issue-workflow.md`
- 既存 PJ への適用ガイド: `notes/apply-to-existing-project.md`

## このプロジェクト固有の値

| 項目 | 値 |
|---|---|
| リポ実体 dir（統合＋デプロイ専用・ここで機能開発しない） | `~/dev/nozei-schedule` |
| GitHub | `sinoda1114/nozei-schedule` |
| スタック | Cloudflare Pages + Vite + TypeScript + vitest（E2E: Playwright）/ KV |
| デプロイ基盤 | Cloudflare Pages（**Direct Upload・手動 `npm run deploy`**）。git 連携の自動デプロイは無効。下記参照 |
| 本番 URL | https://nozei-schedule.pages.dev （独自ドメインがあれば差し替え） |
| タスク正本 | GitHub Issue / Project「Nozei Schedule Tasks」 |

### デプロイ（実態: Direct Upload / 手動 1 経路）
- **確認済み（2026-06-20）**: Cloudflare Pages は **Direct Upload**。リリースは `npm run deploy`（= `npm run build && wrangler pages deploy dist`）の **手動 1 経路**。GitHub の push / merge では自動デプロイされない（GitHub Actions は CI のみで deploy ステップ無し・`wrangler pages deployment list` の履歴も CLI 由来）。
  - 判断根拠は wrangler / Actions の状態。**最終的な git 連携の有無は Cloudflare ダッシュボードが正本**（画面が見える人が確認する）。
- **手順**: `main` へマージ後、リポ実体 dir で `npm run deploy`（要 `wrangler login`）→ 本番 https://nozei-schedule.pages.dev が新バンドルを配信するか確認する。
- 「**リリースは 1 経路・本番を手動で二重化しない**」原則を守る。将来 git 連携を有効化する場合は、手動デプロイを廃止してどちらか一方に統一する。

## 役割境界（このプロジェクト）

<!-- 担当エージェント/領域を必要に応じて記入する。
| 領域 | 担当 |
|---|---|
| ... | ... |
-->

## dev 規律

- dev サーバ（`npm run dev` = vite）起動中に `dist` / `.wrangler` を消したり本番ビルドを実行しない。dev は 1 つ。
- AI 検証は `npx tsc --noEmit` / `npm run test`（vitest）/ `npm run build` で行う（手動確認をユーザーに丸投げしない）。
- **`.dev.vars` は触らない・中身を出力しない**（Cloudflare のローカル秘密。本番の env / secret は Cloudflare ダッシュボード / `wrangler secret` が正本）。`.dev.vars.example` がテンプレ。
- シークレット（API キー・トークン・KV id）はログ / 出力に出さない。必要なら redact する。
