# Story chart kit

One small toolkit so every graphic in a long story looks like one desk made it. Import
everything from the folder:

```ts
import { textSizes, plotArea, axisY, axisX, drawDirectLabels, drawAnnotation,
         morph, joinKeyed, layer, palette, fmtMoney } from '../../kit';
```

`demo.ts` is a complete `Graphic<S>` built only from the kit, and
`demo.test.ts` drives it through `createScrolly` in jsdom. Copy its shape.

## Rules the kit enforces

- Text is never below 12px (`styleText` throws). Lay out from `ctx.size` in
  real pixels; never set a `viewBox`.
- Colours come from `palette` (a test keeps it equal to the CSS tokens).
  Black and greys; `palette.accent` for the one thing the reader must see.
- Formatters throw on `NaN`/`Infinity`, `dodge` throws when labels cannot
  fit, `joinKeyed` throws on duplicate keys, `byName` throws with near
  matches. A crash at build time beats a wrong chart.
- Animation only through `morph`/`exitFade`: they animate when `ctx.animate`
  is true and the reader has not asked for reduced motion, and otherwise set
  final values synchronously (interrupting anything in flight).

## Formatting

```ts
fmtNum(-1234.5, 1)                     // "−1,234.5"  (true minus)
fmtShort(4_210_000)                    // "4.2 million"
fmtMoney(4_200_000)                    // "$4.2 million"
fmtMoney(-850_000)                     // "−$850,000"
fmtMoney(4_200_000, { style: 'abbr' }) // "$4.2M"   (tick labels only)
fmtMoney(3.5, { style: 'full', digits: 2 }) // "$3.50"
fmtTons(4_200_000, { metric: true })   // "4.2 million metric tons"
fmtUnit(2.5, 'in.', 1)                 // "2.5 in."      fmtUnit(55, '%') // "55%"
fmtRange(4e6, 6e6, (n) => fmtMoney(n)) // "$4–6 million"
fmtRange(-5, 5)                        // "−5 to 5"
```

Also re-exported from `core/format`: `fmtInt`, `fmtPct`, `fmtSignedPct`, `fmtFeet`.

## Sizing

```ts
const t = textSizes(ctx.size);   // { compact, tick, label, annotation, small, lineHeight, margin, ticks }
const area = plotArea(ctx.size, { ...t.margin, right: t.margin.right + 90 }); // room for end labels
textWidth('Carmel, Ind.', t.label);       // estimate in px (deterministic, works in jsdom)
wrapLines(longText, 160, t.annotation);   // string[]
styleText(sel.append('text'), t.label, { weight: 700, fill: palette.accent, anchor: 'end' });
```

Compact (phone) layout below 520px: 12–13px text, 4 ticks.

## Layers, joins, motion

```ts
const g = layer(svg, 'dots');                 // <g class="dots">, created once
const dots = joinKeyed(g, 'circle', 'dot', data, (d) => d.id,
  { enter: (s) => s.attr('r', 0), ctx });     // exits fade when ctx allows
morph(dots, ctx, { cx: (d) => x(d.x), cy: (d) => y(d.y), r: 4 });
```

`shouldAnimate(ctx)` if you need the decision yourself; `DURATION` = 600ms.

## Axes (Times style)

```ts
axisY(layer(svg, 'y-axis'), { scale: y, sizes: t, x0: area.x0, x1: area.x1, unit: 'million tons', ctx });
axisX(layer(svg, 'x-axis'), { scale: x, sizes: t, y: area.y1, format: String });
```

Hairline gridlines, labels sitting above each line at the left, no domain
line, darker baseline at zero, unit on the top tick only ("40 million tons",
"30", "20"). Use `topFormat: (v) => fmtMoney(v)` for money. `tickLabels()` is
the pure function behind it.

## Direct labels and annotations

```ts
drawDirectLabels(layer(svg, 'labels'), series.map((s) => ({
  key: s.key, text: s.label, x: x(lastX), y: y(lastY),
  ...(s.key === focus ? { color: palette.accent, bold: true } : {}),
})), { sizes: t, min: area.y0, max: area.y1, ctx });

const notes = layer(svg, 'notes'); notes.selectAll('*').remove();
drawAnnotation(notes, { anchor: { x: x(2019), y: y(v) }, text: 'Prices doubled', sizes: t,
  bounds: area, mark: true, accent: false, avoid: [/* rects to keep clear */] });
```

Pure pieces: `dodge(items, { min, max, gap })` separates label centres with
least movement; `placeAnnotation(req)` picks a side (ne, nw, se, sw, e, w, n,
s) that fits and returns a leader that ends on the box edge nearest the
anchor, so it never crosses its own text (property-tested).

## Tooltip

```ts
const tip = createTooltip(svgEl.parentElement!);  // in init()
tip.bind(dots, (d) => `${d.name}: ${fmtTons(d.tons)}`); // text, never parsed as HTML
tip.destroy();                                     // in destroy(): removes element and listeners
```

## Diagrams

```ts
drawDimension(g, { from, to, offset: 14, label: '2.57 in.', sizes: t });  // arrows, extension lines, upright label
drawCallout(g, { anchor, dx: 30, dy: -20, text: 'Seam', sizes: t });
rect.attr('fill', hatchPattern(svgEl, { id: 'ch01-core', angle: 45, cross: false })); // ids must be page-unique: prefix your chapter
const lay = drawStationRow(g, stations, { x, y, width, boxHeight: 56, sizes: t, active: 'press', done: ['mill'] });
token.attr('cx', tokenAt(lay, ctx.index + ctx.progress).x);  // moving token, wraps rows on phones
drawGantt(g, tasks, x, { y0, sizes: t, highlight: ['permits'], maxX: area.x1 });
const proj = project3d({ yaw: 0.6, pitch: 0.45, scale: 120, cx, cy });
drawSurface(g, surfaceQuads(saddle(1, 1, 0.5), proj, { u: [-1, 1], v: [-1, 1], nu: 16, nv: 16 }));
drawSurface(g, surfaceQuads(sphere(1), proj, { u: [0, 2 * Math.PI], v: [0, Math.PI], nu: 24, nv: 12 }));
```

Pure: `dimensionGeometry`, `stationLayout`, `tokenAt`, `ganttLayout`,
`project3d`, `surfaceQuads`. Surfaces use painter's ordering (paper fill,
ink stroke): right for a sphere and a saddle, not for arbitrary
self-intersecting shapes.

## Maps

```ts
const us = await loadUS();                 // states, nation, stateBorders (lon/lat); { counties: true } for counties
const world = await loadWorld('110m');     // countries, land, borders
const proj = fitProjection(geoAlbersUsa(), ctx.size, us.nation, 10);
const path = geoPath(proj);
byName(us.states, 'Indiana');
path(greatCircle(CARMEL, [100.5, 13.75]));      // curved great-circle line
path(route([CARMEL, INDY, [-87.63, 41.88]]));
distanceMiles(CARMEL, INDY);     // ~14.6, straight-line, not road miles
```

Atlases load by dynamic import, so only map chapters pay for them. Load in
the section's `mount`, then build the graphic; `update` stays synchronous.

## Not in the kit

No band/categorical axis (label bars directly), no legend helper (by
design), no canvas rendering, no time-scale axis (pass years as numbers with
`format: String`). `textWidth` is an estimate, roughly 10% of the browser's
measurement; leave slack. Not yet checked visually in a real browser.
