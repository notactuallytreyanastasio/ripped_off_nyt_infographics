/**
 * A worked example of a chapter graphic built only from the kit: a line
 * chart with a Times-style axis, dodged direct labels, one accent series and
 * an annotation, plus a tooltip. Copy this shape for a new Graphic<S>.
 * The data are placeholders for the demo test, not story facts.
 */
import { line, scaleLinear, select, type Selection } from 'd3';
import type { Graphic, GraphicContext, Size } from '../types';
import { axisX, axisY } from './axis';
import { fmtMoney } from './format';
import { drawAnnotation, drawDirectLabels } from './labels';
import { layer, morph } from './motion';
import { palette } from './palette';
import { plotArea, textSizes } from './size';
import { createTooltip, type Tooltip } from './tooltip';

/** One series in the demo. */
export interface DemoSeries { readonly key: string; readonly label: string; readonly values: readonly (readonly [number, number])[] }

/** Demo state: which series is in accent, the y-domain top, an optional note. */
export interface DemoState { readonly highlight: string | null; readonly yMax: number; readonly note?: { readonly at: readonly [number, number]; readonly text: string } }

/** Build the demo graphic over `series`. */
export function demoGraphic(series: readonly DemoSeries[]): Graphic<DemoState> {
  let svg: Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  let size: Size = { width: 0, height: 0 };
  let tip: Tooltip | null = null;

  return {
    title: 'Demo: costs over time',
    subtitle: 'Placeholder data',
    sourceIds: ['demo'],
    init(el, s) {
      svg = select(el);
      size = s;
      const plot = el.parentElement;
      if (plot) tip = createTooltip(plot);
    },
    resize(s) { size = s; },
    update(state: DemoState, ctx: GraphicContext) {
      if (!svg) throw new Error('demo: update before init');
      const t = textSizes(ctx.size);
      const labelRoom = 90;
      const area = plotArea(ctx.size, { ...t.margin, right: t.margin.right + labelRoom });
      const xs = series.flatMap((s) => s.values.map((v) => v[0]));
      const x = scaleLinear().domain([Math.min(...xs), Math.max(...xs)]).range([area.x0, area.x1]);
      const y = scaleLinear().domain([0, state.yMax]).range([area.y1, area.y0]).nice();

      axisY(layer(svg, 'y-axis'), { scale: y, sizes: t, x0: area.x0, x1: area.x1 + labelRoom, format: (v) => fmtMoney(v, { style: 'abbr' }), topFormat: (v) => fmtMoney(v, { style: 'abbr' }) + ' a year', ctx });
      axisX(layer(svg, 'x-axis'), { scale: x, sizes: t, y: area.y1, format: String, ticks: t.compact ? 3 : 5 });

      const lines = layer(svg, 'lines');
      const gen = line<readonly [number, number]>().x((d) => x(d[0])).y((d) => y(d[1]));
      const paths = lines.selectAll<SVGPathElement, DemoSeries>('path').data(series, (d) => d.key).join('path')
        .attr('fill', 'none')
        .attr('stroke', (d) => (d.key === state.highlight ? palette.accent : palette.data2))
        .attr('stroke-width', (d) => (d.key === state.highlight ? 2.5 : 1.5));
      morph(paths, ctx, { d: (d) => gen(d.values) ?? '' });
      if (tip) tip.bind(paths, (d) => d.label);

      drawDirectLabels(layer(svg, 'labels'), series.map((s) => {
        const last = s.values[s.values.length - 1];
        if (!last) throw new Error(`demo: series ${s.key} is empty`);
        return { key: s.key, text: s.label, x: x(last[0]), y: y(last[1]), ...(s.key === state.highlight ? { color: palette.accent, bold: true } : {}) };
      }), { sizes: t, min: area.y0, max: area.y1, ctx });

      const notes = layer(svg, 'notes');
      notes.selectAll('*').remove();
      if (state.note) {
        drawAnnotation(notes, { anchor: { x: x(state.note.at[0]), y: y(state.note.at[1]) }, text: state.note.text, sizes: t, bounds: area, mark: true });
      }
      void size;
    },
    destroy() {
      tip?.destroy();
      svg?.selectAll('*').remove();
      svg = null;
    },
  };
}
