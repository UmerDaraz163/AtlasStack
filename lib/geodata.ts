/**
 * Geographic data loaded on demand, shared by the map engine and the React components:
 *  - country shapes (world-atlas, 1:110m)
 *  - cities with their IANA time zones (Natural Earth, data/geo/cities.json)
 *  - each country's time zones (data/geo/country-zones.json)
 *  - the PB2002 plate model: plate polygons and typed boundaries (data/geo/plates.json)
 * Each loader runs once; later calls get the same promise. The data files are produced by
 * scripts/build-geodata.mjs.
 *
 * Also here: look-ups (which country or plate is a point in, nearest plate boundary, nearest city)
 * and civil-time helpers that use the browser's own time-zone database (Intl), so offsets such as
 * India's UTC+5:30 and daylight-saving changes are always right for the chosen date.
 */
import { geoArea, geoCentroid, geoContains, geoDistance } from 'd3-geo';
import type { Feature, Geometry, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { BOUNDARY_TYPES, COUNTRY_ZONE_OVERRIDES, TECTONIC_PLATES } from '@/data';
import { RAD, clamp, fmtHour } from './geo';
import type { BoundaryKind, LonLat, SunState } from './types';

export const EARTH_RADIUS_KM = 6371;

/* ====================================================================
   Types
   ==================================================================== */

export interface Country {
  name: string;
  feature: Feature<Geometry, { name: string }>;
  centroid: LonLat;
}

export interface City {
  id: number;
  name: string;
  /** Country name as drawn on the map (world-atlas); for small islands the sovereign country's name. */
  country: string | null;
  lonlat: LonLat;
  population: number;
  /** IANA time zone, e.g. "Asia/Karachi". */
  tz: string | null;
  /** Natural Earth scale rank: 0 = most important. */
  rank: number;
  capital: boolean;
}

export interface CountryZones {
  /** Zone of the capital (or of most people). */
  main: string;
  /** Every zone found in the country, most populous first. */
  zones: string[];
}

export interface Plate {
  code: string;
  /** Display name, e.g. "Indian Plate". */
  name: string;
  geometry: MultiPolygon;
}

export interface Boundary {
  a: string;
  b: string;
  /** PB2002 step class, e.g. "SUB" (subduction zone). */
  cls: string;
  kind: BoundaryKind;
  /** Length in km and mean relative speed of the two plates in mm per year. */
  km: number;
  speed: number;
  coords: LonLat[];
}

export interface CityData {
  cities: City[];
  zones: Record<string, CountryZones>;
}

export interface PlateData {
  plates: Plate[];
  boundaries: Boundary[];
}

/* ====================================================================
   Loaders
   ==================================================================== */

type Atlas = Topology<{ countries: GeometryCollection<{ name: string }> }>;
type CityRow = [string, string | null, number, number, number, number, number, number];
interface CitiesFile { timeZones: string[]; cities: CityRow[] }
interface PlatesFile {
  plates: { code: string; name: string; polygons: number[][][] }[];
  boundaries: { a: string; b: string; cls: string; km: number; speed: number; c: number[] }[];
}

/** Results of finished loads, for synchronous look-ups (null until loaded). */
export const loaded: { countries: Country[] | null; cities: CityData | null; plates: PlateData | null } = {
  countries: null, cities: null, plates: null
};

let countriesPromise: Promise<Country[]> | null = null;
let citiesPromise: Promise<CityData> | null = null;
let platesPromise: Promise<PlateData> | null = null;

export function loadCountries(): Promise<Country[]> {
  countriesPromise ??= (async () => {
    const world = (await import('world-atlas/countries-110m.json')).default as unknown as Atlas;
    const countries = feature(world, world.objects.countries).features.map(f => ({
      name: f.properties.name, feature: f, centroid: geoCentroid(f) as LonLat
    }));
    loaded.countries = countries;
    return countries;
  })();
  return countriesPromise;
}

export function loadCities(): Promise<CityData> {
  citiesPromise ??= (async () => {
    const [citiesModule, zonesModule] = await Promise.all([
      import('@/data/geo/cities.json'), import('@/data/geo/country-zones.json')
    ]);
    const file = citiesModule.default as unknown as CitiesFile;
    const cities = file.cities.map(([name, country, lon, lat, population, tzIndex, rank, capital], id): City => ({
      id, name, country, lonlat: [lon, lat], population,
      tz: tzIndex >= 0 ? file.timeZones[tzIndex] : null, rank, capital: capital === 1
    }));
    const zones = { ...(zonesModule.default as unknown as Record<string, CountryZones>) };
    for (const [country, tz] of Object.entries(COUNTRY_ZONE_OVERRIDES)) zones[country] ??= { main: tz, zones: [tz] };
    loaded.cities = { cities, zones };
    return loaded.cities;
  })();
  return citiesPromise;
}

/** Coordinates are stored as integers in tenths of a degree: [lon0, lat0, lon1, lat1, …]. */
const unflatten = (flat: number[]): LonLat[] => {
  const out: LonLat[] = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i] / 10, flat[i + 1] / 10]);
  return out;
};

const kindOf = (cls: string): BoundaryKind =>
  (Object.entries(BOUNDARY_TYPES).find(([, t]) => t.classes.includes(cls))?.[0] as BoundaryKind) ?? 'transform';

export function loadPlates(): Promise<PlateData> {
  platesPromise ??= (async () => {
    const file = (await import('@/data/geo/plates.json')).default as unknown as PlatesFile;
    const plates = file.plates.map((p): Plate => ({
      code: p.code,
      name: plateName(p.code, p.name),
      geometry: { type: 'MultiPolygon', coordinates: p.polygons.map(poly => poly.map(unflatten)) }
    }));
    const boundaries = file.boundaries.map((b): Boundary => ({
      a: b.a, b: b.b, cls: b.cls, kind: kindOf(b.cls), km: b.km, speed: b.speed, coords: unflatten(b.c)
    }));
    loaded.plates = { plates, boundaries };
    return loaded.plates;
  })();
  return platesPromise;
}

/** "Indian Plate" for "IN"; PB2002's own name for plates that are not listed in data/tectonics.ts. */
export function plateName(code: string, fallback?: string): string {
  return TECTONIC_PLATES[code]?.name ?? `${fallback ?? code} Plate`;
}

/* ====================================================================
   Look-ups
   ==================================================================== */

export const countryAt = (countries: Country[], ll: LonLat) => countries.find(c => geoContains(c.feature, ll)) ?? null;

export const plateAt = (plates: Plate[], ll: LonLat) => plates.find(p => geoContains(p.geometry, ll)) ?? null;

/** Area of a shape in km². */
export const areaKm2 = (geometry: MultiPolygon) => geoArea(geometry) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;

/** Initial compass bearing from a to b, in radians. */
function bearing(a: LonLat, b: LonLat): number {
  const [l1, p1] = [a[0] * RAD, a[1] * RAD], [l2, p2] = [b[0] * RAD, b[1] * RAD];
  return Math.atan2(Math.sin(l2 - l1) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(l2 - l1));
}

/** Initial compass bearing in degrees (0 = north, 90 = east). */
export const bearingDeg = (a: LonLat, b: LonLat) => ((bearing(a, b) / RAD) + 360) % 360;

/** Shortest distance (radians) from p to the great-circle segment a–b. */
function segmentDistance(p: LonLat, a: LonLat, b: LonLat): number {
  const d13 = geoDistance(a, p), d12 = geoDistance(a, b);
  if (d12 < 1e-9) return d13;
  const delta = bearing(a, p) - bearing(a, b);
  if (Math.cos(delta) < 0) return d13;                                  // p lies behind a
  const crossTrack = Math.asin(clamp(Math.sin(d13) * Math.sin(delta), -1, 1));
  const alongTrack = Math.acos(clamp(Math.cos(d13) / Math.cos(crossTrack), -1, 1));
  return alongTrack > d12 ? geoDistance(b, p) : Math.abs(crossTrack);   // beyond b, or beside the segment
}

/** The plate boundary closest to a point, with the distance in km. */
export function nearestBoundary(boundaries: Boundary[], ll: LonLat): { boundary: Boundary; km: number } | null {
  let best: Boundary | null = null, bestD = Infinity;
  for (const boundary of boundaries) {
    const c = boundary.coords;
    for (let i = 0; i < c.length - 1; i++) {
      // Cheap reject: both ends far further away than the best so far.
      if (bestD < 0.3 && geoDistance(c[i], ll) > bestD + 0.1 && geoDistance(c[i + 1], ll) > bestD + 0.1) continue;
      const d = segmentDistance(ll, c[i], c[i + 1]);
      if (d < bestD) { bestD = d; best = boundary; }
    }
  }
  return best ? { boundary: best, km: bestD * EARTH_RADIUS_KM } : null;
}

/** Nearest city, optionally only within one country. */
export function nearestCity(cities: City[], ll: LonLat, country?: string | null): City | null {
  let best: City | null = null, bestD = Infinity;
  for (const city of cities) {
    if (country && city.country !== country) continue;
    const d = geoDistance(city.lonlat, ll);
    if (d < bestD) { bestD = d; best = city; }
  }
  return best;
}

/**
 * Civil time zone at a point: the zone of the country it is in (for countries with several zones,
 * the zone of the nearest city in that country). Null at sea or before the data has loaded.
 */
export function zoneAt(ll: LonLat): { tz: string; country: string } | null {
  if (!loaded.countries || !loaded.cities) return null;
  const country = countryAt(loaded.countries, ll);
  if (!country) return null;
  const zones = loaded.cities.zones[country.name];
  if (!zones) return null;
  if (zones.zones.length === 1) return { tz: zones.main, country: country.name };
  const city = nearestCity(loaded.cities.cities.filter(c => c.tz), ll, country.name);
  return { tz: city?.tz ?? zones.main, country: country.name };
}

/** Plate at a point and the nearest boundary (null until the plate data has loaded). */
export function plateFactsAt(ll: LonLat) {
  if (!loaded.plates) return null;
  return { plate: plateAt(loaded.plates.plates, ll), nearest: nearestBoundary(loaded.plates.boundaries, ll) };
}

/** "on the Indian Plate, about 120 km from its boundary with the Eurasian Plate (convergent, ≈ 47 mm/yr)". */
export function describePlatePosition(ll: LonLat): string | null {
  const facts = plateFactsAt(ll);
  if (!facts?.plate) return null;
  const { plate, nearest } = facts;
  if (!nearest) return `on the ${plate.name}`;
  const { boundary, km } = nearest;
  const other = boundary.a === plate.code ? boundary.b : boundary.b === plate.code ? boundary.a : null;
  const what = BOUNDARY_TYPES[boundary.kind].short;
  const where = other
    ? `its boundary with the ${plateName(other)}`
    : `the ${plateName(boundary.a)} – ${plateName(boundary.b)} boundary`;
  const distance = km < 25 ? 'right on' : `about ${(Math.round(km / 10) * 10).toLocaleString('en-US')} km from`;
  return `on the ${plate.name}, ${distance} ${where} — a ${what} moving ≈ ${boundary.speed} mm a year`;
}

/* ====================================================================
   Civil time (uses the browser's time-zone database)
   ==================================================================== */

const offsetFormats = new Map<string, Intl.DateTimeFormat>();
const nameFormats = new Map<string, Intl.DateTimeFormat>();

/** The moment selected with the Sun & seasons controls, in the current year. */
export function sunDate({ day, hour }: SunState, year = new Date().getUTCFullYear()): Date {
  return new Date(Date.UTC(year, 0, day) + hour * 3600e3);
}

/** Minutes ahead of UTC that clocks in `tz` show at `date` (daylight saving included). */
export function utcOffsetMinutes(tz: string, date: Date): number {
  let format = offsetFormats.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    offsetFormats.set(tz, format);
  }
  const name = format.formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+\-−])(\d{1,2})(?::?(\d{2}))?/.exec(name);
  if (!match) return 0;
  return (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Standard (winter) offset: the smaller of the January and July offsets. */
export function standardOffsetMinutes(tz: string, year = new Date().getUTCFullYear()): number {
  return Math.min(utcOffsetMinutes(tz, new Date(Date.UTC(year, 0, 1))), utcOffsetMinutes(tz, new Date(Date.UTC(year, 6, 1))));
}

/** "UTC+5:30", "UTC−3", "UTC±0". */
export function fmtOffset(minutes: number): string {
  if (minutes === 0) return 'UTC±0';
  const a = Math.abs(minutes), h = Math.floor(a / 60), m = a % 60;
  return `UTC${minutes > 0 ? '+' : '−'}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** Everyday name of a zone at a date, e.g. "India Standard Time" (falls back to the city in the IANA name). */
export function zoneLongName(tz: string, date: Date): string {
  let format = nameFormats.get(tz);
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' });
    nameFormats.set(tz, format);
  }
  const name = format.formatToParts(date).find(p => p.type === 'timeZoneName')?.value ?? '';
  return name && !name.startsWith('GMT') ? name : `${tz.split('/').pop()?.replace(/_/g, ' ')} time`;
}

/** Clock time ("18:15") in a zone at a date. */
export const clockTime = (tz: string, date: Date) =>
  fmtHour(date.getUTCHours() + date.getUTCMinutes() / 60 + utcOffsetMinutes(tz, date) / 60);

/** "12.1 million", "780,000". */
export const fmtPopulation = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} million` : n.toLocaleString('en-US');
