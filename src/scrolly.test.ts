import { createScrolly } from './scrolly';
import type { Graphic, GraphicContext } from './types';

type S = { readonly kind: 'one' } | { readonly kind: 'two'; readonly n: number };

function fakeGraphic() {
  const calls: { state: S; ctx: GraphicContext }[] = [];
  const resizes: { width: number; height: number }[] = [];
  let destroyed = false;
  const g: Graphic<S> = {
    title: 'A chart',
    subtitle: 'Of things',
    sourceIds: ['s1'],
    init(svg, size) {
      svg.setAttribute('data-init', 'yes');
      resizes.push(size);
    },
    update(state, ctx) {
      calls.push({ state, ctx });
    },
    resize(size) {
      resizes.push(size);
    },
    destroy() {
      destroyed = true;
    },
  };
  return { g, calls, resizes, isDestroyed: () => destroyed };
}

const steps = [
  { body: 'First.', state: { kind: 'one' } as const },
  { body: 'Second.', state: { kind: 'two', n: 2 } as const },
];

describe('createScrolly', () => {
  it('renders a sticky figure with title, subtitle, svg, source line, and one card per step', () => {
    const { g } = fakeGraphic();
    const s = createScrolly({ id: 'x', graphic: g, steps, renderSource: () => document.createTextNode('Source: S1') });
    const el = s.element;
    expect(el.classList.contains('scrolly')).toBe(true);
    expect(el.querySelector('.graphic-title')?.textContent).toBe('A chart');
    expect(el.querySelector('.graphic-sub')?.textContent).toBe('Of things');
    expect(el.querySelector('svg')?.getAttribute('data-init')).toBe('yes');
    expect(el.querySelector('.graphic-source')?.textContent).toBe('Source: S1');
    expect(el.querySelectorAll('.scrolly-step')).toHaveLength(2);
    s.destroy();
  });

  it('accepts DOM nodes as step bodies (for citations and emphasis)', () => {
    const { g } = fakeGraphic();
    const p = document.createElement('p');
    p.append('Rich ', Object.assign(document.createElement('strong'), { textContent: 'text' }));
    const s = createScrolly({ id: 'x', graphic: g, steps: [{ body: p, state: { kind: 'one' } }] });
    expect(s.element.querySelector('.scrolly-step strong')?.textContent).toBe('text');
    s.destroy();
  });

  it('goTo(i) sends that step state to the graphic and marks the card active', () => {
    const { g, calls } = fakeGraphic();
    const s = createScrolly({ id: 'x', graphic: g, steps });
    document.body.append(s.element);
    s.goTo(1, 0.25);
    const last = calls.at(-1);
    expect(last?.state).toEqual({ kind: 'two', n: 2 });
    expect(last?.ctx.index).toBe(1);
    expect(last?.ctx.progress).toBe(0.25);
    const cards = s.element.querySelectorAll('.scrolly-step');
    expect(cards[1]?.classList.contains('is-active')).toBe(true);
    expect(cards[0]?.classList.contains('is-active')).toBe(false);
    s.destroy();
    s.element.remove();
  });

  it('before the first step, shows step 0 state (the graphic is never blank)', () => {
    const { g, calls } = fakeGraphic();
    const s = createScrolly({ id: 'x', graphic: g, steps });
    s.goTo(-1, 0);
    expect(calls.at(-1)?.state).toEqual({ kind: 'one' });
    s.destroy();
  });

  it('throws on an out-of-range step', () => {
    const { g } = fakeGraphic();
    const s = createScrolly({ id: 'x', graphic: g, steps });
    expect(() => s.goTo(5, 0)).toThrow(/step 5/);
    s.destroy();
  });

  it('rejects an empty step list', () => {
    const { g } = fakeGraphic();
    expect(() => createScrolly({ id: 'x', graphic: g, steps: [] })).toThrow(/steps/);
  });

  it('destroy() removes listeners and calls graphic.destroy', () => {
    const { g, isDestroyed } = fakeGraphic();
    const remove = vi.spyOn(window, 'removeEventListener');
    const s = createScrolly({ id: 'x', graphic: g, steps });
    s.destroy();
    expect(isDestroyed()).toBe(true);
    expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function));
    remove.mockRestore();
  });

  it('passes a non-zero fallback size to init when layout is unavailable (jsdom)', () => {
    const { g, resizes } = fakeGraphic();
    const s = createScrolly({ id: 'x', graphic: g, steps });
    expect(resizes[0]?.width).toBeGreaterThan(0);
    expect(resizes[0]?.height).toBeGreaterThan(0);
    s.destroy();
  });
  it('a step change reaches the graphic animated; progress in the same frame does not cancel it', () => {
    const { g, calls } = fakeGraphic();
    const rafs: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { rafs.push(cb); return rafs.length; });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const s = createScrolly({ id: 'x', graphic: g, steps });
    document.body.append(s.element);
    const cards = [...s.element.querySelectorAll<HTMLElement>('.scrolly-step')];
    const rect = (top: number) => ({ top, bottom: top + 400, height: 400, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({}) });
    const scrollTo = (t0: number, t1: number) => {
      cards[0]!.getBoundingClientRect = () => rect(t0);
      cards[1]!.getBoundingClientRect = () => rect(t1);
      window.dispatchEvent(new Event('scroll'));
      while (rafs.length) rafs.shift()?.(0);
    };
    scrollTo(300, 900); // step 0 under the trigger
    const before = calls.length;
    scrollTo(-600, 300); // step 1 under the trigger
    const fresh = calls.slice(before);
    expect(fresh.length).toBeGreaterThan(0);
    expect(fresh.every((c) => c.ctx.index === 1)).toBe(true);
    expect(fresh.at(-1)?.ctx.animate).toBe(true);
    // A later progress-only frame on the same step is not animated.
    scrollTo(-650, 250);
    expect(calls.at(-1)?.ctx.animate).toBe(false);
    s.destroy();
    s.element.remove();
    raf.mockRestore();
  });
});
