/** Number formatting in newspaper house style. */
const MINUS = '−';
const intFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const fmtInt = (n: number): string => intFmt.format(n);
export const fmtPct = (fraction: number): string => `${Math.round(fraction * 100)}%`;
export const fmtFeet = (n: number): string => `${fmtInt(n)} ft.`;

export function fmtSignedPct(pct: number): string {
  const r = Math.round(pct);
  if (r === 0) return '0%';
  return r > 0 ? `+${r}%` : `${MINUS}${Math.abs(r)}%`;
}
