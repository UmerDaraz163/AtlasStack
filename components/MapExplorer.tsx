'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_LAYERS, DEFAULT_PROJECTION, INFO_LAYER_IDS, LAYERS, PROJECTIONS, STREET_MAP, SUN } from '@/data';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { clamp, sunNow } from '@/lib/geo';
import { loaded, nearestCity, type City } from '@/lib/geodata';
import { geoDistance } from 'd3-geo';
import { fmtLonLat } from '@/lib/geo';
import type { LegendRow } from '@/lib/legend';
import type {
  Details, FeatureInfo, LayerId, LayerState, LonLat, Measurement, ProjectionId, QuickView, SunState
} from '@/lib/types';
import { ControlPanel } from './ControlPanel';
import { DetailsPanel } from './DetailsPanel';
import { Disclosure } from './Disclosure';
import { FeatureSearch } from './FeatureSearch';
import { FlightRouteDialog, type RouteEnd } from './FlightRouteDialog';
import { HelpDialog } from './HelpDialog';
import { Legend } from './Legend';
import { StreetMapDialog, type StreetMapTarget } from './StreetMapDialog';
import { ThemeToggle } from './ThemeToggle';
import { WorldMap, type WorldMapHandle } from './WorldMap';
import { CloseIcon, HelpIcon, SlidersIcon } from './icons';

/** Where the chosen view and layers are remembered between visits. */
const STORAGE_KEY = 'world-map:preferences:v1';

const headerButton =
  'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-rule bg-surface ' +
  'text-ink transition-colors hover:border-accent hover:bg-accent-soft';

/* ---------- Shareable links ----------
   A link carries the view in its #hash: view, switched-on layers, Sun date/time and globe centre.
   Example: #view=globe&layers=countries,climate,daynight&sun=172,12&center=15,20                  */

interface SharedState {
  projection?: ProjectionId;
  layers?: LayerState;
  sun?: SunState;
  center?: LonLat;
}

function readSharedState(): SharedState | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (!params.has('view') && !params.has('layers')) return null;
  const shared: SharedState = {};

  const view = params.get('view');
  if (view && view in PROJECTIONS) shared.projection = view as ProjectionId;

  if (params.has('layers')) {
    const on = new Set((params.get('layers') ?? '').split(','));
    shared.layers = Object.fromEntries(LAYERS.map(l => [l.id, on.has(l.id)])) as LayerState;
    shared.layers.spin = false;                 // keep the shared centre in view
  }

  const numbers = (key: string) => (params.get(key) ?? '').split(',').map(Number);
  const [day, hour] = numbers('sun');
  if (Number.isFinite(day) && Number.isFinite(hour)) {
    shared.sun = { day: clamp(Math.round(day), 1, 365), hour: clamp(hour, 0, 23.75) };
  }
  const [lon, lat] = numbers('center');
  if (Number.isFinite(lon) && Number.isFinite(lat)) shared.center = [clamp(lon, -180, 180), clamp(lat, -90, 90)];
  return shared;
}

function buildShareUrl(projection: ProjectionId, layers: LayerState, sun: SunState, center: LonLat | null): string {
  const params = new URLSearchParams({
    view: projection,
    layers: LAYERS.filter(l => layers[l.id]).map(l => l.id).join(','),
    sun: `${sun.day},${sun.hour}`
  });
  if (center) params.set('center', `${center[0].toFixed(1)},${center[1].toFixed(1)}`);
  // Keep the commas readable in the link.
  return `${window.location.origin}${window.location.pathname}#${params.toString().replace(/%2C/g, ',')}`;
}

/**
 * Application shell and state.
 *
 * Layout (mobile-first):
 *  - small screens: the control panel is a bottom drawer opened from the header button;
 *  - large screens (lg+): the same panel is a collapsible sidebar next to the map.
 * One <aside> serves both — only its CSS changes at the breakpoint.
 */
export function MapExplorer() {
  /* ---------- Map state ---------- */
  const [projection, setProjection] = useState<ProjectionId>(DEFAULT_PROJECTION);
  const [layers, setLayers] = useState<LayerState>(DEFAULT_LAYERS);
  const [sun, setSun] = useState<SunState>({ day: 172, hour: 12 });
  const [playing, setPlaying] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [searchIndex, setSearchIndex] = useState<FeatureInfo[]>([]);
  const [country, setCountry] = useState<string | null>(null);              // country being explored
  const [measuring, setMeasuring] = useState(false);                        // distance tool on/off
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [streetMap, setStreetMap] = useState<StreetMapTarget | null>(null); // street-map dialog
  const [routeRequest, setRouteRequest] = useState<{ from?: RouteEnd; to?: RouteEnd; id: number } | null>(null);
  const mapRef = useRef<WorldMapHandle>(null);

  /* ---------- Panel, help and toast state ---------- */
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);     // small screens
  const [sidebarOpen, setSidebarOpen] = useState(true);    // large screens
  const [legendOpen, setLegendOpen] = useState(false);     // collapsed on small screens, open on large ones
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const panelOpen = isDesktop ? sidebarOpen : drawerOpen;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  /** Short message at the bottom of the screen; it disappears by itself. */
  const notify = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // After the first paint: apply a shared link if there is one, otherwise the saved preferences;
  // set the Sun to "now"; and honour the "reduce motion" system setting.
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const shared = readSharedState();
    let saved: { projection?: ProjectionId; layers?: Partial<LayerState> } = {};
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') ?? {};
    } catch { /* unreadable storage: fall back to the defaults */ }

    const startProjection = shared?.projection ?? saved.projection;
    if (startProjection && startProjection in PROJECTIONS) setProjection(startProjection);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setLayers(current => ({
      ...current, ...(reduceMotion ? { spin: false } : {}), ...saved.layers, ...shared?.layers
    }));
    setSun(shared?.sun ?? sunNow());
    if (shared?.center) mapRef.current?.setCenter(shared.center);
    if (shared) {
      // The link has done its job: tidy the address bar so later changes are not confused with it.
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ projection, layers }));
    } catch { /* storage full or blocked: preferences simply are not remembered */ }
  }, [restored, projection, layers]);

  // The legend starts open where there is room for it.
  useEffect(() => { if (isDesktop) setLegendOpen(true); }, [isDesktop]);

  /* ---------- Drawer behaviour (small screens) ---------- */
  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isDesktop || !drawerOpen) return;
    // Move focus into the drawer once it has started sliding in (it cannot take focus while hidden).
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDrawer(); };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';               // the page behind the drawer does not scroll
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isDesktop, drawerOpen, closeDrawer]);

  /* ---------- Sun & seasons ---------- */
  // Any use of the Sun controls switches the day & night layer on.
  const showSunLayer = useCallback(() => setLayers(l => (l.daynight ? l : { ...l, daynight: true })), []);
  const handleSun = useCallback((patch: Partial<SunState>) => {
    setSun(s => ({ ...s, ...patch }));
    showSunLayer();
  }, [showSunLayer]);
  const handleSunNow = useCallback(() => { setSun(sunNow()); showSunLayer(); }, [showSunLayer]);
  const togglePlay = useCallback(() => { setPlaying(p => !p); showSunLayer(); }, [showSunLayer]);

  // "Play year": step one day per tick.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setSun(s => ({ ...s, day: s.day % 365 + 1 })), 1000 / SUN.playDaysPerSecond);
    return () => window.clearInterval(id);
  }, [playing]);

  /* ---------- Layers ---------- */
  const handleLayer = useCallback((id: LayerId, on: boolean) => {
    setLayers(l => ({ ...l, [id]: on }));
    if (id === 'daynight' && !on) setPlaying(false);
  }, []);

  // Quick view: show the base map and exactly this set of info layers.
  const handleQuickView = useCallback((view: QuickView) => {
    setLayers(l => {
      const next = { ...l, countries: true, graticule: true, special: true };
      for (const id of INFO_LAYER_IDS) next[id] = view.layers.includes(id);
      return next;
    });
    if (!view.layers.includes('daynight')) setPlaying(false);
  }, []);

  // "Reset controls": the starting view, layers and Sun (today, now). The map's zoom and
  // rotation have their own "Reset view" button under the map.
  const handleResetControls = useCallback(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setProjection(DEFAULT_PROJECTION);
    setLayers({ ...DEFAULT_LAYERS, ...(reduceMotion ? { spin: false } : {}) });
    setSun(sunNow());
    setPlaying(false);
    setCountry(null);
    setMeasuring(false);
    mapRef.current?.focusCountry(null);
    mapRef.current?.setMeasure(false);
    mapRef.current?.spotlight(null);
    notify('Controls are back to their defaults.');
  }, [notify]);

  /* ---------- Country view, distance tool, street map ---------- */
  // "Explore": highlight the country, show all its cities and the plates, and list them in Details.
  const handleExploreCountry = useCallback((name: string) => {
    setCountry(name);
    setLayers(l => ({ ...l, cities: true, plates: true, spin: false }));
    mapRef.current?.focusCountry(name);
    document.getElementById('details-title')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const handleLeaveCountry = useCallback(() => {
    setCountry(null);
    mapRef.current?.focusCountry(null);
  }, []);

  // A city row: go there and describe the place.
  const handlePickCity = useCallback((city: City) => {
    mapRef.current?.inspectPoint(city.lonlat, city.name);
  }, []);

  const toggleMeasure = useCallback(() => {
    setMeasuring(on => {
      mapRef.current?.setMeasure(!on);
      return !on;
    });
  }, []);
  const stopMeasure = useCallback(() => {
    setMeasuring(false);
    mapRef.current?.setMeasure(false);
  }, []);
  const clearMeasure = useCallback(() => mapRef.current?.setMeasure(true), []);

  // Escape leaves the distance tool.
  useEffect(() => {
    if (!measuring) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') stopMeasure(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [measuring, stopMeasure]);

  // Flight-route explainer: from the toolbar (last or default route) or for the two measured points.
  const openFlightRoutes = useCallback(() => setRouteRequest({ id: Date.now() }), []);
  const explainRoute = useCallback((a: LonLat, b: LonLat) => {
    // Name each end after a city within 80 km, otherwise by its coordinates.
    const name = (p: LonLat) => {
      const city = loaded.cities ? nearestCity(loaded.cities.cities, p) : null;
      return city && geoDistance(city.lonlat, p) * 6371 < 80 ? city.name : fmtLonLat(p);
    };
    setRouteRequest({ from: { point: a, label: name(a) }, to: { point: b, label: name(b) }, id: Date.now() });
  }, []);

  const openStreetMap = useCallback((point: LonLat, label: string, zoom: number = STREET_MAP.placeZoom) => {
    setStreetMap({ point, label, zoom });
  }, []);

  /* ---------- Selections ---------- */
  const handleSelect = useCallback((infos: FeatureInfo[], heading: string, point: LonLat | null) => {
    setDetails(infos.length || point ? { infos, heading, point } : null);
  }, []);

  const handleSpotlight = useCallback((tag: string | null) => {
    mapRef.current?.spotlight(tag ? { tag } : null);
  }, []);

  // Legend row: switch its layer on, spotlight it and show what it means.
  const handleLegend = useCallback((row: LegendRow) => {
    setLayers(l => (l[row.layer] ? l : { ...l, [row.layer]: true }));
    mapRef.current?.spotlight({ tag: row.tag });
    // Rows that stand for many features (e.g. dozens of plate boundaries) show the first dozen.
    const all = row.about ? [row.about] : mapRef.current?.infosByTag(row.tag) ?? [];
    const infos = all.slice(0, 12);
    setDetails({ infos, heading: `Legend — ${row.label}${all.length > infos.length ? ` (${infos.length} of ${all.length})` : ''}` });
  }, []);

  // Search result: switch its layer on, stop the spin, turn the globe to it and pin its card.
  const handlePick = useCallback((info: FeatureInfo) => {
    setLayers(l => ({ ...l, ...(info.layer ? { [info.layer]: true } : {}), spin: false }));
    if (info.country) {
      handleExploreCountry(info.country);
      setDetails({ infos: [info], heading: 'Search result' });
    } else if (info.point) {
      mapRef.current?.inspectPoint(info.point, info.name);
    } else {
      mapRef.current?.focusFeature(info);
      setDetails({ infos: [info], heading: 'Search result' });
    }
  }, [handleExploreCountry]);

  const clearDetails = useCallback(() => {
    setDetails(null);
    mapRef.current?.spotlight(null);
  }, []);

  /* ---------- Map actions ---------- */
  // "My location": ask the browser, then go there and describe the place. Nothing leaves the device.
  const handleLocate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      notify('This browser cannot share a location.');
      return;
    }
    notify('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      position => {
        setLayers(l => (l.spin ? { ...l, spin: false } : l));
        const here: LonLat = [position.coords.longitude, position.coords.latitude];
        mapRef.current?.setUserLocation(here, position.coords.accuracy);
        mapRef.current?.inspectPoint(here, 'Your location');
        setToast(null);
      },
      error => notify(error.code === error.PERMISSION_DENIED
        ? 'Location permission was not given — you can still select any place on the map.'
        : 'Your location could not be found. Try again, or select a place on the map.'),
      { timeout: 10000, maximumAge: 60000 }
    );
  }, [notify]);

  // "Share": copy a link that reopens this view (layers, Sun date/time and globe centre).
  const handleShare = useCallback(async () => {
    const url = buildShareUrl(projection, layers, sun, mapRef.current?.getCenter() ?? null);
    try {
      await navigator.clipboard.writeText(url);
      notify('Link to this view copied.');
    } catch {
      // Clipboard not available (for example on an insecure page): leave the link in the address bar.
      window.history.replaceState(null, '', url);
      notify('The link to this view is now in the address bar.');
    }
  }, [projection, layers, sun, notify]);

  /* ---------- Render ---------- */
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to the map
      </a>

      {/* Header: panel toggle, title, search (md+), theme and help */}
      <header className="sticky top-0 z-30 border-b border-rule bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={panelOpen}
            aria-controls="control-panel"
            onClick={() => (isDesktop ? setSidebarOpen(o => !o) : setDrawerOpen(o => !o))}
            className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
              panelOpen ? 'border-accent bg-accent-soft text-accent-dark' : 'border-rule bg-surface hover:border-accent hover:bg-accent-soft'
            }`}
          >
            <SlidersIcon />
            <span>Controls</span>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold tracking-tight sm:text-lg lg:text-xl">World Geographic Reference Map</h1>
            <p className="hidden truncate text-xs text-muted sm:block">
              Hover or tap any line or region · drag to rotate · scroll or pinch to zoom
            </p>
          </div>
          <div className="hidden w-64 md:block xl:w-80">
            <FeatureSearch items={searchIndex} onPick={handlePick} />
          </div>
          <ThemeToggle className={headerButton} />
          <button type="button" className={headerButton} aria-label="How to use this map" title="How to use this map" onClick={() => setHelpOpen(true)}>
            <HelpIcon />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 items-start">
        {/* Backdrop behind the drawer (small screens only) */}
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className={`fixed inset-0 z-30 bg-slate-900/40 transition-opacity duration-300 lg:hidden ${
            drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />

        {/* Control panel: bottom drawer on small screens, collapsible sidebar on large ones */}
        <aside
          id="control-panel"
          role={isDesktop ? undefined : 'dialog'}
          aria-modal={!isDesktop && drawerOpen ? true : undefined}
          aria-label="Map controls and legend"
          inert={!panelOpen}                 // a closed panel is out of the tab order and the accessibility tree
          className={[
            // small screens: bottom drawer
            'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:flex max-lg:max-h-[85dvh] max-lg:flex-col',
            'max-lg:rounded-t-2xl max-lg:border-t max-lg:border-rule max-lg:bg-surface max-lg:shadow-sheet',
            'max-lg:transition-[translate,transform,visibility] max-lg:duration-300 max-lg:ease-out',
            drawerOpen ? 'max-lg:visible max-lg:translate-y-0' : 'max-lg:invisible max-lg:translate-y-full',
            // large screens: sticky sidebar that collapses to zero width
            'lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)] lg:shrink-0 lg:overflow-hidden lg:border-rule lg:bg-surface',
            'lg:transition-[width,visibility,opacity] lg:duration-300 lg:ease-out',
            sidebarOpen ? 'lg:visible lg:w-80 lg:border-r lg:opacity-100' : 'lg:invisible lg:w-0 lg:opacity-0'
          ].join(' ')}
        >
          {/* Fixed-width inner box so the content does not reflow while the sidebar slides */}
          <div className="flex min-h-0 flex-1 flex-col lg:h-full lg:w-80">
            <div className="relative flex items-center justify-between border-b border-rule py-2 pl-4 pr-2 lg:hidden">
              <span aria-hidden="true" className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-track" />
              <h2 className="pt-1 text-sm font-bold">Controls & legend</h2>
              <button
                ref={closeRef} type="button" onClick={closeDrawer} aria-label="Close controls"
                className="inline-flex size-10 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
              <ControlPanel
                projection={projection} onProjection={setProjection}
                layers={layers} onLayer={handleLayer} onQuickView={handleQuickView}
                sun={sun} onSun={handleSun} onSunNow={handleSunNow}
                playing={playing} onTogglePlay={togglePlay}
                onReset={handleResetControls}
              />
              <Disclosure title="Legend" open={legendOpen} onOpenChange={setLegendOpen}>
                <Legend layers={layers} onSpotlight={handleSpotlight} onActivate={handleLegend} />
              </Disclosure>
            </div>
          </div>
        </aside>

        {/* Map and details */}
        <main id="main" className="min-w-0 flex-1 space-y-3 p-3 sm:space-y-4 sm:p-4">
          <div className="md:hidden">
            <FeatureSearch items={searchIndex} onPick={handlePick} />
          </div>
          <WorldMap
            ref={mapRef} projection={projection} layers={layers} sun={sun}
            onSelect={handleSelect} onIndex={setSearchIndex}
            onLocate={handleLocate} onShare={handleShare}
            measuring={measuring} onToggleMeasure={toggleMeasure} onMeasure={setMeasurement}
            onFlightRoutes={openFlightRoutes}
          />
          <DetailsPanel
            details={details} sun={sun} onClear={clearDetails}
            country={country} onExploreCountry={handleExploreCountry} onLeaveCountry={handleLeaveCountry} onPickCity={handlePickCity}
            measurement={measuring ? measurement : null} onClearMeasure={clearMeasure} onDoneMeasure={stopMeasure}
            onStreetMap={openStreetMap} onExplainRoute={explainRoute}
          />
          <p className="px-1 text-xs text-muted">
            Reference layers are simplified for teaching: ocean currents, wind and pressure belts, the date line and the
            Sun&apos;s position are approximate. Data: Natural Earth; PB2002 plate model (Bird 2003, prepared by Hugo Ahlenius,
            ODC-By); earthquakes from USGS; street maps © OpenStreetMap contributors.
          </p>
        </main>
      </div>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <StreetMapDialog target={streetMap} onClose={() => setStreetMap(null)} />
      <FlightRouteDialog request={routeRequest} onClose={() => setRouteRequest(null)} />

      {/* Toast: brief feedback for actions such as "link copied" */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50">
        {toast && (
          <div key={toast.id} className="toast absolute bottom-0 left-1/2 w-max max-w-[calc(100vw-2rem)] rounded-full bg-slate-900 px-4 py-2 text-center text-sm text-white shadow-pop">
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}
