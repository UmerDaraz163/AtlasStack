/**
 * Reference lines: constants, the 15° graticule and the seven special lines
 * (Equator, Prime Meridian, Date Line, tropics and polar circles).
 * Edit the arrays below to change what the map draws and says.
 */
import type { LonLat, SpecialLine } from '@/lib/types';

export const TROPIC_LAT = 23.436;       // axial tilt: latitude of the tropics
export const POLAR_LAT = 66.563;        // latitude of the polar circles
export const GRATICULE_STEP = 15;       // degrees between graticule lines
export const KM_PER_DEGREE = 111.32;    // length of one degree of latitude

/** General descriptions reused by every graticule line. */
export const GRATICULE = {
  color: '#7b8898', width: 0.7,
  parallel: 'Latitude lines (parallels) run east–west and measure distance north or south of the Equator, from 0° at the Equator to 90° at the poles. They never meet and get shorter toward the poles.',
  meridian: 'Longitude lines (meridians) run north–south, converge at the poles, and measure distance east or west of the Prime Meridian, from 0° to 180°. Every 15° of longitude equals one hour of solar time.'
};

/**
 * International Date Line, simplified, north to south as [longitude, latitude].
 * 179.99 is used instead of 180 so the line stays on one side of the map edge.
 */
export const DATE_LINE_POINTS: LonLat[] = [
  [179.99, 89.9], [179.99, 75], [-169, 68], [-169, 65.5], [170, 53], [179.99, 48],
  [179.99, 3], [-162, 7], [-150, 4], [-150, -11], [-171, -13.5], [-171, -15.5],
  [-172.5, -17], [-172.5, -45], [179.99, -51.5], [179.99, -89.9]
];

/**
 * Special reference lines.
 * type: 'lat' (parallel at `value`), 'lon' (meridian at `value`) or 'path' (custom `points`).
 * group: decides the legend section. labelAt: [lon, lat] anchor of the on-map label
 * (`compact` is an optional shorter label used on narrow screens; the name is the default).
 */
export const SPECIAL_LINES: SpecialLine[] = [
  { name: 'Equator', cls: 'Equator', sub: 'Major reference line · parallel', group: 'major',
    type: 'lat', value: 0, short: '0°', coord: '0° latitude',
    color: '#dc2626', width: 2.8, dash: null, labelAt: [-172, 0],
    desc: '0° latitude. The great circle midway between the poles that divides Earth into the Northern and Southern Hemispheres. It is the longest parallel (about 40,075 km) and the baseline from which latitude is measured.' },
  { name: 'Prime Meridian', cls: 'Meridian', sub: 'Major reference line', group: 'major',
    type: 'lon', value: 0, short: '0°', coord: '0° longitude',
    color: '#1d4ed8', width: 2.8, dash: null, labelAt: [0, -40],
    desc: '0° longitude. Divides Earth into the Eastern and Western Hemispheres and passes through Greenwich, England. It is the baseline for measuring longitude and for Coordinated Universal Time (UTC).' },
  { name: 'International Date Line', cls: 'Date Line', sub: 'Follows the 180° meridian, with detours', group: 'dateline',
    type: 'path', points: DATE_LINE_POINTS, short: '≈180°', coord: '≈ 180° longitude (zigzags between 170°E and 150°W)',
    color: '#2563eb', width: 2, dash: '7 5', labelAt: [180, 25], compact: 'Date Line',
    desc: 'Runs roughly along 180° longitude, where the calendar date changes by one day: crossing it westward adds a day, crossing eastward subtracts one. It bends around island groups such as the Aleutians, Kiribati and Samoa so each keeps a single date. Drawn here in simplified form.' },
  { name: 'Tropic of Cancer', cls: 'Special Circle', sub: 'Parallel of latitude', group: 'circle',
    type: 'lat', value: TROPIC_LAT, short: '23.436°N', coord: '23.436° N latitude',
    color: '#ea8a0c', width: 1.8, dash: '8 5', labelAt: [-172, TROPIC_LAT],
    desc: '23.436°N — the northernmost latitude where the Sun can be directly overhead, which happens at the June solstice. It marks the northern edge of the tropics.' },
  { name: 'Tropic of Capricorn', cls: 'Special Circle', sub: 'Parallel of latitude', group: 'circle',
    type: 'lat', value: -TROPIC_LAT, short: '23.436°S', coord: '23.436° S latitude',
    color: '#ea8a0c', width: 1.8, dash: '8 5', labelAt: [-172, -TROPIC_LAT],
    desc: '23.436°S — the southernmost latitude where the Sun can be directly overhead, which happens at the December solstice. It marks the southern edge of the tropics.' },
  { name: 'Arctic Circle', cls: 'Special Circle', sub: 'Parallel of latitude', group: 'circle',
    type: 'lat', value: POLAR_LAT, short: '66.563°N', coord: '66.563° N latitude',
    color: '#0891b2', width: 2.4, dash: '0.1 5', cap: 'round', labelAt: [-172, POLAR_LAT],
    desc: '66.563°N — the southernmost latitude in the Northern Hemisphere where the Sun can remain above the horizon (midnight sun) or below it (polar night) for a full 24 hours.' },
  { name: 'Antarctic Circle', cls: 'Special Circle', sub: 'Parallel of latitude', group: 'circle',
    type: 'lat', value: -POLAR_LAT, short: '66.563°S', coord: '66.563° S latitude',
    color: '#0891b2', width: 2.4, dash: '0.1 5', cap: 'round', labelAt: [-172, -POLAR_LAT],
    desc: '66.563°S — the northernmost latitude in the Southern Hemisphere where the Sun can remain above the horizon (midnight sun) or below it (polar night) for a full 24 hours.' }
];
