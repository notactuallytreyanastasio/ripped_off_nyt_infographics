/**
 * Scrollytelling step engine. The pure functions decide which step is active
 * from element rects; `observeSteps` wires them to the real page.
 */
import type { Unmount } from '../types';

export interface VRect {
  readonly top: number;
  readonly bottom: number;
}

/** Index of the last step whose top is above the trigger line, or -1. */
export function activeStep(rects: readonly VRect[], viewportH: number, trigger: number): number {
  const line = viewportH * trigger;
  let idx = -1;
  rects.forEach((r, i) => {
    if (r.top <= line) idx = i;
  });
  return idx;
}

/** How far the trigger line has travelled through a step, clamped to [0, 1]. */
export function stepProgress(rect: VRect, viewportH: number, trigger: number): number {
  const line = viewportH * trigger;
  const h = rect.bottom - rect.top;
  if (h <= 0) return rect.top <= line ? 1 : 0;
  return Math.min(1, Math.max(0, (line - rect.top) / h));
}

export interface StepEvent {
  readonly index: number;
  readonly progress: number;
  readonly direction: 'down' | 'up';
}

export interface ObserveOptions {
  /** Fraction of viewport height where steps fire. Default 0.6. */
  readonly trigger?: number;
  /** Called when the active step changes. */
  readonly onStep: (e: StepEvent) => void;
  /** Called on every scroll frame with progress through the active step. */
  readonly onProgress?: (e: StepEvent) => void;
}

/**
 * Watch `steps` and report the active one. Uses a single rAF-throttled scroll
 * listener, which is simpler and more predictable than IntersectionObserver
 * thresholds for continuous progress.
 */
export function observeSteps(steps: readonly Element[], opts: ObserveOptions): Unmount {
  const trigger = opts.trigger ?? 0.6;
  let current = -1;
  let lastY = window.scrollY;
  let frame = 0;

  const update = () => {
    frame = 0;
    const rects = steps.map((s) => s.getBoundingClientRect());
    const vh = window.innerHeight;
    const idx = activeStep(rects, vh, trigger);
    const direction = window.scrollY >= lastY ? 'down' : 'up';
    lastY = window.scrollY;
    const rect = rects[idx];
    const progress = rect ? stepProgress(rect, vh, trigger) : 0;
    if (idx !== current) {
      current = idx;
      opts.onStep({ index: idx, progress, direction });
    }
    opts.onProgress?.({ index: idx, progress, direction });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}
