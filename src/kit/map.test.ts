import { geoAlbersUsa, geoPath } from 'd3';
import { byName, distanceMiles, fitProjection, greatCircle, loadUS, loadWorld, route } from './map';

// Carmel, Ind. (Census gazetteer) and Indianapolis (Monument Circle), as [lon, lat].
const CARMEL = [-86.118, 39.9784] as const;
const INDY = [-86.1581, 39.7684] as const;

describe('maps', () => {
  it('loads world countries as named features', async () => {
    const w = await loadWorld();
    expect(w.countries.features.length).toBeGreaterThan(150);
    expect(byName(w.countries, 'Thailand').properties.name).toBe('Thailand');
    expect(() => byName(w.countries, 'Atlantis')).toThrow(/no feature/);
  });
  it('loads US states and fits a projection to a phone-size box', async () => {
    const us = await loadUS();
    const indiana = byName(us.states, 'Indiana');
    const proj = fitProjection(geoAlbersUsa(), { width: 390, height: 300 }, us.nation, 10);
    const [[x0, y0], [x1, y1]] = geoPath(proj).bounds(us.nation);
    expect(x0).toBeGreaterThanOrEqual(9);
    expect(x1).toBeLessThanOrEqual(381);
    expect(y0).toBeGreaterThanOrEqual(9);
    expect(y1).toBeLessThanOrEqual(291);
    const c = proj([...CARMEL]);
    expect(c).not.toBeNull();
    expect(geoPath(proj).bounds(indiana)[0][0]).toBeLessThan(c![0]);
  });
  it('great circle and multi-leg routes', () => {
    const gc = greatCircle(CARMEL, [100.5, 13.75], 10);
    expect(gc.coordinates).toHaveLength(11);
    expect(gc.coordinates[0]![0]).toBeCloseTo(-86.118);
    const r = route([CARMEL, INDY, [-87.63, 41.88]], 4);
    expect(r.coordinates).toHaveLength(9);
    expect(() => route([CARMEL])).toThrow();
  });
  it('distance Carmel to Indianapolis is about 15 miles straight-line', () => {
    const d = distanceMiles(CARMEL, INDY);
    expect(d).toBeGreaterThan(13);
    expect(d).toBeLessThan(16);
  });
});
