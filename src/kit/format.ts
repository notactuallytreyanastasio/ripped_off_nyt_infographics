/**
 * Number formatting in house style: true minus signs (U+2212), en-dash
 * ranges, "$4.2 million" short forms. Every formatter throws on NaN or
 * Infinity so a bad number fails at build time instead of printing "NaN".
 */
import { fmtFeet, fmtInt, fmtPct, fmtSignedPct } from '../core/format';

export { fmtFeet, fmtInt, fmtPct, fmtSignedPct };

/** U+2212 MINUS SIGN, the only minus a reader should see. */
export const MINUS = '−';
/** U+2013 EN DASH, for ranges. */
export const EN_DASH = '–';

const cache = new Map<number, Intl.NumberFormat>();
const nf = (digits: number): Intl.NumberFormat => {
  let f = cache.get(digits);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    cache.set(digits, f);
  }
  return f;
};

function assertFinite(n: number, who: string): void {
  if (!Number.isFinite(n)) throw new RangeError(`${who}: expected a finite number, got ${n}`);
}

const trimZeros = (s: string): string => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/**
 * Plain number with thousands separators and a true minus.
 * @example fmtNum(-1234.5, 1) // "−1,234.5"
 */
export function fmtNum(n: number, digits = 0): string {
  assertFinite(n, 'fmtNum');
  const s = nf(digits).format(Math.abs(n));
  const isZero = Number(s.replace(/,/g, '')) === 0;
  return n < 0 && !isZero ? MINUS + s : s;
}

const SCALES = [
  [1e12, 'trillion', 'T'],
  [1e9, 'billion', 'B'],
  [1e6, 'million', 'M'],
  [1e3, 'thousand', 'K'],
] as const;

interface Short { readonly num: string; readonly word: string; readonly abbr: string }

/** Scale `abs` (>= 1000) to the largest fitting word, carrying 999.95 million to 1 billion. */
function shortParts(abs: number, digits: number, minScale: number): Short | null {
  for (let i = 0; i < SCALES.length; i++) {
    const sc = SCALES[i];
    if (!sc || sc[0] < minScale) break;
    if (abs >= sc[0]) {
      const rounded = Number((abs / sc[0]).toFixed(digits));
      const up = SCALES[i - 1];
      if (rounded >= 1000 && up) return { num: trimZeros((abs / up[0]).toFixed(digits)), word: up[1], abbr: up[2] };
      return { num: trimZeros(nf(digits).format(rounded)), word: sc[1], abbr: sc[2] };
    }
  }
  return null;
}

/**
 * Short form for large numbers: "4.2 million", "1.3 billion". Below a
 * million it falls back to {@link fmtNum}. Trailing zeros are dropped.
 * @example fmtShort(4_210_000) // "4.2 million"
 */
export function fmtShort(n: number, digits = 1): string {
  assertFinite(n, 'fmtShort');
  const p = shortParts(Math.abs(n), digits, 1e6);
  if (!p) return fmtNum(n, 0);
  return `${n < 0 ? MINUS : ''}${p.num} ${p.word}`;
}

/** Options for {@link fmtMoney}. */
export interface MoneyOptions {
  /**
   * `auto` (default): "$4.2 million" from a million up, "$850,000" below.
   * `full`: always "$4,200,000". `short`: same as auto. `abbr`: "$4.2M",
   * "$850K", for tick labels only.
   */
  readonly style?: 'auto' | 'full' | 'short' | 'abbr';
  /** Decimal places: in the short part for short/abbr (default 1), in the amount for full (default 0). */
  readonly digits?: number;
}

/**
 * Dollars in house style.
 * @example fmtMoney(4_200_000) // "$4.2 million"
 * @example fmtMoney(-850_000)  // "−$850,000"
 * @example fmtMoney(4_200_000, { style: 'abbr' }) // "$4.2M"
 */
export function fmtMoney(n: number, opts: MoneyOptions = {}): string {
  assertFinite(n, 'fmtMoney');
  const style = opts.style ?? 'auto';
  const sign = n < 0 && fmtNum(n, 2).startsWith(MINUS) ? MINUS : '';
  const abs = Math.abs(n);
  if (style === 'abbr') {
    const p = shortParts(abs, opts.digits ?? 1, 1e3);
    return p ? `${sign}$${p.num}${p.abbr}` : `${sign}$${fmtNum(abs, 0)}`;
  }
  if (style !== 'full') {
    const p = shortParts(abs, opts.digits ?? 1, 1e6);
    if (p) return `${sign}$${p.num} ${p.word}`;
  }
  return `${sign}$${fmtNum(abs, style === 'full' ? (opts.digits ?? 0) : 0)}`;
}

const NO_SPACE = /^[%°′″]/;

/**
 * A number with a unit. No space before %, °, ′ or ″; otherwise one space.
 * The unit is used as given (pass the plural yourself).
 * @example fmtUnit(2.5, 'in.', 1) // "2.5 in."
 * @example fmtUnit(-4, '°F')      // "−4°F"
 */
export function fmtUnit(n: number, unit: string, digits = 0): string {
  const num = fmtNum(n, digits);
  return NO_SPACE.test(unit) ? `${num}${unit}` : `${num} ${unit}`;
}

/** Options for {@link fmtTons}. */
export interface TonOptions {
  readonly digits?: number;
  /** "metric tons" (1,000 kg) instead of US short tons. Say which; they differ by 10%. */
  readonly metric?: boolean;
}

/**
 * Tonnage, singular for exactly one, short form from a million up.
 * @example fmtTons(1) // "1 ton"
 * @example fmtTons(4_200_000, { metric: true }) // "4.2 million metric tons"
 */
export function fmtTons(n: number, opts: TonOptions = {}): string {
  assertFinite(n, 'fmtTons');
  const word = opts.metric ? 'metric ton' : 'ton';
  if (Math.abs(n) >= 1e6) return `${fmtShort(n, opts.digits ?? 1)} ${word}s`;
  const num = fmtNum(n, opts.digits ?? 0);
  return `${num} ${num === '1' ? word : `${word}s`}`;
}

const PARTS = /^([^\d−]*)(−?[\d.,]+)(.*)$/;

/**
 * A range with an en dash, sharing a common unit: "$4–6 million", "40–60%",
 * "1,200–1,500 tons". Ranges that start below zero use "to" so the minus
 * and dash do not collide: "−5 to 5".
 * @param format formatter applied to both ends (default {@link fmtNum})
 */
export function fmtRange(lo: number, hi: number, format: (n: number) => string = (n) => fmtNum(n)): string {
  assertFinite(lo, 'fmtRange');
  assertFinite(hi, 'fmtRange');
  if (lo > hi) throw new RangeError(`fmtRange: lo ${lo} > hi ${hi}`);
  let a = format(lo);
  let b = format(hi);
  if (lo < 0) return `${a} to ${b}`;
  const ma = PARTS.exec(a);
  const mb = PARTS.exec(b);
  if (ma && mb && ma[3] === mb[3]) {
    if (ma[3]) a = `${ma[1] ?? ''}${ma[2] ?? ''}`;
    if (ma[1] && ma[1] === mb[1]) b = `${mb[2] ?? ''}${mb[3] ?? ''}`;
  }
  return `${a}${EN_DASH}${b}`;
}
