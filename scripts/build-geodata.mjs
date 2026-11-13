/**
 * Builds the compact data files in data/geo/ from public datasets.
 *
 *   node scripts/build-geodata.mjs
 *
 * Sources (downloaded into .cache/ on first run):
 *  - Natural Earth 1:50m populated places (public domain) — cities, population, IANA time zone
 *  - PB2002 plate model by Peter Bird (2003), GeoJSON by Hugo Ahlenius / Nordpil
 *    (Open Data Commons Attribution License) — plate polygons and boundary steps
 *  - world-atlas countries-110m (the country shapes the app draws), to tie cities to countries
 *
 * Outputs:
 *  - data/geo/cities.json         cities with country, population, time zone
 *  - data/geo/country-zones.json  each country's main time zone and all zones found in it
 *  - data/geo/plates.json         simplified plate polygons + typed boundary lines with speeds
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoArea, geoContains, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache');
const OUT = join(ROOT, 'data', 'geo');
const SOURCES = {
  places: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places.geojson',
  plates: 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_plates.json',
  steps: 'https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_steps.json'
};

async function load(name) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}.json`);
  if (!existsSync(file)) {
    console.log(`downloading ${name} …`);
    const res = await fetch(SOURCES[name]);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    writeFileSync(file, await res.text());
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

const round = v => Math.round(v * 100) / 100;
const pt = ([lon, lat]) => [round(lon), round(lat)];
/** Compact coordinates: one flat list of integers in tenths of a degree, [lon0, lat0, lon1, lat1, …]. */
const flat = coords => coords.flatMap(([lon, lat]) => [Math.round(lon * 10), Math.round(lat * 10)]);

/** Drop vertices closer than `minDeg` to the previous kept one (keeps first and last). */
function thin(ring, minDeg) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length - 1; i++) {
    const [x, y] = ring[i], [px, py] = out[out.length - 1];
    if (Math.abs(x - px) > minDeg || Math.abs(y - py) > minDeg) out.push(ring[i]);
  }
  out.push(ring[ring.length - 1]);
  return out.map(pt);
}

/** d3 decides inside/outside from winding; flip rings of polygons that cover more than half the sphere. */
function rewind(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const fixed = polys.map(rings => {
    const poly = { type: 'Polygon', coordinates: rings };
    return geoArea(poly) > 2 * Math.PI ? rings.map(r => r.slice().reverse()) : rings;
  });
  return geometry.type === 'Polygon' ? { type: 'Polygon', coordinates: fixed[0] } : { type: 'MultiPolygon', coordinates: fixed };
}

/* ---------------- Countries (as drawn by the app) ---------------- */
const atlas = JSON.parse(readFileSync(join(ROOT, 'node_modules/world-atlas/countries-110m.json'), 'utf8'));
const countries = feature(atlas, atlas.objects.countries).features.map(f => ({ name: f.properties.name, geo: f }));

/** Country polygon a point falls in; coastal points just outside the coarse outline go to the nearest one within ~150 km. */
function countryAt(lonlat) {
  const inside = countries.find(c => geoContains(c.geo, lonlat));
  if (inside) return inside.name;
  let best = null, bestD = Infinity;
  for (const c of countries) {
    const polys = c.geo.geometry.type === 'Polygon' ? [c.geo.geometry.coordinates] : c.geo.geometry.coordinates;
    for (const poly of polys) for (const p of poly[0]) {
      const d = geoDistance(lonlat, p);
      if (d < bestD) { bestD = d; best = c.name; }
    }
  }
  return bestD * 6371 < 150 ? best : null;
}

/* ---------------- Cities ---------------- */
const places = (await load('places')).features.map(f => f.properties)
  .filter(p => p.FEATURECLA !== 'Scientific station' && p.FEATURECLA !== 'Historic place');

// Which drawn country each Natural Earth country name corresponds to: the polygon that contains
// most of its cities. Names with no match (Singapore, Bahrain, Mauritius … too small for the
// 1:110m outlines) keep their own name.
const located = places.map(p => ({ adm: p.ADM0NAME, inside: countries.find(c => geoContains(c.geo, [p.LONGITUDE, p.LATITUDE]))?.name ?? null }));
// Loose name match: "Bosnia and Herzegovina" ~ "Bosnia and Herz.", "Falkland Islands" ~ "Falkland Is.".
const norm = name => name.toLowerCase().replace(/[^a-z]/g, '');
const similar = (a, b) => { const x = norm(a), y = norm(b); return x.slice(0, 5) === y.slice(0, 5) || x.includes(y) || y.includes(x); };
const alias = {};
for (const adm of new Set(located.map(l => l.adm))) {
  const votes = {};
  for (const l of located) if (l.adm === adm && l.inside) votes[l.inside] = (votes[l.inside] ?? 0) + 1;
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  // Trust the vote when two or more cities agree, or when the names match.
  if (best && (best[1] >= 2 || similar(adm, best[0]))) alias[adm] = best[0];
  else alias[adm] = countries.find(c => c.name === adm)?.name ?? countries.find(c => similar(adm, c.name))?.name;
}
// Names the loose match cannot pair up.
Object.assign(alias, { 'East Timor': 'Timor-Leste', 'Western Sahara': 'W. Sahara', 'Equatorial Guinea': 'Eq. Guinea' });
const cityCountry = p => alias[p.ADM0NAME] ?? p.ADM0NAME;

const cityRows = places.map(p => ({
  name: p.NAME,
  country: cityCountry(p),
  sovName: p.ADM0NAME,
  lon: round(p.LONGITUDE), lat: round(p.LATITUDE),
  pop: p.POP_MAX,
  tz: p.TIMEZONE,
  rank: p.SCALERANK,
  capital: p.FEATURECLA === 'Admin-0 capital' ? 1 : 0
}));

// Fill a missing time zone from the nearest city in the same country that has one.
for (const c of cityRows.filter(c => !c.tz)) {
  const peers = cityRows.filter(o => o.tz && o.country && o.country === c.country);
  peers.sort((a, b) => geoDistance([a.lon, a.lat], [c.lon, c.lat]) - geoDistance([b.lon, b.lat], [c.lon, c.lat]));
  c.tz = peers[0]?.tz ?? null;
}

// Drop zones the runtime cannot resolve.
const validZones = new Set(Intl.supportedValuesOf('timeZone'));
const zoneOk = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; } };
for (const c of cityRows) if (c.tz && !validZones.has(c.tz) && !zoneOk(c.tz)) { console.warn('unknown zone', c.tz, c.name); c.tz = null; }

cityRows.sort((a, b) => b.pop - a.pop);
const tzList = [...new Set(cityRows.map(c => c.tz).filter(Boolean))].sort();
writeFileSync(join(OUT, 'cities.json'), JSON.stringify({
  source: 'Natural Earth 1:50m populated places (public domain)',
  fields: ['name', 'country', 'lon', 'lat', 'population', 'timeZoneIndex', 'scaleRank', 'isCapital'],
  timeZones: tzList,
  cities: cityRows.map(c => [c.name, c.country, c.lon, c.lat, c.pop, c.tz ? tzList.indexOf(c.tz) : -1, c.rank, c.capital])
}));

/* ---------------- Country time zones ---------------- */
const zones = {};
for (const { name } of countries) {
  const own = cityRows.filter(c => c.country === name && c.tz);
  if (!own.length) continue;
  const byPop = {};
  for (const c of own) byPop[c.tz] = (byPop[c.tz] ?? 0) + c.pop;
  const capital = own.find(c => c.capital);
  zones[name] = {
    main: capital?.tz ?? Object.entries(byPop).sort((a, b) => b[1] - a[1])[0][0],
    zones: Object.entries(byPop).sort((a, b) => b[1] - a[1]).map(([tz]) => tz)
  };
}
writeFileSync(join(OUT, 'country-zones.json'), JSON.stringify(zones));

/* ---------------- Plates ---------------- */
const plateFeatures = (await load('plates')).features;
const byCode = new Map();
for (const f of plateFeatures) {
  const { Code: code, PlateName: name } = f.properties;
  const geom = rewind(f.geometry);
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  const entry = byCode.get(code) ?? { code, name, polygons: [] };
  for (const poly of polys) entry.polygons.push(poly.map(ring => flat(thin(ring, 0.3))));
  byCode.set(code, entry);
}

// Boundary steps → polylines.
// 1. Join consecutive steps of the same plate pair into continuous runs.
// 2. Within a run, group steps by kind of boundary; runs of one kind shorter than MIN_KM
//    (e.g. the short transform offsets that zig-zag along mid-ocean ridges) join their neighbour.
// 3. Each group is labelled with its dominant PB2002 class (by length) and mean relative speed.
const MIN_KM = 400;
const KIND = { OSR: 'div', CRB: 'div', OTF: 'tra', CTF: 'tra', OCB: 'con', CCB: 'con', SUB: 'sub' };
const steps = (await load('steps')).features.map(f => f.properties);
const runs = [];
let run = null;
for (const s of steps) {
  const start = [s.STARTLONG, s.STARTLAT];
  const joined = run && run.pair === s.PLATEBOUND
    && Math.abs(run.steps.at(-1).end[0] - start[0]) < 0.02 && Math.abs(run.steps.at(-1).end[1] - start[1]) < 0.02;
  if (!joined) { run = { pair: s.PLATEBOUND, steps: [] }; runs.push(run); }
  run.steps.push({ start, end: [s.FINALLONG, s.FINALLAT], cls: s.STEPCLASS, km: s.STEPLENGTH, speed: s.VELOCITYLE });
}
const boundaries = [];
for (const r of runs) {
  // groups of consecutive steps with the same kind
  let groups = [];
  for (const st of r.steps) {
    const kind = KIND[st.cls];
    const last = groups.at(-1);
    if (last && last.kind === kind) last.steps.push(st); else groups.push({ kind, steps: [st] });
  }
  const km = g => g.steps.reduce((t, st) => t + st.km, 0);
  // absorb short groups into the previous (or next) one until none is left
  let changed = true;
  while (changed && groups.length > 1) {
    changed = false;
    const i = groups.findIndex(g => km(g) < MIN_KM);
    if (i >= 0) {
      const target = i > 0 ? groups[i - 1] : groups[i + 1];
      if (i > 0) target.steps.push(...groups[i].steps); else target.steps.unshift(...groups[i].steps);
      groups.splice(i, 1);
      // re-merge neighbours that now share a kind
      groups = groups.reduce((acc, g) => {
        const prev = acc.at(-1);
        if (prev && prev.kind === g.kind) prev.steps.push(...g.steps); else acc.push(g);
        return acc;
      }, []);
      changed = true;
    }
  }
  const [a, b] = r.pair.split(/[-\/\\]/);
  for (const g of groups) {
    const byCls = {};
    for (const st of g.steps) byCls[st.cls] = (byCls[st.cls] ?? 0) + st.km;
    const total = km(g);
    const cls = Object.entries(byCls).filter(([c]) => KIND[c] === g.kind).sort((x, y) => y[1] - x[1])[0]?.[0]
      ?? Object.entries(byCls).sort((x, y) => y[1] - x[1])[0][0];
    boundaries.push({
      a, b, cls,
      km: Math.round(total),
      speed: Math.round(g.steps.reduce((t, st) => t + st.speed * st.km, 0) / total),
      c: flat(thin([g.steps[0].start, ...g.steps.map(st => st.end)], 0.2))
    });
  }
}
writeFileSync(join(OUT, 'plates.json'), JSON.stringify({
  source: 'PB2002 (Bird, 2003, doi:10.1029/2001GC000252), GeoJSON by Hugo Ahlenius / Nordpil — ODC Attribution License',
  plates: [...byCode.values()],
  boundaries
}));

/* ---------------- Report ---------------- */
const size = f => (readFileSync(join(OUT, f)).length / 1024).toFixed(0) + ' KB';
console.log('cities', cityRows.length, size('cities.json'), '| zones', tzList.length);
console.log('countries with zones', Object.keys(zones).length, '/', countries.length, size('country-zones.json'));
console.log('countries without a city:', countries.filter(c => !zones[c.name]).map(c => c.name).join(', '));
console.log('cities whose country is not drawn at 1:110m', cityRows.filter(c => !countries.some(k => k.name === c.country)).length,
  [...new Set(cityRows.filter(c => !countries.some(k => k.name === c.country)).map(c => c.country))].join(', '));
console.log('plates', byCode.size, '| boundary lines', boundaries.length, size('plates.json'));
