/**
 * Copy helpers: the small pieces every section of a long story ends up
 * writing for itself. Copy is plain data (strings and {cite} runs), so it
 * can live in its own file, be fact-checked there and be tested.
 */
import { h } from './core/dom';
import type { SectionContext, Source, Step } from './types';

/** One run of a paragraph: text, or a citation mark for a source id. */
export type Seg = string | { readonly cite: string };
/** A paragraph is a list of runs. */
export type Para = readonly Seg[];

/** A scrolly step written as copy: its paragraphs and the graphic state it shows. */
export interface CopyStep<S> {
  readonly paras: readonly Para[];
  readonly state: S;
}

type Cite = Pick<SectionContext, 'cite'>;

/** Render a paragraph; {cite: id} becomes a numbered mark linking to the source list. */
export function para(segs: Para, ctx: Cite): HTMLParagraphElement {
  const p = h('p');
  for (const s of segs) p.append(typeof s === 'string' ? s : ctx.cite(s.cite));
  return p;
}

/** Paragraphs in the body-text column. */
export function prose(paras: readonly Para[], ctx: Cite): HTMLDivElement {
  const div = h('div', { class: 'prose' });
  for (const p of paras) div.append(para(p, ctx));
  return div;
}

/** Turn copy steps into the steps createScrolly takes. */
export function steps<S>(list: readonly CopyStep<S>[], ctx: Cite): Step<S>[] {
  return list.map((s) => {
    const body = h('div');
    for (const p of s.paras) body.append(para(p, ctx));
    return { body, state: s.state };
  });
}

/**
 * The line under a graphic: "Sources: Census Bureau¹²; Federal Reserve³".
 * Each publisher is named once, every id is cited, and an id missing from
 * `sources` throws rather than printing a dead mark.
 */
export function sourceLine(ids: readonly string[], sources: readonly Source[], ctx: Cite): HTMLSpanElement {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const s = byId.get(id);
    if (!s) throw new Error(`sourceLine: unknown source id "${id}"`);
    const g = groups.get(s.publisher);
    if (g) g.push(id);
    else groups.set(s.publisher, [id]);
  }
  const span = h('span', {}, groups.size === 1 ? 'Source: ' : 'Sources: ');
  let first = true;
  for (const [publisher, group] of groups) {
    if (!first) span.append('; ');
    first = false;
    span.append(publisher, ...group.map((id) => ctx.cite(id)));
  }
  return span;
}

/** A closed "how we calculated this" drawer for derivations and caveats. */
export function drawer(summary: string, paras: readonly Para[], ctx: Cite): HTMLDetailsElement {
  const body = h('div', { class: 'drawer-body' });
  for (const p of paras) body.append(para(p, ctx));
  return h('details', { class: 'drawer' }, h('summary', {}, summary), body);
}

export interface Column {
  readonly label: string;
  /** Right-aligned with tabular figures. */
  readonly numeric?: boolean;
}

export interface TableSpec {
  readonly caption?: string;
  readonly columns: readonly Column[];
  readonly rows: readonly (readonly (string | Node)[])[];
}

/** A plain newsroom table, scrollable sideways on phones. */
export function dataTable(spec: TableSpec): HTMLDivElement {
  const { columns } = spec;
  spec.rows.forEach((r, i) => {
    if (r.length !== columns.length) throw new Error(`dataTable: row ${i} has ${r.length} cells, expected ${columns.length}`);
  });
  const cls = (c: Column) => (c.numeric ? { class: 'num' } : {});
  const table = h('table', { class: 'data-table' },
    spec.caption ? h('caption', {}, spec.caption) : null,
    h('thead', {}, h('tr', {}, ...columns.map((c) => h('th', { scope: 'col', ...cls(c) }, c.label)))),
    h('tbody', {}, ...spec.rows.map((r) => h('tr', {}, ...r.map((cell, i) => h('td', cls(columns[i]!), cell))))),
  );
  return h('div', { class: 'data-table-wrap' }, table);
}
