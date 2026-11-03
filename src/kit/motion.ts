/**
 * Transitions that respect the reader. Every animated change in a graphic
 * goes through {@link morph}: it animates only when the scrolly says so
 * (`ctx.animate` is false while scrubbing and under reduced motion) and
 * otherwise sets the final values synchronously, interrupting anything in
 * flight so a fast scroll never leaves a chart half-drawn.
 */
import type { BaseType, Selection } from 'd3';
import { easeCubicInOut, select } from 'd3';
import type { GraphicContext } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnySel<E extends BaseType, D> = Selection<E, D, any, any>;

/** The part of GraphicContext motion helpers need. */
export type MotionContext = Pick<GraphicContext, 'animate'>;

/** Default transition length in ms. */
export const DURATION = 600;

/** true when the OS asks for reduced motion. Safe in jsdom (returns false). */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Whether to animate this update: the scrolly allows it and the reader has not opted out. */
export function shouldAnimate(ctx: MotionContext): boolean {
  return ctx.animate && !prefersReducedMotion();
}

/** An attribute value or a per-datum function, as in d3 `.attr`. */
export type AttrValue<D> = string | number | null | ((d: D, i: number) => string | number | null);

/** Options for {@link morph}. */
export interface MorphOptions {
  /** ms, default {@link DURATION}. */
  readonly duration?: number;
  /** ms, or per-element delay for staggering. */
  readonly delay?: number | ((d: unknown, i: number) => number);
  readonly ease?: (t: number) => number;
}

/**
 * Set attributes, animated when allowed and instant otherwise.
 * @example morph(bars, ctx, { y: (d) => y(d.v), height: (d) => y(0) - y(d.v) });
 */
export function morph<E extends BaseType, D>(
  sel: AnySel<E, D>,
  ctx: MotionContext,
  attrs: Readonly<Record<string, AttrValue<D>>>,
  opts: MorphOptions = {},
): void {
  if (!shouldAnimate(ctx)) {
    sel.interrupt();
    for (const [k, v] of Object.entries(attrs)) sel.attr(k, v as never);
    return;
  }
  const t = sel.transition().duration(opts.duration ?? DURATION).ease(opts.ease ?? easeCubicInOut);
  if (opts.delay !== undefined) t.delay(opts.delay as never);
  for (const [k, v] of Object.entries(attrs)) t.attr(k, v as never);
}

/** Remove a selection, fading it out first when animation is allowed. */
export function exitFade<E extends BaseType, D>(sel: AnySel<E, D>, ctx: MotionContext, duration = DURATION / 2): void {
  if (!shouldAnimate(ctx)) {
    sel.interrupt().remove();
    return;
  }
  sel.transition().duration(duration).attr('opacity', 0).remove();
}

/** Options for {@link joinKeyed}. */
export interface JoinOptions<E extends BaseType, D> {
  /** Set starting attributes on new elements (e.g. zero height) before morphing. */
  readonly enter?: (sel: AnySel<E, D>) => void;
  /** Exit behaviour; pass ctx to fade out instead of removing at once. */
  readonly ctx?: MotionContext;
}

/**
 * Keyed data join over direct children `tag.cls` of `parent`. New elements
 * get the class; exiting ones are removed (faded when `ctx` allows).
 * Returns enter + update, ready for {@link morph}.
 * @example
 * const dots = joinKeyed(g, 'circle', 'dot', data, (d) => d.id, { enter: (s) => s.attr('r', 0) });
 * morph(dots, ctx, { cx: (d) => x(d.x), cy: (d) => y(d.y), r: 4 });
 */
export function joinKeyed<K extends keyof SVGElementTagNameMap, D>(
  parent: Selection<any, any, any, any>,
  tag: K,
  cls: string,
  data: readonly D[],
  key: (d: D) => string,
  opts: JoinOptions<SVGElementTagNameMap[K], D> = {},
): AnySel<SVGElementTagNameMap[K], D> {
  if (/\s/.test(cls) || cls === '') throw new Error(`joinKeyed: class must be one non-empty token, got "${cls}"`);
  const keys = new Set<string>();
  for (const d of data) {
    const k = key(d);
    if (keys.has(k)) throw new Error(`joinKeyed: duplicate key "${k}" in .${cls}`);
    keys.add(k);
  }
  return parent
    .selectChildren<SVGElementTagNameMap[K], D>(`${tag}.${cls}`)
    .data([...data], (d) => key(d as D))
    .join(
      (enter) => {
        const s = enter.append(tag).attr('class', cls) as unknown as AnySel<SVGElementTagNameMap[K], D>;
        opts.enter?.(s);
        return s as never;
      },
      (update) => update,
      (exit) => {
        if (opts.ctx) exitFade(exit, opts.ctx);
        else exit.remove();
      },
    ) as unknown as AnySel<SVGElementTagNameMap[K], D>;
}

/**
 * Append (once) and return a child `<g class=cls>`, so `update` can be
 * called repeatedly without duplicating layers.
 */
export function layer(parent: Selection<any, any, any, any>, cls: string): Selection<SVGGElement, unknown, null, undefined> {
  const node = parent.node() as Element | null;
  if (!node) throw new Error(`layer(".${cls}"): parent selection is empty`);
  let g = Array.from(node.children).find((c) => c.tagName.toLowerCase() === 'g' && c.classList.contains(cls)) as SVGGElement | undefined;
  if (!g) {
    g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', cls);
    node.append(g);
  }
  return selectG(g);
}

const selectG = (g: SVGGElement): Selection<SVGGElement, unknown, null, undefined> => select(g);
