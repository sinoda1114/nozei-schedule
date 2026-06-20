// ローカル日付の 'YYYY-MM-DD' 文字列。
export function today(): string {
  const d = new Date();
  const z = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
