import { createScrolly } from '../scrolly';
import { demoGraphic, type DemoSeries, type DemoState } from './demo';
import { palette } from './palette';

const series: DemoSeries[] = [
  { key: 'rubber', label: 'Rubber', values: [[2020, 1.0e6], [2022, 1.4e6], [2024, 1.62e6]] },
  { key: 'felt', label: 'Felt', values: [[2020, 0.9e6], [2022, 1.3e6], [2024, 1.6e6]] },
  { key: 'cans', label: 'Cans', values: [[2020, 0.3e6], [2022, 0.4e6], [2024, 0.5e6]] },
];
const steps: { body: string; state: DemoState }[] = [
  { body: 'All three.', state: { highlight: null, yMax: 2e6 } },
  { body: 'Rubber.', state: { highlight: 'rubber', yMax: 2e6, note: { at: [2022, 1.4e6], text: 'Prices rose after the supply shock' } } },
  { body: 'Zoom out.', state: { highlight: 'felt', yMax: 4e6 } },
];

describe('kit demo through createScrolly (jsdom)', () => {
  beforeEach(() => vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') })));
  afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

  it('renders a house-style chart and updates it step by step', () => {
    const s = createScrolly({ id: 'kit-demo', graphic: demoGraphic(series), steps });
    document.body.append(s.element);
    const svg = s.element.querySelector('svg')!;
    s.goTo(0, 0); // jsdom has no layout, so observeSteps may report any step on mount

    // Step 0: axis with unit on the top tick only, three dodged labels, no accent.
    const ticks = [...svg.querySelectorAll('.y-axis text')].map((t) => t.textContent ?? '');
    expect(ticks.at(-1)).toBe('$2M a year');
    expect(ticks.filter((t) => t.includes('a year'))).toHaveLength(1);
    const labels = [...svg.querySelectorAll('.labels text')];
    expect(labels.map((l) => l.textContent)).toEqual(['Rubber', 'Felt', 'Cans']);
    const ys = labels.map((l) => Number(l.getAttribute('y')));
    expect(Math.abs(ys[0]! - ys[1]!)).toBeGreaterThanOrEqual(13 * 1.15 + 2 - 1e-6); // rubber and felt end 20k apart: dodged
    expect(svg.querySelectorAll(`[stroke="${palette.accent}"]`)).toHaveLength(0);

    // Step 1: accent on rubber, one annotation with a leader.
    s.goTo(1, 0);
    expect(svg.querySelectorAll(`path[stroke="${palette.accent}"]`)).toHaveLength(1);
    expect(svg.querySelectorAll('.kit-annotation')).toHaveLength(1);
    expect(svg.querySelector('.kit-annotation line')).not.toBeNull();

    // Step 2: axis rescales in place, annotation gone, layers not duplicated.
    s.goTo(2, 0);
    expect([...svg.querySelectorAll('.y-axis text')].at(-1)?.textContent).toBe('$4M a year');
    expect(svg.querySelectorAll('.kit-annotation')).toHaveLength(0);
    expect(svg.querySelectorAll('g.lines')).toHaveLength(1);
    expect(svg.querySelectorAll('.labels g.direct-label')).toHaveLength(3);

    // Text is never below 12px.
    for (const t of svg.querySelectorAll('text')) expect(Number(t.getAttribute('font-size'))).toBeGreaterThanOrEqual(12);

    // Tooltip lives in the plot and is removed on destroy.
    expect(s.element.querySelector('.kit-tooltip')).not.toBeNull();
    s.destroy();
    expect(s.element.querySelector('.kit-tooltip')).toBeNull();
    expect(svg.childElementCount).toBe(0);
  });
});
