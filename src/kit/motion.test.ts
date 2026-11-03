import { select } from 'd3';
import { joinKeyed, layer, morph, shouldAnimate } from './motion';

const svg = () => select(document.body).append('svg');

afterEach(() => { document.body.innerHTML = ''; vi.unstubAllGlobals(); });

describe('morph', () => {
  it('sets final values synchronously when ctx.animate is false', () => {
    const s = svg();
    const c = s.selectAll('circle').data([1, 2]).join('circle');
    morph(c, { animate: false }, { cx: (d) => d * 10, r: 3 });
    expect(c.nodes().map((n) => (n as Element).getAttribute('cx'))).toEqual(['10', '20']);
    expect(c.attr('r')).toBe('3');
  });
  it('does not animate under prefers-reduced-motion even when ctx allows', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    expect(shouldAnimate({ animate: true })).toBe(false);
    const c = svg().append('rect');
    morph(c, { animate: true }, { width: 40 });
    expect(c.attr('width')).toBe('40');
  });
  it('animates when allowed (value not yet final synchronously)', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    const c = svg().append('rect').attr('width', 0);
    morph(c, { animate: true }, { width: 40 }, { duration: 50 });
    expect(c.attr('width')).toBe('0');
  });
});

describe('joinKeyed', () => {
  it('joins by key, keeps identity on update, removes exits, only direct children', () => {
    const s = svg();
    const g = s.append('g');
    g.append('g').append('circle').attr('class', 'dot'); // nested: must be ignored
    const first = joinKeyed(g, 'circle', 'dot', [{ id: 'a' }, { id: 'b' }], (d) => d.id, { enter: (e) => e.attr('r', 0) });
    expect(first.size()).toBe(2);
    expect(first.attr('r')).toBe('0');
    const aNode = first.nodes()[0];
    const second = joinKeyed(g, 'circle', 'dot', [{ id: 'a' }, { id: 'c' }], (d) => d.id);
    expect(second.nodes()[0]).toBe(aNode);
    expect(g.selectChildren('circle.dot').size()).toBe(2);
    expect(g.selectAll('circle.dot').size()).toBe(3);
  });
  it('throws on duplicate keys', () => {
    expect(() => joinKeyed(svg(), 'rect', 'bar', [1, 1], String)).toThrow(/duplicate key "1"/);
  });
});

describe('layer', () => {
  it('creates a group once and reuses it', () => {
    const s = svg();
    const a = layer(s, 'axes');
    const b = layer(s, 'axes');
    expect(a.node()).toBe(b.node());
    expect(s.selectAll('g.axes').size()).toBe(1);
  });
});
