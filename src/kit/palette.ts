/**
 * House colours, mirrored from the CSS tokens in src/styles/base.css (a test keeps
 * them in sync). Use these instead of hex literals so the story reads as one
 * desk: black and greys for everything, `accent` only for the one thing the
 * reader must see.
 */
export const palette = {
  /** Body text, primary marks, baselines. `--ink` */
  ink: '#121212',
  /** Secondary text. `--ink-2` */
  ink2: '#333333',
  /** Axis labels, notes. `--muted` */
  muted: '#666666',
  /** De-emphasised labels. `--faint` */
  faint: '#999999',
  /** Gridlines and hairlines. `--rule` */
  rule: '#e2e2e2',
  /** Background; also the fill that hides lines behind a shape. `--paper` */
  paper: '#ffffff',
  /** Very light panel fill. `--wash` */
  wash: '#f7f7f5',
  /** The single highlight. `--accent` */
  accent: '#b5371f',
  /** Accent at low strength (ranges, bands). `--accent-soft` */
  accentSoft: '#e9c9c1',
  /** Data series in order of emphasis. `--data-1..3` */
  data1: '#121212',
  data2: '#8c8c8c',
  data3: '#c8c8c8',
} as const;

/** A key of {@link palette}. */
export type PaletteKey = keyof typeof palette;

/** CSS custom property each palette key mirrors. */
export const cssToken: Readonly<Record<PaletteKey, string>> = {
  ink: '--ink', ink2: '--ink-2', muted: '--muted', faint: '--faint', rule: '--rule',
  paper: '--paper', wash: '--wash', accent: '--accent', accentSoft: '--accent-soft',
  data1: '--data-1', data2: '--data-2', data3: '--data-3',
};

/** Font stacks: sans for every label, tick and UI string; serif for prose only. */
export const fonts = {
  sans: "'Libre Franklin', 'Helvetica Neue', Arial, sans-serif",
  serif: "'Source Serif 4', Georgia, 'Times New Roman', serif",
} as const;

/** Hairline width in CSS px for axes, gridlines, leaders and outlines. */
export const HAIRLINE = 1;
