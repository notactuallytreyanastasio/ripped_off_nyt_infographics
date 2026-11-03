/**
 * Axes in Times style: hairline gridlines, no domain line, few ticks, a
 * darker baseline at zero, and the unit written on the top tick only
 * ("40 million tons", then "30", "20", "10").
 */
import type { Selection } from 'd3';
import { morph, joinKeyed, type MotionContext } from './motion';
import { palette, HAIRLINE } from './palette';
import { styleText, textWidth, type TextSizes } from './size';
import { fmtNum } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySel = Selection<any, any, any, any>;

/** Any d3 continuous numeric scale (linear, log, sqrt...). */
export interface NumericScale {
  (v: number): number;
  ticks(count?: number): number[];
  domain(): number[];
  range(): number[];
}

/**
 * Tick label strings: `format` for each value, with `unit` (or `topFormat`)
 * applied only to the largest value. A unit starting with a letter gets a
 * space; "%" or "°" do not.
 * @example tickLabels([0, 10, 20], fmtNum, 'tons') // ["0", "10", "20 tons"]
 */
export function tickLabels(values: readonly number[], format: (v: number) => string, unit?: string, topFormat?: (v: number) => string): string[] {
  if (values.length === 0) return [];
  const top = Math.max(...values);
  return values.map((v) => {
    if (v !== top) return format(v);
    if (topFormat) return topFormat(v);
    if (!unit) return format(v);
    return /^[A-Za-z]/.test(unit) ? `${format(v)} ${unit}` : `${format(v)}${unit}`;
  });
}

/** Options shared by {@link axisY} and {@link axisX}. */
export interface AxisOptions {
  readonly scale: NumericScale;
  readonly sizes: TextSizes;
  /** Tick count hint; default sizes.ticks. Ignored when tickValues is set. */
  readonly ticks?: number;
  readonly tickValues?: readonly number[];
  /** Default {@link fmtNum}. */
  readonly format?: (v: number) => string;
  /** Written after the top tick only. */
  readonly unit?: string;
  /** Full override for the top tick, e.g. (v) => fmtMoney(v). */
  readonly topFormat?: (v: number) => string;
  /** Value drawn as a dark baseline; default 0 when in the domain; null for none. */
  readonly baseline?: number | null;
  /** Pass to animate tick moves when the scale changes. */
  readonly ctx?: MotionContext;
}

interface Tick { readonly v: number; readonly label: string }

function ticksOf(o: AxisOptions): Tick[] {
  const values = o.tickValues ? [...o.tickValues] : o.scale.ticks(o.ticks ?? o.sizes.ticks);
  const labels = tickLabels(values, o.format ?? ((v) => fmtNum(v)), o.unit, o.topFormat);
  return values.map((v, i) => ({ v, label: labels[i] ?? '' }));
}

function baselineOf(o: AxisOptions): number | null {
  if (o.baseline !== undefined) return o.baseline;
  const [a = 0, b = 0] = o.scale.domain();
  return Math.min(a, b) <= 0 && Math.max(a, b) >= 0 ? 0 : null;
}

const still: MotionContext = { animate: false };

/**
 * Horizontal gridlines from x0 to x1 with labels sitting just above each
 * line at the left edge. Draws into `g` (give it its own layer).
 */
export function axisY(g: AnySel, o: AxisOptions & { readonly x0: number; readonly x1: number }): void {
  const ticks = ticksOf(o);
  const base = baselineOf(o);
  const ctx = o.ctx ?? still;
  g.classed('kit-axis kit-axis-y', true).attr('aria-hidden', 'true');
  const tick = joinKeyed(g, 'g', 'tick', ticks, (t) => String(t.v), {
    enter: (s) => {
      s.attr('transform', (t) => `translate(0,${o.scale(t.v)})`);
      s.append('line').attr('stroke-width', HAIRLINE).attr('shape-rendering', 'crispEdges');
      styleText(s.append('text'), o.sizes.tick, { fill: palette.muted });
    },
    ctx,
  });
  morph(tick, ctx, { transform: (t) => `translate(0,${o.scale(t.v)})` });
  tick.select('line').attr('x1', o.x0).attr('x2', o.x1)
    .attr('stroke', (t) => (t.v === base ? palette.ink : palette.rule));
  tick.select('text').attr('x', o.x0).attr('y', -4).text((t) => t.label);
}

/**
 * Bottom axis at `y`: short tick marks and centred labels, nudged inward so
 * the first and last never spill past the scale's range.
 */
export function axisX(g: AnySel, o: AxisOptions & { readonly y: number; readonly tickLength?: number }): void {
  const ticks = ticksOf(o);
  const ctx = o.ctx ?? still;
  const len = o.tickLength ?? 4;
  const [r0 = 0, r1 = 0] = o.scale.range();
  const lo = Math.min(r0, r1);
  const hi = Math.max(r0, r1);
  g.classed('kit-axis kit-axis-x', true).attr('aria-hidden', 'true');
  const tick = joinKeyed(g, 'g', 'tick', ticks, (t) => String(t.v), {
    enter: (s) => {
      s.attr('transform', (t) => `translate(${o.scale(t.v)},${o.y})`);
      s.append('line').attr('stroke', palette.faint).attr('stroke-width', HAIRLINE).attr('shape-rendering', 'crispEdges');
      styleText(s.append('text'), o.sizes.tick, { fill: palette.muted });
    },
    ctx,
  });
  morph(tick, ctx, { transform: (t) => `translate(${o.scale(t.v)},${o.y})` });
  tick.select('line').attr('y1', 0).attr('y2', len);
  tick.select('text')
    .attr('y', len + o.sizes.tick + 2)
    .attr('text-anchor', (t) => {
      const x = o.scale(t.v);
      const half = textWidth(t.label, o.sizes.tick) / 2;
      return x - half < lo ? 'start' : x + half > hi ? 'end' : 'middle';
    })
    .text((t) => t.label);
}
