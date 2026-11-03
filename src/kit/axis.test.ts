import { scaleLinear, select } from 'd3';
import { axisX, axisY, tickLabels } from './axis';
import { fmtMoney } from './format';
import { palette } from './palette';
import { textSizes } from './size';

afterEach(() => { document.body.innerHTML = ''; });

describe('tickLabels', () => {
  it('writes the unit on the top tick only', () => {
    expect(tickLabels([0, 10, 20, 30], String, 'million tons')).toEqual(['0', '10', '20', '30 million tons']);
    expect(tickLabels([0, 50, 100], String, '%')).toEqual(['0', '50', '100%']);
    expect(tickLabels([30, 0, 10], String, 'tons')).toEqual(['30 tons', '0', '10']);
  });
  it('topFormat overrides the top tick', () => {
    expect(tickLabels([0, 2e6, 4e6], (v) => String(v / 1e6), undefined, (v) => fmtMoney(v))).toEqual(['0', '2', '$4 million']);
  });
});

describe('axisY', () => {
  const sizes = textSizes({ width: 390, height: 500 });
  it('draws hairline gridlines, no domain path, labels above lines, dark zero baseline', () => {
    const g = select(document.body).append('svg').append('g');
    const y = scaleLinear().domain([0, 40]).range([300, 20]);
    axisY(g, { scale: y, sizes, x0: 0, x1: 350, unit: 'million' });
    expect(g.selectAll('path.domain').size()).toBe(0);
    const texts = g.selectAll<SVGTextElement, unknown>('text').nodes().map((n) => n.textContent);
    expect(texts[texts.length - 1]).toBe('40 million');
    expect(texts.filter((t) => t?.includes('million'))).toHaveLength(1);
    const zero = g.selectAll<SVGGElement, { v: number }>('g.tick').filter((d) => d.v === 0);
    expect(zero.select('line').attr('stroke')).toBe(palette.ink);
    expect(Number(g.select('text').attr('font-size'))).toBeGreaterThanOrEqual(12);
    expect(g.select('text').style('font-variant-numeric')).toBe('tabular-nums');
    expect(g.selectAll('g.tick').size()).toBeLessThanOrEqual(6);
  });
  it('updates in place when the scale changes', () => {
    const g = select(document.body).append('svg').append('g');
    axisY(g, { scale: scaleLinear().domain([0, 40]).range([300, 20]), sizes, x0: 0, x1: 300 });
    axisY(g, { scale: scaleLinear().domain([0, 80]).range([300, 20]), sizes, x0: 0, x1: 300 });
    expect(g.selectAll('g.tick').size()).toBeLessThanOrEqual(6);
    expect(g.selectAll('g.tick').filter((d) => (d as { v: number }).v === 80).size()).toBe(1);
  });
});

describe('axisX', () => {
  it('keeps end labels inside the range', () => {
    const g = select(document.body).append('svg').append('g');
    const x = scaleLinear().domain([2000, 2025]).range([0, 360]);
    axisX(g, { scale: x, sizes: textSizes({ width: 390, height: 400 }), y: 280, tickValues: [2000, 2010, 2025], format: String });
    const anchors = g.selectAll('text').nodes().map((n) => (n as Element).getAttribute('text-anchor'));
    expect(anchors).toEqual(['start', 'middle', 'end']);
  });
});
