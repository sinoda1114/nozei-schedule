// 納税スケジュールのドメイン型。

/** 区分: 確定 = 通知書等で金額・時期が確定 / 予測 = 見込み */
export type EntryStatus = 'confirmed' | 'estimated';

/** 税目カテゴリ（色分け・集計の単位） */
export type TaxCategory =
  | 'residence'   // 市民税・県民税
  | 'income'      // 所得税予定納税
  | 'business'    // 個人事業税
  | 'property'    // 固定資産税
  | 'vehicle'     // 自動車税
  | 'consumption' // 消費税
  | 'withholding' // 源泉所得税
  | 'other';

export interface ScheduleItem {
  /** 一意ID */
  id: string;
  /** 納付期限 'YYYY-MM-DD'（概算月の場合は月末などを入れ dueApprox=true） */
  dueDate: string;
  /** 「〜月ごろ」のような概算日かどうか */
  dueApprox: boolean;
  /** 税目カテゴリ */
  category: TaxCategory;
  /** 表示名（例: 「市民税・県民税 第1期」） */
  label: string;
  /** 金額（円）。null = 金額未登録 */
  amount: number | null;
  /** 「約」付きの概算金額かどうか */
  amountApprox: boolean;
  /** 区分 確定/予測 */
  status: EntryStatus;
  /** 支払い済みか */
  paid: boolean;
  /** 支払日 'YYYY-MM-DD'（未払いは null） */
  paidDate: string | null;
  /** メモ */
  note: string;
}

/** KV に丸ごと保存する1ドキュメント */
export interface ScheduleDoc {
  version: number;
  updatedAt: string; // ISO8601
  items: ScheduleItem[];
}

export const CATEGORY_LABELS: Record<TaxCategory, string> = {
  residence:   '市民税・県民税',
  income:      '所得税予定納税',
  business:    '個人事業税',
  property:    '固定資産税',
  vehicle:     '自動車税',
  consumption: '消費税',
  withholding: '源泉所得税',
  other:       'その他',
};

export const DOC_VERSION = 1;
