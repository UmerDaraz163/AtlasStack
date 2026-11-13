/**
 * Cities, civil time and earthquakes.
 * City and time-zone data come from Natural Earth (data/geo/*.json, built by scripts/build-geodata.mjs);
 * earthquakes are loaded live from the US Geological Survey when that layer is switched on.
 */

/** How cities are drawn. */
export const CITY_STYLE = {
  color: '#1f2937',
  capitalColor: '#b91c1c',
  focusColor: '#2457d6',
  /** Dot radius in pixels for the smallest and largest cities. */
  minRadius: 2,
  maxRadius: 5
};

/**
 * Which cities appear at each zoom level, by Natural Earth "scale rank" (0 = most important).
 * Cities of a country you are exploring are always shown.
 */
export const CITY_ZOOM_RANKS = [
  { minZoom: 1, maxRank: 1 },
  { minZoom: 1.8, maxRank: 3 },
  { minZoom: 3, maxRank: 5 },
  { minZoom: 5, maxRank: 10 }
];

/** Time zone for countries that have no city in the data set (IANA names). */
export const COUNTRY_ZONE_OVERRIDES: Record<string, string> = {
  'Eq. Guinea': 'Africa/Malabo',
  'Cyprus': 'Asia/Nicosia',
  'Fr. S. Antarctic Lands': 'Indian/Kerguelen',
  'W. Sahara': 'Africa/El_Aaiun'
};

/** Civil time zones layer: fill opacity, and how half- and quarter-hour offsets are marked. */
export const CIVIL_TIME = {
  opacity: 0.5,
  /** Offsets that are not a whole number of hours (India +5:30, Nepal +5:45 …) get a striped fill. */
  stripeFractional: true
};

/** Earthquakes layer: USGS feed of magnitude 4.5+ earthquakes in the past 30 days. */
export const QUAKES = {
  feedUrl: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson',
  /** Colour by depth: deep earthquakes only happen where a plate is sinking (subduction). */
  depthBands: [
    { maxKm: 70, label: 'Shallow earthquake (0–70 km deep)', color: '#dc2626' },
    { maxKm: 300, label: 'Intermediate earthquake (70–300 km)', color: '#f59e0b' },
    { maxKm: Infinity, label: 'Deep earthquake (300+ km)', color: '#2563eb' }
  ],
  /** Circle radius = base + perMagnitude × (magnitude − 4.5). */
  radius: { base: 2, perMagnitude: 2.2 }
};

/**
 * Street map (opens for a picked place). Uses OpenStreetMap's free tiles, which need no key —
 * only the attribution below, and fair use: https://operations.osmfoundation.org/policies/tiles/
 * For heavy traffic, switch `tiles` to another provider (several offer free tiers).
 * The "Open in …" links use each site's public URL format and also need no key.
 */
export const STREET_MAP = {
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  maxZoom: 19,
  /** Zoom used for a place / for a whole country. */
  placeZoom: 12,
  countryZoom: 5,
  openStreetMapUrl: (lat: number, lon: number, zoom: number) =>
    `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lon.toFixed(5)}#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`,
  googleMapsUrl: (lat: number, lon: number) =>
    `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lon.toFixed(5)}`
};

/**
 * "Why do planes fly curved routes?" explainer (components/FlightRouteDialog.tsx).
 * Presets are city names as they appear in the city data; add ", Country" when a name exists twice.
 */
export const FLIGHT_ROUTES = {
  greatCircleColor: '#e11d48',
  straightColor: '#2563eb',
  /** Typical airliner cruising speed, used for flight times and the race. */
  cruiseKmh: 850,
  /** Mercator stretches to infinity at the poles, so the flat map stops here. */
  mercatorMaxLat: 78,
  /** Length of the flat-map ⇄ globe animation, one way (ms). */
  morphMs: 2600,
  /** After a route is chosen, the flat map is shown this long before it wraps into a globe (ms). */
  autoWrapDelayMs: 2000,
  /** Length of the "race" for the longer route (ms). */
  raceMs: 7000,
  presets: [
    { from: 'Karachi', to: 'New York' },
    { from: 'New York', to: 'Tokyo' },
    { from: 'London', to: 'Los Angeles, United States of America' },
    { from: 'Islamabad', to: 'Toronto' },
    { from: 'Delhi', to: 'San Francisco' },
    { from: 'Dubai', to: 'Auckland' },
    { from: 'Sydney, Australia', to: 'Santiago, Chile' },
    { from: 'Paris', to: 'Singapore' }
  ]
};
