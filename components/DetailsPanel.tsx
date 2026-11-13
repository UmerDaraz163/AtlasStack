'use client';

import type { City } from '@/lib/geodata';
import type { Details, LonLat, Measurement, SunState } from '@/lib/types';
import { CountryPanel } from './CountryPanel';
import { FeatureCard } from './FeatureCard';
import { MeasureCard } from './MeasureCard';
import { PointFactsCard } from './PointFactsCard';
import { ExploreIcon } from './icons';

interface DetailsPanelProps {
  details: Details | null;
  sun: SunState;
  onClear: () => void;
  /** Country being explored (cities, plates, clock time), if any. */
  country: string | null;
  onExploreCountry: (name: string) => void;
  onLeaveCountry: () => void;
  onPickCity: (city: City) => void;
  /** Distance tool, while it is on. */
  measurement: Measurement | null;
  onClearMeasure: () => void;
  onDoneMeasure: () => void;
  onExplainRoute: (a: LonLat, b: LonLat) => void;
  /** Open the street map (OpenStreetMap) at a place. */
  onStreetMap: (point: LonLat, label: string, zoom?: number) => void;
}

/**
 * Everything pinned below the map: the distance tool, the country being explored, facts about the
 * picked place, and every feature at that point — or a legend row, or a search result.
 */
export function DetailsPanel(props: DetailsPanelProps) {
  const {
    details, sun, onClear, country, onExploreCountry, onLeaveCountry, onPickCity, measurement, onClearMeasure, onDoneMeasure, onStreetMap,
    onExplainRoute
  } = props;
  const hasDetails = !!details && (details.infos.length > 0 || !!details.point);
  const empty = !hasDetails && !country && !measurement;

  return (
    <section aria-labelledby="details-title" className="rounded-xl border border-rule bg-surface p-3 shadow-card sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="details-title" className="text-xs font-bold uppercase tracking-wider text-muted">Details</h2>
        {hasDetails && (
          <button
            type="button" onClick={onClear}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>

      <div className="space-y-3">
        {measurement && (
          <MeasureCard measurement={measurement} sun={sun} onClear={onClearMeasure} onDone={onDoneMeasure} onExplain={onExplainRoute} />
        )}
        {country && <CountryPanel name={country} sun={sun} onClose={onLeaveCountry} onPickCity={onPickCity} onStreetMap={onStreetMap} />}

        {hasDetails && details && (
          <div>
            {/* Only the heading is announced; the cards below can be read on demand. */}
            <p aria-live="polite" className="mb-2 text-muted">{details.heading}</p>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {details.point && <PointFactsCard point={details.point} sun={sun} onStreetMap={onStreetMap} />}
              {details.infos.map((info, i) => (
                <div
                  key={info.key}
                  className="animate-fade-up rounded-lg border border-rule p-3 text-[13px] sm:text-sm"
                  style={{ animationDelay: `${Math.min(i + 1, 8) * 30}ms` }}
                >
                  <FeatureCard info={info} />
                  {info.country && info.country !== country && (
                    <button
                      type="button" onClick={() => onExploreCountry(info.country as string)}
                      className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-accent bg-surface px-3 py-1 text-xs font-medium text-accent-dark transition-colors hover:bg-accent-soft"
                    >
                      <ExploreIcon width={14} height={14} />
                      Explore {info.country}: cities, plates &amp; clock time
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {empty && (
        <p className="text-muted">
          Select any place, line or region on the map — or any row of the legend — to pin its name, classification,
          coordinates and description here, together with its clock time, tectonic plate and daylight. Select a country and
          choose “Explore” to list its cities.
        </p>
      )}
    </section>
  );
}
