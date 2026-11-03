/**
 * Primitives for technical drawings: dimension lines, callouts, hatching
 * for cut sections, a process-station row with a moving token, gantt rows,
 * and an orthographic projection for parametric surfaces (saddle, sphere).
 * Geometry is pure and tested; draw* functions append SVG into a group.
 */
import type { Selection } from 'd3';
import { HAIRLINE, palette } from './palette';
import { setLines, styleText, textWidth, wrapLines, type TextSizes } from './size';
import type { Point } from './labels';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySel = Selection<any, any, any, any>;

const r2 = (n: number): number => Math.round(n * 100) / 100;

// ------------------------------------------------------------ dimension line

/** Input to {@link dimensionGeometry}. */
export interface DimensionSpec {
  readonly from: Point;
  readonly to: Point;
  /** Perpendicular offset of the dimension line from the measured points (px); extension lines bridge the gap. Positive = left of from→to. */
  readonly offset?: number;
  /** Arrowhead length (px), default 7. */
  readonly arrow?: number;
}

/** Computed dimension line: main line, two arrowheads, extension lines, label position and angle. */
export interface DimensionGeometry {
  readonly line: { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };
  /** Closed triangle path strings, one per end, pointing outward. */
  readonly arrows: readonly [string, string];
  readonly extensions: readonly { readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }[];
  readonly label: Point;
  /** Degrees, kept within (−90, 90] so text never reads upside down. */
  readonly angle: number;
  /** Whether the label sits above the line in the text's own frame (else below). */
  readonly labelAbove: boolean;
}

/** Geometry of an engineering dimension line between two points. */
export function dimensionGeometry(spec: DimensionSpec): DimensionGeometry {
  const { from, to } = spec;
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) throw new Error('dimensionGeometry: from and to are the same point');
  const ux = dx / len, uy = dy / len;
  const nx = uy, ny = -ux; // left normal in screen coords (y down)
  const off = spec.offset ?? 0;
  const a = { x: from.x + nx * off, y: from.y + ny * off };
  const b = { x: to.x + nx * off, y: to.y + ny * off };
  const L = spec.arrow ?? 7, W = L * 0.35;
  const head = (tip: Point, dir: number): string => {
    const bx = tip.x + ux * L * dir, by = tip.y + uy * L * dir;
    return `M${r2(tip.x)},${r2(tip.y)}L${r2(bx + nx * W)},${r2(by + ny * W)}L${r2(bx - nx * W)},${r2(by - ny * W)}Z`;
  };
  const ext = off === 0 ? [] : [from, to].map((p) => {
    const s = Math.sign(off);
    return { x1: r2(p.x + nx * s * 2), y1: r2(p.y + ny * s * 2), x2: r2(p.x + nx * (off + s * 4)), y2: r2(p.y + ny * (off + s * 4)) };
  });
  let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  let flipped = false;
  if (angle > 90) { angle -= 180; flipped = true; }
  if (angle <= -90) { angle += 180; flipped = true; }
  const side = off < 0 ? -1 : 1;
  return {
    line: { x1: r2(a.x), y1: r2(a.y), x2: r2(b.x), y2: r2(b.y) },
    arrows: [head(a, 1), head(b, -1)],
    extensions: ext,
    label: { x: r2((a.x + b.x) / 2 + nx * 5 * side), y: r2((a.y + b.y) / 2 + ny * 5 * side) },
    angle: r2(angle),
    labelAbove: side * (flipped ? -1 : 1) > 0,
  };
}

/**
 * Draw a dimension line with arrowheads and a label (e.g. "2.7 in.") set
 * along it, outside the measured edge.
 */
export function drawDimension(g: AnySel, spec: DimensionSpec & { readonly label: string; readonly sizes: TextSizes; readonly color?: string }): DimensionGeometry {
  const geo = dimensionGeometry(spec);
  const color = spec.color ?? palette.ink;
  const d = g.append('g').attr('class', 'kit-dimension');
  for (const e of geo.extensions) d.append('line').attr('x1', e.x1).attr('y1', e.y1).attr('x2', e.x2).attr('y2', e.y2).attr('stroke', palette.faint).attr('stroke-width', HAIRLINE);
  d.append('line').attr('x1', geo.line.x1).attr('y1', geo.line.y1).attr('x2', geo.line.x2).attr('y2', geo.line.y2).attr('stroke', color).attr('stroke-width', HAIRLINE);
  for (const a of geo.arrows) d.append('path').attr('d', a).attr('fill', color);
  styleText(d.append('text'), spec.sizes.small, { anchor: 'middle', fill: color })
    .attr('transform', `translate(${geo.label.x},${geo.label.y}) rotate(${geo.angle})`)
    .attr('dy', geo.labelAbove ? '-0.15em' : '0.9em')
    .text(spec.label);
  return geo;
}

// ------------------------------------------------------------------- callout

/**
 * A numbered or worded callout: small dot on the feature, elbow leader, and
 * a label at (anchor + dx, anchor + dy). Label aligns away from the anchor.
 */
export function drawCallout(g: AnySel, spec: {
  readonly anchor: Point; readonly dx: number; readonly dy: number; readonly text: string;
  readonly sizes: TextSizes; readonly maxWidth?: number; readonly accent?: boolean;
}): void {
  const color = spec.accent ? palette.accent : palette.ink;
  const px = spec.sizes.annotation;
  const ex = spec.anchor.x + spec.dx, ey = spec.anchor.y + spec.dy;
  const dir = spec.dx >= 0 ? 1 : -1;
  const c = g.append('g').attr('class', 'kit-callout');
  c.append('circle').attr('cx', spec.anchor.x).attr('cy', spec.anchor.y).attr('r', 2.5).attr('fill', color);
  c.append('path').attr('d', `M${spec.anchor.x},${spec.anchor.y}L${ex},${ey}h${dir * 6}`).attr('fill', 'none').attr('stroke', color).attr('stroke-width', HAIRLINE);
  const lines = wrapLines(spec.text, spec.maxWidth ?? 160, px);
  const x = ex + dir * 9;
  const t = styleText(c.append('text'), px, { anchor: dir > 0 ? 'start' : 'end', fill: color })
    .attr('x', x).attr('y', ey + px * 0.35 - ((lines.length - 1) * px * spec.sizes.lineHeight) / 2);
  const node = t.node() as SVGTextElement | null;
  if (node) setLines(node, lines, x, px, spec.sizes.lineHeight);
}

// ------------------------------------------------------------------- hatching

/** Options for {@link hatchPattern}. */
export interface HatchOptions {
  /** Unique across the page: prefix with your chapter id, e.g. "ch06-concrete". */
  readonly id: string;
  /** Degrees, default 45. */
  readonly angle?: number;
  /** Line spacing px, default 5. */
  readonly spacing?: number;
  readonly color?: string;
  readonly strokeWidth?: number;
  /** Add a second set at +90 degrees (cross-hatch, e.g. for insulation or rubber). */
  readonly cross?: boolean;
}

/**
 * Define (once per id) a hatching pattern for cut sections in the svg's
 * <defs>, and return the `url(#id)` to use as a fill.
 * @example rect.attr('fill', hatchPattern(svg, { id: 'ch01-core' }))
 */
export function hatchPattern(svg: SVGSVGElement, opts: HatchOptions): string {
  if (!/^[A-Za-z][\w-]*$/.test(opts.id)) throw new Error(`hatchPattern: invalid id "${opts.id}"`);
  const NS = 'http://www.w3.org/2000/svg';
  let defs = svg.querySelector(':scope > defs');
  if (!defs) { defs = document.createElementNS(NS, 'defs'); svg.prepend(defs); }
  if (!defs.querySelector(`#${opts.id}`)) {
    const s = opts.spacing ?? 5;
    const p = document.createElementNS(NS, 'pattern');
    p.setAttribute('id', opts.id);
    p.setAttribute('patternUnits', 'userSpaceOnUse');
    p.setAttribute('width', String(s));
    p.setAttribute('height', String(s));
    p.setAttribute('patternTransform', `rotate(${opts.angle ?? 45})`);
    const add = (x1: number, y1: number, x2: number, y2: number): void => {
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', String(x1)); l.setAttribute('y1', String(y1));
      l.setAttribute('x2', String(x2)); l.setAttribute('y2', String(y2));
      l.setAttribute('stroke', opts.color ?? palette.ink);
      l.setAttribute('stroke-width', String(opts.strokeWidth ?? 0.75));
      p.append(l);
    };
    add(0, 0, 0, s);
    if (opts.cross) add(0, 0, s, 0);
    defs.append(p);
  }
  return `url(#${opts.id})`;
}

// ----------------------------------------------------------- process stations

/** A box in a process line. */
export interface Station { readonly key: string; readonly label: string; readonly sub?: string }

/** Laid-out station row(s), from {@link stationLayout}. */
export interface StationLayout {
  readonly boxes: readonly { readonly key: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly row: number }[];
  /** Arrow paths between consecutive stations (row breaks get an elbow). */
  readonly arrows: readonly string[];
  readonly columns: number;
  readonly height: number;
}

/**
 * Lay out stations left to right, wrapping into rows when a box would be
 * narrower than `minBox` (default 84px). Rows read left to right; a row
 * break is joined by an elbow from the last box down to the next row's first.
 */
export function stationLayout(n: number, o: { readonly x: number; readonly y: number; readonly width: number; readonly boxHeight: number; readonly gap?: number; readonly rowGap?: number; readonly minBox?: number; readonly keys?: readonly string[] }): StationLayout {
  if (n < 1) throw new Error('stationLayout: need at least one station');
  const gap = o.gap ?? 22, rowGap = o.rowGap ?? 28, minBox = o.minBox ?? 84;
  let columns = n;
  while (columns > 1 && (o.width - gap * (columns - 1)) / columns < minBox) columns--;
  const w = (o.width - gap * (columns - 1)) / columns;
  const boxes = Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / columns), col = i % columns;
    return { key: o.keys?.[i] ?? String(i), x: r2(o.x + col * (w + gap)), y: r2(o.y + row * (o.boxHeight + rowGap)), width: r2(w), height: o.boxHeight, row };
  });
  const arrows: string[] = [];
  for (let i = 1; i < n; i++) {
    const a = boxes[i - 1], b = boxes[i];
    if (!a || !b) continue;
    if (a.row === b.row) {
      const y = r2(a.y + a.height / 2);
      arrows.push(`M${r2(a.x + a.width)},${y}H${b.x}`);
    } else {
      const midY = r2(a.y + a.height + rowGap / 2);
      arrows.push(`M${r2(a.x + a.width / 2)},${r2(a.y + a.height)}V${midY}H${r2(b.x + b.width / 2)}V${b.y}`);
    }
  }
  const rows = Math.ceil(n / columns);
  return { boxes, arrows, columns, height: rows * o.boxHeight + (rows - 1) * rowGap };
}

/**
 * Position of a token travelling along the line: `t` = 0 is the centre of
 * the first station, 1 the second, fractional values interpolate between
 * centres (through the elbow on row breaks). Clamped to [0, n−1].
 */
export function tokenAt(layout: StationLayout, t: number): Point {
  const n = layout.boxes.length;
  const tt = Math.min(Math.max(t, 0), n - 1);
  const i = Math.min(Math.floor(tt), n - 2);
  const c = (k: number): Point => {
    const b = layout.boxes[k];
    if (!b) throw new Error(`tokenAt: no station ${k}`);
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  if (n === 1) return c(0);
  const a = c(i), b = c(i + 1), f = tt - i;
  const ra = layout.boxes[i]?.row, rb = layout.boxes[i + 1]?.row;
  if (ra === rb) return { x: r2(a.x + (b.x - a.x) * f), y: r2(a.y + (b.y - a.y) * f) };
  // Elbow: down, across, down.
  const mid = (a.y + b.y) / 2;
  const legs = [Math.abs(mid - a.y), Math.abs(b.x - a.x), Math.abs(b.y - mid)];
  const total = legs[0]! + legs[1]! + legs[2]!;
  let s = f * total;
  if (s <= legs[0]!) return { x: r2(a.x), y: r2(a.y + s) };
  s -= legs[0]!;
  if (s <= legs[1]!) return { x: r2(a.x + Math.sign(b.x - a.x) * s), y: r2(mid) };
  s -= legs[1]!;
  return { x: r2(b.x), y: r2(mid + s) };
}

/**
 * Draw a process row: outlined boxes with wrapped labels (and optional
 * smaller sub-labels), arrows between them, the `active` station in accent.
 * Returns the layout so you can place a token with {@link tokenAt}.
 */
export function drawStationRow(g: AnySel, stations: readonly Station[], o: {
  readonly x: number; readonly y: number; readonly width: number; readonly boxHeight: number; readonly sizes: TextSizes;
  readonly active?: string; readonly done?: readonly string[]; readonly gap?: number; readonly minBox?: number;
}): StationLayout {
  const lay = stationLayout(stations.length, { ...o, keys: stations.map((s) => s.key) });
  const row = g.append('g').attr('class', 'kit-stations');
  row.selectAll('path.arrow').data(lay.arrows).join('path').attr('class', 'arrow').attr('d', (d) => d)
    .attr('fill', 'none').attr('stroke', palette.ink).attr('stroke-width', HAIRLINE);
  for (const a of lay.arrows) {
    // Row arrows end with H (pointing right), row breaks with V (pointing down).
    const tip = lastPoint(a);
    const head = a.endsWith(`V${tip.y}`) ? `M${tip.x},${tip.y}l-3,-6h6Z` : `M${tip.x},${tip.y}l-6,-3v6Z`;
    row.append('path').attr('class', 'arrowhead').attr('d', head).attr('fill', palette.ink);
  }
  const done = new Set(o.done ?? []);
  stations.forEach((s, i) => {
    const b = lay.boxes[i];
    if (!b) return;
    const on = s.key === o.active;
    const box = row.append('g').attr('class', `station${on ? ' is-active' : ''}`).attr('data-key', s.key);
    box.append('rect').attr('x', b.x).attr('y', b.y).attr('width', b.width).attr('height', b.height)
      .attr('fill', done.has(s.key) ? palette.wash : palette.paper)
      .attr('stroke', on ? palette.accent : palette.ink).attr('stroke-width', on ? 2 : HAIRLINE);
    const px = o.sizes.label;
    const lines = wrapLines(s.label, b.width - 10, px);
    const subPx = o.sizes.small;
    const blockH = lines.length * px * 1.15 + (s.sub ? subPx * 1.3 : 0);
    const top = b.y + (b.height - blockH) / 2 + px * 0.85;
    const t = styleText(box.append('text'), px, { anchor: 'middle', weight: 600, fill: on ? palette.accent : palette.ink })
      .attr('x', b.x + b.width / 2).attr('y', top);
    const node = t.node() as SVGTextElement | null;
    if (node) setLines(node, lines, b.x + b.width / 2, px, 1.15);
    if (s.sub) {
      styleText(box.append('text'), subPx, { anchor: 'middle', fill: palette.muted })
        .attr('x', b.x + b.width / 2).attr('y', top + lines.length * px * 1.15 + subPx * 0.3)
        .text(s.sub);
    }
  });
  return lay;
}

function lastPoint(path: string): Point {
  let x = 0, y = 0;
  for (const m of path.matchAll(/([MLHV])(-?[\d.]+)(?:,(-?[\d.]+))?/g)) {
    const c = m[1], a = Number(m[2]), b = Number(m[3]);
    if (c === 'M' || c === 'L') { x = a; y = b; } else if (c === 'H') x = a; else if (c === 'V') y = a;
  }
  return { x, y };
}

// ---------------------------------------------------------------------- gantt

/** A task bar. `start`/`end` are in the x scale's domain (days, weeks, Dates as numbers). */
export interface GanttTask { readonly key: string; readonly label: string; readonly start: number; readonly end: number }

/** One laid-out gantt row. */
export interface GanttRow { readonly key: string; readonly label: string; readonly x: number; readonly width: number; readonly barY: number; readonly labelY: number }

/**
 * Lay out gantt rows top to bottom. Each row is a label line above a bar
 * (labels above bars stay readable on phones). Throws if end < start.
 */
export function ganttLayout(tasks: readonly GanttTask[], x: (v: number) => number, o: { readonly y0: number; readonly sizes: TextSizes; readonly barHeight?: number; readonly rowGap?: number }): { readonly rows: GanttRow[]; readonly height: number } {
  const bar = o.barHeight ?? 10, gap = o.rowGap ?? 8, px = o.sizes.label;
  const rowH = px + 4 + bar + gap;
  const rows = tasks.map((t, i) => {
    if (t.end < t.start) throw new Error(`ganttLayout: task "${t.key}" ends before it starts`);
    const top = o.y0 + i * rowH;
    return { key: t.key, label: t.label, x: r2(x(t.start)), width: r2(Math.max(1, x(t.end) - x(t.start))), labelY: r2(top + px * 0.85), barY: r2(top + px + 4) };
  });
  return { rows, height: tasks.length * rowH - gap };
}

/** Draw gantt rows; `highlight` keys are drawn in accent, others in data2 grey. */
export function drawGantt(g: AnySel, tasks: readonly GanttTask[], x: (v: number) => number, o: {
  readonly y0: number; readonly sizes: TextSizes; readonly barHeight?: number; readonly highlight?: readonly string[]; readonly maxX?: number;
}): { readonly rows: GanttRow[]; readonly height: number } {
  const lay = ganttLayout(tasks, x, o);
  const hi = new Set(o.highlight ?? []);
  const bar = o.barHeight ?? 10;
  const gg = g.append('g').attr('class', 'kit-gantt');
  for (const r of lay.rows) {
    const row = gg.append('g').attr('class', 'gantt-row').attr('data-key', r.key);
    row.append('rect').attr('x', r.x).attr('y', r.barY).attr('width', r.width).attr('height', bar)
      .attr('fill', hi.has(r.key) ? palette.accent : palette.data2);
    // Keep label inside the plot: right-align to bar end if it would overflow maxX.
    const w = textWidth(r.label, o.sizes.label);
    const overflow = o.maxX !== undefined && r.x + w > o.maxX;
    styleText(row.append('text'), o.sizes.label, { anchor: overflow ? 'end' : 'start', fill: hi.has(r.key) ? palette.accent : palette.ink })
      .attr('x', overflow ? Math.min(r.x + r.width, o.maxX ?? Infinity) : r.x).attr('y', r.labelY).text(r.label);
  }
  return lay;
}

// ----------------------------------------------------------------- 3D surface

/** A point in model space. */
export type Vec3 = readonly [number, number, number];

/** Orthographic view: rotate by yaw (about z) then pitch (about x), scale, centre on screen. */
export interface View3D { readonly yaw: number; readonly pitch: number; readonly scale: number; readonly cx: number; readonly cy: number }

/** A projected point: screen x, y and depth (larger = nearer the viewer). */
export interface Projected { readonly x: number; readonly y: number; readonly depth: number }

/**
 * Orthographic projection from model space (z up) to screen (y down).
 * Angles are radians. yaw 0, pitch 0 looks along +y at the x–z plane.
 */
export function project3d(view: View3D): (p: Vec3) => Projected {
  const cy = Math.cos(view.yaw), sy = Math.sin(view.yaw), cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
  return ([x, y, z]) => {
    const x1 = x * cy - y * sy;
    const y1 = x * sy + y * cy;
    const y2 = y1 * cp - z * sp; // depth axis (into screen = +)
    const z2 = y1 * sp + z * cp;
    return { x: view.cx + x1 * view.scale, y: view.cy - z2 * view.scale, depth: -y2 };
  };
}

/** A parametric surface (u, v) → point. */
export type Surface = (u: number, v: number) => Vec3;

/** Hyperbolic paraboloid z = (x²/a² − y²/b²)·h over u, v in [−1, 1]: the saddle. */
export const saddle = (a = 1, b = 1, h = 0.5): Surface => (u, v) => [u * a, v * b, h * (u * u - v * v)];

/** Sphere of radius r; u in [0, 2π] longitude, v in [0, π] colatitude. */
export const sphere = (r = 1): Surface => (u, v) => [r * Math.sin(v) * Math.cos(u), r * Math.sin(v) * Math.sin(u), r * Math.cos(v)];

/** A projected surface patch with its mean depth, for painter's ordering. */
export interface Quad { readonly path: string; readonly depth: number; readonly i: number; readonly j: number }

/**
 * Sample `surface` on an nu × nv grid, project, and return quads sorted back
 * to front. Fill them with paper and stroke with ink for hidden-line
 * removal by painter's algorithm (good for convex-ish shapes like a saddle or sphere).
 */
export function surfaceQuads(surface: Surface, project: (p: Vec3) => Projected, o: {
  readonly u: readonly [number, number]; readonly v: readonly [number, number]; readonly nu: number; readonly nv: number;
}): Quad[] {
  if (o.nu < 1 || o.nv < 1) throw new Error('surfaceQuads: nu and nv must be at least 1');
  const grid: Projected[][] = [];
  for (let i = 0; i <= o.nu; i++) {
    const row: Projected[] = [];
    for (let j = 0; j <= o.nv; j++) {
      const u = o.u[0] + ((o.u[1] - o.u[0]) * i) / o.nu;
      const v = o.v[0] + ((o.v[1] - o.v[0]) * j) / o.nv;
      row.push(project(surface(u, v)));
    }
    grid.push(row);
  }
  const quads: Quad[] = [];
  for (let i = 0; i < o.nu; i++) {
    for (let j = 0; j < o.nv; j++) {
      const ps = [grid[i]?.[j], grid[i + 1]?.[j], grid[i + 1]?.[j + 1], grid[i]?.[j + 1]];
      if (ps.some((p) => !p)) continue;
      const pts = ps as Projected[];
      quads.push({
        path: `M${pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join('L')}Z`,
        depth: pts.reduce((s, p) => s + p.depth, 0) / 4,
        i, j,
      });
    }
  }
  return quads.sort((a, b) => a.depth - b.depth);
}

/** Draw quads back to front as a hidden-line wireframe. `fill(q)` may return accent for highlighted patches. */
export function drawSurface(g: AnySel, quads: readonly Quad[], o: { readonly fill?: (q: Quad) => string; readonly stroke?: string } = {}): void {
  g.append('g').attr('class', 'kit-surface')
    .selectAll('path').data(quads).join('path')
    .attr('d', (q) => q.path)
    .attr('fill', (q) => o.fill?.(q) ?? palette.paper)
    .attr('stroke', o.stroke ?? palette.ink)
    .attr('stroke-width', 0.75)
    .attr('stroke-linejoin', 'round');
}
