import { select } from 'd3';
import {
  dimensionGeometry, drawDimension, drawGantt, drawStationRow, ganttLayout, hatchPattern,
  project3d, saddle, sphere, stationLayout, surfaceQuads, tokenAt,
} from './diagram';
import { textSizes } from './size';

afterEach(() => { document.body.innerHTML = ''; });
const sizes = textSizes({ width: 390, height: 600 });

describe('dimensionGeometry', () => {
  it('horizontal dimension offset upward gets extension lines and an upright label', () => {
    const g = dimensionGeometry({ from: { x: 0, y: 100 }, to: { x: 100, y: 100 }, offset: 20 });
    expect(g.line).toEqual({ x1: 0, y1: 80, x2: 100, y2: 80 });
    expect(g.extensions).toHaveLength(2);
    expect(g.angle).toBe(0);
    expect(g.labelAbove).toBe(true);
    expect(g.label.y).toBeLessThan(80);
  });
  it('arrowheads touch the line ends', () => {
    const g = dimensionGeometry({ from: { x: 0, y: 0 }, to: { x: 100, y: 0 } });
    expect(g.arrows[0].startsWith('M0,0')).toBe(true);
    expect(g.arrows[1].startsWith('M100,0')).toBe(true);
  });
  it('keeps text upright for right-to-left and vertical lines', () => {
    expect(dimensionGeometry({ from: { x: 100, y: 0 }, to: { x: 0, y: 0 } }).angle).toBe(0);
    const v = dimensionGeometry({ from: { x: 0, y: 0 }, to: { x: 0, y: 100 } }).angle;
    expect(v).toBeGreaterThan(-90);
    expect(v).toBeLessThanOrEqual(90);
  });
  it('throws on a zero-length dimension', () => {
    expect(() => dimensionGeometry({ from: { x: 1, y: 1 }, to: { x: 1, y: 1 } })).toThrow();
  });
  it('draws', () => {
    const g = select(document.body).append('svg').append('g');
    drawDimension(g, { from: { x: 0, y: 50 }, to: { x: 200, y: 50 }, offset: 12, label: '2.7 in.', sizes });
    expect(g.select('text').text()).toBe('2.7 in.');
    expect(g.selectAll('path').size()).toBe(2);
  });
});

describe('hatchPattern', () => {
  it('defines once per id and returns a url', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    expect(hatchPattern(svg, { id: 'ch01-core' })).toBe('url(#ch01-core)');
    hatchPattern(svg, { id: 'ch01-core' });
    expect(svg.querySelectorAll('pattern')).toHaveLength(1);
    hatchPattern(svg, { id: 'ch01-felt', cross: true });
    expect(svg.querySelector('#ch01-felt')?.querySelectorAll('line')).toHaveLength(2);
    expect(() => hatchPattern(svg, { id: 'bad id' })).toThrow();
  });
});

describe('stationLayout and tokenAt', () => {
  it('one row when wide enough', () => {
    const l = stationLayout(4, { x: 0, y: 0, width: 600, boxHeight: 50 });
    expect(l.columns).toBe(4);
    expect(l.arrows).toHaveLength(3);
    expect(l.boxes.every((b) => b.row === 0)).toBe(true);
  });
  it('wraps on a phone, keeping boxes at least minBox wide', () => {
    const l = stationLayout(8, { x: 0, y: 0, width: 370, boxHeight: 50, minBox: 84 });
    expect(l.columns).toBe(3);
    expect(l.boxes[0]!.width).toBeGreaterThanOrEqual(84);
    expect(l.boxes[3]!.row).toBe(1);
    expect(l.arrows[2]).toContain('V');
  });
  it('token moves between centres and through the elbow', () => {
    const l = stationLayout(4, { x: 0, y: 0, width: 300, boxHeight: 40, minBox: 84 });
    const c0 = tokenAt(l, 0), c1 = tokenAt(l, 1);
    expect(tokenAt(l, 0.5).x).toBeCloseTo((c0.x + c1.x) / 2, 1);
    expect(tokenAt(l, -3)).toEqual(c0);
    expect(tokenAt(l, 99)).toEqual(tokenAt(l, 3));
    const mid = tokenAt(l, 2.5); // across a row break (3 columns)
    expect(mid.y).toBeGreaterThan(c0.y);
  });
  it('draws boxes, arrows, the active station in accent', () => {
    const g = select(document.body).append('svg').append('g');
    drawStationRow(g, [{ key: 'mill', label: 'Mixing mill' }, { key: 'press', label: 'Half-shell press', sub: '160°C' }],
      { x: 0, y: 0, width: 360, boxHeight: 60, sizes, active: 'press' });
    expect(g.selectAll('g.station').size()).toBe(2);
    expect(g.select('g.station.is-active').attr('data-key')).toBe('press');
    expect(g.selectAll('path.arrowhead').size()).toBe(1);
  });
});

describe('gantt', () => {
  it('stacks rows with the label above the bar', () => {
    const x = (v: number) => v * 10;
    const { rows, height } = ganttLayout([{ key: 'a', label: 'Permits', start: 0, end: 6 }, { key: 'b', label: 'Steel', start: 4, end: 9 }], x, { y0: 0, sizes });
    expect(rows[0]!.labelY).toBeLessThan(rows[0]!.barY);
    expect(rows[1]!.labelY).toBeGreaterThan(rows[0]!.barY);
    expect(rows[1]!.width).toBe(50);
    expect(height).toBeGreaterThan(0);
    expect(() => ganttLayout([{ key: 'z', label: 'z', start: 5, end: 1 }], x, { y0: 0, sizes })).toThrow(/ends before/);
  });
  it('draws highlighted bars in accent', () => {
    const g = select(document.body).append('svg').append('g');
    drawGantt(g, [{ key: 'a', label: 'Permits', start: 0, end: 6 }], (v) => v * 10, { y0: 0, sizes, highlight: ['a'] });
    expect(g.select('rect').attr('fill')).toBe('#b5371f');
  });
});

describe('3D projection', () => {
  const view = { yaw: 0, pitch: 0, scale: 100, cx: 200, cy: 150 };
  it('maps the origin to the centre and z up to screen up', () => {
    const p = project3d(view);
    expect(p([0, 0, 0])).toMatchObject({ x: 200, y: 150 });
    expect(p([0, 0, 1]).y).toBe(50);
    expect(p([1, 0, 0]).x).toBe(300);
  });
  it('sphere points lie at radius r', () => {
    const s = sphere(2);
    for (const [u, v] of [[0, 0.3], [1, 1], [4, 2.5]] as const) {
      const [x, y, z] = s(u, v);
      expect(Math.hypot(x, y, z)).toBeCloseTo(2);
    }
  });
  it('saddle rises along u and falls along v', () => {
    const s = saddle();
    expect(s(1, 0)[2]).toBeGreaterThan(0);
    expect(s(0, 1)[2]).toBeLessThan(0);
  });
  it('surfaceQuads returns nu*nv quads sorted back to front', () => {
    const q = surfaceQuads(saddle(), project3d({ ...view, yaw: 0.6, pitch: 0.5 }), { u: [-1, 1], v: [-1, 1], nu: 6, nv: 5 });
    expect(q).toHaveLength(30);
    for (let i = 1; i < q.length; i++) expect(q[i]!.depth).toBeGreaterThanOrEqual(q[i - 1]!.depth);
  });
});
