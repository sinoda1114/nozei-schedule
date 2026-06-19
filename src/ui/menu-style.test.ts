import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

// happy-dom は外部CSSを適用しないため、メニューの「常時表示バグ」
// （.menu__panel の display:flex が [hidden] を上書き）は DOM テストでは拾えない。
// ここでは style.css を直接読み、hidden 用の打ち消しルールが存在することを保証する。

const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');

describe('メニュー表示CSSの回帰防止', () => {
  test('.menu__panel は display:flex を持つ（前提）', () => {
    expect(css).toMatch(/\.menu__panel\s*\{[^}]*display:\s*flex/);
  });

  test('.menu__panel[hidden] が display:none を打ち消しとして持つ', () => {
    expect(css).toMatch(/\.menu__panel\[hidden\]\s*\{[^}]*display:\s*none/);
  });
});
