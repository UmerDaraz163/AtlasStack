'use client';

import { useEffect, useReducer } from 'react';
import { loadCities, loadCountries, loadPlates, loaded } from '@/lib/geodata';

/**
 * Starts loading the shared geographic data (countries, cities, plates) and re-renders the
 * component as each part arrives. Returns which parts are ready; read the data from `loaded`.
 */
export function useGeoData() {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    let alive = true;
    const update = () => { if (alive) refresh(); };
    for (const load of [loadCountries, loadCities, loadPlates]) load().then(update, update);
    return () => { alive = false; };
  }, []);
  return { countries: !!loaded.countries, cities: !!loaded.cities, plates: !!loaded.plates };
}
