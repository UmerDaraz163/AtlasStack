'use client';

import {
  geoDistance, geoEquirectangularRaw, geoGraticule10, geoMercatorRaw, geoOrthographicRaw, geoPath, geoProjection,
  type GeoPath, type GeoProjection
} from 'd3-geo';
import { useEffect, useRef, useState } from 'react';
import { FLIGHT_ROUTES } from '@/data';
import { RAD, clamp } from '@/lib/geo';
import { loadCountries, type Country } from '@/lib/geodata';
import type { FlatMapKind } from '@/lib/route-geometry';
import type { LonLat } from '@/lib/types';

/** A plane drawn on a route: where it is and the next point (for its heading). */
export interface PlaneMarker {
  point: LonLat;
  next: LonLat;
}

interface RouteMorphMapProps {
  from: LonLat;
  to: LonLat;
  fromLabel: string;
  toLabel: string;
  flat: FlatMapKind;
  /** 0 = flat map, 1 = globe; anything between is the transition. */
  t: number;
  greatCircle: LonLat[];
  straight: LonLat[];
  greatCircleKm: number;
  straightKm: number;
  planes: { greatCircle: PlaneMarker; straight: PlaneMarker } | null;
  /** Tallest the map may be, in pixels (larger in full screen). */
  maxHeight?: number;
}

const fmtKm = (km: number) => `${Math.round(km).toLocaleString('en-US')} km`;
/** Small plane silhouette pointing up, centred on 0,0. */
const PLANE = 'M0,-8L1.6,-2.5L8,1.5V3.3L1.6,1.6L1.2,5.6L3.4,7.3V8.5L0,7.6L-3.4,8.5V7.3L-1.2,5.6L-1.6,1.6L-8,3.3V1.5L-1.6,-2.5Z';

/**
 * Map that morphs between a flat map (Mercator or equirectangular) and a globe.
 * The trick: one projection whose formula is a blend of the two — at t = 0 it is the flat map,
 * at t = 1 the orthographic globe. Only the half of the world around the route is shown
 * (clipped at 90° from its centre), which keeps the blend free of seams.
 */
export function RouteMorphMap(props: RouteMorphMapProps) {
  const { from, to, fromLabel, toLabel, flat, t, greatCircle, straight, greatCircleKm, straightKm, planes, maxHeight = 600 } = props;
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 640, h: 440 });
  const [countries, setCountries] = useState<Country[] | null>(null);
  const maxHeightRef = useRef(maxHeight);          // read by the resize observer

  // Projection state lives in a ref: the raw formula reads the current blend and flat-map kind.
  const state = useRef({ alpha: 0, kind: flat as FlatMapKind });
  const tools = useRef<{ projection: GeoProjection; path: GeoPath } | null>(null);
  if (!tools.current) {
    const maxY = FLIGHT_ROUTES.mercatorMaxLat * RAD;
    const raw = (lambda: number, phi: number): [number, number] => {
      const f = state.current.kind === 'mercator'
        ? geoMercatorRaw(lambda, clamp(phi, -maxY, maxY))
        : geoEquirectangularRaw(lambda, phi);
      const g = geoOrthographicRaw(lambda, phi);
      const a = state.current.alpha;
      return [f[0] + (g[0] - f[0]) * a, f[1] + (g[1] - f[1]) * a];
    };
    const projection = geoProjection(raw).clipAngle(90).precision(0.3);
    tools.current = { projection, path: geoPath(projection) };
  }

  // Country shapes (shared with the main map) and the size of the box.
  useEffect(() => {
    let alive = true;
    loadCountries().then(c => { if (alive) setCountries(c); }, () => {});
    const box = boxRef.current;
    if (!box) return () => { alive = false; };
    const observer = new ResizeObserver(() => {
      const w = Math.max(280, Math.floor(box.clientWidth));
      // Taller on narrow screens, where the map is the main thing on screen.
      setSize({ w, h: Math.round(clamp(w * (w < 560 ? 0.95 : 0.7), 260, maxHeightRef.current)) });
    });
    observer.observe(box);
    return () => { alive = false; observer.disconnect(); };
  }, []);

  // Re-measure when the allowed height changes (entering or leaving full screen).
  useEffect(() => {
    maxHeightRef.current = maxHeight;
    const w = Math.max(280, Math.floor(boxRef.current?.clientWidth ?? 0));
    if (w) setSize({ w, h: Math.round(clamp(w * (w < 560 ? 0.95 : 0.7), 260, maxHeight)) });
  }, [maxHeight]);

  // Draw everything for the current blend.
  useEffect(() => {
    const svg = svgRef.current;
    const { projection, path } = tools.current!;
    if (!svg) return;
    const { w, h } = size;
    const alpha = clamp(t, 0, 1);
    state.current.alpha = alpha;
    state.current.kind = flat;

    // Centre: halfway in longitude (flat map stays north-up); the globe also tilts toward the route.
    const dLon = ((to[0] - from[0] + 540) % 360) - 180;
    const centerLon = from[0] + dLon / 2;
    const midLat = clamp(greatCircle[Math.floor(greatCircle.length / 2)][1], -60, 60);
    const ySpan = flat === 'mercator' ? 2 * Math.log(Math.tan(Math.PI / 4 + (FLIGHT_ROUTES.mercatorMaxLat * RAD) / 2)) : Math.PI;

    // Flat end: zoom to the two routes (with a margin), but stay inside the half-world strip.
    state.current.alpha = 0;
    projection.rotate([-centerLon, 0]).scale(1).translate([0, 0]);
    const [[bx0, by0], [bx1, by1]] = path.bounds({ type: 'MultiLineString', coordinates: [greatCircle, straight] });
    const halfW = Math.PI / 2, halfH = ySpan / 2;
    const kStrip = Math.min(w / (2 * halfW), h / (2 * halfH)) * 0.94;
    const kFlat = clamp(Math.min(w / Math.max(bx1 - bx0, 1e-6), h / Math.max(by1 - by0, 1e-6)) * 0.62, kStrip, kStrip * 4);
    const sw = halfW * kFlat, sh = halfH * kFlat;
    const txFlat = 2 * sw >= w ? clamp(w / 2 - ((bx0 + bx1) / 2) * kFlat, w - sw, sw) : w / 2;
    const tyFlat = 2 * sh >= h ? clamp(h / 2 - ((by0 + by1) / 2) * kFlat, h - sh, sh) : h / 2;

    // Globe end: the whole disc, centred. In between, everything blends.
    const kGlobe = (Math.min(w, h) / 2) * 0.94;
    state.current.alpha = alpha;
    projection
      .rotate([-centerLon, -midLat * alpha])
      .scale(kFlat + (kGlobe - kFlat) * alpha)     // setting the scale also refreshes the projection
      .translate([txFlat + (w / 2 - txFlat) * alpha, tyFlat + (h / 2 - tyFlat) * alpha]);

    const center: LonLat = [centerLon, midLat * alpha];
    const visible = (p: LonLat) => geoDistance(p, center) < Math.PI / 2 - 1e-3;
    const xy = (p: LonLat) => projection(p) ?? [NaN, NaN];

    const set = (selector: string, d: string | null) => svg.querySelector(selector)?.setAttribute('d', d ?? '');
    set('.rm-sphere', path({ type: 'Sphere' }));
    set('.rm-outline', path({ type: 'Sphere' }));
    set('.rm-graticule', path(geoGraticule10()));
    set('.rm-straight', path({ type: 'LineString', coordinates: straight }));
    set('.rm-great', path({ type: 'LineString', coordinates: greatCircle }));
    const land = svg.querySelector('.rm-land');
    if (land && countries) {
      land.setAttribute('d', countries.map(c => path(c.feature) ?? '').join(''));
    }

    // End points, their names and the two distances.
    const place = (selector: string, p: LonLat, dx = 0, dy = 0) => {
      const el = svg.querySelector<SVGGraphicsElement>(selector);
      if (!el) return;
      const [x, y] = xy(p);
      const show = visible(p) && Number.isFinite(x);
      el.style.display = show ? '' : 'none';
      if (show) el.setAttribute('transform', `translate(${(x + dx).toFixed(1)},${(y + dy).toFixed(1)})`);
    };
    place('.rm-from', from);
    place('.rm-to', to);
    const left = (xy(from)[0] ?? 0) <= (xy(to)[0] ?? 0);
    svg.querySelector('.rm-from text')?.setAttribute('text-anchor', left ? 'end' : 'start');
    svg.querySelector('.rm-from text')?.setAttribute('x', left ? '-9' : '9');
    svg.querySelector('.rm-to text')?.setAttribute('text-anchor', left ? 'start' : 'end');
    svg.querySelector('.rm-to text')?.setAttribute('x', left ? '9' : '-9');

    // Distance labels: on the side of each route that faces away from the other.
    const gcMid = greatCircle[Math.floor(greatCircle.length / 2)];
    const stMid = straight[Math.floor(straight.length / 2)];
    const gcAbove = (xy(gcMid)[1] ?? 0) <= (xy(stMid)[1] ?? 0);
    place('.rm-great-label', gcMid, 0, gcAbove ? -10 : 18);
    place('.rm-straight-label', stMid, 0, gcAbove ? 18 : -10);

    // Planes (during the race), turned to follow their route on screen.
    for (const [selector, plane] of [['.rm-plane-great', planes?.greatCircle], ['.rm-plane-straight', planes?.straight]] as const) {
      const el = svg.querySelector<SVGGraphicsElement>(selector);
      if (!el) continue;
      if (!plane || !visible(plane.point)) { el.style.display = 'none'; continue; }
      const [x, y] = xy(plane.point), [nx, ny] = xy(plane.next);
      const angle = Math.atan2(ny - y, nx - x) / RAD + 90;
      el.style.display = '';
      el.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${Number.isFinite(angle) ? angle.toFixed(1) : 0})`);
    }
  }, [size, t, flat, from, to, greatCircle, straight, planes, countries]);

  const viewName = t < 0.05 ? (flat === 'mercator' ? 'Flat Mercator map' : 'Flat equirectangular map') : t > 0.95 ? 'Globe' : 'Map wrapping into a globe';
  return (
    <div ref={boxRef} className="w-full">
      <svg
        ref={svgRef} width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`}
        className="route-map block max-w-full" role="img"
        aria-label={`${viewName} showing two routes from ${fromLabel} to ${toLabel}: the great-circle route, ${fmtKm(greatCircleKm)}, and the line that looks straight on the flat map, ${fmtKm(straightKm)}.`}
      >
        <path className="rm-sphere" />
        <path className="rm-graticule" />
        <path className="rm-land" />
        <path className="rm-outline" />
        <path className="rm-straight" stroke={FLIGHT_ROUTES.straightColor} />
        <path className="rm-great" stroke={FLIGHT_ROUTES.greatCircleColor} />
        <g className="rm-from"><circle r="5" /><text dy="4">{fromLabel}</text></g>
        <g className="rm-to"><circle r="5" /><text dy="4">{toLabel}</text></g>
        <g className="rm-great-label"><text textAnchor="middle" fill={FLIGHT_ROUTES.greatCircleColor}>{fmtKm(greatCircleKm)}</text></g>
        <g className="rm-straight-label"><text textAnchor="middle" fill={FLIGHT_ROUTES.straightColor}>{fmtKm(straightKm)}</text></g>
        <g className="rm-plane-straight"><path d={PLANE} fill={FLIGHT_ROUTES.straightColor} /></g>
        <g className="rm-plane-great"><path d={PLANE} fill={FLIGHT_ROUTES.greatCircleColor} /></g>
      </svg>
    </div>
  );
}
