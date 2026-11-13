'use client';

import { useGeoData } from '@/hooks/useGeoData';
import { fmtDay, fmtDuration, fmtHour, fmtLonLat, pointFacts } from '@/lib/geo';
import {
  clockTime, countryAt, describePlatePosition, fmtOffset, loaded, standardOffsetMinutes, sunDate, utcOffsetMinutes,
  zoneAt, zoneLongName
} from '@/lib/geodata';
import type { LonLat, SunState } from '@/lib/types';
import { PinIcon } from './icons';

interface PointFactsCardProps {
  point: LonLat;
  sun: SunState;
  /** Open the street map (OpenStreetMap) here. */
  onStreetMap: (point: LonLat, label: string) => void;
}

/**
 * "This place" card: where the picked point is, its real clock time, the plate under it, and
 * what the Sun does there on the date and time chosen in Sun & seasons. It recalculates live
 * while the sliders move or the year plays.
 */
export function PointFactsCard({ point, sun, onStreetMap }: PointFactsCardProps) {
  useGeoData();                                   // re-render when countries, cities and plates arrive
  const f = pointFacts(point, sun);
  const date = sunDate(sun);

  const country = loaded.countries ? countryAt(loaded.countries, point) : null;
  const zone = zoneAt(point);
  const clock = zone
    ? (() => {
        const offset = utcOffsetMinutes(zone.tz, date);
        const dst = offset > standardOffsetMinutes(zone.tz) ? ', daylight saving' : '';
        return `${clockTime(zone.tz, date)} · ${fmtOffset(offset)} (${zoneLongName(zone.tz, date)}${dst})`;
      })()
    : country || !loaded.cities ? null : `At sea — ships use the nominal zone, ${f.zone}`;
  const plate = describePlatePosition(point);

  const daylight = f.dayLength >= 24
    ? '24 hours — the Sun does not set (polar day)'
    : f.dayLength <= 0
      ? 'None — the Sun does not rise (polar night)'
      : `≈ ${fmtDuration(f.dayLength)} · sunrise ≈ ${f.sunrise}, sunset ≈ ${f.sunset} (solar time)`;

  const noon = f.noonAltitude > 0
    ? `${f.noonAltitude.toFixed(1)}° above the horizon${f.noonAltitude > 89.5 ? ' — directly overhead' : ''}`
    : `${Math.abs(f.noonAltitude).toFixed(1)}° below the horizon`;

  const sunNow = `${f.light} — Sun ${Math.abs(f.altitude).toFixed(0)}° ${f.altitude >= 0 ? 'above' : 'below'} the horizon`;

  const rows: [string, string | null][] = [
    ['Country', country?.name ?? (loaded.countries ? 'None (sea or an island too small for this map)' : null)],
    ['Hemispheres', f.hemispheres],
    ['From the Equator', f.equatorSide === 'on' ? 'On the Equator' : `≈ ${f.equatorKm.toLocaleString('en-US')} km ${f.equatorSide}`],
    [`Clock time at ${fmtHour(sun.hour)} UTC`, clock],
    ['Solar time', `${f.solarTime} · nominal 15° zone ${f.zone}`],
    ['Tectonic plate', plate ? plate.charAt(0).toUpperCase() + plate.slice(1) : null],
    [`Daylight on ${fmtDay(sun.day)}`, daylight],
    ['Sun at local noon', noon],
    ['Sun right now', sunNow]
  ];

  return (
    <div className="animate-fade-up rounded-lg border border-accent bg-accent-soft p-3 text-[13px] sm:text-sm">
      <div className="flex items-center gap-2 text-sm font-bold">
        <PinIcon width={16} height={16} className="shrink-0 text-accent" />
        This place · {fmtLonLat(point)}
      </div>
      <dl className="my-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.filter((row): row is [string, string] => !!row[1]).map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button" onClick={() => onStreetMap(point, country ? `${fmtLonLat(point)}, ${country.name}` : fmtLonLat(point))}
        className="mb-2 mt-1 inline-flex cursor-pointer items-center rounded-full border border-accent bg-surface px-3 py-1 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-soft"
      >
        Street map of this place (OpenStreetMap)
      </button>
      <p className="text-xs text-muted">
        Clock time uses the country&apos;s legal time zone (from the nearest city in our data). Solar time and the
        Sun follow the Sun &amp; seasons sliders.
      </p>
    </div>
  );
}
