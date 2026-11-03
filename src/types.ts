/**
 * Core types. Every number shown to a reader is a Fact that names its
 * sources; every chart names the sources it draws.
 */

/** Tear-down returned by every mount, so nothing is left behind. */
export type Unmount = () => void;

export type SourceKind =
  | 'primary'      // rules, standards, filings, government statistics, company documents
  | 'secondary'    // journalism, trade press, academic papers
  | 'industry'     // market reports, supplier catalogues, price quotes
  | 'interview';   // first-hand accounts, factory tours on video

export interface Source {
  readonly id: string;          // kebab-case, unique across the whole story
  readonly title: string;
  readonly publisher: string;
  readonly url: string;
  readonly accessed: string;    // YYYY-MM-DD
  readonly kind: SourceKind;
  readonly date?: string;       // publication date if known
}

/**
 * verified: stated directly by a cited source.
 * estimate: derived by us from cited inputs; `note` must say how.
 * disputed: sources disagree; `note` must give the range.
 */
export type FactStatus = 'verified' | 'estimate' | 'disputed';

export interface Fact<T> {
  readonly value: T;
  readonly unit?: string;
  readonly sources: readonly string[];
  readonly status: FactStatus;
  readonly note?: string;
}

// ------------------------------------------------------------- scrolly

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface GraphicContext {
  readonly index: number;
  /** 0..1 through the active step, for scroll-scrubbed animation. */
  readonly progress: number;
  /** false when scrubbing within a step or when reduced motion is on. */
  readonly animate: boolean;
  readonly size: Size;
}

/**
 * A sticky graphic. It draws into an SVG sized in real CSS pixels (no
 * viewBox scaling), so text stays legible on phones: lay out from `size`.
 */
export interface Graphic<S> {
  readonly title: string;
  readonly subtitle: string;
  readonly sourceIds: readonly string[];
  init(svg: SVGSVGElement, size: Size): void;
  update(state: S, ctx: GraphicContext): void;
  resize(size: Size): void;
  destroy(): void;
}

export interface Step<S> {
  /** A string becomes a paragraph; a Node is used as-is (citations, emphasis). */
  readonly body: string | Node;
  readonly state: S;
}

// ------------------------------------------------------------- sections

export interface SectionContext {
  /** Superscript citation linking to the story's source list. */
  cite(sourceId: string): HTMLElement;
}

export interface Section {
  readonly id: string;           // matches folder name, e.g. "01-the-ball"
  readonly kicker: string;       // e.g. "Chapter 1"
  readonly title: string;
  readonly sources: readonly Source[];
  mount(root: HTMLElement, ctx: SectionContext): Unmount;
}
