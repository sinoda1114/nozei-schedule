// 保存層の抽象。UI はこのインターフェースにのみ依存するので、
// 将来 KV から別バックエンド(Turso 等)へ差し替えても UI は無変更で済む。

import { DOC_VERSION, type ScheduleDoc } from '../types';

export interface ScheduleRepository {
  load(): Promise<ScheduleDoc>;
  save(doc: ScheduleDoc): Promise<void>;
}

/** 認証エラー（パスフレーズ不正/未設定）。UI はこれを見て再入力を促す。 */
export class AuthError extends Error {
  constructor(message = '認証に失敗しました') {
    super(message);
    this.name = 'AuthError';
  }
}

/** 通信・サーバーエラー */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const ENDPOINT = '/api/schedule';

/** Cloudflare Pages Functions (/api/schedule) 経由で KV に読み書きする実装。 */
export class RemoteRepository implements ScheduleRepository {
  constructor(private readonly getToken: () => string | null) {}

  private authHeader(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async load(): Promise<ScheduleDoc> {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, { headers: { ...this.authHeader() } });
    } catch {
      throw new ApiError('サーバーに接続できませんでした');
    }
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new ApiError(`読み込みに失敗しました (${res.status})`);
    const json = (await res.json()) as unknown;
    return normalizeDoc(json);
  }

  async save(doc: ScheduleDoc): Promise<void> {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...this.authHeader() },
        body: JSON.stringify(doc),
      });
    } catch {
      throw new ApiError('サーバーに接続できませんでした');
    }
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new ApiError(`保存に失敗しました (${res.status})`);
  }
}

/** 受け取った JSON を ScheduleDoc 形に正規化（外部データは信用しない）。 */
export function normalizeDoc(input: unknown): ScheduleDoc {
  const obj = (input ?? {}) as Record<string, unknown>;
  const rawItems = Array.isArray(obj.items) ? obj.items : [];
  return {
    version: typeof obj.version === 'number' ? obj.version : DOC_VERSION,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date(0).toISOString(),
    items: rawItems.map(normalizeItem),
  };
}

function normalizeItem(input: unknown): ScheduleDoc['items'][number] {
  const o = (input ?? {}) as Record<string, unknown>;
  const category = o.category;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
    dueDate: typeof o.dueDate === 'string' ? o.dueDate : '',
    dueApprox: o.dueApprox === true,
    category:
      category === 'residence' || category === 'income' || category === 'business'
        ? category
        : 'other',
    label: typeof o.label === 'string' ? o.label : '',
    amount: typeof o.amount === 'number' && Number.isFinite(o.amount) ? o.amount : null,
    amountApprox: o.amountApprox === true,
    status: o.status === 'estimated' ? 'estimated' : 'confirmed',
    paid: o.paid === true,
    paidDate: typeof o.paidDate === 'string' ? o.paidDate : null,
    note: typeof o.note === 'string' ? o.note : '',
  };
}
