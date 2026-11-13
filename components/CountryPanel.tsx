'use client';

import { useMemo } from 'react';
import { BOUNDARY_TYPES, STREET_MAP } from '@/data';
import { useGeoData } from '@/hooks/useGeoData';
import {
  clockTime, fmtOffset, fmtPopulation, loaded, nearestBoundary, plateAt, plateName, sunDate, utcOffsetMinutes,
  zoneLongName, type City
} from '@/lib/geodata';
import type { SunState } from '@/lib/types';
import { ExploreIcon } from './icons';

interface CountryPanelProps {
  name: string;
  sun: SunState;
  onClose: () => void;
  onPickCity: (city: City) => void;
  /** Open the street map (OpenStreetMap) at a place. */
  onStreetMap: (point: [number, number], label: string, zoom?: number) => void;
}

const plateShort = (code: string) => plateName(code).replace(/ Plate$/, '').replace(/ \(.*\)/, '');

/**
 * "Explore a country": its clock time(s), the plates under it, and every city in the data set
 * with its population, local clock time, plate and distance to the nearest plate boundary.
 */
export function CountryPanel({ name, sun, onClose, onPickCity, onStreetMap }: CountryPanelProps) {
  const ready = useGeoData();
  const date = sunDate(sun);

  const cities = useMemo(
    () => (ready.cities && loaded.cities ? loaded.cities.cities.filter(c => c.country === name) : []),
    [name, ready.cities]
  );

  // Plate and nearest boundary for each city (computed once per country).
  const tectonics = useMemo(() => {
    if (!ready.plates || !loaded.plates) return null;
    const { plates, boundaries } = loaded.plates;
    return new Map(cities.map(c => [c.id, { plate: plateAt(plates, c.lonlat), nearest: nearestBoundary(boundaries, c.lonlat) }]));
  }, [cities, ready.plates]);

  const zones = loaded.cities?.zones[name];
  const offsets = zones ? [...new Set(zones.zones.map(tz => utcOffsetMinutes(tz, date)))].sort((a, b) => a - b) : [];
  const clockSummary = !zones
    ? null
    : offsets.length > 1
      ? `${offsets.length} clock times: ${offsets.map(fmtOffset).join(', ')}`
      : `${fmtOffset(offsets[0])} — ${zoneLongName(zones.main, date)}`;

  const platesUnder = tectonics
    ? Object.entries(cities.reduce<Record<string, number>>((acc, c) => {
        const plate = tectonics.get(c.id)?.plate;
        if (plate) acc[plate.name] = (acc[plate.name] ?? 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <section aria-labelledby="country-title" className="animate-fade-up rounded-lg border border-accent p-3 text-[13px] sm:text-sm">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id="country-title" className="flex items-center gap-2 text-base font-bold">
          <ExploreIcon width={18} height={18} className="text-accent" />
          {name}
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {loaded.countries && (
            <button
              type="button"
              onClick={() => {
                const shape = loaded.countries?.find(c => c.name === name);
                if (shape) onStreetMap(shape.centroid, name, STREET_MAP.countryZoom);
              }}
              className="cursor-pointer rounded-full border border-rule bg-surface px-3 py-1 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft"
            >
              Street map
            </button>
          )}
          <button
            type="button" onClick={onClose}
            className="cursor-pointer rounded-full border border-rule bg-surface px-3 py-1 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft"
          >
            Leave country view
          </button>
        </div>
      </div>

      <dl className="mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {clockSummary && (<><dt className="text-muted">Clock time</dt><dd>{clockSummary}</dd></>)}
        {platesUnder.length > 0 && (
          <><dt className="text-muted">Cities sit on</dt><dd>{platesUnder.map(([plate, n]) => `${plate} (${n})`).join(', ')}</dd></>
        )}
      </dl>

      {cities.length === 0 ? (
        <p className="text-muted">{ready.cities ? 'No cities of this country are in the data set.' : 'Loading cities…'}</p>
      ) : (
        <div className="-mx-3 overflow-x-auto px-3">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <caption className="sr-only">Cities in {name}, their clock time and nearest tectonic plate boundary</caption>
            <thead>
              <tr className="border-b border-rule text-xs text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">City</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-medium">Population</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Clock</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">Plate</th>
                <th scope="col" className="py-1.5 font-medium">Nearest plate boundary</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(city => {
                const t = tectonics?.get(city.id);
                const nb = t?.nearest;
                const other = nb && t?.plate
                  ? (nb.boundary.a === t.plate.code ? nb.boundary.b : nb.boundary.b === t.plate.code ? nb.boundary.a : null)
                  : null;
                return (
                  <tr key={city.id} className="border-b border-rule last:border-b-0">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      <button
                        type="button" onClick={() => onPickCity(city)}
                        className="cursor-pointer text-left font-semibold text-accent-dark underline-offset-2 hover:underline"
                      >
                        {city.name}
                      </button>
                      {city.capital && <span className="ml-1.5 rounded bg-hover px-1 text-[11px] text-muted">capital</span>}
                    </th>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{fmtPopulation(city.population)}</td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {city.tz ? <>{clockTime(city.tz, date)} <span className="text-muted">{fmtOffset(utcOffsetMinutes(city.tz, date))}</span></> : '—'}
                    </td>
                    <td className="py-1.5 pr-3">{t ? (t.plate ? plateShort(t.plate.code) : '—') : '…'}</td>
                    <td className="py-1.5">
                      {nb ? (
                        <>
                          <span className="tabular-nums">{nb.km < 25 ? 'on it' : `≈ ${Math.round(nb.km).toLocaleString('en-US')} km`}</span>
                          <span className="text-muted">
                            {' · '}{other ? `with ${plateShort(other)}` : `${plateShort(nb.boundary.a)}–${plateShort(nb.boundary.b)}`}
                            {' · '}{BOUNDARY_TYPES[nb.boundary.kind].short}
                          </span>
                        </>
                      ) : '…'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        Cities: Natural Earth (about 1,200 world cities, so smaller towns are not listed). Plates: PB2002 model. Distances are
        to the nearest boundary line and are approximate.
      </p>
    </section>
  );
}
