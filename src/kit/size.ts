/**
 * Responsive type and margins. Graphics draw in real CSS pixels (no viewBox
 * scaling), so lay out from GraphicContext.size and size text from here:
 * nothing drops below {@link MIN_TEXT} px, even on a 390px phone.
 */
import type { Selection } from 'd3';
import type { Size } from '../types';
import { fonts, palette } from './palette';

/** Smallest text size anywhere in a graphic, in px. */
export const MIN_TEXT = 12;
/** Widths below this get the compact (phone) layout. */
export const COMPACT_BELOW = 520;

/** Space around a plot, in px. */
export interface Margins {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Font sizes (px), margins and tick count for one graphic size. */
export interface TextSizes {
  /** true below {@link COMPACT_BELOW}: fewer ticks, shorter labels, wrap more. */
  readonly compact: boolean;
  /** Axis tick labels. */
  readonly tick: number;
  /** Direct labels on data. */
  readonly label: number;
  /** Annotation text. */
  readonly annotation: number;
  /** Secondary notes, dimension labels. */
  readonly small: number;
  /** Line height as a multiple of font size. */
  readonly lineHeight: number;
  /** Default margins; Times-style y labels sit inside the plot, so left is small. */
  readonly margin: Margins;
  /** Suggested tick count for a full-height axis. */
  readonly ticks: number;
}

/**
 * Font sizes and margins for a graphic of `size`.
 * @example const t = textSizes(ctx.size); // t.tick >= 12 at 390px
 */
export function textSizes(size: Size): TextSizes {
  const w = size.width;
  if (w < COMPACT_BELOW) {
    return { compact: true, tick: 12, label: 13, annotation: 13, small: 12, lineHeight: 1.3, ticks: 4,
      margin: { top: 24, right: 12, bottom: 28, left: 8 } };
  }
  const big = w >= 900;
  return { compact: false, tick: 13, label: big ? 15 : 14, annotation: big ? 15 : 14, small: 12, lineHeight: 1.3, ticks: 5,
    margin: { top: 28, right: 24, bottom: 32, left: 12 } };
}

/** A rectangle in px; x0/y0 is top-left. */
export interface Box {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly width: number;
  readonly height: number;
}

/** The plot rectangle inside `size` after `margin` (never negative). */
export function plotArea(size: Size, margin: Margins): Box {
  const width = Math.max(0, size.width - margin.left - margin.right);
  const height = Math.max(0, size.height - margin.top - margin.bottom);
  return { x0: margin.left, y0: margin.top, x1: margin.left + width, y1: margin.top + height, width, height };
}

const NARROW = new Set([...'il.,:;\'|!()[]1 ']);
const WIDE = new Set([...'mwMW@%']);

/**
 * Estimated rendered width of `text` in Libre Franklin at `px`. Deterministic
 * (works in jsdom), and within about 10% of the browser for labels.
 */
export function textWidth(text: string, px: number, bold = false): number {
  let em = 0;
  for (const ch of text) {
    if (ch === ' ') em += 0.27;
    else if (NARROW.has(ch)) em += 0.3;
    else if (WIDE.has(ch)) em += 0.86;
    else if (/[0-9]/.test(ch)) em += 0.6;
    else if (/[A-Z]/.test(ch)) em += 0.68;
    else em += 0.54;
  }
  return em * px * (bold ? 1.06 : 1);
}

/** Greedy word wrap to `maxWidth` px. A word wider than the line stays whole on its own line. */
export function wrapLines(text: string, maxWidth: number, px: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && textWidth(next, px) > maxWidth) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Options for {@link styleText}. */
export interface TextStyle {
  readonly weight?: 400 | 600 | 700;
  readonly fill?: string;
  readonly anchor?: 'start' | 'middle' | 'end';
}

/**
 * Apply house chart type to a text selection: Libre Franklin, `px` size,
 * tabular figures, ink fill unless given.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function styleText<E extends SVGElement, D>(sel: Selection<E, D, any, any>, px: number, style: TextStyle = {}): Selection<E, D, any, any> {
  if (px < MIN_TEXT) throw new RangeError(`styleText: ${px}px is below the ${MIN_TEXT}px minimum`);
  return sel
    .attr('font-family', fonts.sans)
    .attr('font-size', px)
    .attr('font-weight', style.weight ?? 400)
    .attr('fill', style.fill ?? palette.ink)
    .attr('text-anchor', style.anchor ?? 'start')
    .style('font-variant-numeric', 'tabular-nums');
}

/**
 * Write wrapped lines into a <text> as <tspan>s, first baseline at the text's y.
 * @returns the block height in px
 */
export function setLines(text: SVGTextElement, lines: readonly string[], x: number, px: number, lineHeight = 1.3): number {
  while (text.firstChild) text.removeChild(text.firstChild);
  lines.forEach((l, i) => {
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    t.setAttribute('x', String(x));
    t.setAttribute('dy', i === 0 ? '0' : String(px * lineHeight));
    t.textContent = l;
    text.append(t);
  });
  return lines.length * px * lineHeight;
}
