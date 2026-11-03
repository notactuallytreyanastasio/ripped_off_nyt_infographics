import { createCitations, collectSources, fact } from './sources';
import type { Source } from './types';

const itf: Source = {
  id: 'itf-rules',
  title: 'ITF Rules of Tennis, Appendix I',
  publisher: 'International Tennis Federation',
  url: 'https://example.org/itf',
  accessed: '2026-11-02',
  kind: 'primary',
};
const paper: Source = {
  id: 'paper',
  title: 'A paper',
  publisher: 'Journal',
  url: 'https://example.org/paper',
  accessed: '2026-11-02',
  kind: 'secondary',
};

describe('collectSources', () => {
  it('merges section lists, dedupes by id, keeps first-seen order', () => {
    expect(collectSources([[itf, paper], [itf]]).map((s) => s.id)).toEqual(['itf-rules', 'paper']);
  });

  it('throws when one id is used for two different URLs (a citation bug, not a style issue)', () => {
    expect(() => collectSources([[itf], [{ ...itf, url: 'https://other.example' }]])).toThrow(/itf-rules/);
  });
});

describe('createCitations', () => {
  it('numbers sources in order of first citation and reuses numbers', () => {
    const c = createCitations([itf, paper]);
    expect(c.number('paper')).toBe(1);
    expect(c.number('itf-rules')).toBe(2);
    expect(c.number('paper')).toBe(1);
    expect(c.cited().map((s) => s.id)).toEqual(['paper', 'itf-rules']);
  });

  it('throws on an unknown source id', () => {
    expect(() => createCitations([itf]).number('nope')).toThrow(/nope/);
  });

  it('renders a superscript link to the sources list', () => {
    const c = createCitations([itf]);
    const el = c.cite('itf-rules');
    expect(el.tagName).toBe('SUP');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('#source-itf-rules');
    expect(el.textContent).toBe('1');
  });
});

describe('fact', () => {
  it('requires at least one source', () => {
    expect(() => fact(3, { sources: [] })).toThrow(/source/);
  });

  it('keeps value, unit and status', () => {
    const f = fact(57.7, { unit: 'g', sources: ['itf-rules'], status: 'verified' });
    expect(f).toEqual({ value: 57.7, unit: 'g', sources: ['itf-rules'], status: 'verified' });
  });

  it('defaults status to verified only when not marked as an estimate', () => {
    expect(fact(1, { sources: ['x'] }).status).toBe('verified');
    expect(fact(1, { sources: ['x'], status: 'estimate', note: 'derived' }).status).toBe('estimate');
  });

  it('demands a note for estimates, so readers learn how it was derived', () => {
    expect(() => fact(1, { sources: ['x'], status: 'estimate' })).toThrow(/note/);
  });
});
