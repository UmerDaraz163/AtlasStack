'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const Key = ({ children }: { children: ReactNode }) => (
  <kbd className="rounded border border-rule bg-hover px-1.5 py-0.5 font-sans text-xs font-semibold">{children}</kbd>
);

/** Help topics, kept as data so they are easy to edit. */
const TOPICS: { title: string; items: ReactNode[] }[] = [
  { title: 'Move around', items: [
    'Drag the globe to turn it; drag a zoomed flat map to pan.',
    'Scroll, pinch or use the + and − buttons to zoom. “Reset view” fits the map again.',
    'Switch between the globe and three flat maps under View.'
  ] },
  { title: 'Read the map', items: [
    'Hover a line or region (or tap it on a touch screen) for its name, classification and purpose.',
    'Click or tap to pin everything at that place under Details, with its daylight, solar time and Sun height.',
    'Hover a legend row to spotlight it; select it to switch its layer on and read about it.'
  ] },
  { title: 'Find things', items: [
    'Type in the search box to jump to a line, zone, current, plate, time zone or country.',
    '“My location” shows which zones you are in. Your position is used only in this browser.',
    'Select a country and choose “Explore” to list its cities with their clock time, tectonic plate and distance to the nearest plate boundary.',
    '“Street map” opens any picked place on OpenStreetMap, with links to OpenStreetMap.org and Google Maps.',
    'Quick views switch on ready-made layer sets such as Climate, Oceans or Seasons; “Reset controls” puts everything back.'
  ] },
  { title: 'Measure & compare', items: [
    '“Measure” under the map: click two places for the distance, direction, flight time and the difference in clock time.',
    '“Flight routes” shows why planes fly curved routes: watch a flat map wrap into a globe and race the shortest route against the line that looks straight.',
    'Civil time zones colour each country by the clock time it really uses (India UTC+5:30, Nepal UTC+5:45 …).',
    'Recent earthquakes (live from USGS) line up along the plate boundaries — deep ones only where a plate is sinking.'
  ] },
  { title: 'Sun & seasons', items: [
    'Move the date and time sliders to see the night shadow and where the Sun is overhead.',
    '“Play year” runs through the seasons; pin a place first to watch its day length change.'
  ] },
  { title: 'Keyboard', items: [
    <>Press <Key>Tab</Key> until the map is focused, then use <Key>←</Key> <Key>→</Key> <Key>↑</Key> <Key>↓</Key> to turn or pan.</>,
    <><Key>+</Key> and <Key>−</Key> zoom, <Key>0</Key> resets the view.</>,
    <><Key>Enter</Key> describes whatever is under the crosshair at the centre.</>
  ] }
];

/**
 * "How to use" window. Built on the native <dialog>, which traps focus, closes on Escape
 * and restores focus to the button that opened it.
 */
export function HelpDialog({ open, onClose }: HelpDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={event => { if (event.target === ref.current) onClose(); }}     // click on the backdrop
      aria-labelledby="help-title"
      className="help-dialog m-auto max-h-[85dvh] w-[min(40rem,calc(100vw-1.5rem))] rounded-2xl border border-rule bg-surface p-0 text-ink shadow-pop"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule py-2 pl-5 pr-2">
        <h2 id="help-title" className="text-base font-bold">How to use this map</h2>
        <button
          type="button" onClick={onClose} aria-label="Close help"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="grid gap-x-6 gap-y-4 overflow-y-auto px-5 py-4 sm:grid-cols-2">
        {TOPICS.map(topic => (
          <section key={topic.title} className="last:sm:col-span-2">
            <h3 className="mb-1 text-sm font-semibold">{topic.title}</h3>
            <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted marker:text-rule">
              {topic.items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  );
}
