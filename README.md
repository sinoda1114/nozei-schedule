# 納税スケジュール (nozei-schedule)

個人事業の納税予定（市民税・県民税 / 所得税予定納税 / 個人事業税 など）を
管理する小さな Web アプリ。複数デバイスから同じデータを見られるよう、
データは Cloudflare KV に保存する。

- フロント: Vite + React 19 + TypeScript / UI は HeroUI v3（Tailwind CSS v4）
- API: Cloudflare Pages Functions (`functions/api/schedule.ts`)
- 保存: Cloudflare KV（スケジュール全体を1個のJSONドキュメントで保持）
- 認証: 本番は Cloudflare Access（Zero Trust）をホスト名全体に適用済み。
  アプリ層はさらにパスキー(WebAuthn/FIDO2) を主、リカバリコード（旧称パスフレーズ）を保険に、
  二重で認証する。ログイン成功で HMAC 署名セッショントークンを発行し `Authorization: Bearer` で送る。
  `functions/_lib/auth.ts` の `cfAccessEmail()` は Cloudflare Access が付与する
  `CF-Access-Authenticated-User-Email` ヘッダーを読むが、JWT (`Cf-Access-Jwt-Assertion`) の
  署名検証は未実装（Cloudflare Access がホスト名を経由しない到達経路を許さない前提に依存している）。

## 機能

- 納付予定の追加 / 編集 / 削除
- 支払済みチェック、期限超過のハイライト、「次の納付」表示
- 年間合計 / 確定分 / 予測分 / 残り（未払い）の集計
- 税目カテゴリの色分け、概算（「約」「〜月ごろ」）表記
- JSON 書き出し / 読み込み（バックアップ・端末移行用）

## アーキテクチャ方針

保存層は `ScheduleRepository` インターフェース（`src/lib/repository.ts`）で
抽象化している。今は KV を叩く `RemoteRepository` 実装のみだが、将来 Turso 等へ
移行する場合も実装を1つ足して差し替えるだけで UI は無変更で済む。

## ローカル開発

```bash
npm install

# 1) UIだけ素早く確認（APIは動かない。認証ゲートが出る）
npm run dev

# 2) フルスタック（API + KV エミュレート）で確認
cp .dev.vars.example .dev.vars   # APP_PASSPHRASE を好きな値に
npm run preview                  # build して wrangler pages dev で起動
```

`npm run preview` は `wrangler pages dev` を使うため、ローカルでも KV と
Functions が動く。ブラウザでパスフレーズ（`.dev.vars` の値）を入力して接続する。

### テスト

純粋ロジック（集計・フォーマット）は vitest でテストしている。

```bash
npm test
```

## Cloudflare へのデプロイ

前提: Cloudflare アカウントと `wrangler`（`npm i -g wrangler` 済み、または `npx wrangler`）。

```bash
# 0) ログイン
wrangler login

# 1) KV 名前空間を作成し、出力された id を wrangler.toml の
#    [[kv_namespaces]] の id に貼り付ける
wrangler kv namespace create SCHEDULE_KV

# 2) 認証パスフレーズを Secret として登録（本番用に十分長いランダム値を）
wrangler pages secret put APP_PASSPHRASE

# 3) 初回のみ手動デプロイ（プロジェクト作成のため）
npm run deploy
```

> **通常のデプロイは自動**: main へのマージで `.github/workflows/deploy.yml` が
> 「標準CI → Cloudflare Pages デプロイ → 疎通確認」を自動実行する
> （[ci-standard の CD標準](https://github.com/sinoda1114/ci-standard/blob/main/docs/CD.md)）。
> ローカルでの `npm run deploy` 手動実行は原則廃止。緊急再デプロイは
> Actions タブ → Deploy → Run workflow（main のみ有効）。
> ロールバックは `npx wrangler pages deployment rollback`。

## データとバックアップ

- 実データは KV のキー `schedule:doc` に1個のJSONとして入る。
- アプリの「⋯」メニューから JSON エクスポート/インポートが可能。
  端末移行や手動バックアップに使える。
- 初回など空のときは「サンプルを読み込む」で初期予定（`src/lib/seed.ts`）を投入できる。

## セキュリティ注意

- アクセス制御は Cloudflare Access（ホスト名全体）+ アプリ層のパスキー/パスフレーズの二重。
  パスフレーズは十分長いランダム値にし、漏れたら `wrangler pages secret put APP_PASSPHRASE` で更新する。
- ブラウザ側はパスフレーズを `localStorage` に保持する（共有PCでは「パスフレーズを変更」で消去）。
- 機密度の高い個人情報（口座番号など）は登録しない想定。金額と予定の管理に留める。
