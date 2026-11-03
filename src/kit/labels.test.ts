import { dodge, nearestPointOnRect, placeAnnotation, rectsOverlap, segmentCrossesRect, type Side } from './labels';

describe('dodge', () => {
  const spans = (ys: number[], h: number) => ys.map((y) => [y - h / 2, y + h / 2] as const);
  const noOverlap = (ys: number[], h: number, gap: number) => {
    const s = spans([...ys].sort((a, b) => a - b), h);
    for (let i = 1; i < s.length; i++) expect(s[i]![0] - s[i - 1]![1]).toBeGreaterThanOrEqual(gap - 1e-9);
  };

  it('leaves separated labels alone', () => {
    expect(dodge([{ y: 10, height: 10 }, { y: 50, height: 10 }])).toEqual([10, 50]);
  });
  it('splits a colliding pair symmetrically around their mean', () => {
    expect(dodge([{ y: 100, height: 14 }, { y: 104, height: 14 }])).toEqual([94, 110]);
  });
  it('returns positions in input order and keeps order', () => {
    const ys = dodge([{ y: 104, height: 14 }, { y: 100, height: 14 }]);
    expect(ys).toEqual([110, 94]);
  });
  it('resolves a pile-up with no overlaps and respects bounds', () => {
    const items = [50, 51, 52, 53, 54, 200, 201].map((y) => ({ y, height: 12 }));
    const ys = dodge(items, { min: 30, max: 210, gap: 2 });
    noOverlap(ys, 12, 2);
    for (const y of ys) {
      expect(y - 6).toBeGreaterThanOrEqual(30 - 1e-9);
      expect(y + 6).toBeLessThanOrEqual(210 + 1e-9);
    }
  });
  it('random inputs never overlap (property)', () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 200; k++) {
      const n = 1 + Math.floor(rnd() * 12);
      const items = Array.from({ length: n }, () => ({ y: rnd() * 300, height: 13 }));
      const ys = dodge(items, { min: 0, max: 300 });
      noOverlap(ys, 13, 2);
      for (const y of ys) expect(y).toBeGreaterThanOrEqual(6.5 - 1e-9);
    }
  });
  it('throws when labels cannot fit', () => {
    expect(() => dodge([{ y: 0, height: 20 }, { y: 0, height: 20 }], { min: 0, max: 30 })).toThrow(/need/);
  });
});

describe('geometry helpers', () => {
  const r = { x: 10, y: 10, width: 20, height: 10 };
  it('nearestPointOnRect clamps', () => {
    expect(nearestPointOnRect({ x: 0, y: 0 }, r)).toEqual({ x: 10, y: 10 });
    expect(nearestPointOnRect({ x: 50, y: 15 }, r)).toEqual({ x: 30, y: 15 });
  });
  it('segmentCrossesRect: through yes, ending on edge no, along edge no', () => {
    expect(segmentCrossesRect({ x: 0, y: 15 }, { x: 40, y: 15 }, r)).toBe(true);
    expect(segmentCrossesRect({ x: 0, y: 15 }, { x: 10, y: 15 }, r)).toBe(false);
    expect(segmentCrossesRect({ x: 0, y: 10 }, { x: 40, y: 10 }, r)).toBe(false);
    expect(segmentCrossesRect({ x: 0, y: 0 }, { x: 5, y: 40 }, r)).toBe(false);
  });
  it('rectsOverlap ignores touching edges', () => {
    expect(rectsOverlap(r, { x: 30, y: 10, width: 5, height: 5 })).toBe(false);
    expect(rectsOverlap(r, { x: 29, y: 10, width: 5, height: 5 })).toBe(true);
  });
});

describe('placeAnnotation', () => {
  const bounds = { x0: 0, y0: 0, x1: 390, y1: 300, width: 390, height: 300 };

  it('takes the first preferred side that fits', () => {
    const p = placeAnnotation({ anchor: { x: 100, y: 150 }, width: 80, height: 30, bounds });
    expect(p.side).toBe('ne');
    expect(p.fits).toBe(true);
    expect(p.textAnchor).toBe('start');
  });
  it('flips to the west near the right edge and right-aligns text', () => {
    const p = placeAnnotation({ anchor: { x: 370, y: 150 }, width: 80, height: 30, bounds });
    expect(p.side).toBe('nw');
    expect(p.textAnchor).toBe('end');
    expect(p.textX).toBeCloseTo(p.box.x + p.box.width);
  });
  it('avoids other labels', () => {
    const blocker = { x: 100, y: 80, width: 120, height: 60 };
    const p = placeAnnotation({ anchor: { x: 100, y: 150 }, width: 80, height: 30, bounds, avoid: [blocker] });
    expect(rectsOverlap(p.box, blocker)).toBe(false);
  });
  it('the leader never crosses its own label, for every side and many anchors (property)', () => {
    const sides: Side[] = ['ne', 'nw', 'se', 'sw', 'e', 'w', 'n', 's'];
    for (const side of sides) {
      for (let x = 5; x < 390; x += 37) {
        for (let y = 5; y < 300; y += 41) {
          const p = placeAnnotation({ anchor: { x, y }, width: 110, height: 34, bounds, prefer: [side] });
          if (!p.leader) continue;
          expect(segmentCrossesRect({ x: p.leader.x1, y: p.leader.y1 }, { x: p.leader.x2, y: p.leader.y2 }, p.box)).toBe(false);
          // and it ends on the box
          const end = nearestPointOnRect({ x: p.leader.x2, y: p.leader.y2 }, p.box);
          expect(end.x).toBeCloseTo(p.leader.x2);
          expect(end.y).toBeCloseTo(p.leader.y2);
        }
      }
    }
  });
  it('clamps into bounds when nothing fits', () => {
    const p = placeAnnotation({ anchor: { x: 195, y: 150 }, width: 380, height: 280, bounds });
    expect(p.fits).toBe(false);
    expect(p.box.x).toBeGreaterThanOrEqual(0);
    expect(p.box.y + p.box.height).toBeLessThanOrEqual(300);
  });
});
