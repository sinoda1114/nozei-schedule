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
| デプロイ基盤 | Cloudflare Pages（git 駆動・feature push = Preview / main = Production）※下記要確認 |
| 本番 URL | https://nozei-schedule.pages.dev （独自ドメインがあれば差し替え） |
| タスク正本 | GitHub Issue / Project「Nozei Schedule Tasks」 |

### デプロイ（要確認）
- **想定**: Cloudflare Pages の Git 連携で `main` マージ = Production / feature push = Preview を自動デプロイ。
- **要確認**: Cloudflare ダッシュボードで Git 連携（Production Branch = `main`・Preview 有効）が実際に有効か。
  - 有効なら: **手動デプロイしない**。マージ後に Pages のデプロイ発火を確認する。
  - 未連携なら: `npm run deploy`（= `wrangler pages deploy dist`）の手動デプロイ。その場合は「リリースは1経路・本番を手動で二重化しない」原則だけ守る。

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
