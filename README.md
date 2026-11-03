# ripped_off_nyt_infographics

The parts used to build [How to Build a Tennis Ball Factory From Nothing](https://bobbby.online/tennis-potatoes), a 14-chapter scrolling graphics story with 313 cited sources, pulled out so the next one starts from here.

It is a newspaper-graphics-desk style done in plain TypeScript and D3: a chart that stays pinned while text cards scroll past it, every number tied to a source, numbered endnotes, and a deliberately dull palette of black, greys and one red. It is not affiliated with any newspaper; "ripped off" is a description of the taste, not of any code or assets. The fonts are the open-source Libre Franklin and Source Serif 4.

```ts
import { createScrolly, mountStory, steps, sourceLine, fact } from 'ripped-off-nyt-infographics';
import 'ripped-off-nyt-infographics/styles.css';
```

Run the example story with `npm install && npm run dev`.

## What is in it

| Module | What it does |
|---|---|
| `createScrolly` | Sticky scrollytelling. Graphic pinned on the right, cards on the left; on phones the graphic pins full-width and the cards pass over it. Graphics draw at their real pixel size, never a scaled viewBox, so 12px text stays 12px on a phone. |
| `observeSteps`, `activeStep`, `stepProgress` | The scroll engine underneath: one rAF-throttled scroll listener, and two pure functions you can test without a browser. |
| `mountStory` | The story shell: headline, dek, part dividers, sections in order, the numbered source list. A section that throws shows a located error box and the rest of the story still renders. |
| `fact`, `createCitations`, `collectSources` | Every displayed number is a `Fact` that names its sources. An estimate or a disputed figure without a note throws. Citations are numbered by first use; two sources with one id and different URLs throw. |
| `para`, `prose`, `steps`, `sourceLine`, `drawer`, `dataTable` | Copy as data: paragraphs are arrays of strings and `{ cite: id }` runs, so copy lives in its own file and can be fact-checked and tested. |
| Chart kit | Axes, direct labels that dodge each other, annotations whose leader line never crosses its own label, tooltips, dimension lines, hatching, process-station rows, Gantt bars, 3D surfaces, maps. See [docs/kit.md](docs/kit.md). |

## A graphic

A graphic is an object with `init`, `update(state, ctx)`, `resize` and `destroy`. Each scroll step carries a state; `update` draws it. `ctx` gives the step index, scroll progress through the step, whether to animate, and the plot's size in pixels.

```ts
const COST_STEPS: CopyStep<DemoState>[] = [
  { paras: [['Three costs set the price of almost everything.', { cite: 'demo' }]], state: { highlight: null, yMax: 70000 } },
  { paras: [['Labor is the biggest by far.']], state: { highlight: 'labor', yMax: 70000 } },
];

const graphic = demoGraphic(SERIES);
const s = createScrolly({
  id: 'costs',
  graphic,
  steps: steps(COST_STEPS, ctx),
  renderSource: () => sourceLine(graphic.sourceIds, SOURCES, ctx),
});
root.append(s.element);
```

`demoGraphic` in `src/kit/demo.ts` is a complete line chart built only from the kit. Copy it to start a new one. The full example story is in `example/main.ts`.

## Rules the code enforces

These fail loudly rather than draw something wrong:

- Text is never smaller than 12px: `styleText` throws if asked for less.
- Colours come only from `palette`, and a test checks it against the CSS tokens.
- Formatters throw on `NaN`. `dodge` throws when labels cannot fit. Keyed joins throw on duplicate keys. A Gantt task that ends before it starts throws.
- A citation to an unknown source id throws instead of printing a dead number.
- Animation runs only when `ctx.animate` is true and the reader has not asked for reduced motion; otherwise final values are set at once.

## Things learned the hard way, now fixed here

- **`svg text { fill: ... }` in CSS beats SVG `fill` attributes**, so every red label silently rendered black. The base stylesheet only fills text that has no fill of its own.
- **On phones a sticky child cannot outlive its parent.** With the figure one screen tall, the graphic scrolled away after the first card. Figure and steps now share one grid cell, so the figure is as tall as all the steps.
- **The scroll engine fires `onProgress` in the same frame as `onStep`.** Redrawing un-animated there cancelled every step transition. That first progress event is now dropped.
- **Hash routing and endnotes collide.** If your app routes on `location.hash`, a citation link to `#source-x` will look like a route. Treat a hash without a slash as an in-page anchor.

## What it does not do

- No categorical (bar) axis and no time axis; pass years as numbers with `format: String`.
- No legends. The house style labels lines directly.
- Text widths are estimated, not measured, so they work in jsdom; leave about 10% slack.
- On phones the cards cover part of the graphic as they pass. That is the usual phone layout for this form, not a solved problem.
- Built for bundlers (Vite, webpack, esbuild). The ESM output is not meant for Node.

## Development

```sh
npm install
npm test          # vitest + jsdom
npm run typecheck # strict TypeScript, noUncheckedIndexedAccess, exactOptionalPropertyTypes
npm run dev       # the example story
npm run build     # dist/index.js, dist/types, dist/styles.css
```

MIT licensed.
