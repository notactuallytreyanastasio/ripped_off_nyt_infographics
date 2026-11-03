import { h } from './core/dom';
import type { Fact, FactStatus, Source } from './types';

/** Merge per-section source lists; same id must mean the same URL. */
export function collectSources(lists: readonly (readonly Source[])[]): Source[] {
  const byId = new Map<string, Source>();
  for (const list of lists) {
    for (const s of list) {
      const prev = byId.get(s.id);
      if (prev && prev.url !== s.url) {
        throw new Error(`source id "${s.id}" used for two URLs: ${prev.url} and ${s.url}`);
      }
      if (!prev) byId.set(s.id, s);
    }
  }
  return [...byId.values()];
}

export interface Citations {
  number(id: string): number;
  cite(id: string): HTMLElement;
  cited(): Source[];
}

/** Numbers sources in order of first citation, newspaper-endnote style. */
export function createCitations(sources: readonly Source[]): Citations {
  const known = new Map(sources.map((s) => [s.id, s]));
  const order: string[] = [];
  const number = (id: string): number => {
    if (!known.has(id)) throw new Error(`unknown source id "${id}"`);
    let i = order.indexOf(id);
    if (i === -1) i = order.push(id) - 1;
    return i + 1;
  };
  return {
    number,
    cite: (id) => h('sup', { class: 'cite' }, h('a', { href: `#source-${id}` }, String(number(id)))),
    cited: () => order.map((id) => {
      const s = known.get(id);
      if (!s) throw new Error(`unknown source id "${id}"`);
      return s;
    }),
  };
}

interface FactOpts {
  readonly sources: readonly string[];
  readonly unit?: string;
  readonly status?: FactStatus;
  readonly note?: string;
}

export function fact<T>(value: T, opts: FactOpts): Fact<T> {
  if (opts.sources.length === 0) throw new Error('a fact needs at least one source');
  const status = opts.status ?? 'verified';
  if (status !== 'verified' && !opts.note) {
    throw new Error(`a ${status} fact needs a note explaining it`);
  }
  return {
    value,
    ...(opts.unit !== undefined && { unit: opts.unit }),
    sources: opts.sources,
    status,
    ...(opts.note !== undefined && { note: opts.note }),
  };
}
