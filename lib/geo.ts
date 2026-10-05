/**
 * Pure helpers: number formatting, polyline utilities, spherical shapes and the
 * (approximate) position of the Sun. Nothing in here touches the DOM.
 */
import { color } from 'd3-color';
import { geoArea } from 'd3-geo';
import type { LineString, Polygon } from 'geojson';
import { KM_PER_DEGREE, TROPIC_LAT } from '@/data/reference-lines';
import type { LonLat, SunState } from './types';

export const RAD = Math.PI / 180;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Wrap a longitude into −180 … 180. */
export const wrapLon = (lon: number) => ((lon + 180) % 360 + 360) % 360 - 180;

/* ---------- Formatting ---------- */

export const trimNum = (v: number, digits: number) => String(+Math.abs(v).toFixed(digits));

export const fmtLat = (v: number, digits = 3) => `${trimNum(v, digits)}°${v > 0 ? 'N' : v < 0 ? 'S' : ''}`;

export const fmtLon = (v: number, digits = 3) => {
  const a = Math.abs(v);
  return `${trimNum(v, digits)}°${a === 0 || a === 180 ? '' : v > 0 ? 'E' : 'W'}`;
};

export const fmtLonLat = (ll: LonLat) => `${fmtLat(ll[1], 1)}, ${fmtLon(ll[0], 1)}`;

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** A darker shade of a colour, used for label text. */
export const darker = (c: string, k = 0.7) => color(c)?.darker(k).formatHex() ?? c;

/* ---------- Arrays and polylines ---------- */

/** Numbers from start (inclusive) to stop (exclusive). */
export function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  for (let v = start; v < stop; v += step) out.push(v);
  return out;
}

/** Evenly spaced values from a to b (inclusive), no more than `step` apart. */
export function spaced(a: number, b: number, step: number): number[] {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / step));
  return Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
}

/** Mirror a [from, to] latitude range into both hemispheres (optionally merged across the Equator). */
export const mirrorBands = ([a, b]: [number, number], merge: boolean): [number, number][] =>
  (a === 0 && merge ? [[-b, b]] : [[a, b], [-b, -a]]);

/** Add points every ≤2° along a polyline so it is drawn straight in lon/lat space, wrapping at ±180°. */
export function densify(points: LonLat[]): LonLat[] {
  const out: LonLat[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [lon0, lat0] = points[i], [lon1, lat1] = points[i + 1];
    let dLon = lon1 - lon0;
    if (dLon > 180) dLon -= 360; else if (dLon < -180) dLon += 360;
    const dLat = lat1 - lat0;
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dLon), Math.abs(dLat)) / 2));
    for (let j = 0; j < n; j++) out.push([wrapLon(lon0 + dLon * j / n), lat0 + dLat * j / n]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Catmull-Rom smoothing of waypoints in lon/lat space (ocean currents). */
export function smooth(points: LonLat[], steps = 8): LonLat[] {
  const out: LonLat[] = [], last = points.length - 1;
  for (let i = 0; i < last; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1], p3 = points[Math.min(last, i + 2)];
    for (let j = 0; j < steps; j++) {
      const t = j / steps, t2 = t * t, t3 = t2 * t;
      const at = (k: 0 | 1) => 0.5 * (2 * p1[k] + (p2[k] - p0[k]) * t
        + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([at(0), at(1)]);
    }
  }
  out.push(points[last]);
  return out;
}

/* ---------- Spherical shapes (GeoJSON), used by the globe ---------- */

export const parallelGeo = (lat: number): LineString =>
  ({ type: 'LineString', coordinates: spaced(-180, 180, 2.5).map(lon => [lon, lat]) });

export const meridianGeo = (lon: number): LineString =>
  ({ type: 'LineString', coordinates: spaced(-90, 90, 5).map(lat => [lon, lat]) });

/** A lat/lon box. With the default longitudes it is a belt right around the globe. */
export function bandGeo(lat0: number, lat1: number, lon0 = -180, lon1 = 180): Polygon {
  let rings: number[][][];
  if (lon1 - lon0 >= 360) {
    // One ring per edge (a polar cap has only one edge).
    rings = [];
    if (lat1 < 90) rings.push(spaced(-180, 180, 2.5).map(lon => [lon, lat1]));
    if (lat0 > -90) rings.push(spaced(180, -180, 2.5).map(lon => [lon, lat0]));
  } else {
    const ring = [
      ...spaced(lat0, lat1, 5).map(lat => [lon0, lat]),
      ...(Math.abs(lat1) < 90 ? spaced(lon0, lon1, 2.5).slice(1, -1).map(lon => [lon, lat1]) : []),
      ...spaced(lat1, lat0, 5).map(lat => [lon1, lat]),
      ...(Math.abs(lat0) < 90 ? spaced(lon1, lon0, 2.5).slice(1, -1).map(lon => [lon, lat0]) : [])
    ];
    ring.push(ring[0]);
    rings = [ring];
  }
  const polygon: Polygon = { type: 'Polygon', coordinates: rings };
  // D3 reads "inside" from the winding order; none of our shapes covers more than half the sphere.
  if (geoArea(polygon) > 2 * Math.PI) polygon.coordinates = rings.map(r => r.slice().reverse());
  return polygon;
}

/* ---------- Sun ---------- */

/** Approximate latitude where the Sun is overhead (solar declination, degrees) for a day of the year 1–365. */
export function solarDeclination(day: number): number {
  const w = 2 * Math.PI / 365.24;
  return -Math.asin(Math.sin(TROPIC_LAT * RAD) * Math.cos(w * (day + 10) + 0.0334 * Math.sin(w * (day - 2)))) / RAD;
}

/** Point where the Sun is directly overhead: local noon is on the meridian (12 − UTC hour) × 15°. */
export function sunPosition({ day, hour }: SunState): { lat: number; lon: number } {
  return { lat: solarDeclination(day), lon: wrapLon((12 - hour) * 15) };
}

/** Today's day of the year and the current UTC time, rounded to a quarter of an hour. */
export function sunNow(): SunState {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  return {
    day: clamp(Math.floor((now.getTime() - start) / 864e5), 1, 365),
    hour: Math.round((now.getUTCHours() + now.getUTCMinutes() / 60) * 4) / 4 % 24
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** "21 Jun" for day 172 (non-leap year). */
export function fmtDay(day: number): string {
  let d = clamp(Math.round(day), 1, 365), m = 0;
  while (d > MONTH_DAYS[m]) d -= MONTH_DAYS[m++];
  return `${d} ${MONTHS[m]}`;
}

/** "06:30" for 6.5 (wraps at 24 h). */
export function fmtHour(h: number): string {
  const minutes = ((Math.round(h * 60) % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "13 h 20 min" for 13.33. */
export function fmtDuration(hours: number): string {
  const minutes = Math.round(hours * 60);
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** "21 Jun, 12:00 UTC — Sun overhead at 23.4°N, 0°". */
export function describeSun(sun: SunState): string {
  const { lat, lon } = sunPosition(sun);
  return `${fmtDay(sun.day)}, ${fmtHour(sun.hour)} UTC — Sun overhead at ${fmtLat(lat, 1)}, ${fmtLon(lon, 1)}`;
}

/* ---------- Facts about one point ---------- */

export interface PointFacts {
  /** "Northern · Western". */
  hemispheres: string;
  /** Distance from the Equator in km, and on which side. */
  equatorKm: number;
  equatorSide: 'north' | 'south' | 'on';
  /** Nominal 15° time zone, e.g. "UTC−7". */
  zone: string;
  /** Local solar time, "HH:MM". */
  solarTime: string;
  /** Hours of daylight on the chosen date (0–24). */
  dayLength: number;
  /** Sunrise / sunset in local solar time; null during polar day or polar night. */
  sunrise: string | null;
  sunset: string | null;
  /** Height of the Sun above the horizon at local noon (negative: it stays below). */
  noonAltitude: number;
  /** Height of the Sun right now, and what that means on the ground. */
  altitude: number;
  light: 'Daylight' | 'Twilight' | 'Night';
}

/**
 * What the Sun is doing at one place for the chosen date and time: day length, noon height,
 * solar time and whether it is day or night. Geometric values — refraction and the
 * equation of time are ignored, so treat them as "about".
 */
export function pointFacts([lon, lat]: LonLat, sun: SunState): PointFacts {
  const subsolar = sunPosition(sun);
  const phi = lat * RAD, delta = subsolar.lat * RAD;

  // Day length from the sunrise hour angle: cos(H0) = −tan(latitude) · tan(declination).
  const cosH0 = -Math.tan(phi) * Math.tan(delta);
  const dayLength = cosH0 <= -1 ? 24 : cosH0 >= 1 ? 0 : 2 * Math.acos(cosH0) / RAD / 15;
  const hasSunrise = dayLength > 0 && dayLength < 24;

  // Hour angle: how far the Sun is east or west of this meridian (15° = 1 hour).
  const hourAngle = wrapLon(lon - subsolar.lon);
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle * RAD)
  ) / RAD;

  const zone = Math.round(lon / 15);
  return {
    hemispheres: [
      lat > 0 ? 'Northern' : lat < 0 ? 'Southern' : 'On the Equator',
      lon > 0 ? 'Eastern' : lon < 0 ? 'Western' : 'On the Prime Meridian'
    ].join(' · '),
    equatorKm: Math.round(Math.abs(lat) * KM_PER_DEGREE),
    equatorSide: lat > 0 ? 'north' : lat < 0 ? 'south' : 'on',
    zone: zone === 0 ? 'UTC±0' : `UTC${zone > 0 ? '+' : '−'}${Math.abs(zone)}`,
    solarTime: fmtHour(12 + hourAngle / 15),
    dayLength,
    sunrise: hasSunrise ? fmtHour(12 - dayLength / 2) : null,
    sunset: hasSunrise ? fmtHour(12 + dayLength / 2) : null,
    noonAltitude: 90 - Math.abs(lat - subsolar.lat),
    altitude,
    light: altitude > 0 ? 'Daylight' : altitude > -18 ? 'Twilight' : 'Night'
  };
}
