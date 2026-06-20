// 解析候補の確認モーダル。チェックした候補だけを取り込む（誤抽出を弾く）。
// 個別の細かな編集は取り込み後に既存の「編集」モーダルで行う想定（側ではチェック取捨のみ）。

import { Button, Checkbox, Chip, Modal } from '@heroui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { type ProposedItem } from '../analyze/types';
import { formatDate, formatYen } from '../lib/format';
import { CATEGORY_LABELS } from '../types';

export function AnalyzeReviewModal({
  isOpen,
  items,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  items: readonly ProposedItem[];
  onConfirm: (selected: ProposedItem[]) => void;
  onClose: () => void;
}): ReactNode {
  const [selected, setSelected] = useState<boolean[]>([]);

  useEffect(() => {
    if (isOpen) setSelected(items.map(() => true));
  }, [isOpen, items]);

  const toggle = (i: number): void =>
    setSelected((s) => s.map((v, idx) => (idx === i ? !v : v)));

  const selectedCount = selected.filter(Boolean).length;

  const handleConfirm = (): void => {
    onConfirm(items.filter((_, i) => selected[i]));
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[520px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>解析結果の確認</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {items.length === 0 ? (
              <p className="m-0 text-sm text-muted">候補が見つかりませんでした。</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border p-3"
                    data-testid="analyze-candidate"
                  >
                    <Checkbox
                      isSelected={selected[i] ?? false}
                      onChange={() => toggle(i)}
                      aria-label={`「${p.label}」を取り込む`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 truncate font-bold">{p.label}</p>
                      <p className="m-0 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                        <span>{CATEGORY_LABELS[p.category]}</span>
                        <span>{p.dueDate ? formatDate(p.dueDate, p.dueApprox) : '期限未取得'}</span>
                        <span className="font-semibold tabular-nums">
                          {formatYen(p.amount, p.amountApprox)}
                        </span>
                        <Chip
                          color={p.status === 'confirmed' ? 'accent' : 'warning'}
                          variant="soft"
                          size="sm"
                        >
                          {p.status === 'confirmed' ? '確定' : '予測'}
                        </Chip>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onPress={onClose}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="primary"
              isDisabled={selectedCount === 0}
              onPress={handleConfirm}
              data-testid="analyze-confirm"
            >
              {selectedCount}件を取り込む
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
