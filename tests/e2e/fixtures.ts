// E2E 用の固定値。playwright.config.ts が webServer の --binding でアプリへ渡し、
// 各 spec がログインに使う。両者がここを共有することで、
// 「spec のハードコード値とサーバ側の設定が食い違う」事故を構造的に防ぐ。
//
// 秘密情報ではない。本番の APP_PASSPHRASE は Pages secret が正本で、
// ここの値は localhost の使い捨てサーバにしか渡らない。

// playwright.config.ts が webServer のコマンド行へそのまま埋め込むため、
// 空白・引用符・シェルのメタ文字を含めないこと。
export const E2E_PASSPHRASE = 'test-pass-1234567890';
