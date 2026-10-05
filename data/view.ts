/**
 * Views (projections), layer toggles and view-level settings.
 * Edit these to change the picker, the toggles and their initial state.
 */
import { geoEquirectangular, geoMercator, geoNaturalEarth1, geoOrthographic } from 'd3-geo';
import type { LayerDef, LayerId, LayerState, ProjectionDef, ProjectionId, QuickView } from '@/lib/types';
import { CLIMATE_LABEL_LON, PRESSURE_LABEL_LON, WIND_STYLE } from './climate';

/**
 * Views offered in the picker. `globe: true` marks the round, rotatable Earth; the others are flat maps.
 * `maxLat` crops a flat map (Mercator stretches to infinity at the poles).
 */
export const PROJECTIONS: Record<ProjectionId, ProjectionDef> = {
  globe:           { label: 'Globe (3D)',      hint: 'Drag to rotate',       create: () => geoOrthographic(),     maxLat: 90, globe: true },
  equirectangular: { label: 'Equirectangular', hint: 'Even lat / lon grid',  create: () => geoEquirectangular(),  maxLat: 90 },
  mercator:        { label: 'Mercator',        hint: 'Straight compass lines', create: () => geoMercator(),       maxLat: 82 },
  naturalEarth:    { label: 'Natural Earth',   hint: 'Balanced world map',   create: () => geoNaturalEarth1(),    maxLat: 90 }
};

/** View shown on first load. */
export const DEFAULT_PROJECTION: ProjectionId = 'globe';

/** Globe view: the [longitude, latitude] facing the viewer at start, and the auto-rotation speed. */
export const GLOBE = { startCenter: [15, 20] as [number, number], spinDegPerSec: 5 };

/** Group name of the thematic layers. */
export const INFO_GROUP = 'Info layers';

/** Toggles of the control panel. `on` is the initial state; `hint` is the line under the label. */
export const LAYERS: LayerDef[] = [
  { id: 'countries', label: 'Countries',         hint: 'Land and country borders',                  group: 'Base map',  on: true },
  { id: 'graticule', label: 'Graticule (15°)',   hint: 'Latitude and longitude grid',               group: 'Base map',  on: true },
  { id: 'special',   label: 'Special lines',     hint: 'Equator, tropics, polar circles, date line', group: 'Base map', on: true },
  { id: 'labels',    label: 'Labels',            hint: 'Names written on the map',                  group: 'Display',   on: true },
  { id: 'bigLabels', label: 'Larger labels',     hint: 'Bigger text that is easier to read',        group: 'Display',   on: false },
  { id: 'tooltips',  label: 'Tooltips',          hint: 'Pop-up descriptions on hover or tap',       group: 'Display',   on: true },
  { id: 'spin',      label: 'Auto-rotate globe', hint: 'Turn slowly until you touch the map',       group: 'Display',   on: true },
  { id: 'climate',   label: 'Climate zones',     hint: 'Tropical, arid, temperate, polar',          group: INFO_GROUP,  on: true },
  { id: 'pressure',  label: 'Pressure belts',    hint: 'Bands of high and low pressure',            group: INFO_GROUP,  on: false },
  { id: 'winds',     label: 'Prevailing winds',  hint: 'Trade winds, westerlies, easterlies',       group: INFO_GROUP,  on: false },
  { id: 'currents',  label: 'Ocean currents',    hint: 'Major warm and cold currents',              group: INFO_GROUP,  on: false },
  { id: 'timezones', label: 'Time zones',        hint: '24 zones with their UTC offsets',           group: INFO_GROUP,  on: false },
  { id: 'plates',    label: 'Tectonic plates',   hint: 'Plates and the boundaries between them',    group: INFO_GROUP,  on: false },
  { id: 'daynight',  label: 'Day & night (Sun)', hint: 'Night shadow and where the Sun is overhead', group: INFO_GROUP, on: false }
];

/** Ids of the thematic layers (the ones a quick view switches on or off). */
export const INFO_LAYER_IDS: LayerId[] = LAYERS.filter(l => l.group === INFO_GROUP).map(l => l.id);

/**
 * Quick views: one tap sets the info layers to a ready-made combination
 * (and makes sure the base map is visible). Add, remove or reorder freely.
 */
export const QUICK_VIEWS: QuickView[] = [
  { id: 'basics',     label: 'Basics',      layers: [] },
  { id: 'climate',    label: 'Climate',     layers: ['climate'] },
  { id: 'air',        label: 'Air & winds', layers: ['pressure', 'winds'] },
  { id: 'oceans',     label: 'Oceans',      layers: ['currents'] },
  { id: 'time',       label: 'Time',        layers: ['timezones', 'daynight'] },
  { id: 'seasons',    label: 'Seasons',     layers: ['climate', 'daynight'] },
  { id: 'tectonics',  label: 'Tectonics',   layers: ['plates'] },
  { id: 'everything', label: 'Everything',  layers: INFO_LAYER_IDS }
];

/** Initial on/off state of every layer, derived from LAYERS. */
export const DEFAULT_LAYERS = Object.fromEntries(LAYERS.map(l => [l.id, l.on])) as LayerState;

/** Drawing order of the map layers, bottom to top. */
export const DRAW_ORDER: LayerId[] = [
  'countries', 'climate', 'timezones', 'pressure', 'winds', 'daynight', 'graticule', 'plates', 'currents', 'special'
];

/**
 * Longitude "columns" for the labels of latitude lines and bands.
 * flat: fixed longitude on the flat maps. globe: degrees east of the globe's centre,
 * so these labels stay in view while the globe turns underneath them.
 */
export const LABEL_COLUMNS = {
  special:  { flat: -172,                globe: -26 },
  climate:  { flat: CLIMATE_LABEL_LON,   globe: 12 },
  pressure: { flat: PRESSURE_LABEL_LON,  globe: 40 },
  winds:    { flat: WIND_STYLE.labelLon, globe: -50 }
};

/** Zoom limits and the size of one keyboard / button step. */
export const ZOOM = { min: 1, max: 8, step: 1.6, keyRotateDeg: 10, keyPanPx: 48 };
