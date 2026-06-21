// トップに置く省スペースの取り込み枠（クリック選択＋ドラッグ&ドロップ）。
// 受け付けたファイルは onFile に渡すだけ（解析・確認は App 側）。

import { useRef, useState, type ReactNode } from 'react';

const ACCEPT = 'image/jpeg,image/png,video/mp4';

export function MediaDropZone({
  onFile,
  busy = false,
}: {
  onFile: (file: File) => void;
  busy?: boolean;
}): ReactNode {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const pick = (): void => {
    if (!busy) inputRef.current?.click();
  };
  const take = (files: FileList | null): void => {
    const f = files?.[0];
    if (f && !busy) onFile(f);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="画像・動画から納付予定を取り込み"
      data-testid="media-dropzone"
      onClick={pick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        take(e.dataTransfer.files);
      }}
      className={`mb-8 flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3.5 text-sm transition-colors ${
        dragOver
          ? 'border-accent bg-accent-soft text-foreground'
          : 'border-accent/65 bg-accent/[0.07] text-foreground/70 hover:border-accent hover:bg-accent/[0.12] hover:text-foreground'
      } ${busy ? 'pointer-events-none opacity-60' : ''}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M12 3v13" />
        <path d="m7 8 5-5 5 5" />
      </svg>
      <span>
        {busy
          ? '解析中…'
          : '納付書の画像・動画をドラッグ＆ドロップ、またはクリックで取り込み'}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        data-testid="media-input"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
