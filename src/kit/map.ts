/**
 * Maps: load world-atlas and us-atlas TopoJSON as typed GeoJSON, fit a
 * projection to a box, and draw great-circle routes. The atlases are
 * imported dynamically so they only load for chapters that draw a map.
 *
 * Coordinates are [longitude, latitude] everywhere, as in GeoJSON.
 */
import type { Feature, FeatureCollection, Geometry, LineString, MultiLineString } from 'geojson';
import type { GeoPermissibleObjects, GeoProjection } from 'd3';
import { geoDistance, geoInterpolate } from 'd3';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { Size } from '../types';

/** [longitude, latitude] in degrees. */
export type LonLat = readonly [number, number];

/** Properties carried by atlas features. */
export interface AtlasProps { readonly name: string }

/** A collection of atlas polygons with a `name` property and the atlas id (ISO 3166 numeric or FIPS). */
export type AtlasFeatures = FeatureCollection<Geometry, AtlasProps>;

/**
 * Convert one object of a topology to GeoJSON features. Throws, naming the
 * available objects, if `object` is missing.
 */
export function featuresOf(topology: Topology, object: string): AtlasFeatures {
  const obj = topology.objects[object];
  if (!obj) throw new Error(`featuresOf: no object "${object}"; have ${Object.keys(topology.objects).join(', ')}`);
  const fc = feature(topology, obj as GeometryCollection);
  if (fc.type !== 'FeatureCollection') throw new Error(`featuresOf: "${object}" is not a GeometryCollection`);
  return fc as unknown as AtlasFeatures;
}

/** Internal borders only (each shared edge once), for drawing hairline boundaries. */
export function bordersOf(topology: Topology, object: string): MultiLineString {
  const obj = topology.objects[object];
  if (!obj) throw new Error(`bordersOf: no object "${object}"`);
  return mesh(topology, obj as GeometryCollection, (a, b) => a !== b);
}

/** World countries and land. */
export interface World { readonly countries: AtlasFeatures; readonly land: AtlasFeatures; readonly borders: MultiLineString }

/**
 * Load the world atlas. '110m' (default) is right for a world or continent
 * map; '50m' for a country or region.
 */
export async function loadWorld(resolution: '110m' | '50m' = '110m'): Promise<World> {
  const mod = resolution === '50m'
    ? await import('world-atlas/countries-50m.json')
    : await import('world-atlas/countries-110m.json');
  const topo = mod.default as unknown as Topology;
  return { countries: featuresOf(topo, 'countries'), land: featuresOf(topo, 'land'), borders: bordersOf(topo, 'countries') };
}

/** US states, counties and the nation outline, in longitude/latitude (project with geoAlbersUsa or a state-plane conic). */
export interface US { readonly states: AtlasFeatures; readonly nation: AtlasFeatures; readonly stateBorders: MultiLineString; readonly counties?: AtlasFeatures }

/**
 * Load the US atlas (1:10m, unprojected). Pass `counties: true` for county
 * polygons (Hamilton County, Ind., is id "18057"); it is a bigger file.
 */
export async function loadUS(opts: { readonly counties?: boolean } = {}): Promise<US> {
  if (opts.counties) {
    const topo = (await import('us-atlas/counties-10m.json')).default as unknown as Topology;
    return { states: featuresOf(topo, 'states'), nation: featuresOf(topo, 'nation'), stateBorders: bordersOf(topo, 'states'), counties: featuresOf(topo, 'counties') };
  }
  const topo = (await import('us-atlas/states-10m.json')).default as unknown as Topology;
  return { states: featuresOf(topo, 'states'), nation: featuresOf(topo, 'nation'), stateBorders: bordersOf(topo, 'states') };
}

/** Find a feature by exact name, throwing (with near matches) if absent. */
export function byName<P extends AtlasProps>(fc: FeatureCollection<Geometry, P>, name: string): Feature<Geometry, P> {
  const f = fc.features.find((x) => x.properties.name === name);
  if (!f) {
    const near = fc.features.map((x) => x.properties.name).filter((n) => n.toLowerCase().includes(name.toLowerCase().slice(0, 4))).slice(0, 5);
    throw new Error(`byName: no feature "${name}"${near.length ? `; did you mean ${near.join(', ')}?` : ''}`);
  }
  return f;
}

/**
 * Fit `projection` so `object` fills `size` inside `margin` px, and return it.
 * @example const proj = fitProjection(geoAlbersUsa(), ctx.size, us.nation, 8);
 */
export function fitProjection<P extends GeoProjection>(projection: P, size: Size, object: GeoPermissibleObjects, margin = 10): P {
  projection.fitExtent([[margin, margin], [Math.max(margin + 1, size.width - margin), Math.max(margin + 1, size.height - margin)]], object);
  return projection;
}

/**
 * Great-circle route from `a` to `b` as a GeoJSON LineString with `steps`
 * segments, ready for d3.geoPath. Draws as a curve on flat projections.
 */
export function greatCircle(a: LonLat, b: LonLat, steps = 64): LineString {
  const interp = geoInterpolate([a[0], a[1]], [b[0], b[1]]);
  return { type: 'LineString', coordinates: Array.from({ length: steps + 1 }, (_, i) => interp(i / steps)) };
}

/** A multi-leg route through waypoints, each leg a great circle. */
export function route(points: readonly LonLat[], stepsPerLeg = 32): LineString {
  if (points.length < 2) throw new Error('route: need at least two points');
  const coords: [number, number][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (!a || !b) continue;
    const leg = greatCircle(a, b, stepsPerLeg).coordinates as [number, number][];
    coords.push(...(i === 1 ? leg : leg.slice(1)));
  }
  return { type: 'LineString', coordinates: coords };
}

/** Mean Earth radius (IUGG), km. */
export const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in km. This is straight-line, not road or shipping distance: say so in copy. */
export function distanceKm(a: LonLat, b: LonLat): number {
  return geoDistance([a[0], a[1]], [b[0], b[1]]) * EARTH_RADIUS_KM;
}

/** Great-circle distance in statute miles. */
export function distanceMiles(a: LonLat, b: LonLat): number {
  return distanceKm(a, b) / 1.609344;
}
