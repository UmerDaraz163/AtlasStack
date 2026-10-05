'use client';

import { fmtDay, fmtDuration, fmtHour, fmtLonLat, pointFacts } from '@/lib/geo';
import type { LonLat, SunState } from '@/lib/types';
import { PinIcon } from './icons';

interface PointFactsCardProps {
  point: LonLat;
  sun: SunState;
}

/**
 * "This place" card: where the picked point is and what the Sun does there on the date and
 * time chosen in Sun & seasons. It recalculates live while the sliders move or the year plays.
 */
export function PointFactsCard({ point, sun }: PointFactsCardProps) {
  const f = pointFacts(point, sun);

  const daylight = f.dayLength >= 24
    ? '24 hours — the Sun does not set (polar day)'
    : f.dayLength <= 0
      ? 'None — the Sun does not rise (polar night)'
      : `≈ ${fmtDuration(f.dayLength)} · sunrise ≈ ${f.sunrise}, sunset ≈ ${f.sunset} (solar time)`;

  const noon = f.noonAltitude > 0
    ? `${f.noonAltitude.toFixed(1)}° above the horizon${f.noonAltitude > 89.5 ? ' — directly overhead' : ''}`
    : `${Math.abs(f.noonAltitude).toFixed(1)}° below the horizon`;

  const sunNow = `${f.light} — Sun ${Math.abs(f.altitude).toFixed(0)}° ${f.altitude >= 0 ? 'above' : 'below'} the horizon`;

  const rows: [string, string][] = [
    ['Hemispheres', f.hemispheres],
    ['From the Equator', f.equatorSide === 'on' ? 'On the Equator' : `≈ ${f.equatorKm.toLocaleString('en-US')} km ${f.equatorSide}`],
    ['Time zone', `${f.zone} (nominal) · solar time ${f.solarTime}`],
    [`Daylight on ${fmtDay(sun.day)}`, daylight],
    ['Sun at local noon', noon],
    [`At ${fmtHour(sun.hour)} UTC`, sunNow]
  ];

  return (
    <div className="animate-fade-up rounded-lg border border-accent bg-accent-soft p-3 text-[13px] sm:text-sm">
      <div className="flex items-center gap-2 text-sm font-bold">
        <PinIcon width={16} height={16} className="shrink-0 text-accent" />
        This place · {fmtLonLat(point)}
      </div>
      <dl className="my-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        Follows the Sun &amp; seasons sliders. Times are approximate (solar time, no daylight-saving).
      </p>
    </div>
  );
}
