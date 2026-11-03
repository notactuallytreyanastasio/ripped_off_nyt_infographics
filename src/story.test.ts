import { mountStory, separateAdjacentCitations } from './story';
import type { Section } from './types';

const ok = (id: string): Section => ({
  id,
  kicker: 'K',
  title: `Title ${id}`,
  sources: [{ id: `src-${id}`, title: 'T', publisher: 'P', url: `https://x/${id}`, accessed: '2026-11-02', kind: 'primary' }],
  mount(root, ctx) {
    const p = document.createElement('p');
    p.className = 'probe';
    p.append(`body ${id}`, ctx.cite(`src-${id}`));
    root.append(p);
    return () => root.replaceChildren();
  },
});

const broken = (id: string): Section => ({
  ...ok(id),
  mount() {
    throw new Error(`TODO: ${id}`);
  },
});

describe('mountStory', () => {
  const outline = {
    kicker: 'Kicker', headline: 'A Headline', dek: 'A dek.', byline: 'By Someone', methodology: 'How we did it.',
    parts: [
      { id: 'I', label: 'Part I', title: 'First', sections: [ok('01-a'), broken('02-b')] },
      { id: 'turn', label: 'Interlude', title: 'The Turn', accent: true, sections: [ok('03-c')] },
      { id: 'II', label: 'Part II', title: 'Second', sections: [ok('04-d')] },
    ],
  };

  it('renders headline, part dividers and every section in order', () => {
    const root = document.createElement('div');
    const un = mountStory(root, outline);
    expect(root.querySelector('h1.headline')).not.toBeNull();
    expect([...root.querySelectorAll('.part-divider')].map((d) => d.getAttribute('data-part'))).toEqual(['I', 'turn', 'II']);
    expect([...root.querySelectorAll('.story-section')].map((s) => s.id)).toEqual(['01-a', '02-b', '03-c', '04-d']);
    un();
  });

  it('a section that throws shows a located error, and later sections still render', () => {
    const root = document.createElement('div');
    const un = mountStory(root, outline);
    const bad = root.querySelector('#\\30 2-b');
    expect(bad?.querySelector('.error-box')?.textContent).toMatch(/02-b/);
    expect(root.querySelector('#\\30 4-d .probe')).not.toBeNull();
    un();
  });

  it('lists cited sources at the end with anchors the citations link to', () => {
    const root = document.createElement('div');
    const un = mountStory(root, outline);
    const items = [...root.querySelectorAll('.sources-list li')];
    expect(items.map((li) => li.id)).toEqual(['source-src-01-a', 'source-src-03-c', 'source-src-04-d']);
    un();
  });

  it('adds a source cited after mount (a map that loads later) to the end of the list', async () => {
    const late: Section = {
      ...ok('05-e'),
      mount(root, ctx) {
        void Promise.resolve().then(() => root.append(ctx.cite('src-05-e')));
        return () => root.replaceChildren();
      },
    };
    const root = document.createElement('div');
    const un = mountStory(root, { ...outline, parts: [{ id: 'I', label: 'Part I', title: 'T', sections: [ok('01-a'), late] }] });
    expect(root.querySelectorAll('.sources-list li').length).toBe(1);
    await Promise.resolve();
    await Promise.resolve();
    const ids = [...root.querySelectorAll('.sources-list li')].map((li) => li.id);
    expect(ids).toEqual(['source-src-01-a', 'source-src-05-e']);
    un();
  });

  it('unmount tears every section down and empties the root', () => {
    const root = document.createElement('div');
    const un = mountStory(root, outline);
    un();
    expect(root.childElementCount).toBe(0);
  });
});

describe('separateAdjacentCitations', () => {
  const mark = (n: number): HTMLElement => {
    const s = document.createElement('sup');
    s.className = 'cite';
    const a = document.createElement('a');
    a.href = `#source-${n}`;
    a.textContent = String(n);
    s.append(a);
    return s;
  };
  it('puts a comma between touching marks, ignores whitespace, and leaves separated ones alone', () => {
    const p = document.createElement('p');
    const sep = document.createElement('sup');
    sep.className = 'cite cite-sep';
    sep.textContent = ',';
    p.append('a', mark(1), mark(2), ' ', mark(3), 'b', mark(4), sep, mark(5));
    expect(separateAdjacentCitations(p)).toBe(2);
    expect(p.textContent).toBe('a1,2,3b4,5');
  });
});

