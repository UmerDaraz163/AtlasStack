'use client';

import type { Details, SunState } from '@/lib/types';
import { FeatureCard } from './FeatureCard';
import { PointFactsCard } from './PointFactsCard';

interface DetailsPanelProps {
  details: Details | null;
  sun: SunState;
  onClear: () => void;
}

/**
 * Pinned descriptions: facts about the picked place, plus every feature at that point —
 * or a legend row, or a search result.
 */
export function DetailsPanel({ details, sun, onClear }: DetailsPanelProps) {
  const hasContent = !!details && (details.infos.length > 0 || !!details.point);
  return (
    <section aria-labelledby="details-title" className="rounded-xl border border-rule bg-surface p-3 shadow-card sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="details-title" className="text-xs font-bold uppercase tracking-wider text-muted">Details</h2>
        {hasContent && (
          <button
            type="button" onClick={onClear}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-hover hover:text-ink"
          >
            Clear
          </button>
        )}
      </div>
      {hasContent && details ? (
        <>
          {/* Only the heading is announced; the cards below can be read on demand. */}
          <p aria-live="polite" className="mb-2 text-muted">{details.heading}</p>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {details.point && <PointFactsCard point={details.point} sun={sun} />}
            {details.infos.map((info, i) => (
              <div
                key={info.key}
                className="animate-fade-up rounded-lg border border-rule p-3 text-[13px] sm:text-sm"
                style={{ animationDelay: `${Math.min(i + 1, 8) * 30}ms` }}
              >
                <FeatureCard info={info} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-muted">
          Select any place, line or region on the map — or any row of the legend — to pin its name, classification,
          coordinates and description here, together with the daylight and Sun position at that place.
        </p>
      )}
    </section>
  );
}
