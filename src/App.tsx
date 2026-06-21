// アプリのオーケストレーター。phase に応じて Gate / 本体 / エラー / 読込中 を出し分け、
// ミューテーション・パスキー儀式・インポート/エクスポートを配線する。

import { Button, Spinner, useTheme } from '@heroui/react';
import { useRef, useState, type ReactNode } from 'react';
import { analyzeFile } from './analyze/analyzeClient';
import { proposedToItem, type ProposedItem } from './analyze/types';
import {
  loginWithPasskey,
  loginWithPassphrase,
  passkeySupported,
  registerThisDevice,
} from './auth/passkeyClient';
import { useSchedule } from './hooks/useSchedule';
import { createSeedDoc } from './lib/seed';
import { today } from './lib/today';
import { getToken } from './lib/token';
import { type ScheduleItem } from './types';
import { AnalyzeReviewModal } from './ui/AnalyzeReviewModal';
import { AppMenu } from './ui/AppMenu';
import { Gate } from './ui/Gate';
import { MediaDropZone } from './ui/MediaDropZone';
import { ItemFormModal } from './ui/ItemFormModal';
import { NextPayment } from './ui/NextPayment';
import { ScheduleList } from './ui/ScheduleList';
import { Summary } from './ui/Summary';
import { Timeline, TimelineLegend, timelineRangeLabel } from './ui/Timeline';

function defaultDeviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  return '端末';
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()) || d.getTime() === 0) return '—';
  return d.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
}

export function App(): ReactNode {
  useTheme('system'); // OS 設定に追従（.dark クラスを自動適用）
  const sched = useSchedule();
  const { doc } = sched;

  const [modal, setModal] = useState<{ open: boolean; editing?: ScheduleItem }>({ open: false });
  const [analyze, setAnalyze] = useState<{ open: boolean; items: ProposedItem[] }>({
    open: false,
    items: [],
  });
  const [notice, setNotice] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const passkeyBusy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const t = today();

  // ---- ミューテーション ----
  const onTogglePaid = (id: string, paid: boolean): void => {
    void sched.commit(
      doc.items.map((i) =>
        i.id === id ? { ...i, paid, paidDate: paid ? (i.paidDate ?? t) : null } : i,
      ),
    );
  };

  const onDelete = (id: string): void => {
    const target = doc.items.find((i) => i.id === id);
    if (!target) return;
    if (!window.confirm(`「${target.label}」を削除しますか？`)) return;
    void sched.commit(doc.items.filter((i) => i.id !== id));
  };

  const onEdit = (id: string): void => {
    const target = doc.items.find((i) => i.id === id);
    if (target) setModal({ open: true, editing: target });
  };

  const onAdd = (): void => setModal({ open: true, editing: undefined });

  const onModalSubmit = (item: ScheduleItem): void => {
    const editing = modal.editing;
    const next = editing
      ? doc.items.map((i) => (i.id === editing.id ? item : i))
      : [...doc.items, item];
    setModal({ open: false });
    void sched.commit(next);
  };

  const onLoadSeed = (): void => {
    void sched.commit(createSeedDoc().items);
  };

  // ---- インポート / エクスポート ----
  const onExport = (): void => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nozei-schedule-${t}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { items?: unknown };
      if (!Array.isArray(parsed.items)) throw new Error('items 配列がありません');
      if (!window.confirm('現在のデータを読み込んだ内容で置き換えます。よろしいですか？')) return;
      await sched.importDoc(parsed);
    } catch (err) {
      setNotice(`⚠ 読み込み失敗: ${err instanceof Error ? err.message : ''}`);
    }
  };

  // ---- 画像/動画から取り込み ----
  const runAnalyze = async (file: File): Promise<void> => {
    const token = getToken();
    if (!token) {
      setNotice('再ログインしてください。');
      return;
    }
    if (analyzing) return;
    setAnalyzing(true);
    setNotice('解析中…');
    try {
      const items = await analyzeFile(token, file);
      setNotice('');
      setAnalyze({ open: true, items });
    } catch (err) {
      setNotice('');
      window.alert(`解析に失敗しました\n${err instanceof Error ? err.message : ''}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const onAnalyzeConfirm = (selected: ProposedItem[]): void => {
    setAnalyze({ open: false, items: [] });
    if (selected.length === 0) return;
    void sched.commit([...doc.items, ...selected.map(proposedToItem)]);
  };

  // ---- パスキー ----
  const onPasskeyLogin = async (): Promise<void> => {
    const token = await loginWithPasskey();
    await sched.loginSuccess(token);
  };

  const onRecoveryLogin = async (code: string): Promise<void> => {
    const token = await loginWithPassphrase(code);
    await sched.loginSuccess(token);
  };

  const onRegisterPasskey = async (): Promise<void> => {
    const token = getToken();
    if (!token) return;
    if (passkeyBusy.current) return;
    passkeyBusy.current = true;
    setNotice('パスキー登録中…');
    try {
      await registerThisDevice(token, defaultDeviceLabel());
      setNotice('パスキーを登録しました');
      window.setTimeout(() => setNotice(''), 2500);
    } catch (err) {
      setNotice('');
      window.alert(`パスキー登録に失敗しました\n${err instanceof Error ? err.message : ''}`);
    } finally {
      passkeyBusy.current = false;
    }
  };

  // ---- 画面分岐 ----
  if (sched.phase === 'loading') {
    return (
      <div className="grid min-h-[60vh] place-items-center text-muted">
        <Spinner />
      </div>
    );
  }

  if (sched.phase === 'gate') {
    return (
      <Gate
        message={sched.gateMessage}
        passkeySupported={passkeySupported()}
        onPasskeyLogin={onPasskeyLogin}
        onRecoveryLogin={onRecoveryLogin}
      />
    );
  }

  if (sched.phase === 'fatal') {
    return (
      <main className="grid min-h-[80vh] place-items-center p-4">
        <div className="w-[min(380px,90vw)] rounded-2xl border border-border bg-surface p-8 text-center shadow-md">
          <h1 className="m-0 mb-2 text-2xl font-extrabold">接続エラー</h1>
          <p className="mb-4 text-sm text-[var(--overdue)]">{sched.fatalMessage}</p>
          <Button variant="primary" onPress={() => void sched.reload()}>
            再試行
          </Button>
        </div>
      </main>
    );
  }

  const status = sched.saveStatus || notice;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4" data-testid="topbar">
        <div>
          <h1 className="m-0 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-3xl">
            納税スケジュール
          </h1>
          <p className="m-0 mt-0.5 text-xs font-medium uppercase tracking-widest text-muted">
            個人事業 / 納付予定の管理
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="min-w-[4.5rem] text-right text-xs text-muted"
            aria-live="polite"
            data-testid="save-status"
          >
            {status}
          </span>
          <Button variant="primary" onPress={onAdd} data-testid="add-btn">
            ＋ 追加
          </Button>
          <AppMenu
            passkeySupported={passkeySupported()}
            actions={{
              onExport,
              onImport: () => fileInput.current?.click(),
              onReload: () => void sched.reload(),
              onRegisterPasskey: passkeySupported() ? () => void onRegisterPasskey() : undefined,
              onLogout: sched.logout,
            }}
          />
        </div>
      </header>

      <main className="flex flex-col">
        <NextPayment items={doc.items} today={t} />
        <Summary items={doc.items} />
        {doc.items.length > 0 && (
          <section className="mb-6 rounded-2xl bg-surface p-4 shadow-none ring-1 ring-inset ring-border sm:p-5">
            <h2 className="m-0 mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted">
              年間スケジュール
              <span className="ml-2 font-medium normal-case tracking-normal text-muted/80">
                {timelineRangeLabel(doc.items)}
              </span>
            </h2>
            <Timeline items={doc.items} today={t} />
            <TimelineLegend />
          </section>
        )}
        <MediaDropZone onFile={(f) => void runAnalyze(f)} busy={analyzing} />
        <ScheduleList
          items={doc.items}
          today={t}
          onTogglePaid={onTogglePaid}
          onEdit={onEdit}
          onDelete={onDelete}
          onLoadSeed={onLoadSeed}
        />
      </main>

      <footer className="mt-8 border-t border-border pt-4 text-center text-xs text-muted">
        最終更新: {formatUpdatedAt(doc.updatedAt)}
      </footer>

      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => void onImportFile(e)}
      />

      <ItemFormModal
        isOpen={modal.open}
        existing={modal.editing}
        onSubmit={onModalSubmit}
        onClose={() => setModal({ open: false })}
      />

      <AnalyzeReviewModal
        isOpen={analyze.open}
        items={analyze.items}
        onConfirm={onAnalyzeConfirm}
        onClose={() => setAnalyze({ open: false, items: [] })}
      />
    </>
  );
}
