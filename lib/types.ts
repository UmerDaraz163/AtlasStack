/**
 * Shared types for the map data (data/*.ts), the map engine (lib/map-engine.ts)
 * and the React components.
 */
import type { GeoProjection } from 'd3-geo';

/** [longitude, latitude] in degrees. */
export type LonLat = [number, number];

/* ---------- Views and layers ---------- */

export type ProjectionId = 'globe' | 'equirectangular' | 'mercator' | 'naturalEarth';

export interface ProjectionDef {
  label: string;
  /** One-line hint shown under the label in the view picker. */
  hint: string;
  create: () => GeoProjection;
  /** Crops a flat map (Mercator stretches to infinity at the poles). */
  maxLat: number;
  /** True for the round, rotatable Earth. */
  globe?: boolean;
}

export type LayerId =
  | 'countries' | 'graticule' | 'special'
  | 'labels' | 'tooltips' | 'spin' | 'bigLabels'
  | 'climate' | 'pressure' | 'winds' | 'currents' | 'timezones' | 'plates' | 'daynight';

export interface LayerDef {
  id: LayerId;
  label: string;
  /** Short explanation shown under the label. */
  hint: string;
  group: string;
  /** Initial state of the toggle. */
  on: boolean;
}

/** A one-tap combination of info layers ("Quick views" in the control panel). */
export interface QuickView {
  id: string;
  label: string;
  /** Info layers that are switched on; all other info layers are switched off. */
  layers: LayerId[];
}

export type LayerState = Record<LayerId, boolean>;

/** Day of the year (1–365) and UTC hour (0–23.75) used by the day & night layer. */
export interface SunState {
  day: number;
  hour: number;
}

/* ---------- Data definitions ---------- */

export interface SpecialLine {
  name: string;
  cls: string;
  sub: string;
  /** Legend section the line belongs to. */
  group: 'major' | 'circle' | 'dateline';
  /** 'lat' = parallel at `value`, 'lon' = meridian at `value`, 'path' = custom `points`. */
  type: 'lat' | 'lon' | 'path';
  value?: number;
  points?: LonLat[];
  short: string;
  coord: string;
  color: string;
  width: number;
  dash: string | null;
  cap?: 'round';
  /** Anchor of the on-map label. */
  labelAt: LonLat;
  /** Shorter label for narrow screens (defaults to the name). */
  compact?: string;
  desc: string;
}

export interface ClimateZone {
  name: string;
  /** Degrees from the Equator; mirrored into both hemispheres. */
  range: [number, number];
  labelLat: number;
  color: string;
  opacity: number;
  desc: string;
}

export type PressureKind = 'low' | 'high';

export interface PressureBelt {
  name: string;
  kind: PressureKind;
  range: [number, number];
  labelLat: number;
  coord: string;
  desc: string;
}

export interface WindBelt {
  name: string;
  range: [number, number];
  /** 'west' = blows toward the Equator and west; 'east' = toward the pole and east. */
  toward: 'west' | 'east';
  fromN: string;
  fromS: string;
  labelLat: number;
  desc: string;
}

export type CurrentTemp = 'warm' | 'cold';

export interface OceanCurrent {
  name: string;
  temp: CurrentTemp;
  region: string;
  anchor: 'start' | 'middle' | 'end';
  /** Waypoint that carries the label (defaults to the middle one). */
  labelIndex?: number;
  /** Waypoints in flow direction. */
  points: LonLat[];
  desc: string;
}

export interface TectonicPlate {
  name: string;
  rank: 'Major plate' | 'Minor plate';
  label: LonLat;
  region: string;
  desc: string;
}

export type BoundaryKind = 'divergent' | 'convergent' | 'transform' | 'diffuse';

export interface BoundaryType {
  label: string;
  color: string;
  dash: string | null;
  desc: string;
}

export interface PlateBoundary {
  name: string;
  type: BoundaryKind;
  plates: string;
  note?: string;
  points: LonLat[];
}

/* ---------- Runtime records ---------- */

/**
 * Everything the tooltip, the details panel and the search need to know about one
 * feature of the map.
 */
export interface FeatureInfo {
  /** Unique id. */
  key: number;
  name: string;
  /** Classification, e.g. "Special Circle" or "Ocean Current". */
  cls: string;
  /** Optional second part of the classification. */
  sub?: string;
  /** Caption of the coordinate row, e.g. "Coordinate" or "Latitude range". */
  coordLabel: string;
  coord: string;
  desc: string;
  color: string;
  /** Links the feature to its legend row. */
  tag?: string;
  /** Layer that draws the feature (switched on when the feature is searched for). */
  layer?: LayerId;
  /** Where the globe turns to show the feature; null keeps the current longitude or latitude. */
  focus?: [number | null, number | null];
}

/** Content and position of the map tooltip. */
export interface TooltipState {
  infos: FeatureInfo[];
  /** Viewport coordinates of the pointer or tap. */
  x: number;
  y: number;
  /** True when opened by a tap: it stays until dismissed instead of following the pointer. */
  sticky: boolean;
}

/** What the details panel shows. */
export interface Details {
  infos: FeatureInfo[];
  heading: string;
  /** The picked location, when the selection came from a point on the map. */
  point?: LonLat | null;
}

/** Which features the legend / search spotlight keeps bright. */
export type SpotlightTarget = { tag: string } | { key: number } | null;
