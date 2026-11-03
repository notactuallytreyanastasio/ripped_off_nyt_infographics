/**
 * The story shell: headline, parts, sections in order, and the numbered
 * source list. Sections own their content; this only orders and frames them.
 * A section that throws while mounting shows a located error box and the
 * rest of the story still renders.
 */
import { h } from './core/dom';
import { collectSources, createCitations } from './sources';
import type { Section, Source, Unmount } from './types';

export interface Part {
  /** Written to data-part on the divider, for styling. */
  readonly id: string;
  /** Small label above the title, e.g. "Part I" or "Interlude". */
  readonly label: string;
  readonly title: string;
  /** Draw the divider in the accent colour (a turn in the story). */
  readonly accent?: boolean;
  readonly sections: readonly Section[];
}

export interface StoryConfig {
  readonly kicker: string;
  readonly headline: string;
  readonly dek: string;
  readonly byline: string;
  /** Paragraph above the source list. */
  readonly methodology: string;
  readonly sourcesTitle?: string;
  readonly parts: readonly Part[];
}

function errorBox(id: string, err: unknown): HTMLElement {
  const msg = err instanceof Error ? err.message : String(err);
  return h('div', { class: 'error-box' }, h('strong', {}, `Section ${id} failed to mount`), h('pre', {}, msg));
}

/**
 * Two citation marks side by side read as one number ("213214"). After every
 * section has mounted, put a comma between any two linked marks that touch (ignoring
 * whitespace between them). Marks that already have a separator are left alone.
 */
export function separateAdjacentCitations(root: ParentNode): number {
  let added = 0;
  const isLinkCite = (n: Node | null): n is HTMLElement =>
    n instanceof HTMLElement && n.classList.contains('cite') && n.querySelector('a') !== null;
  for (const c of Array.from(root.querySelectorAll('.cite'))) {
    if (!isLinkCite(c)) continue;
    let n = c.nextSibling;
    while (n && n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() === '') n = n.nextSibling;
    if (!isLinkCite(n)) continue;
    while (c.nextSibling && c.nextSibling !== n) c.nextSibling.remove();
    c.after(h('sup', { class: 'cite cite-sep' }, ','));
    added += 1;
  }
  return added;
}

function sourceItem(src: Source): HTMLElement {
  return h('li', { id: `source-${src.id}` },
    `${src.publisher}. `,
    h('a', { href: src.url, rel: 'noopener', target: '_blank' }, src.title),
    src.date ? `. ${src.date}.` : '.',
    h('span', { class: 'accessed' }, ` Accessed ${src.accessed}.`),
  );
}

export function mountStory(root: HTMLElement, story: StoryConfig): Unmount {
  const outline = story.parts;
  const all = outline.flatMap((p) => p.sections);
  const citations = createCitations(collectSources(all.map((s) => s.sources)));
  // Sections that load data (maps) build some steps after mount, so a source can
  // be cited for the first time after the list below exists. Append those late
  // entries to the list so every citation still has its endnote.
  let list: HTMLOListElement | null = null;
  let listed = 0;
  const syncList = (): void => {
    if (!list) return;
    const cited = citations.cited();
    for (const src of cited.slice(listed)) list.append(sourceItem(src));
    listed = cited.length;
  };
  const ctx = { cite: (id: string) => { const el = citations.cite(id); syncList(); return el; } };
  const unmounts: Unmount[] = [];

  const article = h('article', { class: 'story' },
    h('header', { class: 'story-top prose' },
      h('div', { class: 'kicker' }, story.kicker),
      h('h1', { class: 'headline' }, story.headline),
      h('p', { class: 'dek' }, story.dek),
      h('p', { class: 'byline' }, story.byline),
    ),
  );
  root.append(article);

  for (const part of outline) {
    article.append(
      h('div', { class: part.accent ? 'part-divider is-accent' : 'part-divider', 'data-part': part.id },
        h('div', { class: 'part-label' }, part.label),
        h('div', { class: 'part-title' }, part.title),
      ),
    );
    for (const s of part.sections) {
      const el = h('section', { class: 'story-section', id: s.id },
        h('header', { class: 'section-head prose' },
          h('div', { class: 'kicker' }, s.kicker),
          h('h2', { class: 'section-title' }, s.title),
        ),
      );
      const body = h('div', { class: 'section-body' });
      el.append(body);
      article.append(el);
      try {
        unmounts.push(s.mount(body, ctx));
      } catch (err) {
        body.replaceChildren(errorBox(s.id, err));
      }
    }
  }

  separateAdjacentCitations(article);
  list = h('ol', { class: 'sources-list' });
  article.append(
    h('footer', { class: 'story-sources prose' },
      h('h2', { class: 'section-title' }, story.sourcesTitle ?? 'Sources and methodology'),
      h('p', { class: 'methodology' }, story.methodology),
      list,
    ),
  );
  syncList();

  return () => {
    for (const u of unmounts.reverse()) u();
    root.replaceChildren();
  };
}
