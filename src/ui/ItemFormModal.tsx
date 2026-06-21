// 追加/編集モーダル（HeroUI Modal + React Aria フォーム部品）。
// isOpen で開閉、確定時に onSubmit(item)、キャンセル/外側クリックで onClose。

import {
  Button,
  Calendar,
  Checkbox,
  DateField,
  DatePicker,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextArea,
  TextField,
} from '@heroui/react';
import { parseDate } from '@internationalized/date';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { today as todayStr } from '../lib/today';
import { CATEGORY_LABELS, type ScheduleItem, type TaxCategory } from '../types';

const CATEGORY_OPTIONS: TaxCategory[] = [
  'residence', 'income', 'business', 'property', 'vehicle', 'consumption', 'withholding', 'other',
];

interface FormState {
  category: TaxCategory;
  label: string;
  dueDate: string;
  dueApprox: boolean;
  amount: string;
  amountApprox: boolean;
  status: 'confirmed' | 'estimated';
  paid: boolean;
  paidDate: string;
  note: string;
}

function initialState(existing?: ScheduleItem): FormState {
  return {
    category: existing?.category ?? 'other',
    label: existing?.label ?? '',
    dueDate: existing?.dueDate ?? '',
    dueApprox: existing?.dueApprox ?? false,
    amount: existing?.amount != null ? String(existing.amount) : '',
    amountApprox: existing?.amountApprox ?? false,
    status: existing?.status === 'estimated' ? 'estimated' : 'confirmed',
    paid: existing?.paid ?? false,
    paidDate: existing?.paidDate ?? todayStr(),
    note: existing?.note ?? '',
  };
}

function safeParseDate(str: string) {
  if (!str) return null;
  try { return parseDate(str); } catch { return null; }
}

function DateCalendarPopover() {
  return (
    <DatePicker.Popover>
      <Calendar>
        <Calendar.Header>
          <Calendar.NavButton slot="previous" />
          <Calendar.Heading />
          <Calendar.NavButton slot="next" />
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day: string) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(date) => (
              <Calendar.Cell date={date}>
                <Calendar.CellIndicator />
              </Calendar.Cell>
            )}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
    </DatePicker.Popover>
  );
}

export function ItemFormModal({
  isOpen,
  existing,
  onSubmit,
  onClose,
}: {
  isOpen: boolean;
  existing?: ScheduleItem;
  onSubmit: (item: ScheduleItem) => void;
  onClose: () => void;
}): ReactNode {
  const isEdit = Boolean(existing);
  const [form, setForm] = useState<FormState>(() => initialState(existing));
  const [error, setError] = useState('');

  // 開くたび／対象が変わるたびにフォームを初期化する。
  useEffect(() => {
    if (isOpen) {
      setForm(initialState(existing));
      setError('');
    }
  }, [isOpen, existing]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = (e: FormEvent): void => {
    e.preventDefault();
    const label = form.label.trim();
    const dueDate = form.dueDate;
    if (!label) return setError('表示名を入力してください');
    if (!dueDate) return setError('納付期限を入力してください');

    let amount: number | null = null;
    const amountRaw = form.amount.trim();
    if (amountRaw !== '') {
      const n = Number(amountRaw);
      if (!Number.isFinite(n) || n < 0) return setError('金額は0以上の数値で入力してください');
      amount = Math.round(n);
    }

    const item: ScheduleItem = {
      id: existing?.id ?? crypto.randomUUID(),
      dueDate,
      dueApprox: form.dueApprox,
      category: form.category,
      label,
      amount,
      amountApprox: form.amountApprox,
      status: form.status,
      paid: form.paid,
      paidDate: form.paid ? form.paidDate || todayStr() : null,
      note: form.note.trim(),
    };
    onSubmit(item);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[460px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{isEdit ? '予定を編集' : '予定を追加'}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
              <Select
                selectedKey={form.category}
                onSelectionChange={(k) => set('category', k as TaxCategory)}
              >
                <Label>税目カテゴリ</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {CATEGORY_OPTIONS.map((c) => (
                      <ListBox.Item key={c} id={c} textValue={CATEGORY_LABELS[c]}>
                        {CATEGORY_LABELS[c]}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <TextField value={form.label} onChange={(v) => set('label', v)} isRequired>
                <Label>表示名 *</Label>
                <Input name="label" placeholder="例: 市民税・県民税 第1期" />
              </TextField>

              <div className="grid grid-cols-[1fr_auto] items-end gap-3.5">
                <DatePicker
                  value={safeParseDate(form.dueDate)}
                  onChange={(v) => set('dueDate', v?.toString() ?? '')}
                  isRequired
                >
                  <Label>納付期限 *</Label>
                  <DatePicker.Trigger>
                    <DateField />
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                  <DateCalendarPopover />
                </DatePicker>
                <Checkbox isSelected={form.dueApprox} onChange={(v) => set('dueApprox', v)}>
                  「〜月ごろ」表記
                </Checkbox>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-end gap-3.5">
                <TextField type="number" value={form.amount} onChange={(v) => set('amount', v)}>
                  <Label>金額（円）</Label>
                  <Input name="amount" placeholder="未登録は空欄" inputMode="numeric" />
                </TextField>
                <Checkbox isSelected={form.amountApprox} onChange={(v) => set('amountApprox', v)}>
                  「約」概算
                </Checkbox>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-end gap-3.5">
                <Select
                  selectedKey={form.status}
                  onSelectionChange={(k) => set('status', k as FormState['status'])}
                >
                  <Label>区分</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="confirmed" textValue="確定">
                        確定
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="estimated" textValue="予測">
                        予測
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Checkbox isSelected={form.paid} onChange={(v) => set('paid', v)}>
                  支払済み
                </Checkbox>
              </div>

              {form.paid && (
                <DatePicker
                  value={safeParseDate(form.paidDate)}
                  onChange={(v) => set('paidDate', v?.toString() ?? '')}
                >
                  <Label>支払日</Label>
                  <DatePicker.Trigger>
                    <DateField />
                    <DatePicker.TriggerIndicator />
                  </DatePicker.Trigger>
                  <DateCalendarPopover />
                </DatePicker>
              )}

              <TextField value={form.note} onChange={(v) => set('note', v)}>
                <Label>メモ</Label>
                <TextArea name="note" rows={2} placeholder="任意" />
              </TextField>

              {error && <p className="m-0 text-sm text-[var(--overdue)]">{error}</p>}

              <div className="mt-1 flex justify-end gap-2.5">
                <Button type="button" variant="secondary" onPress={onClose}>
                  キャンセル
                </Button>
                <Button type="submit" variant="primary">
                  {isEdit ? '更新' : '追加'}
                </Button>
              </div>
            </form>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
