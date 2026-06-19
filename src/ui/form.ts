// 追加/編集モーダル。Promise で結果(ScheduleItem)または null(キャンセル)を返す。

import { CATEGORY_LABELS, type ScheduleItem, type TaxCategory } from '../types';

const CATEGORY_OPTIONS: TaxCategory[] = ['residence', 'income', 'business', 'other'];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

/** 編集対象 item を渡せば編集、無ければ新規。 */
export function openItemForm(existing?: ScheduleItem): Promise<ScheduleItem | null> {
  return new Promise((resolve) => {
    const isEdit = Boolean(existing);
    const overlay = el('div', { class: 'modal-overlay' });
    const today = new Date().toISOString().slice(0, 10);

    const categoryOptions = CATEGORY_OPTIONS.map(
      (c) =>
        `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${CATEGORY_LABELS[c]}</option>`,
    ).join('');

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" class="modal__title">${isEdit ? '予定を編集' : '予定を追加'}</h2>
        <form class="form" novalidate>
          <label class="field">
            <span class="field__label">税目カテゴリ</span>
            <select name="category" class="field__input">${categoryOptions}</select>
          </label>
          <label class="field">
            <span class="field__label">表示名 <em>*</em></span>
            <input name="label" class="field__input" type="text" required
              placeholder="例: 市民税・県民税 第1期"
              value="${existing ? escapeAttr(existing.label) : ''}" />
          </label>
          <div class="field-row">
            <label class="field">
              <span class="field__label">納付期限 <em>*</em></span>
              <input name="dueDate" class="field__input" type="date" required
                value="${escapeAttr(existing?.dueDate ?? '')}" />
            </label>
            <label class="field field--check">
              <input name="dueApprox" type="checkbox" ${existing?.dueApprox ? 'checked' : ''} />
              <span>「〜月ごろ」表記</span>
            </label>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field__label">金額（円）</span>
              <input name="amount" class="field__input" type="number" min="0" step="1"
                placeholder="未登録は空欄"
                value="${existing?.amount ?? ''}" />
            </label>
            <label class="field field--check">
              <input name="amountApprox" type="checkbox" ${existing?.amountApprox ? 'checked' : ''} />
              <span>「約」概算</span>
            </label>
          </div>
          <div class="field-row">
            <label class="field">
              <span class="field__label">区分</span>
              <select name="status" class="field__input">
                <option value="confirmed" ${existing?.status !== 'estimated' ? 'selected' : ''}>確定</option>
                <option value="estimated" ${existing?.status === 'estimated' ? 'selected' : ''}>予測</option>
              </select>
            </label>
            <label class="field field--check">
              <input name="paid" type="checkbox" ${existing?.paid ? 'checked' : ''} />
              <span>支払済み</span>
            </label>
          </div>
          <label class="field js-paid-date-wrap" ${existing?.paid ? '' : 'hidden'}>
            <span class="field__label">支払日</span>
            <input name="paidDate" class="field__input" type="date"
              value="${escapeAttr(existing?.paidDate ?? today)}" />
          </label>
          <label class="field">
            <span class="field__label">メモ</span>
            <textarea name="note" class="field__input" rows="2"
              placeholder="任意">${existing ? escapeHtmlText(existing.note) : ''}</textarea>
          </label>
          <p class="form__error" hidden></p>
          <div class="form__actions">
            <button type="button" class="btn btn--ghost js-cancel">キャンセル</button>
            <button type="submit" class="btn btn--primary">${isEdit ? '更新' : '追加'}</button>
          </div>
        </form>
      </div>
    `;

    const form = overlay.querySelector('form') as HTMLFormElement;
    const errorEl = overlay.querySelector('.form__error') as HTMLElement;
    const paidCheckbox = form.elements.namedItem('paid') as HTMLInputElement;
    const paidDateWrap = overlay.querySelector('.js-paid-date-wrap') as HTMLElement;

    paidCheckbox.addEventListener('change', () => {
      paidDateWrap.hidden = !paidCheckbox.checked;
    });

    const close = (result: ScheduleItem | null) => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(null);
    };
    document.addEventListener('keydown', onKey);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(null);
    });
    (overlay.querySelector('.js-cancel') as HTMLElement).addEventListener('click', () => close(null));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const label = String(data.get('label') ?? '').trim();
      const dueDate = String(data.get('dueDate') ?? '');
      if (!label) return showError(errorEl, '表示名を入力してください');
      if (!dueDate) return showError(errorEl, '納付期限を入力してください');

      const amountRaw = String(data.get('amount') ?? '').trim();
      let amount: number | null = null;
      if (amountRaw !== '') {
        const n = Number(amountRaw);
        if (!Number.isFinite(n) || n < 0) return showError(errorEl, '金額は0以上の数値で入力してください');
        amount = Math.round(n);
      }

      const paid = data.get('paid') === 'on';
      const item: ScheduleItem = {
        id: existing?.id ?? crypto.randomUUID(),
        dueDate,
        dueApprox: data.get('dueApprox') === 'on',
        category: String(data.get('category') ?? 'other') as TaxCategory,
        label,
        amount,
        amountApprox: data.get('amountApprox') === 'on',
        status: data.get('status') === 'estimated' ? 'estimated' : 'confirmed',
        paid,
        paidDate: paid ? String(data.get('paidDate') ?? today) : null,
        note: String(data.get('note') ?? '').trim(),
      };
      close(item);
    });

    document.body.appendChild(overlay);
    (form.elements.namedItem('label') as HTMLInputElement).focus();
  });
}

function showError(el: HTMLElement, message: string): void {
  el.textContent = message;
  el.hidden = false;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function escapeHtmlText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
