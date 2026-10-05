/**
 * Map engine: draws the world map / globe into an SVG with D3 and handles zoom, rotation,
 * hit-testing and labels. It knows nothing about React — components talk to it through the
 * small API returned by createMapEngine() and listen through the callbacks they pass in.
 *
 * How it is organised:
 *   1. scaffold   – SVG groups, one per layer, created once
 *   2. geometry   – helpers that turn lat/lon shapes into SVG paths for the current view
 *   3. builders   – one function per layer; elements are created once from data/*.ts
 *   4. layout     – fits the projection to the container
 *   5. draw       – recomputes every path and label position (called on every zoom/rotate frame)
 *   6. interaction – zoom, drag-to-rotate, keyboard, hover / tap hit-testing
 */
import { geoCentroid, geoCircle, geoDistance, geoPath, type GeoPath, type GeoProjection } from 'd3-geo';
import { pointer, select, type Selection } from 'd3-selection';
import { timer } from 'd3-timer';
import 'd3-transition';
import { zoom as d3Zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import type { LineString, Polygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import {
  BOUNDARY_TYPES, CLIMATE_NOTE, CLIMATE_ZONES, CURRENT_STYLE, DRAW_ORDER, GLOBE, GRATICULE, GRATICULE_STEP,
  KM_PER_DEGREE, LABEL_COLUMNS, OCEAN_CURRENTS, PLATE_BOUNDARIES, PLATE_LABEL_COLOR, PRESSURE_BELTS,
  PRESSURE_STYLE, PROJECTIONS, SPECIAL_LINES, SUN, TECTONIC_PLATES, TIME_ZONE_EXAMPLES, TIME_ZONE_STYLE,
  WIND_BELTS, WIND_STYLE, ZOOM
} from '@/data';
import {
  RAD, bandGeo, clamp, darker, densify, fmtDay, fmtHour, fmtLat, fmtLon, fmtLonLat, meridianGeo, mirrorBands,
  parallelGeo, plural, range, smooth, spaced, sunPosition, trimNum, wrapLon
} from './geo';
import { TAGS } from './legend';
import type {
  FeatureInfo, LayerId, LayerState, LonLat, ProjectionId, SpotlightTarget, SunState, TooltipState
} from './types';

/* ---------- Public API ---------- */

export interface EngineInit {
  projection: ProjectionId;
  layers: LayerState;
  sun: SunState;
  /** id of an element that describes the keyboard controls (for aria-describedby). */
  describedBy?: string;
}

export interface EngineCallbacks {
  /** The tooltip content changed (null = hide). */
  onTooltip: (tip: TooltipState | null) => void;
  /** Same content, new pointer position. */
  onTooltipMove: (x: number, y: number) => void;
  /** The user clicked / tapped the map or inspected its centre with the keyboard. */
  /** `point` is the picked location, or null when it is off the Earth. */
  onSelect: (infos: FeatureInfo[], heading: string, point: LonLat | null) => void;
  /** Coordinates under the pointer, already formatted ("—" when off the Earth). */
  onCursor: (text: string) => void;
  onStatus: (text: string) => void;
  /** The list of searchable features changed (once at start, again when countries load). */
  onIndex: (infos: FeatureInfo[]) => void;
}

export interface MapEngine {
  setProjection: (id: ProjectionId) => void;
  setLayers: (layers: LayerState) => void;
  setSun: (sun: SunState) => void;
  zoomBy: (factor: number) => void;
  /** Reset view / zoom to fit. */
  resetView: () => void;
  /** Dim everything except the matching features (null clears). */
  spotlight: (target: SpotlightTarget) => void;
  /** Spotlight one feature and, on the globe, turn it into view. */
  focusFeature: (info: FeatureInfo) => void;
  infosByTag: (tag: string) => FeatureInfo[];
  /** Go to a location and describe what is there. `lead` starts the heading (default "At <coordinates>"). */
  inspectPoint: (point: LonLat, lead?: string) => void;
  /** Centre of the globe view, or null on a flat map. */
  getCenter: () => LonLat | null;
  setCenter: (point: LonLat) => void;
  dismissTooltip: () => void;
  destroy: () => void;
}

/* ---------- Internal types ---------- */

type GSel = Selection<SVGGElement, unknown, null, undefined>;

/** Anything whose path is recomputed on every draw. */
interface Drawable {
  geom: () => string | null;
  info?: FeatureInfo;
  tag?: string;
}
interface LineItem extends Drawable {
  color: string;
  width: number;
  dash?: string | null;
  cap?: string;
  opacity?: number;
  marker?: string;
}
interface BandItem extends Drawable {
  color: string;
  opacity: number;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  strokeOpacity?: number;
}

type Anchor = 'start' | 'middle' | 'end';
/** [x, y] or [x, y, rotation in degrees]; null hides the label. */
type LabelPos = [number, number, number?] | null;
interface LabelItem {
  text: string;
  /** Shorter text for narrow maps. */
  compact?: string;
  /** Text used on the globe. */
  globeText?: string;
  anchor?: Anchor;
  globeAnchor?: Anchor;
  dy?: number;
  fill?: string;
  cls?: string;
  /** Makes the label itself hoverable (plate names). */
  info?: FeatureInfo;
  /** Collision priority: lower numbers win. */
  prio?: number;
  pos: () => LabelPos;
}

const MARGIN = { top: 26, right: 20, bottom: 22, left: 42 };   // room for edge labels on the flat maps
const HORIZON = 80 * RAD;                                      // labels nearer the globe's edge are hidden
const SPHERE = { type: 'Sphere' } as const;

/** Smallest step from `steps` whose on-screen spacing is at least `minPx`. */
const pickStep = (steps: number[], pxPerUnit: number, minPx: number) =>
  steps.find(s => s * pxPerUnit >= minPx) ?? steps[steps.length - 1];

export function createMapEngine(container: HTMLElement, init: EngineInit, cb: EngineCallbacks): MapEngine {
  /* ====================================================================
     State
     ==================================================================== */
  let projectionId = init.projection;
  let layers: LayerState = { ...init.layers };
  let sunState: SunState = { ...init.sun };
  let rotate: [number, number] = [-GLOBE.startCenter[0], -GLOBE.startCenter[1]];   // minus the centre [lon, lat]

  let projection: GeoProjection = PROJECTIONS[projectionId].create();
  let path: GeoPath = geoPath(projection);
  let base = { scale: 1, translate: [0, 0] as [number, number] };   // un-zoomed projection
  let frame = { x0: 0, y0: 0, x1: 0, y1: 0 };                       // rectangle the map is clipped to
  let width = 0, height = 0, latCap = 90;
  let globeMode = false;
  let viewCenter: LonLat = [0, 0];        // [lon, lat] facing the viewer (globe only)
  let pinned: LonLat | null = null;       // last clicked point
  let destroyed = false;

  /** Per-draw metrics for the degree / UTC labels. */
  const edge = { latStep: 15, lonStep: 30, zoneStep: 1, topLat: 90, botLat: -90, lonLabelLat: 0, zoneLabelLat: 15 };
  /** Current subsolar point and night hemisphere. */
  const sun: { lat: number; lon: number; nightGeos: Polygon[] } = { lat: 0, lon: 0, nightGeos: [] };

  /** Every tooltip record, for the legend and the search box. */
  const infos: FeatureInfo[] = [];
  let infoCount = 0;
  function makeInfo(o: Omit<FeatureInfo, 'key' | 'coordLabel'> & { coordLabel?: string }): FeatureInfo {
    const info: FeatureInfo = { coordLabel: 'Coordinate', ...o, key: ++infoCount };
    infos.push(info);
    return info;
  }

  /* ====================================================================
     1. SVG scaffold
     ==================================================================== */
  const svg = select(container).append('svg')
    .attr('class', 'world-map')
    .attr('tabindex', 0)
    .attr('role', 'application')
    .attr('aria-roledescription', 'interactive map')
    .attr('aria-label', 'World map with latitude and longitude lines, climate zones and other geographic reference layers')
    .attr('aria-describedby', init.describedBy ?? null);
  const svgNode = svg.node() as SVGSVGElement;
  const defs = svg.append('defs');
  const clipRect = defs.append('clipPath').attr('id', 'wm-frame-clip').append('rect');

  // Soft light-to-shadow gradient that makes the globe look round.
  const shade = defs.append('radialGradient').attr('id', 'wm-globe-shade').attr('cx', '36%').attr('cy', '30%').attr('r', '78%');
  shade.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.25);
  shade.append('stop').attr('offset', '45%').attr('stop-color', '#fff').attr('stop-opacity', 0);
  shade.append('stop').attr('offset', '100%').attr('stop-color', '#0b1736').attr('stop-opacity', 0.34);

  /** Arrowhead marker in a given colour. */
  function addMarker(id: string, color: string) {
    defs.append('marker').attr('id', id).attr('viewBox', '0 0 10 10')
      .attr('refX', 7).attr('refY', 5).attr('markerWidth', 4.5).attr('markerHeight', 4.5).attr('orient', 'auto')
      .append('path').attr('d', 'M0,0.5L10,5L0,9.5z').attr('fill', color);
  }
  addMarker('wm-arrow-wind', WIND_STYLE.color);
  addMarker('wm-arrow-warm', CURRENT_STYLE.warm.color);
  addMarker('wm-arrow-cold', CURRENT_STYLE.cold.color);

  // Everything inside gMap is clipped to the map frame.
  const gMap: GSel = svg.append('g').attr('clip-path', 'url(#wm-frame-clip)');
  const spherePath = gMap.append('path').attr('class', 'sphere');
  const layerG = {} as Record<LayerId, GSel>;
  for (const id of DRAW_ORDER) layerG[id] = gMap.append('g').attr('data-layer', id);
  const sphereShade = gMap.append('path').attr('class', 'sphere-shade').attr('fill', 'url(#wm-globe-shade)');
  const sphereOutline = gMap.append('path').attr('class', 'sphere-outline');
  const gLabels: GSel = gMap.append('g').attr('class', 'labels').attr('data-layer', 'labels');
  const pinMark = gMap.append('circle').attr('class', 'pin').attr('r', 4).style('display', 'none');
  // Degree ticks and UTC offsets: in the margins of the flat maps, on the surface of the globe.
  const gEdge: GSel = svg.append('g').attr('class', 'labels edge').attr('data-layer', 'labels');
  // Crosshair marking the map centre; shown while the map has keyboard focus (see globals.css).
  const crosshair = svg.append('g').attr('class', 'crosshair').attr('aria-hidden', 'true');
  crosshair.append('circle').attr('r', 9);
  crosshair.append('path').attr('d', 'M-16,0H-4M4,0H16M0,-16V-4M0,4V16');

  /** All label nodes with their data, sorted by collision priority once everything is built. */
  const labelNodes: { el: SVGTextElement; d: LabelItem }[] = [];

  /* ====================================================================
     2. Geometry helpers (depend on the current projection)
     Flat maps: latitude bands and straight lines are built directly in screen space.
     Globe: the same shapes are GeoJSON so D3 can clip them at the horizon.
     ==================================================================== */

  /** Project [lon, lat] to screen. Mercator cannot project the poles, so latitude is capped. */
  function pt(lon: number, lat: number): [number, number] {
    if (projectionId === 'mercator') lat = clamp(lat, -89.5, 89.5);
    return projection([lon, lat]) ?? [NaN, NaN];
  }
  const xy = (p: [number, number]) => p[0].toFixed(1) + ',' + p[1].toFixed(1);

  // --- flat-map paths
  const parallelPath = (lat: number) => `M${xy(pt(-180, lat))}L${xy(pt(180, lat))}`;   // parallels are straight on all flat maps
  const meridianPath = (lon: number) =>                                              // meridians curve in Natural Earth
    'M' + spaced(-90, 90, 3).map(lat => xy(pt(lon, lat))).join('L');
  function bandPath(lat0: number, lat1: number, lon0 = -180, lon1 = 180) {            // outline of a lat/lon box
    const lats = spaced(lat0, lat1, 3);
    return 'M' + [...lats.map(lat => xy(pt(lon0, lat))), ...lats.reverse().map(lat => xy(pt(lon1, lat)))].join('L') + 'Z';
  }

  // --- geometry factories: each returns a function that gives the SVG path for the current view
  const parallelGeom = (lat: number) => { const geo = parallelGeo(lat); return () => (globeMode ? path(geo) : parallelPath(lat)); };
  const meridianGeom = (lon: number) => { const geo = meridianGeo(lon); return () => (globeMode ? path(geo) : meridianPath(lon)); };
  const bandGeom = (lat0: number, lat1: number, lon0?: number, lon1?: number) => {
    const geo = bandGeo(lat0, lat1, lon0, lon1);
    return () => (globeMode ? path(geo) : bandPath(lat0, lat1, lon0, lon1));
  };
  const lineGeom = (points: LonLat[]) => {
    const geo: LineString = { type: 'LineString', coordinates: points };
    return () => path(geo);
  };
  const arrowGeom = (from: LonLat, to: LonLat) => {            // straight on flat maps, a great-circle arc on the globe
    const geo: LineString = { type: 'LineString', coordinates: [from, to] };
    return () => (globeMode ? path(geo) : `M${xy(pt(from[0], from[1]))}L${xy(pt(to[0], to[1]))}`);
  };

  // --- label placement
  const isVisible = (lon: number, lat: number) => !globeMode || geoDistance([lon, lat], viewCenter) < HORIZON;

  /** Screen position of a geographic point plus a pixel offset; null when it is on the far side of the globe. */
  function place(lon: number, lat: number, dx = 0, dy = 0): [number, number] | null {
    if (!isVisible(lon, lat)) return null;
    const p = pt(lon, lat);
    return [p[0] + dx, p[1] + dy];
  }

  /** On-screen angle (degrees) of the direction (dLon, dLat) at a point, so labels can follow curved lines. */
  function angleAt(lon: number, lat: number, dLon: number, dLat: number) {
    const a = pt(lon - dLon / 2, lat - dLat / 2), b = pt(lon + dLon / 2, lat + dLat / 2);
    return Math.atan2(b[1] - a[1], b[0] - a[0]) / RAD;
  }

  /** Label position for a latitude band: a fixed column on flat maps, one that follows the view on the globe. */
  function bandLabelPos(column: { flat: number; globe: number }, lat: number): LabelPos {
    const lon = globeMode ? viewCenter[0] + column.globe : column.flat;
    const p = place(lon, lat);
    return p && [p[0], p[1], globeMode ? angleAt(lon, lat, 2, 0) : 0];
  }

  /** Latitude for a band label; falls back to the visible part of the band when the map is cropped. */
  const labelLatFor = (def: { labelLat: number; range: [number, number] }) =>
    (Math.abs(def.labelLat) <= latCap - 4 ? def.labelLat : (def.range[0] + latCap) / 2);

  /* ====================================================================
     3. Layer builders (elements are created once; draw() only updates geometry)
     Every element with class "dyn" has a datum with geom() → SVG path string.
     Every element with class "hit" has a datum with .info for the tooltip.
     ==================================================================== */

  /** Line features: a visible path plus a wide transparent path that catches the pointer. */
  function addLineFeatures(parent: GSel, items: LineItem[]) {
    for (const item of items) {
      const g = parent.append('g').attr('class', 'feat').datum(item);
      g.append('path').attr('class', 'dyn line')
        .attr('stroke', item.color).attr('stroke-width', item.width)
        .attr('stroke-dasharray', item.dash ?? null).attr('stroke-linecap', item.cap ?? null)
        .attr('stroke-opacity', item.opacity ?? null)
        .attr('marker-end', item.marker ? `url(#${item.marker})` : null);
      g.append('path').attr('class', 'dyn hit hit-line').attr('stroke', item.color);
    }
  }

  /** Band features: a filled, hoverable region. */
  function addBandFeatures(parent: GSel, items: BandItem[]) {
    for (const item of items) {
      parent.append('g').attr('class', 'feat').datum(item)
        .append('path').attr('class', 'dyn hit band')
        .attr('fill', item.color).style('--fo', String(item.opacity))
        .attr('stroke', item.stroke ?? 'none').attr('stroke-width', item.strokeWidth ?? null)
        .attr('stroke-dasharray', item.dash ?? null).attr('stroke-opacity', item.strokeOpacity ?? null);
    }
  }

  /** Text labels; `prio` ranks them when they collide (see declutterLabels). */
  function addLabels(parent: GSel, layerId: LayerId, items: LabelItem[], prio = 9) {
    const g = parent.append('g').attr('data-layer', layerId);
    for (const item of items) {
      item.prio = item.prio ?? prio;
      const text = g.append('text').datum(item)
        .attr('class', `lbl ${item.cls ?? ''}${item.info ? ' hit' : ''}`)
        .attr('dy', item.dy ?? null)
        .attr('fill', item.fill ?? null);
      labelNodes.push({ el: text.node() as SVGTextElement, d: item });
    }
  }

  function buildGraticule() {
    const lats = range(-90 + GRATICULE_STEP, 90, GRATICULE_STEP);
    const lons = range(-180, 181, GRATICULE_STEP);
    const style = { color: GRATICULE.color, width: GRATICULE.width, opacity: 0.75 };

    const parallels: LineItem[] = lats.map(lat => ({
      ...style,
      info: makeInfo({
        name: `${fmtLat(lat)} parallel`, cls: 'Graticule: Latitude', sub: 'Parallel',
        tag: TAGS.graticule, layer: 'graticule', focus: [null, lat],
        coord: lat === 0 ? '0° latitude' : `${Math.abs(lat)}° ${lat > 0 ? 'N' : 'S'} latitude`, color: GRATICULE.color,
        desc: GRATICULE.parallel + (lat === 0
          ? ' This parallel is the Equator.'
          : ` This one lies about ${Math.round(Math.abs(lat) * KM_PER_DEGREE).toLocaleString('en-US')} km ${lat > 0 ? 'north' : 'south'} of the Equator.`)
      }),
      geom: parallelGeom(lat)
    }));

    const meridians: LineItem[] = lons.map(lon => {
      const a = Math.abs(lon);
      const extra = a === 0 ? ' This meridian is the Prime Meridian.'
        : a === 180 ? ' This is the antimeridian, opposite the Prime Meridian; the International Date Line roughly follows it.'
        : ` Solar time here is ${plural(a / 15, 'hour')} ${lon > 0 ? 'ahead of' : 'behind'} Greenwich.`;
      return {
        ...style,
        info: makeInfo({
          name: `${fmtLon(lon)} meridian`, cls: 'Graticule: Longitude', sub: 'Meridian',
          tag: TAGS.graticule, layer: 'graticule', focus: [lon, null],
          coord: a === 0 || a === 180 ? `${a}° longitude` : `${a}° ${lon > 0 ? 'E' : 'W'} longitude`, color: GRATICULE.color,
          desc: GRATICULE.meridian + extra
        }),
        geom: meridianGeom(lon)
      };
    });
    addLineFeatures(layerG.graticule, [...parallels, ...meridians]);

    // Degree labels. The step widens automatically when labels would collide.
    // Flat maps: in the margins. Globe: along the central meridian and a reference parallel.
    const latLabels: LabelItem[] = lats.map(lat => ({
      text: fmtLat(lat), anchor: 'end', globeAnchor: 'start',
      pos: () => {
        if (lat % edge.latStep !== 0) return null;
        if (globeMode) return place(viewCenter[0], lat, 4, -3);
        const y = pt(0, lat)[1];
        if (y < frame.y0 - 1 || y > frame.y1 + 1) return null;
        return [Math.max(frame.x0, pt(-180, lat)[0]) - 5, y + 3.5];
      }
    }));
    const lonLabels: LabelItem[] = lons.map(lon => ({
      text: fmtLon(lon),
      pos: () => {
        if (lon % edge.lonStep !== 0) return null;
        if (globeMode) return lon === -180 ? null : place(lon, edge.lonLabelLat, 0, 12);
        const x = pt(lon, edge.botLat)[0];
        return x < frame.x0 - 1 || x > frame.x1 + 1 ? null : [x, frame.y1 + 14];
      }
    }));
    addLabels(gEdge, 'graticule', [...latLabels, ...lonLabels], 7);
  }

  function buildSpecialLines() {
    addLineFeatures(layerG.special, SPECIAL_LINES.map(d => ({
      color: d.color, width: d.width, dash: d.dash, cap: d.cap,
      geom: d.type === 'lat' ? parallelGeom(d.value ?? 0)
        : d.type === 'lon' ? meridianGeom(d.value ?? 0)
        : lineGeom(densify(d.points ?? [])),
      info: makeInfo({
        name: d.name, cls: d.cls, sub: d.sub, coord: d.coord, desc: d.desc, color: d.color,
        tag: TAGS.special(d.name), layer: 'special',
        focus: d.type === 'lat' ? [null, d.value ?? 0] : d.type === 'lon' ? [d.value ?? 0, null] : d.labelAt
      })
    })));

    // Labels follow their line. They stay inside the frame while a flat map is zoomed,
    // and slide along the line to stay in view while the globe turns.
    const column = LABEL_COLUMNS.special;
    addLabels(gLabels, 'special', SPECIAL_LINES.map((d): LabelItem => {
      const label = { text: `${d.name} · ${d.short}`, compact: d.compact ?? d.name, dy: -5, fill: darker(d.color) };
      if (d.type === 'lat') {
        const lat = d.value ?? 0;
        return { ...label, anchor: 'start', globeAnchor: 'middle', pos: () => {
          if (globeMode) {
            const lon = viewCenter[0] + column.globe, p = place(lon, lat);
            return p && [p[0], p[1], angleAt(lon, lat, 2, 0)];
          }
          const p = pt(d.labelAt[0], lat);
          return [Math.max(p[0], frame.x0 + 6), p[1], 0];
        } };
      }
      return { ...label, pos: () => {
        const [lon, lat0] = d.labelAt;
        if (globeMode) {
          const lat = d.type === 'lon' ? clamp(viewCenter[1] - 22, -60, 60) : lat0;
          const p = place(lon, lat);
          return p && [p[0], p[1], angleAt(lon, lat, 0, 2)];
        }
        const p = pt(lon, lat0), m = Math.min(70, (frame.y1 - frame.y0) / 2);
        return [p[0], clamp(p[1], frame.y0 + m, frame.y1 - m), -90];
      } };
    }), 0);
  }

  function buildClimateZones() {
    const bands: BandItem[] = [], labels: LabelItem[] = [];
    for (const z of CLIMATE_ZONES) {
      const info = makeInfo({
        name: `${z.name} Zone`, cls: 'Climate Zone', coordLabel: 'Latitude range',
        tag: TAGS.climate(z.name), layer: 'climate', focus: [null, z.labelLat],
        coord: `${z.range[0]}°–${z.range[1]}° N and S`, desc: z.desc + CLIMATE_NOTE, color: z.color
      });
      for (const [lo, hi] of mirrorBands(z.range, true)) {
        const merged = lo < 0 && hi > 0, sign = hi > 0 ? 1 : -1;
        bands.push({ info, color: z.color, opacity: z.opacity, geom: bandGeom(lo, hi) });
        labels.push({
          text: z.name, cls: 'caps', dy: 3.5, fill: darker(z.color, 1.4),
          pos: () => bandLabelPos(LABEL_COLUMNS.climate, (merged ? 1 : sign) * labelLatFor(z))
        });
      }
    }
    addBandFeatures(layerG.climate, bands);
    addLabels(gLabels, 'climate', labels, 1);
  }

  function buildPressureBelts() {
    const bands: BandItem[] = [], labels: LabelItem[] = [];
    for (const b of PRESSURE_BELTS) {
      const style = PRESSURE_STYLE[b.kind];
      const info = makeInfo({
        name: b.name, cls: 'Pressure Belt', sub: b.kind === 'low' ? 'Low pressure — rising air' : 'High pressure — sinking air',
        coordLabel: 'Latitude range', coord: b.coord, desc: b.desc, color: style.color,
        tag: TAGS.pressure(b.kind), layer: 'pressure', focus: [null, Math.min(b.labelLat, 75)]
      });
      for (const [lo, hi] of mirrorBands(b.range, true)) {
        const merged = lo < 0 && hi > 0, sign = hi > 0 ? 1 : -1;
        bands.push({ info, color: style.color, opacity: 0.13, stroke: style.color, strokeWidth: 1.2, dash: '6 4', geom: bandGeom(lo, hi) });
        labels.push({
          text: `${b.name} (${b.kind === 'low' ? 'L' : 'H'})`, dy: 3.5, fill: darker(style.color),
          pos: () => bandLabelPos(LABEL_COLUMNS.pressure, merged ? b.labelLat : sign * labelLatFor(b))
        });
      }
    }
    addBandFeatures(layerG.pressure, bands);
    addLabels(gLabels, 'pressure', labels, 3);
  }

  function buildWinds() {
    const bands: BandItem[] = [], arrows: Drawable[] = [], labels: LabelItem[] = [];
    const hw = WIND_STYLE.arrowHalfWidth;
    for (const w of WIND_BELTS) {
      const [a, b] = w.range;
      const info = makeInfo({
        name: w.name, cls: 'Wind Belt', sub: w.toward === 'west' ? 'Blows east → west' : 'Blows west → east',
        coordLabel: 'Latitude range', coord: `${a}°–${b}° N and S`, desc: w.desc, color: WIND_STYLE.color,
        tag: TAGS.wind, layer: 'winds', focus: [null, (a + b) / 2]
      });
      for (const [lo, hi] of mirrorBands(w.range, false)) {
        const sign = hi > 0 ? 1 : -1;
        // The band itself is invisible until hovered; the arrows carry the visual.
        bands.push({ info, color: WIND_STYLE.color, opacity: 0, geom: bandGeom(lo, hi) });
        const latEq = sign * (a + 0.22 * (b - a)), latPole = sign * (b - 0.22 * (b - a));
        for (const lon of WIND_STYLE.arrowLons) {
          const from: LonLat = w.toward === 'west' ? [lon + hw, latPole] : [lon - hw, latEq];
          const to: LonLat = w.toward === 'west' ? [lon - hw, latEq] : [lon + hw, latPole];
          arrows.push({ tag: TAGS.wind, geom: arrowGeom(from, to) });
        }
        labels.push({
          text: `${w.name} (from ${sign > 0 ? w.fromN : w.fromS})`, compact: w.name, dy: 3.5, fill: darker(WIND_STYLE.color),
          pos: () => bandLabelPos(LABEL_COLUMNS.winds, sign * w.labelLat)
        });
      }
    }
    addBandFeatures(layerG.winds, bands);
    const gArrows = layerG.winds.append('g');
    for (const arrow of arrows) {
      gArrows.append('path').datum(arrow)
        .attr('class', 'dyn arrow').attr('stroke', WIND_STYLE.color).attr('stroke-width', 1.6)
        .attr('stroke-opacity', 0.85).attr('marker-end', 'url(#wm-arrow-wind)');
    }
    addLabels(gLabels, 'winds', labels, 4);
  }

  function buildCurrents() {
    const labelPoint = (c: (typeof OCEAN_CURRENTS)[number]) => c.points[c.labelIndex ?? Math.floor(c.points.length / 2)];
    addLineFeatures(layerG.currents, OCEAN_CURRENTS.map(c => {
      const style = CURRENT_STYLE[c.temp];
      return {
        color: style.color, width: 2, marker: `wm-arrow-${c.temp}`, geom: lineGeom(smooth(c.points)),
        info: makeInfo({
          name: c.name, cls: 'Ocean Current', sub: c.temp === 'warm' ? 'Warm current' : 'Cold current',
          coordLabel: 'Region', coord: c.region, desc: c.desc, color: style.color,
          tag: TAGS.current(c.temp), layer: 'currents', focus: labelPoint(c)
        })
      };
    }));
    addLabels(gLabels, 'currents', OCEAN_CURRENTS.map((c): LabelItem => {
      const mid = labelPoint(c);
      const dx = c.anchor === 'start' ? 7 : c.anchor === 'end' ? -7 : 0;
      return {
        text: c.name, cls: 'italic', anchor: c.anchor, fill: darker(CURRENT_STYLE[c.temp].color),
        pos: () => place(mid[0], mid[1], dx, dx ? 3.5 : -6)
      };
    }), 5);
  }

  function buildTimeZones() {
    const bands: BandItem[] = [], labels: LabelItem[] = [];
    // Offsets −12 … +12: the zone centred on 180° is split by the date line into two half-zones.
    for (let n = -12; n <= 12; n++) {
      const center = n * 15;
      const lon0 = Math.max(-180, center - 7.5), lon1 = Math.min(180, center + 7.5);
      const sign = n > 0 ? '+' : '−';
      const name = n === 0 ? 'UTC±0' : `UTC${sign}${Math.abs(n)}`;
      const clock = n === 0 ? 'Clocks here show UTC (Greenwich Mean Time).'
        : `Clocks here are ${plural(Math.abs(n), 'hour')} ${n > 0 ? 'ahead of' : 'behind'} UTC.`;
      const split = Math.abs(n) === 12
        ? ' The 15° zone centred on 180° is split by the International Date Line into UTC+12 on its west side and UTC−12 on its east side.' : '';
      bands.push({
        color: TIME_ZONE_STYLE.color, opacity: n % 2 === 0 ? 0.03 : 0.12,
        stroke: TIME_ZONE_STYLE.color, strokeWidth: 0.6, strokeOpacity: 0.35,
        geom: bandGeom(-90, 90, lon0, lon1),
        info: makeInfo({
          name, cls: 'Time Zone', sub: 'Nominal 15° zone', coordLabel: 'Longitude range',
          tag: TAGS.timezone, layer: 'timezones', focus: [(lon0 + lon1) / 2, null],
          coord: `${fmtLon(lon0)} – ${fmtLon(lon1)} (central meridian ${fmtLon(center)})`, color: TIME_ZONE_STYLE.color,
          desc: `${clock} Earth turns 15° of longitude every hour, giving 24 time zones of 15° each.${split} Real zone boundaries bend to follow national borders. Standard-time examples: ${TIME_ZONE_EXAMPLES[String(n)]}.`
        })
      });
      labels.push({
        text: n === 0 ? 'UTC' : `${sign}${Math.abs(n)}`, globeText: name, fill: TIME_ZONE_STYLE.color,
        pos: () => {
          if (n % edge.zoneStep !== 0) return null;
          if (globeMode) return place((lon0 + lon1) / 2, edge.zoneLabelLat, 0, 3.5);
          const x = pt((lon0 + lon1) / 2, edge.topLat)[0];
          return x < frame.x0 - 1 || x > frame.x1 + 1 ? null : [x, frame.y0 - 8];
        }
      });
    }
    addBandFeatures(layerG.timezones, bands);
    addLabels(gEdge, 'timezones', labels, 8);
  }

  function buildPlates() {
    addLineFeatures(layerG.plates, PLATE_BOUNDARIES.map(b => {
      const type = BOUNDARY_TYPES[b.type];
      return {
        color: type.color, width: 1.8, dash: type.dash, geom: lineGeom(densify(b.points)),
        info: makeInfo({
          name: b.name, cls: 'Tectonic Plate', sub: `Plate boundary · ${b.type}`,
          tag: TAGS.plate(b.type), layer: 'plates', focus: b.points[Math.floor(b.points.length / 2)],
          coordLabel: 'Plates', coord: b.plates, color: type.color,
          desc: `${type.desc}${b.note ? ' ' + b.note : ''} (Simplified outline.)`
        })
      };
    }));

    // Plate names are hoverable labels that carry the plate descriptions.
    addLabels(gLabels, 'plates', TECTONIC_PLATES.map((p): LabelItem => ({
      text: p.name, cls: p.rank === 'Major plate' ? 'caps' : 'caps small', fill: PLATE_LABEL_COLOR,
      prio: p.rank === 'Major plate' ? 2 : 6,
      info: makeInfo({
        name: p.name, cls: 'Tectonic Plate', sub: p.rank, coordLabel: 'Region', coord: p.region, desc: p.desc,
        color: PLATE_LABEL_COLOR, layer: 'plates', focus: p.label
      }),
      pos: () => place(p.label[0], p.label[1], 0, 3.5)
    })));
  }

  /** Day & night: the night hemisphere, the parallel the Sun is over today, and the subsolar point. */
  const sunInfo = {
    night: makeInfo({ name: 'Night side of Earth', cls: 'Day / Night', coordLabel: 'Sun overhead at', coord: '', desc: '', color: SUN.nightColor, tag: TAGS.sun, layer: 'daynight' }),
    path: makeInfo({ name: 'Sun\'s overhead latitude', cls: 'Sun Position', sub: 'Parallel of latitude', coord: '', desc: '', color: SUN.color, tag: TAGS.sun, layer: 'daynight' }),
    point: makeInfo({ name: 'Subsolar point', cls: 'Sun Position', sub: 'Sun directly overhead', coord: '', desc: '', color: SUN.color, tag: TAGS.sun, layer: 'daynight' })
  };
  let sunMarker: Selection<SVGGElement, Drawable, null, undefined> | null = null;

  function buildSun() {
    // Night side: shades stacked from the edge of the shadow inward (twilight → full night).
    // Only the outermost shade is hoverable; it stands for the whole night side.
    const night = layerG.daynight.append('g').attr('class', 'feat')
      .datum<Drawable>({ info: sunInfo.night, geom: () => null });
    SUN.nightBands.forEach((band, i) => {
      const item: Drawable = {
        info: i === 0 ? sunInfo.night : undefined,
        geom: () => (sun.nightGeos[i] ? path(sun.nightGeos[i]) : null)
      };
      night.append('path').datum(item)
        .attr('class', i === 0 ? 'dyn hit band' : 'dyn night-inner')
        .attr('fill', SUN.nightColor)
        .style('--fo', String(band.opacity))
        .attr('fill-opacity', i === 0 ? null : band.opacity);
    });
    addLineFeatures(layerG.daynight, [{
      info: sunInfo.path, color: SUN.color, width: 1.5, dash: '2 4',
      geom: () => (globeMode ? path(parallelGeo(sun.lat)) : parallelPath(sun.lat))
    }]);
    sunMarker = layerG.daynight.append('g').attr('class', 'feat sun-mark')
      .datum<Drawable>({ info: sunInfo.point, geom: () => null });
    sunMarker.append('circle').attr('class', 'sun-glow').attr('r', 13).attr('fill', SUN.color);
    sunMarker.append('circle').attr('class', 'hit sun-disc').attr('r', 6.5).attr('fill', SUN.color);
    updateSun();
  }

  /** Recompute the Sun's position from sunState and refresh the texts that describe it. */
  function updateSun() {
    const { day, hour } = sunState;
    Object.assign(sun, sunPosition(sunState));
    const antisolar: LonLat = [sun.lon + 180, -sun.lat];
    sun.nightGeos = SUN.nightBands.map(band => geoCircle().center(antisolar).radius(90 - band.sunBelow)());

    const when = `${fmtDay(day)}, ${fmtHour(hour)} UTC`;
    const where = `${fmtLat(sun.lat, 1)}, ${fmtLon(sun.lon, 1)}`;
    const tilt = Math.abs(sun.lat), summer = sun.lat > 0 ? 'Northern' : 'Southern';
    const season = tilt < 1
      ? 'It is close to an equinox: the Sun is over the Equator and day and night are about 12 hours long everywhere.'
      : `The ${summer} Hemisphere is tilted toward the Sun, so it has the longer days. Poleward of ${trimNum(90 - tilt, 1)}° ${sun.lat > 0 ? 'N' : 'S'} the Sun does not set at all today, and poleward of ${trimNum(90 - tilt, 1)}° ${sun.lat > 0 ? 'S' : 'N'} it does not rise.`;

    Object.assign(sunInfo.night, {
      coord: `${where} (${when})`,
      desc: `The shaded half of Earth is facing away from the Sun. Its edge, the terminator, is where sunrise and sunset are happening right now. ${season}`
    });
    Object.assign(sunInfo.path, {
      coord: `${fmtLat(sun.lat, 1)} on ${fmtDay(day)}`,
      desc: 'As Earth rotates today, the Sun passes directly overhead at every place along this parallel. Over a year the line moves between the Tropic of Cancer (June solstice) and the Tropic of Capricorn (December solstice) — which is why the tropics sit at 23.436°.'
    });
    Object.assign(sunInfo.point, {
      coord: `${where} (${when})`,
      desc: 'The one place on Earth where the Sun is exactly overhead at this moment and it is local noon. It travels westward 15° every hour and never leaves the belt between the two tropics.'
    });
  }

  /** Country outlines come from the world-atlas package; everything else works without them. */
  async function loadCountries() {
    try {
      type Atlas = Topology<{ countries: GeometryCollection<{ name: string }> }>;
      const world = (await import('world-atlas/countries-110m.json')).default as unknown as Atlas;
      if (destroyed) return;
      for (const f of feature(world, world.objects.countries).features) {
        const c = geoCentroid(f);
        const item: Drawable = {
          geom: () => path(f),
          info: makeInfo({
            name: f.properties.name, cls: 'Country', coordLabel: 'Centre', layer: 'countries', focus: [c[0], c[1]],
            coord: `≈ ${fmtLat(c[1], 0)}, ${fmtLon(c[0], 0)}`, color: '#a8a291',
            desc: 'Country outline from Natural Earth (1:110m scale).'
          })
        };
        layerG.countries.append('path').datum(item).attr('class', 'dyn hit feat country');
      }
      cb.onIndex(infos.slice());
      draw();
    } catch {
      if (!destroyed) cb.onStatus('Country outlines could not be loaded — the other layers still work.');
    }
  }

  /* ====================================================================
     4. Layout
     ==================================================================== */

  /** Fit the projection to the container. `keepZoom` preserves the globe's zoom on a resize. */
  function layout(keepZoom = false) {
    const def = PROJECTIONS[projectionId];
    const previousK = keepZoom && globeMode && def.globe ? grab.k : 1;
    globeMode = !!def.globe;
    width = Math.max(280, Math.floor(container.clientWidth));
    latCap = def.maxLat;
    projection = def.create().precision(0.4);

    // Height left in the window below the top of the map, so the whole map fits on screen.
    const top = container.getBoundingClientRect().top + window.scrollY;
    const available = window.innerHeight - Math.min(top, 260) - 64;

    let mapWidth: number;
    if (globeMode) {
      const pad = 12;
      mapWidth = clamp(Math.min(width - 2 * pad, available - 2 * pad), 240, 760);
      height = Math.round(mapWidth + 2 * pad);
      projection.scale(mapWidth / 2).translate([width / 2, height / 2]).clipAngle(90).rotate([rotate[0], rotate[1], 0]);
      frame = { x0: 0, y0: 0, x1: width, y1: height };
    } else {
      // Fit the width; if that makes the map taller than the window, shrink it and centre it.
      const span = () => {
        const yTop = pt(0, latCap)[1], yBot = pt(0, -latCap)[1];
        return { yTop, h: yBot - yTop };
      };
      mapWidth = width - MARGIN.left - MARGIN.right;
      projection.fitWidth(mapWidth, SPHERE);
      let { yTop, h } = span();
      const maxH = Math.max(200, available - MARGIN.top - MARGIN.bottom);
      if (h > maxH) {
        mapWidth = Math.round(mapWidth * maxH / h);
        projection.fitWidth(mapWidth, SPHERE);
        ({ yTop, h } = span());
      }
      const x0 = MARGIN.left + (width - MARGIN.left - MARGIN.right - mapWidth) / 2;
      const t = projection.translate();
      projection.translate([t[0] + x0, t[1] - yTop + MARGIN.top]);
      frame = { x0, y0: MARGIN.top, x1: x0 + mapWidth, y1: MARGIN.top + h };
      height = Math.ceil(frame.y1 + MARGIN.bottom);
    }
    base = { scale: projection.scale(), translate: projection.translate() };
    path = geoPath(projection);

    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    clipRect.attr('x', frame.x0).attr('y', frame.y0).attr('width', frame.x1 - frame.x0).attr('height', frame.y1 - frame.y0);
    crosshair.attr('transform', `translate(${(frame.x0 + frame.x1) / 2},${(frame.y0 + frame.y1) / 2})`);

    // Pick the label variant for this view; narrow maps get shorter, smaller labels.
    const compact = mapWidth < (globeMode ? 420 : 620);
    svg.classed('compact', compact).classed('globe', globeMode);
    for (const { el, d } of labelNodes) {
      el.textContent = (globeMode && d.globeText) || (compact && d.compact) || d.text;
      el.setAttribute('text-anchor', (globeMode && d.globeAnchor) || d.anchor || 'middle');
    }

    // Flat maps pan within the map; the globe turns freely.
    zoomer.extent([[0, 0], [width, height]])
      .translateExtent(globeMode ? [[-Infinity, -Infinity], [Infinity, Infinity]] : [[0, 0], [width, height]]);
    grab = { k: previousK, x: 0, y: 0 };
    if (globeMode) projection.scale(base.scale * previousK);
    svg.call(zoomer.transform, zoomIdentity.scale(previousK));
    draw();
  }

  /* ====================================================================
     5. Draw
     ==================================================================== */

  /** Recompute every path and label position from the current projection. */
  function draw() {
    if (destroyed || !width) return;

    // Work out how densely the degree / UTC labels can be drawn in this view.
    if (globeMode) {
      viewCenter = [-rotate[0], -rotate[1]];
      const pxPerDeg = projection.scale() * RAD;
      edge.lonLabelLat = Math.round(clamp(viewCenter[1], -60, 60) / 30) * 30;   // parallel that carries the longitude labels
      edge.zoneLabelLat = edge.lonLabelLat + (edge.lonLabelLat >= 60 ? -15 : 15);
      edge.latStep = pickStep([15, 30, 45], pxPerDeg, 16);
      edge.lonStep = pickStep([15, 30, 60, 90], pxPerDeg * Math.cos(edge.lonLabelLat * RAD), 42);
      edge.zoneStep = pickStep([1, 2, 3, 4, 6], pxPerDeg * 15 * Math.cos(edge.zoneLabelLat * RAD), 48);
    } else {
      // Latitudes at the top and bottom edge of the frame (they change while zoomed).
      const cx = (frame.x0 + frame.x1) / 2;
      const top = projection.invert?.([cx, frame.y0]), bottom = projection.invert?.([cx, frame.y1]);
      edge.topLat = clamp(top && isFinite(top[1]) ? top[1] : latCap, -latCap, latCap);
      edge.botLat = clamp(bottom && isFinite(bottom[1]) ? bottom[1] : -latCap, -latCap, latCap);
      const pxPerDegLon = (lat: number) => Math.abs(pt(15, lat)[0] - pt(0, lat)[0]) / 15;
      edge.latStep = pickStep([15, 30, 45], Math.abs(pt(0, 15)[1] - pt(0, 0)[1]) / 15, 12);
      edge.lonStep = pickStep([15, 30, 60, 90], pxPerDegLon(edge.botLat), 38);
      edge.zoneStep = pickStep([1, 2, 3, 4, 6], pxPerDegLon(edge.topLat) * 15, 24);
    }

    const sphere = path(SPHERE);
    spherePath.attr('d', sphere);
    sphereShade.attr('d', sphere);
    sphereOutline.attr('d', sphere);
    gMap.selectAll<SVGPathElement, Drawable>('path.dyn').attr('d', d => d.geom());

    for (const { el, d } of labelNodes) {
      const p = d.pos();
      if (!p || !isFinite(p[0]) || !isFinite(p[1])) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.setAttribute('transform', `translate(${p[0].toFixed(1)},${p[1].toFixed(1)})${p[2] ? ` rotate(${p[2].toFixed(1)})` : ''}`);
    }
    declutterLabels();

    // Point markers: the Sun and the pinned (clicked) location.
    const sunAt = place(sun.lon, sun.lat);
    if (sunMarker) {
      sunMarker.style('display', sunAt ? '' : 'none');
      if (sunAt) sunMarker.attr('transform', `translate(${xy(sunAt)})`);
    }
    const pinAt = pinned && place(pinned[0], pinned[1]);
    pinMark.style('display', pinAt ? '' : 'none');
    if (pinAt) pinMark.attr('cx', pinAt[0]).attr('cy', pinAt[1]);
  }

  /**
   * Hide labels that would overlap a higher-priority label. Zooming in spreads the
   * labels apart (text keeps its size), so hidden ones reappear.
   */
  function declutterLabels() {
    for (const { el } of labelNodes) el.style.visibility = '';
    const rects = labelNodes.map(({ el }) => (el.style.display === 'none' ? null : el.getBoundingClientRect()));
    const placed: DOMRect[] = [], pad = 2;
    labelNodes.forEach(({ el }, i) => {
      const r = rects[i];
      if (!r || !r.width) return;        // not positioned, or inside a hidden layer
      const clash = placed.some(q => r.left < q.right + pad && r.right > q.left - pad && r.top < q.bottom + pad && r.bottom > q.top - pad);
      if (clash) el.style.visibility = 'hidden'; else placed.push(r);
    });
  }

  /** Show or hide layers according to the toggles. */
  function applyVisibility() {
    svg.selectAll<SVGGElement, unknown>('[data-layer]').style('display', function () {
      return layers[this.getAttribute('data-layer') as LayerId] ? null : 'none';
    });
    svg.classed('big-labels', layers.bigLabels);
    declutterLabels();
    if (!layers.tooltips) hideTooltip();
  }

  /* ====================================================================
     6. Interaction: zoom, pan, globe rotation, keyboard
     The projection itself is rescaled (instead of scaling the SVG), so strokes and labels
     keep their size. On the globe a drag turns the Earth rather than panning.
     ==================================================================== */

  let grab = { k: 1, x: 0, y: 0 };    // previous zoom transform, to tell a drag from a zoom
  let dragging = false, pointerInside = false, flying = false;

  function setRotation(lambda: number, phi: number) {
    rotate = [wrapLon(lambda), clamp(phi, -90, 90)];
    projection.rotate([rotate[0], rotate[1], 0]);
  }

  const zoomer = d3Zoom<SVGSVGElement, unknown>().scaleExtent([ZOOM.min, ZOOM.max])
    .on('start', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      dragging = true;
      svg.classed('dragging', true);
      if (event.sourceEvent) svg.interrupt('fly');     // a user gesture cancels a fly-to
    })
    .on('end', () => { dragging = false; svg.classed('dragging', false); })
    .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      const t = event.transform;
      if (globeMode) {
        if (t.k !== grab.k) {
          projection.scale(base.scale * t.k);                       // wheel, pinch or zoom buttons
        } else if (event.sourceEvent) {
          const degPerPx = 1 / (projection.scale() * RAD);          // the surface follows the pointer
          setRotation(rotate[0] + (t.x - grab.x) * degPerPx, rotate[1] - (t.y - grab.y) * degPerPx);
        }
        grab = { k: t.k, x: t.x, y: t.y };
      } else {
        projection.scale(base.scale * t.k)
          .translate([base.translate[0] * t.k + t.x, base.translate[1] * t.k + t.y]);
        grab = { k: t.k, x: t.x, y: t.y };
      }
      draw();
    });
  svg.call(zoomer);

  function zoomBy(factor: number) {
    svg.transition().duration(200).call(zoomer.scaleBy, factor);
  }

  function resetView() {
    svg.interrupt('fly');
    if (globeMode) setRotation(-GLOBE.startCenter[0], -GLOBE.startCenter[1]);
    svg.transition().duration(250).call(zoomer.transform, zoomIdentity);
    draw();
  }

  /** Turn the globe so [lon, lat] faces the viewer (null keeps the current value). */
  function flyTo(lon: number | null, lat: number | null, onArrive?: () => void) {
    if (!globeMode) return;
    const from: [number, number] = [rotate[0], rotate[1]];
    const to: [number, number] = [lon == null ? from[0] : -lon, lat == null ? from[1] : -clamp(lat, -75, 75)];
    const dLon = wrapLon(to[0] - from[0]);            // take the short way round
    flying = true;
    svg.transition('fly').duration(900)
      .tween('rotate', () => (t: number) => {
        setRotation(from[0] + dLon * t, from[1] + (to[1] - from[1]) * t);
        draw();
      })
      .on('interrupt', () => { flying = false; })
      .on('end', () => { flying = false; onArrive?.(); });
  }

  /** Keyboard step: turn the globe, or pan a zoomed flat map. dx/dy are −1, 0 or 1. */
  function nudge(dx: number, dy: number) {
    if (globeMode) {
      const step = ZOOM.keyRotateDeg / Math.sqrt(grab.k);
      setRotation(rotate[0] - dx * step, rotate[1] + dy * step);
      draw();
    } else {
      zoomer.translateBy(svg, -dx * ZOOM.keyPanPx / grab.k, -dy * ZOOM.keyPanPx / grab.k);
    }
  }

  svg.on('keydown', (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowLeft: () => nudge(-1, 0), ArrowRight: () => nudge(1, 0),
      ArrowUp: () => nudge(0, -1), ArrowDown: () => nudge(0, 1),
      '+': () => zoomBy(ZOOM.step), '=': () => zoomBy(ZOOM.step),
      '-': () => zoomBy(1 / ZOOM.step), _: () => zoomBy(1 / ZOOM.step),
      '0': resetView, Home: resetView,
      Enter: inspectCenter, ' ': inspectCenter
    };
    const action = keys[event.key];
    if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    action();
  });

  // Auto-rotation: turns the globe slowly; pauses while the pointer is over the map,
  // while a tapped tooltip is open and while the map has keyboard focus.
  let lastTick = 0, stickyOpen = false;
  const spinTimer = timer(elapsed => {
    const dt = Math.min(100, elapsed - lastTick);
    lastTick = elapsed;
    if (!globeMode || !layers.spin || dragging || flying || pointerInside || stickyOpen || document.hidden) return;
    if (document.activeElement === svgNode) return;
    setRotation(rotate[0] + GLOBE.spinDegPerSec * dt / 1000, rotate[1]);
    draw();
  });

  /* ====================================================================
     Hover, tap and click
     ==================================================================== */

  /** All hoverable features under a screen point, topmost first (overlapping layers are all reported). */
  function featuresAt(clientX: number, clientY: number) {
    const seen = new Set<FeatureInfo>(), out: { info: FeatureInfo; el: Element }[] = [];
    for (const el of document.elementsFromPoint(clientX, clientY)) {
      if (!el.classList.contains('hit') || !svgNode.contains(el)) continue;
      const d = select<Element, Drawable | LabelItem | undefined>(el).datum();
      if (!d?.info || seen.has(d.info)) continue;
      seen.add(d.info);
      out.push({ info: d.info, el });
    }
    return out;
  }

  /** Geographic position at a point of the SVG, or null when it is off the Earth. */
  function lonLatAtPoint(x: number, y: number): LonLat | null {
    if (x < frame.x0 || x > frame.x1 || y < frame.y0 || y > frame.y1) return null;
    const ll = projection.invert?.([x, y]);
    if (!ll || !isFinite(ll[0]) || !isFinite(ll[1]) || Math.abs(ll[0]) > 180 || Math.abs(ll[1]) > 90) return null;
    return ll;
  }

  let hotEl: Element | null = null;
  function setHot(el: Element | null) {
    const target = el ? el.closest('.feat') : null;
    if (target === hotEl) return;
    hotEl?.classList.remove('hot');
    target?.classList.add('hot');
    hotEl = target;
  }

  let tipKey = '';                       // identifies the current tooltip content
  let lastPointerType = 'mouse';
  function hideTooltip() {
    stickyOpen = false;
    if (!tipKey) return;
    tipKey = '';
    cb.onTooltip(null);
  }

  /** Pin the features at a viewport point in the details panel. Returns them. */
  function selectAt(clientX: number, clientY: number, ll: LonLat | null, lead?: string) {
    const stack = featuresAt(clientX, clientY).map(s => s.info);
    pinned = ll;
    const where = lead ?? (ll ? `At ${fmtLonLat(ll)}` : '');
    cb.onSelect(stack, `${where}${where ? ' — ' : ''}${plural(stack.length, 'feature')}`, ll);
    draw();
    return stack;
  }

  /** Go to a location (turning the globe if needed) and describe what is there. */
  function inspectPoint(ll: LonLat, lead?: string) {
    const describe = () => {
      const p = projection(ll);
      if (!p || destroyed) return;
      const r = svgNode.getBoundingClientRect();
      selectAt(r.left + p[0], r.top + p[1], ll, lead);
    };
    svgNode.scrollIntoView({ block: 'nearest' });      // hit-testing needs the map on screen
    if (globeMode) {
      flyTo(ll[0], ll[1], describe);
    } else {
      svg.call(zoomer.transform, zoomIdentity);         // a zoomed flat map may have the point out of view
      describe();
    }
  }

  /** Keyboard: inspect whatever is under the crosshair at the centre of the map. */
  function inspectCenter() {
    const r = svgNode.getBoundingClientRect();
    const x = (frame.x0 + frame.x1) / 2, y = (frame.y0 + frame.y1) / 2;
    selectAt(r.left + x, r.top + y, lonLatAtPoint(x, y));
  }

  svg
    .on('pointerenter', () => { pointerInside = true; })
    .on('pointerleave', (event: PointerEvent) => {
      pointerInside = false;
      setHot(null);
      cb.onCursor('—');
      if (event.pointerType === 'mouse') hideTooltip();      // a tapped tooltip stays until dismissed
    })
    .on('pointerdown', (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      hideTooltip();
      spotlight(null);
    })
    .on('pointermove', (event: PointerEvent) => {
      const [x, y] = pointer(event, svgNode);
      const ll = lonLatAtPoint(x, y);
      cb.onCursor(ll ? fmtLonLat(ll) : '—');
      if (event.pointerType === 'touch') return;              // touch screens use tap instead of hover

      // Desktop: the tooltip follows the pointer and lists everything under it.
      const stack = featuresAt(event.clientX, event.clientY);
      setHot(stack.length ? stack[0].el : null);
      if (!layers.tooltips || !stack.length || dragging) { hideTooltip(); return; }
      const key = stack.map(s => s.info.key).join(',');
      if (key !== tipKey) {
        tipKey = key;
        cb.onTooltip({ infos: stack.map(s => s.info), x: event.clientX, y: event.clientY, sticky: false });
      } else {
        cb.onTooltipMove(event.clientX, event.clientY);
      }
    })
    .on('click', (event: MouseEvent) => {
      const [x, y] = pointer(event, svgNode);
      const stack = selectAt(event.clientX, event.clientY, lonLatAtPoint(x, y));
      // Touch: a tap opens the tooltip; it stays until the next tap elsewhere.
      if (lastPointerType !== 'mouse' && layers.tooltips && stack.length) {
        tipKey = 'tap';
        stickyOpen = true;
        cb.onTooltip({ infos: stack, x: event.clientX, y: event.clientY, sticky: true });
      }
    });

  /** Dim everything except the matching features (null clears the spotlight). */
  function spotlight(target: SpotlightTarget) {
    svg.classed('spotlight', !!target);
    gMap.selectAll<SVGElement, Drawable>('.feat, .arrow').classed('lit', d => {
      if (!target || !d) return false;
      return 'tag' in target ? (d.tag ?? d.info?.tag) === target.tag : d.info?.key === target.key;
    });
  }

  function focusFeature(info: FeatureInfo) {
    spotlight({ key: info.key });
    const [lon, lat] = info.focus ?? [null, null];
    pinned = lon != null && lat != null ? [lon, lat] : null;
    if (info.focus) flyTo(lon, lat);
    draw();
  }

  /* ====================================================================
     Start
     ==================================================================== */
  buildGraticule();
  buildSpecialLines();
  buildClimateZones();
  buildPressureBelts();
  buildWinds();
  buildCurrents();
  buildTimeZones();
  buildPlates();
  buildSun();
  labelNodes.sort((a, b) => (a.d.prio ?? 9) - (b.d.prio ?? 9));

  layout();
  applyVisibility();
  cb.onIndex(infos.slice());
  void loadCountries();

  // Responsive: refit whenever the container changes width (sidebar toggle, rotation, resize).
  let resizeFrame = 0;
  const observer = new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!destroyed && Math.max(280, Math.floor(container.clientWidth)) !== width) layout(true);
    });
  });
  observer.observe(container);

  return {
    setProjection(id) {
      if (id === projectionId) return;
      projectionId = id;
      svg.interrupt('fly');
      layout();
    },
    setLayers(next) {
      layers = { ...next };
      applyVisibility();
    },
    setSun(next) {
      if (next.day === sunState.day && next.hour === sunState.hour) return;
      sunState = { ...next };
      updateSun();
      draw();
    },
    zoomBy,
    resetView,
    spotlight,
    focusFeature,
    infosByTag: tag => infos.filter(info => info.tag === tag),
    inspectPoint,
    getCenter: () => (globeMode ? [-rotate[0], -rotate[1]] : null),
    setCenter(point) {
      setRotation(-point[0], -point[1]);
      draw();
    },
    dismissTooltip: hideTooltip,
    destroy() {
      destroyed = true;
      spinTimer.stop();
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      svg.interrupt().interrupt('fly');
      svg.on('.zoom', null);
      svg.remove();
    }
  };
}
