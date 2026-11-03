/**
 * Reusable sticky scrollytelling block, generalised from flow A.
 * Desktop: graphic pinned on the right, cards scroll on the left.
 * Narrow (<760px): graphic pinned full-width under the masthead, cards
 * scroll over its lower part with an opaque background.
 */
import { h } from './core/dom';
import { observeSteps } from './core/scroll';
import type { Graphic, Size, Step } from './types';

const SVG_NS = 'http://www.w3.org/2000/svg';
const FALLBACK: Size = { width: 600, height: 480 };

export interface ScrollyOptions<S> {
  readonly id: string;
  readonly graphic: Graphic<S>;
  readonly steps: readonly Step<S>[];
  /** Renders the source line; defaults to listing graphic.sourceIds. */
  readonly renderSource?: () => Node;
  readonly trigger?: number;
}

export interface Scrolly {
  readonly element: HTMLElement;
  goTo(index: number, progress: number): void;
  destroy(): void;
}

const reducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function measure(el: Element): Size {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { width: Math.round(r.width), height: Math.round(r.height) } : FALLBACK;
}

export function createScrolly<S>(opts: ScrollyOptions<S>): Scrolly {
  const { graphic, steps } = opts;
  if (steps.length === 0) throw new Error(`scrolly "${opts.id}": steps must not be empty`);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'scrolly-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', graphic.title);
  const plot = h('div', { class: 'scrolly-plot' });
  plot.append(svg);

  const source = opts.renderSource?.() ?? document.createTextNode(`Sources: ${graphic.sourceIds.join(', ')}`);
  const figure = h('figure', { class: 'scrolly-figure graphic' },
    h('div', { class: 'scrolly-sticky' },
      h('div', { class: 'graphic-title' }, graphic.title),
      h('div', { class: 'graphic-sub' }, graphic.subtitle),
      plot,
      h('div', { class: 'graphic-source' }, source),
    ),
  );

  const cards = steps.map((s, i) =>
    h('div', { class: 'scrolly-step', 'data-step': i },
      h('div', { class: 'scrolly-card' }, typeof s.body === 'string' ? h('p', {}, s.body) : s.body),
    ),
  );
  const element = h('section', { class: 'scrolly', id: `scrolly-${opts.id}` },
    figure, h('div', { class: 'scrolly-steps' }, ...cards));

  let size = measure(plot);
  graphic.init(svg, size);
  let current = -2;
  let skipProgress = false;

  const goTo = (index: number, progress: number, animate = !reducedMotion()) => {
    if (index >= steps.length || index < -1) throw new Error(`scrolly "${opts.id}": no step ${index}`);
    const i = Math.max(0, index);
    const step = steps[i];
    if (!step) throw new Error(`scrolly "${opts.id}": no step ${index}`);
    cards.forEach((c, k) => c.classList.toggle('is-active', k === index));
    graphic.update(step.state, { index: i, progress, animate, size });
    current = index;
  };

  // First paint: step 0, no animation.
  goTo(-1, 0, false);

  const stopSteps = observeSteps(cards, {
    trigger: opts.trigger ?? 0.6,
    // observeSteps fires onProgress straight after onStep in the same frame.
    // Re-drawing un-animated there would cancel the step's transition, so the
    // first progress event after a step change is dropped.
    onStep: (e) => {
      goTo(e.index, e.progress);
      skipProgress = true;
    },
    onProgress: (e) => {
      if (skipProgress) { skipProgress = false; return; }
      if (e.index === current && e.index >= 0) goTo(e.index, e.progress, false);
    },
  });

  let ro: ResizeObserver | null = null;
  if (typeof ResizeObserver === 'function') {
    ro = new ResizeObserver(() => {
      const next = measure(plot);
      if (next.width === size.width && next.height === size.height) return;
      size = next;
      graphic.resize(size);
      goTo(current, 0, false);
    });
    ro.observe(plot);
  }

  return {
    element,
    goTo: (i, p) => goTo(i, p),
    destroy: () => {
      stopSteps();
      ro?.disconnect();
      graphic.destroy();
    },
  };
}
