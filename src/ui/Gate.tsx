// ログインゲート（パスキー / リカバリコード）。
import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { useState, type FormEvent, type ReactNode } from 'react';

export function Gate({
  message,
  passkeySupported,
  onPasskeyLogin,
  onRecoveryLogin,
}: {
  message?: string;
  passkeySupported: boolean;
  onPasskeyLogin: () => Promise<void>;
  onRecoveryLogin: (code: string) => Promise<void>;
}): ReactNode {
  const [code, setCode] = useState('');
  const [error, setError] = useState(message ?? '');
  const [busy, setBusy] = useState(false);

  const handlePasskey = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onPasskeyLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスキーでのログインに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleRecovery = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    setError('');
    try {
      await onRecoveryLogin(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[80vh] place-items-center p-4">
      <Card className="w-[min(380px,90vw)] p-8 text-center">
        <h1 className="m-0 mb-1 text-2xl font-extrabold">納税スケジュール</h1>
        <p className="m-0 mb-5 text-sm text-muted">ログイン方法を選んでください。</p>

        {passkeySupported && (
          <>
            <Button
              variant="primary"
              fullWidth
              isDisabled={busy}
              onPress={handlePasskey}
              data-testid="passkey-login"
            >
              パスキーでログイン
            </Button>
            <p className="my-3 text-xs text-muted">または</p>
          </>
        )}

        <form className="flex flex-col gap-2.5" onSubmit={handleRecovery} data-testid="gate-form">
          <TextField type="password" value={code} onChange={setCode} isRequired>
            <Label className="sr-only">リカバリコード</Label>
            <Input
              name="pass"
              placeholder="リカバリコード"
              autoComplete="current-password"
              data-testid="recovery-input"
            />
          </TextField>
          <Button type="submit" variant="ghost" isDisabled={busy} data-testid="recovery-submit">
            リカバリコードでログイン
          </Button>
        </form>

        {error && (
          <p className="m-0 mt-3 text-sm text-[var(--overdue)]" data-testid="gate-error">
            {error}
          </p>
        )}
      </Card>
    </main>
  );
}
