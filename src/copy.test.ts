import { createCitations } from './sources';
import { dataTable, drawer, para, prose, sourceLine, steps } from './copy';
import type { Source } from './types';

const src = (id: string, publisher: string): Source => ({
  id, publisher, title: `Title ${id}`, url: `https://example.com/${id}`, accessed: '2026-11-03', kind: 'primary',
});
const sources = [src('a', 'Census Bureau'), src('b', 'Census Bureau'), src('c', 'Federal Reserve')];
const ctx = () => {
  const c = createCitations(sources);
  return { cite: (id: string) => c.cite(id) };
};

describe('para', () => {
  it('renders strings as text and {cite} runs as numbered citation marks', () => {
    const p = para(['Prices rose 4 percent.', { cite: 'a' }, ' Then fell.'], ctx());
    expect(p.tagName).toBe('P');
    expect(p.textContent).toBe('Prices rose 4 percent.1 Then fell.');
    expect(p.querySelector('sup.cite a')?.getAttribute('href')).toBe('#source-a');
  });

  it('throws on an unknown source id instead of printing a dead mark', () => {
    expect(() => para([{ cite: 'nope' }], ctx())).toThrow(/nope/);
  });
});

describe('prose', () => {
  it('wraps paragraphs in a .prose column', () => {
    const el = prose([['One.'], ['Two.']], ctx());
    expect(el.classList.contains('prose')).toBe(true);
    expect(el.querySelectorAll('p')).toHaveLength(2);
  });
});

describe('steps', () => {
  it('turns copy steps into scrolly steps, keeping each state', () => {
    const out = steps([{ paras: [['First.']], state: { n: 1 } }, { paras: [['Second.', { cite: 'c' }]], state: { n: 2 } }], ctx());
    expect(out.map((s) => s.state)).toEqual([{ n: 1 }, { n: 2 }]);
    expect((out[1]!.body as HTMLElement).textContent).toBe('Second.1');
  });
});

describe('sourceLine', () => {
  it('lists each publisher once, cites every id, and separates publishers with semicolons', () => {
    const line = sourceLine(['a', 'b', 'c'], sources, ctx());
    expect(line.textContent).toBe('Sources: Census Bureau12; Federal Reserve3');
  });

  it('says "Source:" for a single publisher', () => {
    expect(sourceLine(['a'], sources, ctx()).textContent).toBe('Source: Census Bureau1');
  });

  it('throws on an id that is not in the source list', () => {
    expect(() => sourceLine(['zzz'], sources, ctx())).toThrow(/zzz/);
  });
});

describe('drawer', () => {
  it('is a closed <details> with a summary and paragraphs', () => {
    const d = drawer('How we calculated this', [['Step one.'], ['Step two.']], ctx());
    expect(d.tagName).toBe('DETAILS');
    expect(d.open).toBe(false);
    expect(d.querySelector('summary')?.textContent).toBe('How we calculated this');
    expect(d.querySelectorAll('.drawer-body p')).toHaveLength(2);
  });
});

describe('dataTable', () => {
  it('renders a caption, header and rows, right-aligning numeric columns', () => {
    const t = dataTable({
      caption: 'Fees',
      columns: [{ label: 'Item' }, { label: 'Cost', numeric: true }],
      rows: [['Permit', '$1,200'], ['Inspection', '$300']],
    });
    expect(t.querySelector('caption')?.textContent).toBe('Fees');
    expect([...t.querySelectorAll('th')].map((th) => th.textContent)).toEqual(['Item', 'Cost']);
    expect(t.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(t.querySelector('tbody td.num')?.textContent).toBe('$1,200');
  });

  it('throws when a row has the wrong number of cells', () => {
    expect(() => dataTable({ columns: [{ label: 'A' }, { label: 'B' }], rows: [['only one']] })).toThrow(/row 0/);
  });
});
