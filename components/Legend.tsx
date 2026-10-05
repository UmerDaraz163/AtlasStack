'use client';

import { memo, useMemo } from 'react';
import { buildLegend, type LegendRow, type Swatch } from '@/lib/legend';
import type { LayerState } from '@/lib/types';

interface LegendProps {
  layers: LayerState;
  /** Hover / focus: spotlight the row's features on the map (null clears). */
  onSpotlight: (tag: string | null) => void;
  /** Click: switch the row's layer on and show its description. */
  onActivate: (row: LegendRow) => void;
}

/** A short line sample or a filled box, drawn like the feature on the map. */
function SwatchIcon({ swatch }: { swatch: Swatch }) {
  if (swatch.kind === 'fill') {
    return (
      <svg width="34" height="12" aria-hidden="true" className="shrink-0">
        <rect
          x="1" y="1" width="32" height="10" rx="2" fill={swatch.color} fillOpacity={swatch.opacity}
          stroke={swatch.color} strokeOpacity={0.7} strokeDasharray={swatch.dash}
        />
      </svg>
    );
  }
  return (
    <svg width="34" height="12" aria-hidden="true" className="shrink-0">
      <line
        x1="2" y1="6" x2={swatch.arrow ? 25 : 32} y2="6" stroke={swatch.color} strokeWidth={swatch.width ?? 2}
        strokeDasharray={swatch.dash ?? undefined} strokeLinecap={swatch.cap === 'round' ? 'round' : undefined}
      />
      {swatch.arrow && <path d="M24,2.5L33,6L24,9.5z" fill={swatch.color} />}
    </svg>
  );
}

/**
 * The legend, generated from the data definitions. Rows are buttons:
 * hover or focus spotlights the features, click switches the layer on and pins its description.
 */
export const Legend = memo(function Legend({ layers, onSpotlight, onActivate }: LegendProps) {
  const groups = useMemo(buildLegend, []);

  return (
    <div onPointerLeave={() => onSpotlight(null)}>
      <p className="mb-3 text-xs text-muted">
        Hover a row to spotlight it on the map. Select it to switch its layer on and read about it.
      </p>
      {groups.map(group => (
        <div key={group.title} className="mb-3 last:mb-0">
          <h3 className="mb-0.5 text-[13px] font-semibold">{group.title}</h3>
          <ul>
            {group.rows.map(row => {
              const off = !layers[row.layer];
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => onActivate(row)}
                    onPointerEnter={() => onSpotlight(row.tag)}
                    onFocus={() => onSpotlight(row.tag)}
                    onBlur={() => onSpotlight(null)}
                    className="-mx-1.5 flex min-h-8 w-[calc(100%+0.75rem)] cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] transition-colors hover:bg-hover"
                  >
                    <span className={`transition-opacity ${off ? 'opacity-40' : ''}`}><SwatchIcon swatch={row.swatch} /></span>
                    <span className={`flex-1 transition-colors ${off ? 'text-muted' : ''}`}>{row.label}</span>
                    {off && <span className="rounded bg-hover px-1.5 text-[11px] text-muted">off</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
});
