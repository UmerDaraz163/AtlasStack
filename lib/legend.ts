/**
 * Builds the legend from the data definitions, so it always matches what the map draws.
 * Each row names the layer it belongs to and the `tag` shared by the features it stands for.
 */
import {
  BOUNDARY_TYPES, CLIMATE_ZONES, CURRENT_STYLE, GRATICULE, GRATICULE_STEP, PRESSURE_STYLE,
  NIGHT_DARKNESS, SPECIAL_LINES, SUN, TIME_ZONE_STYLE, WIND_STYLE
} from '@/data';
import type { FeatureInfo, LayerId, SpecialLine } from './types';

/** A short line sample or a filled box. */
export type Swatch =
  | { kind: 'line'; color: string; width?: number; dash?: string | null; cap?: string; arrow?: boolean }
  | { kind: 'fill'; color: string; opacity: number; dash?: string };

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
      { id: TAGS.timezone, label: 'Time zone (15° band, UTC offset)', layer: 'timezones', tag: TAGS.timezone,
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
      { id: TAGS.sun, label: 'Night side of Earth (day & night)', layer: 'daynight', tag: TAGS.sun,
        swatch: { kind: 'fill', color: SUN.nightColor, opacity: NIGHT_DARKNESS } }
    ] }
  ];
}
