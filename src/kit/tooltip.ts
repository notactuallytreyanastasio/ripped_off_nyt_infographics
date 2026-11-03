/**
 * A hover tooltip that owns exactly one element and removes it (and any
 * listeners it bound) on destroy(). Call destroy() from Graphic.destroy().
 */
import type { Selection } from 'd3';
import { pointer } from 'd3';

/** A tooltip created by {@link createTooltip}. */
export interface Tooltip {
  readonly element: HTMLDivElement;
  /** Show content (text is set as textContent, never parsed as HTML) near (x, y) in container px. */
  show(content: string | Node, x: number, y: number): void;
  hide(): void;
  /**
   * Show on pointer enter/move over `sel`, hide on leave. Listeners are
   * namespaced and removed on destroy().
   */
  bind<D>(sel: Selection<any, D, any, any>, content: (d: D) => string | Node): void;
  destroy(): void;
}

/**
 * Create a tooltip inside `container` (usually the scrolly plot, i.e.
 * `svg.parentElement`). Makes the container `position: relative` if it was
 * static, and restores it on destroy.
 */
export function createTooltip(container: HTMLElement): Tooltip {
  const el = document.createElement('div');
  el.className = 'tooltip kit-tooltip';
  el.setAttribute('role', 'status');
  el.hidden = true;
  const prevPosition = container.style.position;
  const computed = typeof getComputedStyle === 'function' ? getComputedStyle(container).position : '';
  if (computed === '' || computed === 'static') container.style.position = 'relative';
  container.append(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bound: Selection<any, any, any, any>[] = [];
  let destroyed = false;

  const show = (content: string | Node, x: number, y: number): void => {
    if (destroyed) throw new Error('tooltip used after destroy()');
    if (typeof content === 'string') el.textContent = content;
    else el.replaceChildren(content);
    el.hidden = false;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const cw = container.clientWidth || Infinity;
    const left = x + 12 + w > cw ? Math.max(0, x - 12 - w) : x + 12;
    const top = Math.max(0, y - h - 10);
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  };
  const hide = (): void => { el.hidden = true; };

  return {
    element: el,
    show,
    hide,
    bind<D>(sel: Selection<any, D, any, any>, content: (d: D) => string | Node) {
      sel
        .on('pointerenter.kit-tooltip pointermove.kit-tooltip', (event: Event, d: D) => {
          const [x, y] = pointer(event, container);
          show(content(d), x, y);
        })
        .on('pointerleave.kit-tooltip', hide);
      bound.push(sel);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const s of bound) s.on('.kit-tooltip', null);
      el.remove();
      container.style.position = prevPosition;
    },
  };
}
