'use client';

import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { TooltipState } from '@/lib/types';
import { FeatureCard } from './FeatureCard';
import { CloseIcon } from './icons';

export interface MapTooltipHandle {
  /** Follow the pointer without re-rendering. */
  moveTo: (x: number, y: number) => void;
  contains: (node: Node | null) => boolean;
}

interface MapTooltipProps {
  tip: TooltipState | null;
  onClose: () => void;
}

/**
 * Tooltip for the map.
 *  - Mouse: follows the pointer (not interactive).
 *  - Touch: opened by a tap, stays put, and has a close button; tapping elsewhere dismisses it.
 * It shows the topmost feature in full and lists everything else at that point.
 */
export const MapTooltip = forwardRef<MapTooltipHandle, MapTooltipProps>(function MapTooltip({ tip, onClose }, ref) {
  const el = useRef<HTMLDivElement>(null);

  // Keep the last content while the tooltip fades out.
  const [last, setLast] = useState<TooltipState | null>(null);
  if (tip && tip !== last) setLast(tip);
  const view = tip ?? last;

  /** Place the tooltip next to a viewport point, flipping to stay on screen. */
  const placeAt = (x: number, y: number, sticky: boolean) => {
    const node = el.current;
    if (!node) return;
    const w = node.offsetWidth, h = node.offsetHeight, gap = 16;
    let left = sticky ? x - w / 2 : x + gap;          // a tapped tooltip is centred on the finger
    let top = y + gap;
    if (left + w > window.innerWidth - 8) left = sticky ? window.innerWidth - 8 - w : x - w - gap;
    if (top + h > window.innerHeight - 8) top = y - h - gap;
    node.style.left = `${Math.max(8, left)}px`;
    node.style.top = `${Math.max(8, top)}px`;
  };

  useLayoutEffect(() => {
    if (tip) placeAt(tip.x, tip.y, tip.sticky);
  }, [tip]);

  useImperativeHandle(ref, () => ({
    moveTo: (x, y) => placeAt(x, y, false),
    contains: node => !!el.current && !!node && el.current.contains(node)
  }), []);

  const [first, ...rest] = view?.infos ?? [];

  return (
    <div
      ref={el}
      role={view?.sticky ? 'dialog' : 'tooltip'}
      aria-label={view?.sticky ? 'Feature at this point' : undefined}
      aria-hidden={!tip}
      data-open={!!tip}
      data-sticky={!!view?.sticky}
      className="map-tooltip fixed left-0 top-0 z-50 w-max max-w-[min(21rem,calc(100vw-1rem))] rounded-xl border border-white/10 bg-slate-900 p-3 text-[13px] leading-snug text-slate-50 shadow-pop"
    >
      {first && (
        <>
          {view?.sticky && (
            <button
              type="button" onClick={onClose} aria-label="Close" tabIndex={tip ? 0 : -1}
              className="float-right -mr-1 -mt-1 ml-2 rounded-md p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CloseIcon width={14} height={14} />
            </button>
          )}
          <FeatureCard info={first} tone="dark" />
          {rest.length > 0 && (
            <div className="mt-2 border-t border-white/15 pt-2">
              <div className="text-[10.5px] uppercase tracking-wider text-slate-400">
                Also at this point — {view?.sticky ? 'see Details below' : 'click for details'}
              </div>
              <ul>
                {rest.map(info => (
                  <li key={info.key} className="flex items-baseline gap-1.5">
                    <span aria-hidden="true" className="size-2 shrink-0 self-center rounded-full ring-1 ring-white/40" style={{ background: info.color }} />
                    <span>{info.name}</span>
                    <span className="text-slate-400">{info.cls}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
});
