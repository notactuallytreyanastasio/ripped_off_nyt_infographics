/**
 * An example story built only from the library. The data are made up; the
 * point is the shape: copy as data, a Graphic<S> per scrolly, facts that
 * name their sources, and a story config that orders the sections.
 */
import '../src/styles/base.css';
import '../src/styles/story.css';
import {
  createScrolly, dataTable, demoGraphic, drawer, fact, fmtMoney, mountStory, prose, sourceLine, steps,
  type CopyStep, type DemoSeries, type DemoState, type Section, type Source,
} from '../src';

const SOURCES: readonly Source[] = [
  { id: 'demo', title: 'Made-up figures for this example', publisher: 'The Example Desk', url: 'https://github.com/notactuallytreyanastasio/ripped_off_nyt_infographics', accessed: '2026-11-03', kind: 'primary' },
  { id: 'demo-method', title: 'How the example numbers were invented', publisher: 'The Example Desk', url: 'https://github.com/notactuallytreyanastasio/ripped_off_nyt_infographics#example', accessed: '2026-11-03', kind: 'secondary' },
];

const SERIES: readonly DemoSeries[] = [
  { key: 'rent', label: 'Rent', values: [[2016, 18000], [2018, 21000], [2020, 22500], [2022, 27000], [2024, 31000]] },
  { key: 'power', label: 'Power', values: [[2016, 6000], [2018, 6400], [2020, 7600], [2022, 11800], [2024, 10200]] },
  { key: 'labor', label: 'Labor', values: [[2016, 52000], [2018, 55000], [2020, 58000], [2022, 64000], [2024, 69000]] },
];

const peakPower = fact(11800, { sources: ['demo'], unit: 'dollars a year' });

const COST_STEPS: readonly CopyStep<DemoState>[] = [
  { paras: [['Three costs set the price of almost everything a small workshop makes.', { cite: 'demo' }]], state: { highlight: null, yMax: 70000 } },
  { paras: [['Labor is the biggest by far, and it climbs every year.']], state: { highlight: 'labor', yMax: 70000 } },
  { paras: [[`Power is the smallest, but the most volatile: it peaked at ${fmtMoney(peakPower.value)} in 2022.`, { cite: 'demo' }]], state: { highlight: 'power', yMax: 15000, note: { at: [2022, 11800], text: 'The 2022 spike' } } },
  { paras: [['Rent grew steadily, about 70 percent in eight years.', { cite: 'demo-method' }]], state: { highlight: 'rent', yMax: 35000 } },
];

const costs: Section = {
  id: '01-costs',
  kicker: 'Chapter 1',
  title: 'Where the Money Goes',
  sources: SOURCES,
  mount(root, ctx) {
    root.append(prose([
      ['This page is an example built with the library. Every number on it is invented.', { cite: 'demo-method' }],
      ['Scroll: the chart on the right stays pinned while the cards move past it.'],
    ], ctx));
    const graphic = demoGraphic(SERIES);
    const s = createScrolly({
      id: 'costs', graphic, steps: steps(COST_STEPS, ctx),
      renderSource: () => sourceLine(graphic.sourceIds, SOURCES, ctx),
    });
    root.append(s.element);
    root.append(dataTable({
      caption: 'Annual costs, 2024',
      columns: [{ label: 'Cost' }, { label: 'Dollars', numeric: true }],
      rows: SERIES.map((x) => [x.label, fmtMoney(x.values[x.values.length - 1]![1])]),
    }));
    root.append(drawer('How we made these numbers up', [
      ['We picked round numbers that look plausible and moved them a little each year.', { cite: 'demo-method' }],
    ], ctx));
    return () => s.destroy();
  },
};

const turn: Section = {
  id: '02-turn',
  kicker: 'Chapter 2',
  title: 'Then Something Changed',
  sources: SOURCES,
  mount(root, ctx) {
    root.append(prose([['An accented part divider marks a turn in the story. Sections in later parts work the same way.', { cite: 'demo' }]], ctx));
    return () => root.replaceChildren();
  },
};

const app = document.getElementById('app');
if (!app) throw new Error('example: #app missing');
mountStory(app, {
  kicker: 'Example',
  headline: 'How a Small Workshop Pays Its Bills',
  dek: 'A made-up story that shows the parts: a pinned chart, scroll cards, a table, a drawer and numbered sources.',
  byline: 'By the Example Desk',
  methodology: 'Everything on this page is invented to demonstrate the library.',
  parts: [
    { id: 'one', label: 'Part I', title: 'The Costs', sections: [costs] },
    { id: 'turn', label: 'Interlude', title: 'The Turn', accent: true, sections: [turn] },
  ],
});
