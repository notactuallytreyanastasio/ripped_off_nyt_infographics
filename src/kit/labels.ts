/**
 * Direct labels and annotations. The logic is pure and tested: a 1-D dodge
 * that separates labels with the least total movement, and an annotation
 * placement whose leader line ends on the label box edge nearest the anchor,
 * so it can never cross its own text. Renderers are thin wrappers.
 */
import type { Selection } from 'd3';
import { joinKeyed, morph, type MotionContext } from './motion';
import { palette, HAIRLINE } from './palette';
import { setLines, styleText, textWidth, wrapLines, type Box, type TextSizes } from './size';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySel = Selection<any, any, any, any>;

// ------------------------------------------------------------------ geometry

/** A point in px. */
export interface Point { readonly x: number; readonly y: number }
/** A rectangle in px, top-left origin. */
export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

/** Closest point to `p` on the boundary-or-inside of `r` (p itself when inside). */
export function nearestPointOnRect(p: Point, r: Rect): Point {
  return { x: Math.min(Math.max(p.x, r.x), r.x + r.width), y: Math.min(Math.max(p.y, r.y), r.y + r.height) };
}

/** Whether rectangles overlap with positive area (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.width + pad && b.x < a.x + a.width + pad && a.y < b.y + b.height + pad && b.y < a.y + a.height + pad;
}

/**
 * Whether segment p→q passes through the open interior of `r` (running along
 * or ending on an edge does not count). Liang–Barsky clipping.
 */
export function segmentCrossesRect(p: Point, q: Point, r: Rect, eps = 1e-6): boolean {
  const x0 = r.x + eps, x1 = r.x + r.width - eps, y0 = r.y + eps, y1 = r.y + r.height - eps;
  if (x0 >= x1 || y0 >= y1) return false;
  let t0 = 0, t1 = 1;
  const dx = q.x - p.x, dy = q.y - p.y;
  const clips: [number, number][] = [[-dx, p.x - x0], [dx, x1 - p.x], [-dy, p.y - y0], [dy, y1 - p.y]];
  for (const [pp, qq] of clips) {
    if (pp === 0) {
      if (qq < 0) return false;
    } else {
      const t = qq / pp;
      if (pp < 0) t0 = Math.max(t0, t);
      else t1 = Math.min(t1, t);
      if (t0 > t1) return false;
    }
  }
  return t1 - t0 > eps;
}

// --------------------------------------------------------------------- dodge

/** One label to separate: `y` is its desired centre, `height` its extent. */
export interface DodgeItem { readonly y: number; readonly height: number }

/** Options for {@link dodge}. */
export interface DodgeOptions {
  /** Top limit for label edges (px). */
  readonly min?: number;
  /** Bottom limit for label edges (px). */
  readonly max?: number;
  /** Space between labels (px), default 2. */
  readonly gap?: number;
}

/**
 * Move label centres apart along one axis so none overlap, keeping their
 * order and minimising squared displacement (clusters settle on the mean of
 * their targets), then clamping into [min, max]. Returns centres in input order.
 * Throws if the labels cannot fit in the range at all.
 * @example dodge([{ y: 100, height: 14 }, { y: 104, height: 14 }]) // [94, 110]
 */
export function dodge(items: readonly DodgeItem[], opts: DodgeOptions = {}): number[] {
  const gap = opts.gap ?? 2;
  const min = opts.min ?? -Infinity;
  const max = opts.max ?? Infinity;
  const order = items.map((_, i) => i).sort((a, b) => (items[a]?.y ?? 0) - (items[b]?.y ?? 0) || a - b);
  const total = items.reduce((s, it) => s + it.height, 0) + gap * Math.max(0, items.length - 1);
  if (total > max - min + 1e-9) throw new RangeError(`dodge: ${items.length} labels need ${total.toFixed(1)}px but only ${(max - min).toFixed(1)}px are available`);

  interface Cluster { idx: number[]; offsets: number[]; size: number; top: number }
  const solve = (c: Cluster): void => {
    let s = 0;
    c.idx.forEach((i, k) => { s += (items[i]?.y ?? 0) - (c.offsets[k] ?? 0); });
    c.top = Math.min(Math.max(s / c.idx.length, min), max - c.size);
  };
  const clusters: Cluster[] = [];
  for (const i of order) {
    const it = items[i];
    if (!it) continue;
    const c: Cluster = { idx: [i], offsets: [it.height / 2], size: it.height, top: 0 };
    solve(c);
    clusters.push(c);
    for (;;) {
      const b = clusters[clusters.length - 1];
      const a = clusters[clusters.length - 2];
      if (!a || !b || a.top + a.size + gap <= b.top + 1e-9) break;
      const shift = a.size + gap;
      a.idx.push(...b.idx);
      a.offsets.push(...b.offsets.map((o) => o + shift));
      a.size += gap + b.size;
      clusters.pop();
      solve(a);
    }
  }
  const out = new Array<number>(items.length).fill(0);
  for (const c of clusters) c.idx.forEach((i, k) => { out[i] = c.top + (c.offsets[k] ?? 0); });
  return out;
}

// ---------------------------------------------------------------- annotation

/** Where a label sits relative to its anchor. */
export type Side = 'ne' | 'nw' | 'se' | 'sw' | 'e' | 'w' | 'n' | 's';

/** Input to {@link placeAnnotation}. */
export interface AnnotationRequest {
  readonly anchor: Point;
  /** Label block size in px. */
  readonly width: number;
  readonly height: number;
  /** The label must stay inside this box. */
  readonly bounds: Box;
  /** Distance from anchor to label, default 20. */
  readonly offset?: number;
  /** Sides to try, in order. Default ne, nw, se, sw, e, w, n, s. */
  readonly prefer?: readonly Side[];
  /** Rectangles (other labels, key marks) the label must not cover. */
  readonly avoid?: readonly Rect[];
}

/** Result of {@link placeAnnotation}. */
export interface AnnotationPlacement {
  readonly side: Side;
  readonly box: Rect;
  /** Text x and anchor so the edge facing the leader is exact even if width was estimated. */
  readonly textX: number;
  readonly textAnchor: 'start' | 'middle' | 'end';
  /** From just outside the anchor to the nearest point on the box; null if the box covers the anchor. */
  readonly leader: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number } | null;
  /** false when nothing fit and the best candidate was clamped into bounds. */
  readonly fits: boolean;
}

const ALL_SIDES: readonly Side[] = ['ne', 'nw', 'se', 'sw', 'e', 'w', 'n', 's'];

function candidate(side: Side, a: Point, w: number, h: number, d: number): Rect {
  const diag = d * Math.SQRT1_2;
  switch (side) {
    case 'ne': return { x: a.x + diag, y: a.y - diag - h, width: w, height: h };
    case 'nw': return { x: a.x - diag - w, y: a.y - diag - h, width: w, height: h };
    case 'se': return { x: a.x + diag, y: a.y + diag, width: w, height: h };
    case 'sw': return { x: a.x - diag - w, y: a.y + diag, width: w, height: h };
    case 'e': return { x: a.x + d, y: a.y - h / 2, width: w, height: h };
    case 'w': return { x: a.x - d - w, y: a.y - h / 2, width: w, height: h };
    case 'n': return { x: a.x - w / 2, y: a.y - d - h, width: w, height: h };
    case 's': return { x: a.x - w / 2, y: a.y + d, width: w, height: h };
  }
}

function overflow(r: Rect, b: Box): number {
  return Math.max(0, b.x0 - r.x) + Math.max(0, r.x + r.width - b.x1) + Math.max(0, b.y0 - r.y) + Math.max(0, r.y + r.height - b.y1);
}

/**
 * Choose where an annotation label goes: the first preferred side that fits
 * in bounds without covering `avoid`; otherwise the least-overflowing side,
 * clamped into bounds. The leader runs from 3px outside the anchor to the
 * nearest point of the box, so it ends on the box edge and never crosses it.
 */
export function placeAnnotation(req: AnnotationRequest): AnnotationPlacement {
  const d = req.offset ?? 20;
  const sides = req.prefer ?? ALL_SIDES;
  if (sides.length === 0) throw new Error('placeAnnotation: prefer must list at least one side');
  const avoid = req.avoid ?? [];
  let best: { side: Side; box: Rect; cost: number } | null = null;
  let fits = false;
  for (const side of sides) {
    const box = candidate(side, req.anchor, req.width, req.height, d);
    const cost = overflow(box, req.bounds) * 10 + avoid.filter((r) => rectsOverlap(box, r)).length;
    if (cost === 0) { best = { side, box, cost }; fits = true; break; }
    if (!best || cost < best.cost) best = { side, box, cost };
  }
  if (!best) throw new Error('placeAnnotation: no candidate');
  let { box } = best;
  if (!fits) {
    const b = req.bounds;
    box = {
      ...box,
      x: Math.min(Math.max(box.x, b.x0), Math.max(b.x0, b.x1 - box.width)),
      y: Math.min(Math.max(box.y, b.y0), Math.max(b.y0, b.y1 - box.height)),
    };
  }
  const side = best.side;
  const textAnchor = side.endsWith('w') ? 'end' : side === 'n' || side === 's' ? 'middle' : 'start';
  const textX = textAnchor === 'end' ? box.x + box.width : textAnchor === 'middle' ? box.x + box.width / 2 : box.x;
  const end = nearestPointOnRect(req.anchor, box);
  const dx = end.x - req.anchor.x, dy = end.y - req.anchor.y;
  const len = Math.hypot(dx, dy);
  const leader = len < 4 ? null
    : { x1: req.anchor.x + (dx / len) * 3, y1: req.anchor.y + (dy / len) * 3, x2: end.x, y2: end.y };
  return { side, box, textX, textAnchor, leader, fits };
}

// ----------------------------------------------------------------- renderers

/** One direct label for {@link drawDirectLabels}. */
export interface DirectLabel {
  readonly key: string;
  readonly text: string;
  /** Where the label starts (left edge for start-anchored). */
  readonly x: number;
  /** Desired vertical centre, usually the series' last value. */
  readonly y: number;
  /** Use palette.accent for the one series that matters. */
  readonly color?: string;
  readonly bold?: boolean;
}

/**
 * Labels at the end of lines (or beside dots), dodged vertically so none
 * overlap; a hairline joins a label to its point when it had to move more
 * than 3px. Keyed, so it updates in place.
 */
export function drawDirectLabels(g: AnySel, labels: readonly DirectLabel[], o: {
  readonly sizes: TextSizes; readonly min?: number; readonly max?: number; readonly ctx?: MotionContext;
  readonly anchor?: 'start' | 'end'; readonly gutter?: number;
}): void {
  const px = o.sizes.label;
  const h = px * 1.15;
  const ys = dodge(labels.map((l) => ({ y: l.y, height: h })), {
    ...(o.min !== undefined ? { min: o.min } : {}), ...(o.max !== undefined ? { max: o.max } : {}),
  });
  const placed = labels.map((l, i) => ({ ...l, ly: ys[i] ?? l.y }));
  const ctx = o.ctx ?? { animate: false };
  const gutter = o.gutter ?? 6;
  const sign = o.anchor === 'end' ? -1 : 1;
  g.classed('kit-direct-labels', true);
  const item = joinKeyed(g, 'g', 'direct-label', placed, (d) => d.key, {
    enter: (s) => {
      s.append('line').attr('stroke-width', HAIRLINE);
      styleText(s.append('text'), px, { anchor: o.anchor ?? 'start' }).attr('dy', '0.35em');
    },
    ctx,
  });
  item.select('text')
    .attr('font-weight', (d) => (d.bold ? 700 : 400))
    .attr('fill', (d) => d.color ?? palette.ink)
    .text((d) => d.text);
  morph(item.select<SVGTextElement>('text'), ctx, { x: (d) => d.x + sign * gutter, y: (d) => d.ly });
  item.select('line')
    .attr('stroke', (d) => d.color ?? palette.faint)
    .attr('opacity', (d) => (Math.abs(d.ly - d.y) > 3 ? 1 : 0));
  morph(item.select<SVGLineElement>('line'), ctx, {
    x1: (d) => d.x + sign * 1, y1: (d) => d.y, x2: (d) => d.x + sign * (gutter - 2), y2: (d) => d.ly,
  });
}

/** Input to {@link drawAnnotation}. */
export interface AnnotationSpec extends Omit<AnnotationRequest, 'width' | 'height'> {
  readonly text: string;
  readonly sizes: TextSizes;
  /** Wrap width in px; default 40% of bounds width, at least 120. */
  readonly maxWidth?: number;
  /** Draw text and leader in the accent colour. */
  readonly accent?: boolean;
  /** Draw a small ring on the anchor. */
  readonly mark?: boolean;
}

/**
 * Draw one annotation (wrapped text, leader line, optional anchor ring) into
 * a fresh `g.kit-annotation` appended to `g`, and return its placement.
 * Call `g.selectAll('*').remove()` (or use a dedicated layer) before redrawing.
 */
export function drawAnnotation(g: AnySel, spec: AnnotationSpec): AnnotationPlacement {
  const px = spec.sizes.annotation;
  const lh = spec.sizes.lineHeight;
  const maxW = spec.maxWidth ?? Math.max(120, spec.bounds.width * 0.4);
  const lines = wrapLines(spec.text, maxW, px);
  const width = Math.max(...lines.map((l) => textWidth(l, px)));
  const height = lines.length * px * lh;
  const p = placeAnnotation({ ...spec, width, height });
  const color = spec.accent ? palette.accent : palette.ink;
  const a = g.append('g').attr('class', 'kit-annotation');
  if (p.leader) {
    a.append('line').attr('x1', p.leader.x1).attr('y1', p.leader.y1).attr('x2', p.leader.x2).attr('y2', p.leader.y2)
      .attr('stroke', color).attr('stroke-width', HAIRLINE);
  }
  if (spec.mark) {
    a.append('circle').attr('cx', spec.anchor.x).attr('cy', spec.anchor.y).attr('r', 4)
      .attr('fill', 'none').attr('stroke', color).attr('stroke-width', HAIRLINE);
  }
  const t = styleText(a.append('text'), px, { anchor: p.textAnchor, fill: color })
    .attr('x', p.textX).attr('y', p.box.y + px * 0.85);
  const node = t.node() as SVGTextElement | null;
  if (node) setLines(node, lines, p.textX, px, lh);
  return p;
}
