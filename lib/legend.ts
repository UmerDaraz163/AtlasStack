/**
 * Builds the legend from the data definitions, so it always matches what the map draws.
 * Each row names the layer it belongs to and the `tag` shared by the features it stands for.
 */
import {
  BOUNDARY_TYPES, CLIMATE_ZONES, CURRENT_STYLE, GRATICULE, GRATICULE_STEP, PRESSURE_STYLE,
  CITY_STYLE, NIGHT_DARKNESS, QUAKES, SPECIAL_LINES, SUN, TIME_ZONE_STYLE, WIND_STYLE
} from '@/data';
import type { FeatureInfo, LayerId, SpecialLine } from './types';

/** A short line sample or a filled box. */
export type Swatch =
  | { kind: 'line'; color: string; width?: number; dash?: string | null; cap?: string; arrow?: boolean }
  | { kind: 'fill'; color: string; opacity: number; dash?: string }
  | { kind: 'dot'; color: string; radius: number }
  | { kind: 'rainbow'; striped?: boolean };

export interface LegendRow {
  id: string;
  label: string;
  layer: LayerId;
  tag: string;
  swatch: Swatch;
  /** Summary card for rows that stand for many features (graticule, time zones). */
  about?: FeatureInfo;
}

export interface LegendGroup {
  title: string;
  rows: LegendRow[];
}

/** Tags tie features to legend rows; the map engine uses the same helpers. */
export const TAGS = {
  special: (name: string) => `special:${name}`,
  graticule: 'graticule',
  climate: (name: string) => `climate:${name}`,
  pressure: (kind: string) => `pressure:${kind}`,
  wind: 'wind',
  current: (temp: string) => `current:${temp}`,
  timezone: 'timezone',
  plate: (type: string) => `plate:${type}`,
  sun: 'sun'
};

/** Summary cards for rows that stand for many features. */
const CIVIL_ABOUT: FeatureInfo = {
  key: -3, name: 'Civil time zones', cls: 'Civil Time Zone', coordLabel: 'Shown as', coord: 'Each country coloured by the clock time it uses',
  color: '#7c6fd6',
  desc: 'Countries set their own clock time by law, so real time zones follow borders, not meridians. Some use offsets that are not whole hours — India UTC+5:30, Nepal UTC+5:45, Iran UTC+3:30 (striped on the map). Large countries such as the USA, Russia or Australia span several zones. The map follows the Sun & seasons date, so daylight-saving changes show up as you move it.'
};
const CITY_ABOUT: FeatureInfo = {
  key: -4, name: 'Cities', cls: 'City', coordLabel: 'Source', coord: 'Natural Earth populated places (about 1,200 cities)',
  color: CITY_STYLE.color,
  desc: 'Capitals (red) and major cities; more appear as you zoom in. Hover or tap a city for its population, clock time and the tectonic plate it sits on. Explore a country to list all its cities with their nearest plate boundary.'
};
const quakeAbout = (i: number): FeatureInfo => ({
  key: -10 - i, name: QUAKES.depthBands[i].label, cls: 'Earthquake', coordLabel: 'Source',
  coord: 'US Geological Survey, magnitude 4.5+, past 30 days (live)', color: QUAKES.depthBands[i].color,
  desc: 'Earthquakes cluster along plate boundaries. Shallow ones happen everywhere along them; deeper ones (orange and blue) only where one plate dives beneath another, tracing the sinking slab under trenches such as Japan, Tonga or the Andes. Circle size grows with magnitude.'
});

export function buildLegend(): LegendGroup[] {
  const specialRows = (group: SpecialLine['group']): LegendRow[] =>
    SPECIAL_LINES.filter(d => d.group === group).map(d => ({
      id: TAGS.special(d.name), label: `${d.name} (${d.short})`, layer: 'special', tag: TAGS.special(d.name),
      swatch: { kind: 'line', color: d.color, width: d.width, dash: d.dash, cap: d.cap }
    }));

  return [
    { title: 'Major Reference Lines', rows: specialRows('major') },
    { title: 'Special Latitude Circles', rows: specialRows('circle') },
    { title: `Graticule (${GRATICULE_STEP}°)`, rows: [{
      id: TAGS.graticule, label: 'Parallels (latitude) and meridians (longitude)', layer: 'graticule', tag: TAGS.graticule,
      swatch: { kind: 'line', color: GRATICULE.color, width: 1 },
      about: {
        key: -1, name: 'Graticule', cls: 'Graticule: Latitude / Longitude', coordLabel: 'Spacing',
        coord: `Every ${GRATICULE_STEP}° of latitude and longitude`, color: GRATICULE.color,
        desc: `${GRATICULE.parallel} ${GRATICULE.meridian}`
      }
    }] },
    { title: 'Date Line', rows: specialRows('dateline') },
    { title: 'Climate Zones', rows: CLIMATE_ZONES.map(z => ({
      id: TAGS.climate(z.name), label: `${z.name} (${z.range[0]}°–${z.range[1]}°)`, layer: 'climate', tag: TAGS.climate(z.name),
      swatch: { kind: 'fill', color: z.color, opacity: z.opacity + 0.25 }
    })) },
    { title: 'Other Info Layers', rows: [
      ...(Object.entries(PRESSURE_STYLE) as [string, { label: string; color: string }][]).map(([kind, s]): LegendRow => ({
        id: TAGS.pressure(kind), label: s.label, layer: 'pressure', tag: TAGS.pressure(kind),
        swatch: { kind: 'fill', color: s.color, opacity: 0.2, dash: '4 3' }
      })),
      { id: TAGS.wind, label: 'Prevailing wind direction', layer: 'winds', tag: TAGS.wind,
        swatch: { kind: 'line', color: WIND_STYLE.color, width: 1.6, arrow: true } },
      ...(Object.entries(CURRENT_STYLE) as [string, { label: string; color: string }][]).map(([temp, s]): LegendRow => ({
        id: TAGS.current(temp), label: s.label, layer: 'currents', tag: TAGS.current(temp),
        swatch: { kind: 'line', color: s.color, width: 2, arrow: true }
      })),
      { id: 'civil', label: 'Civil time zone (colour = clock time)', layer: 'civiltime', tag: 'civil',
        swatch: { kind: 'rainbow' }, about: CIVIL_ABOUT },
      { id: 'civil-fraction', label: 'Not a whole hour (e.g. India UTC+5:30)', layer: 'civiltime', tag: 'civil',
        swatch: { kind: 'rainbow', striped: true }, about: CIVIL_ABOUT },
      { id: TAGS.timezone, label: 'Solar time zone (15° band, UTC offset)', layer: 'timezones', tag: TAGS.timezone,
        swatch: { kind: 'fill', color: TIME_ZONE_STYLE.color, opacity: 0.15 },
        about: {
          key: -2, name: 'Time zones', cls: 'Time Zone', coordLabel: 'Layout', coord: '24 zones, each 15° of longitude',
          color: TIME_ZONE_STYLE.color,
          desc: 'Earth turns 360° in 24 hours — 15° every hour — so the world is divided into 24 nominal time zones, each one hour apart and counted from UTC at the Prime Meridian. Hover a band on the map for its offset and example cities.'
        } },
      ...Object.entries(BOUNDARY_TYPES).map(([type, t]): LegendRow => ({
        id: TAGS.plate(type), label: t.label, layer: 'plates', tag: TAGS.plate(type),
        swatch: { kind: 'line', color: t.color, width: 1.8, dash: t.dash }
      })),
      ...QUAKES.depthBands.map((band, i): LegendRow => ({
        id: `quake:${i}`, label: band.label, layer: 'quakes', tag: `quake:${i}`,
        swatch: { kind: 'dot', color: band.color, radius: 3 + i }, about: quakeAbout(i)
      })),
      { id: 'city', label: 'City', layer: 'cities', tag: 'city', swatch: { kind: 'dot', color: CITY_STYLE.color, radius: 3 }, about: CITY_ABOUT },
      { id: 'capital', label: 'Capital city', layer: 'cities', tag: 'city', swatch: { kind: 'dot', color: CITY_STYLE.capitalColor, radius: 3.5 }, about: CITY_ABOUT },
      { id: TAGS.sun, label: 'Night side of Earth (day & night)', layer: 'daynight', tag: TAGS.sun,
        swatch: { kind: 'fill', color: SUN.nightColor, opacity: NIGHT_DARKNESS } }
    ] }
  ];
}
