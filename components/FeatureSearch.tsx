'use client';

import { memo, useId, useMemo, useState, type KeyboardEvent } from 'react';
import type { FeatureInfo } from '@/lib/types';
import { SearchIcon } from './icons';

interface FeatureSearchProps {
  /** Everything that can be found: lines, zones, currents, plates, time zones, countries … */
  items: FeatureInfo[];
  onPick: (info: FeatureInfo) => void;
}

const MAX_RESULTS = 8;

/**
 * Search box (ARIA combobox). Type a name, pick a result with the arrow keys + Enter or a tap:
 * the map switches the right layer on, turns the globe to the feature and pins its description.
 */
export const FeatureSearch = memo(function FeatureSearch({ items, onPick }: FeatureSearchProps) {
  const inputId = useId(), listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // Names that start with the query first, then names that contain it, then matching classifications.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const rank = (info: FeatureInfo) => {
      const name = info.name.toLowerCase();
      if (name.startsWith(q)) return 0;
      if (name.includes(q)) return 1;
      return info.cls.toLowerCase().includes(q) ? 2 : 3;
    };
    return items
      .map(info => ({ info, rank: rank(info) }))
      .filter(r => r.rank < 3)
      .sort((a, b) => a.rank - b.rank || a.info.name.localeCompare(b.info.name))
      .slice(0, MAX_RESULTS)
      .map(r => r.info);
  }, [items, query]);

  const showList = open && query.trim() !== '';

  const pick = (info: FeatureInfo) => {
    onPick(info);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (results.length) setActive(i => (i + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
    } else if (event.key === 'Enter' && showList && results[active]) {
      event.preventDefault();
      pick(results[active]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div
      className="relative"
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    >
      <label htmlFor={inputId} className="sr-only">Find a line, zone, current, plate or country</label>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" width={16} height={16} />
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Find a line, zone, country…"
        value={query}
        onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-lg border border-rule bg-surface pl-9 pr-3 text-sm transition-colors placeholder:text-muted hover:border-muted focus:border-accent"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Search results"
        className={`absolute inset-x-0 z-40 mt-1 max-h-80 origin-top overflow-y-auto rounded-lg border border-rule bg-surface py-1 shadow-pop transition-[opacity,visibility] duration-150 ${
          showList ? 'opacity-100' : 'invisible opacity-0'
        }`}
      >
        {results.map((info, i) => (
          <li
            key={info.key}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            onPointerDown={event => event.preventDefault()}     // keep focus in the input
            onPointerEnter={() => setActive(i)}
            onClick={() => pick(info)}
            className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${i === active ? 'bg-accent-soft' : ''}`}
          >
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: info.color }} />
            <span className="flex-1 truncate">{info.name}</span>
            <span className="shrink-0 text-xs text-muted">{info.cls}</span>
          </li>
        ))}
        {results.length === 0 && <li role="presentation" className="px-3 py-2 text-sm text-muted">No matching feature</li>}
      </ul>
    </div>
  );
});
