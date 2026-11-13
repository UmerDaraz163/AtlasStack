/**
 * Route maths for the flight-route explainer:
 *  - the great-circle route (the shortest path over the sphere)
 *  - the line that looks straight on a flat map: on Mercator that is a rhumb line (constant
 *    compass bearing); on the equirectangular map latitude and longitude change evenly.
 * All paths go the short way round in longitude.
 */
import { geoDistance, geoInterpolate } from 'd3-geo';
import { RAD } from './geo';
import { EARTH_RADIUS_KM, bearingDeg } from './geodata';
import type { LonLat } from './types';

export type FlatMapKind = 'mercator' | 'equirectangular';

/** Signed longitude change from a to b the short way round (−180 … 180). */
export function shortLonDelta(a: LonLat, b: LonLat): number {
  let d = b[0] - a[0];
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return d;
}

/** Longitude halfway along the short way from a to b. */
export const midLongitude = (a: LonLat, b: LonLat) => a[0] + shortLonDelta(a, b) / 2;

/** Points along the great circle from a to b. */
export function greatCirclePoints(a: LonLat, b: LonLat, n = 160): LonLat[] {
  const at = geoInterpolate(a, b);
  return Array.from({ length: n + 1 }, (_, i) => at(i / n) as LonLat);
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
const mercatorLat = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / RAD;

/** Points along the line that is straight on the given flat map. */
export function straightMapPoints(a: LonLat, b: LonLat, kind: FlatMapKind, n = 320): LonLat[] {
  const dLon = shortLonDelta(a, b);
  const y0 = mercatorY(a[1]), y1 = mercatorY(b[1]);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const lat = kind === 'mercator' ? mercatorLat(y0 + (y1 - y0) * t) : a[1] + (b[1] - a[1]) * t;
    return [a[0] + dLon * t, lat] as LonLat;
  });
}

/** Length of a path over the Earth's surface, in km. */
export function pathKm(points: LonLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += geoDistance(points[i - 1], points[i]);
  return total * EARTH_RADIUS_KM;
}

/** Running distance (km) at each point of a path. */
export function cumulativeKm(points: LonLat[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) out.push(out[i - 1] + geoDistance(points[i - 1], points[i]) * EARTH_RADIUS_KM);
  return out;
}

/** Position (and heading) after travelling `km` along a path. */
export function pointAlong(points: LonLat[], cumulative: number[], km: number): { point: LonLat; next: LonLat } {
  const total = cumulative[cumulative.length - 1];
  const d = Math.max(0, Math.min(total, km));
  let i = cumulative.findIndex(c => c >= d);
  if (i <= 0) i = 1;
  const span = cumulative[i] - cumulative[i - 1] || 1;
  const t = (d - cumulative[i - 1]) / span;
  const [a, b] = [points[i - 1], points[i]];
  const point: LonLat = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { point, next: b };
}

/** The latitude furthest from the Equator that a path reaches. */
export const extremeLatitude = (points: LonLat[]) =>
  points.reduce((best, p) => (Math.abs(p[1]) > Math.abs(best) ? p[1] : best), 0);

/** Compass heading at the start of a path, in degrees. */
export const startHeading = (points: LonLat[]) => bearingDeg(points[0], points[1]);
