// 右上の「⋯」メニュー（HeroUI Dropdown）。
// React Aria の Dropdown.Menu onAction で各アクションへ振り分ける。
// （旧実装の手書き hidden 制御＝常時表示バグは Dropdown 化で消滅。）

import { Button, Dropdown, Label } from '@heroui/react';
import { type Key, type ReactNode } from 'react';

export interface AppMenuActions {
  onExport: () => void;
  onImport: () => void;
  onReload: () => void;
  onRegisterPasskey?: () => void;
  onLogout: () => void;
}

export function AppMenu({
  passkeySupported,
  actions,
}: {
  passkeySupported: boolean;
  actions: AppMenuActions;
}): ReactNode {
  const handleAction = (key: Key): void => {
    switch (key) {
      case 'export':
        return actions.onExport();
      case 'import':
        return actions.onImport();
      case 'reload':
        return actions.onReload();
      case 'register':
        return actions.onRegisterPasskey?.();
      case 'logout':
        return actions.onLogout();
    }
  };

  return (
    <Dropdown>
      <Button variant="ghost" aria-label="メニュー" data-testid="menu-btn">
        ⋯
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu onAction={handleAction} aria-label="メニュー">
          <Dropdown.Section>
            <Dropdown.Item id="export" textValue="バックアップを保存（JSON）">
              <Label>バックアップを保存（JSON）</Label>
            </Dropdown.Item>
            <Dropdown.Item id="import" textValue="バックアップから復元（JSON）">
              <Label>バックアップから復元（JSON）</Label>
            </Dropdown.Item>
            <Dropdown.Item id="reload" textValue="サーバーから再読込">
              <Label>サーバーから再読込</Label>
            </Dropdown.Item>
          </Dropdown.Section>
          {passkeySupported ? (
            <Dropdown.Section>
              <Dropdown.Item id="register" textValue="この端末をパスキー登録">
                <Label>この端末をパスキー登録</Label>
              </Dropdown.Item>
            </Dropdown.Section>
          ) : null}
          <Dropdown.Section>
            <Dropdown.Item id="logout" textValue="ログアウト" variant="danger">
              <Label>ログアウト</Label>
            </Dropdown.Item>
          </Dropdown.Section>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
