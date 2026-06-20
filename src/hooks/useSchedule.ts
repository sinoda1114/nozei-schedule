// アプリの単一状態とサーバー同期を集約するフック。
// 旧 main.ts の boot / commit / persist / 楽観ロック・認証切れ・競合処理を React 化したもの。

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  AuthError,
  ConflictError,
  RemoteRepository,
  normalizeDoc,
} from '../lib/repository';
import { clearToken, getToken, setToken } from '../lib/token';
import { DOC_VERSION, type ScheduleDoc, type ScheduleItem } from '../types';

export type Phase = 'loading' | 'gate' | 'app' | 'fatal';

const EMPTY_DOC: ScheduleDoc = {
  version: DOC_VERSION,
  updatedAt: new Date(0).toISOString(),
  items: [],
};

export interface ScheduleApi {
  phase: Phase;
  doc: ScheduleDoc;
  saveStatus: string;
  gateMessage: string;
  fatalMessage: string;
  /** サーバーから読み込み直す（初回ブート・再読込・競合後の復帰）。 */
  reload: () => Promise<void>;
  /** items を確定し、即サーバー保存する（楽観ロック付き）。 */
  commit: (items: ScheduleItem[]) => Promise<void>;
  /** 外部JSON取り込み（生データを正規化してから保存）。 */
  importDoc: (incoming: unknown) => Promise<void>;
  /** ログイン成功時：トークン保存→読み込み。 */
  loginSuccess: (token: string) => Promise<void>;
  /** ログアウト：トークン破棄→ゲートへ。 */
  logout: () => void;
}

export function useSchedule(): ScheduleApi {
  const [phase, setPhase] = useState<Phase>('loading');
  const [doc, setDoc] = useState<ScheduleDoc>(EMPTY_DOC);
  const [saveStatus, setSaveStatus] = useState('');
  const [gateMessage, setGateMessage] = useState('');
  const [fatalMessage, setFatalMessage] = useState('');

  // 最後にサーバーが確定した updatedAt（楽観ロックの期待値）。ローカル編集で doc.updatedAt は先走るため別管理。
  const baseUpdatedAt = useRef(EMPTY_DOC.updatedAt);
  const repo = useRef(new RemoteRepository(getToken));
  const statusTimer = useRef<number | undefined>(undefined);

  const flashStatus = useCallback((text: string, clearAfterMs?: number) => {
    setSaveStatus(text);
    if (statusTimer.current) window.clearTimeout(statusTimer.current);
    if (clearAfterMs) {
      statusTimer.current = window.setTimeout(() => setSaveStatus(''), clearAfterMs);
    }
  }, []);

  const reload = useCallback(async () => {
    setPhase('loading');
    try {
      const loaded = await repo.current.load();
      baseUpdatedAt.current = loaded.updatedAt;
      setDoc(loaded);
      setSaveStatus('');
      setPhase('app');
    } catch (err) {
      if (err instanceof AuthError) {
        setPhase('gate');
      } else {
        setFatalMessage(err instanceof Error ? err.message : '不明なエラー');
        setPhase('fatal');
      }
    }
  }, []);

  const persist = useCallback(
    async (current: ScheduleDoc) => {
      flashStatus('保存中…');
      try {
        const confirmed = await repo.current.save(current, baseUpdatedAt.current);
        baseUpdatedAt.current = confirmed;
        setDoc((d) => ({ ...d, updatedAt: confirmed }));
        flashStatus('保存しました', 1800);
      } catch (err) {
        if (err instanceof AuthError) {
          setGateMessage('認証の有効期限が切れました。再度ログインしてください。');
          setPhase('gate');
          return;
        }
        if (err instanceof ConflictError) {
          flashStatus('⚠ 他の端末で更新されました');
          window.alert(
            '他の端末でデータが更新されていたため、この変更は保存できませんでした。\n' +
              '最新の状態を読み込み直します。お手数ですが、もう一度編集してください。',
          );
          await reload();
          return;
        }
        const msg = err instanceof ApiError ? err.message : '保存に失敗しました';
        flashStatus(`⚠ ${msg}`);
      }
    },
    [flashStatus, reload],
  );

  const commit = useCallback(
    async (items: ScheduleItem[]) => {
      const next: ScheduleDoc = {
        version: DOC_VERSION,
        updatedAt: new Date().toISOString(),
        items,
      };
      setDoc(next);
      await persist(next);
    },
    [persist],
  );

  const importDoc = useCallback(
    async (incoming: unknown) => {
      const normalized = normalizeDoc(incoming);
      setDoc(normalized);
      await persist(normalized);
    },
    [persist],
  );

  const loginSuccess = useCallback(
    async (token: string) => {
      setToken(token);
      setGateMessage('');
      await reload();
    },
    [reload],
  );

  const logout = useCallback(() => {
    clearToken();
    setGateMessage('ログアウトしました。再度ログインしてください。');
    setPhase('gate');
  }, []);

  // 初回ブート
  useEffect(() => {
    void reload();
    return () => {
      if (statusTimer.current) window.clearTimeout(statusTimer.current);
    };
  }, [reload]);

  return {
    phase,
    doc,
    saveStatus,
    gateMessage,
    fatalMessage,
    reload,
    commit,
    importDoc,
    loginSuccess,
    logout,
  };
}
