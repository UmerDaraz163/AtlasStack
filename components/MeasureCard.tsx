'use client';

import { geoDistance } from 'd3-geo';
import { useGeoData } from '@/hooks/useGeoData';
import { fmtDuration, fmtLonLat, wrapLon } from '@/lib/geo';
import {
  EARTH_RADIUS_KM, bearingDeg, clockTime, fmtOffset, sunDate, utcOffsetMinutes, zoneAt
} from '@/lib/geodata';
import type { Measurement, SunState } from '@/lib/types';
import { RulerIcon } from './icons';

interface MeasureCardProps {
  measurement: Measurement;
  sun: SunState;
  onClear: () => void;
  onDone: () => void;
  /** Open the flight-route explainer for these two points. */
  onExplain: (a: [number, number], b: [number, number]) => void;
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** Typical airliner cruising speed, for a sense of scale. */
const FLIGHT_KMH = 850;

/** Distance tool results: great-circle distance, direction, and the time difference between the two places. */
export function MeasureCard({ measurement, sun, onClear, onDone, onExplain }: MeasureCardProps) {
  useGeoData();
  const [a, b] = measurement.points;
  const date = sunDate(sun);

  let body;
  if (!a || !b) {
    body = (
      <p className="text-muted">
        {a ? 'Now select the second place.' : 'Select two places on the map to measure the distance between them.'}
        {' '}A third click starts a new measurement.
      </p>
    );
  } else {
    const km = geoDistance(a, b) * EARTH_RADIUS_KM;
    const bearing = bearingDeg(a, b);
    const za = zoneAt(a), zb = zoneAt(b);
    const solarDiff = wrapLon(b[0] - a[0]) / 15;
    const clockDiff = za && zb ? (utcOffsetMinutes(zb.tz, date) - utcOffsetMinutes(za.tz, date)) / 60 : null;
    const diffText = (h: number) => (Math.abs(h) < 1 / 120 ? 'same time' : `${fmtDuration(Math.abs(h))} ${h > 0 ? 'ahead' : 'behind'}`);
    const place = (p: typeof a, z: typeof za) =>
      z ? `${z.country} — ${clockTime(z.tz, date)} (${fmtOffset(utcOffsetMinutes(z.tz, date))})` : fmtLonLat(p);

    const rows: [string, string][] = [
      ['From', place(a, za)],
      ['To', place(b, zb)],
      ['Distance', `${Math.round(km).toLocaleString('en-US')} km · ${Math.round(km * 0.621371).toLocaleString('en-US')} miles`],
      ['Direction', `${Math.round(bearing)}° (${COMPASS[Math.round(bearing / 22.5) % 16]}) at the start`],
      ['Flight time', `≈ ${fmtDuration(km / FLIGHT_KMH)} at ${FLIGHT_KMH} km/h`],
      ['Clock difference', clockDiff == null ? 'one point is at sea' : `${diffText(clockDiff)} (second place vs. first)`],
      ['Solar time difference', diffText(solarDiff)]
    ];
    body = (
      <>
        <dl className="my-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          {rows.map(([term, value]) => (
            <div key={term} className="contents"><dt className="text-muted">{term}</dt><dd className="tabular-nums">{value}</dd></div>
          ))}
        </dl>
        <p className="text-xs text-muted">
          The line is the great-circle route — the shortest path over the Earth&apos;s surface, which is why it bends on flat maps.
        </p>
        <button
          type="button" onClick={() => onExplain(a, b)}
          className="mt-2 inline-flex cursor-pointer items-center rounded-full border border-accent bg-surface px-3 py-1 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-soft"
        >
          Why is this route curved? Compare flat map and globe
        </button>
      </>
    );
  }

  return (
    <section aria-labelledby="measure-title" className="animate-fade-up rounded-lg border border-accent bg-accent-soft p-3 text-[13px] sm:text-sm">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 id="measure-title" className="flex items-center gap-2 text-sm font-bold">
          <RulerIcon width={16} height={16} className="text-accent" /> Measure distance
        </h3>
        <div className="flex gap-1.5">
          {a && (
            <button type="button" onClick={onClear} className="cursor-pointer rounded-full border border-rule bg-surface px-3 py-1 text-xs font-medium hover:border-accent">
              Clear points
            </button>
          )}
          <button type="button" onClick={onDone} className="cursor-pointer rounded-full border border-accent bg-surface px-3 py-1 text-xs font-medium hover:bg-accent-soft">
            Done
          </button>
        </div>
      </div>
      {body}
    </section>
  );
}
