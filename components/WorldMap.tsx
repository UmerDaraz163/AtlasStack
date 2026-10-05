'use client';

import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ZOOM } from '@/data';
import { createMapEngine, type MapEngine } from '@/lib/map-engine';
import type {
  FeatureInfo, LayerState, LonLat, ProjectionId, SpotlightTarget, SunState, TooltipState
} from '@/lib/types';
import { MapTooltip, type MapTooltipHandle } from './MapTooltip';
import { FitIcon, LocateIcon, MinusIcon, PlusIcon, ShareIcon } from './icons';

/** What the rest of the app can ask the map to do. */
export interface WorldMapHandle {
  spotlight: (target: SpotlightTarget) => void;
  focusFeature: (info: FeatureInfo) => void;
  infosByTag: (tag: string) => FeatureInfo[];
  /** Go to a location and describe what is there. */
  inspectPoint: (point: LonLat, lead?: string) => void;
  /** Centre of the globe view (null on a flat map). */
  getCenter: () => LonLat | null;
  setCenter: (point: LonLat) => void;
}

interface WorldMapProps {
  projection: ProjectionId;
  layers: LayerState;
  sun: SunState;
  /** The user picked a point on the map. */
  onSelect: (infos: FeatureInfo[], heading: string, point: LonLat | null) => void;
  /** The list of searchable features is ready or has grown. */
  onIndex: (infos: FeatureInfo[]) => void;
  /** Toolbar buttons handled by the app shell. */
  onLocate: () => void;
  onShare: () => void;
}

const HELP_ID = 'map-keyboard-help';
const toolButton =
  'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-rule bg-surface text-ink ' +
  'transition-colors hover:border-accent hover:bg-accent-soft active:bg-accent-soft';

/**
 * The map card: the SVG drawn by the map engine, its tooltip and the zoom toolbar.
 * This component only bridges React and the engine — props go in through effects,
 * events come back through callbacks.
 */
export const WorldMap = memo(forwardRef<WorldMapHandle, WorldMapProps>(function WorldMap(props, ref) {
  const { projection, layers, sun, onSelect, onIndex, onLocate, onShare } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<MapTooltipHandle>(null);
  const engineRef = useRef<MapEngine | null>(null);

  const [tip, setTip] = useState<TooltipState | null>(null);
  const [status, setStatus] = useState('Simplified reference layers · Country data: Natural Earth');

  // The engine is created once; keep the latest props where its callbacks can reach them.
  const latest = useRef({ projection, layers, sun, onSelect, onIndex });
  useEffect(() => { latest.current = { projection, layers, sun, onSelect, onIndex }; });

  // Create the engine on mount, tear it down on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { projection, layers, sun } = latest.current;
    const engine = createMapEngine(container, { projection, layers, sun, describedBy: HELP_ID }, {
      onTooltip: setTip,
      onTooltipMove: (x, y) => tooltipRef.current?.moveTo(x, y),
      onSelect: (infos, heading, point) => latest.current.onSelect(infos, heading, point),
      // The coordinate readout changes on every pointer move, so it is written straight to the DOM.
      onCursor: text => { if (readoutRef.current) readoutRef.current.textContent = text; },
      onStatus: setStatus,
      onIndex: infos => latest.current.onIndex(infos)
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Push state changes into the engine.
  useEffect(() => { engineRef.current?.setProjection(projection); }, [projection]);
  useEffect(() => { engineRef.current?.setLayers(layers); }, [layers]);
  useEffect(() => { engineRef.current?.setSun(sun); }, [sun]);

  useImperativeHandle(ref, () => ({
    spotlight: target => engineRef.current?.spotlight(target),
    focusFeature: info => engineRef.current?.focusFeature(info),
    infosByTag: tag => engineRef.current?.infosByTag(tag) ?? [],
    inspectPoint: (point, lead) => engineRef.current?.inspectPoint(point, lead),
    getCenter: () => engineRef.current?.getCenter() ?? null,
    setCenter: point => engineRef.current?.setCenter(point)
  }), []);

  // A tapped (sticky) tooltip closes on Escape or when the user taps anywhere outside the map.
  // (Taps on the map itself are handled by the engine, which may open a new tooltip.)
  const sticky = !!tip?.sticky;
  useEffect(() => {
    if (!sticky) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (tooltipRef.current?.contains(target) || containerRef.current?.contains(target)) return;
      engineRef.current?.dismissTooltip();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') engineRef.current?.dismissTooltip(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [sticky]);

  return (
    <section aria-label="Map" className="overflow-hidden rounded-xl border border-rule bg-surface shadow-card">
      <p id={HELP_ID} className="sr-only">
        Keyboard: arrow keys turn the globe or pan a zoomed map, plus and minus zoom, 0 resets the view,
        and Enter describes the features under the crosshair at the centre of the map.
      </p>

      {/* The engine appends its <svg> here. */}
      <div ref={containerRef} className="min-h-44 w-full" />

      {/* Toolbar: cursor position, data credit, map actions */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-rule px-3 py-2 text-xs text-muted">
        <span className="hidden tabular-nums sm:inline">Cursor: <span ref={readoutRef}>—</span></span>
        <span className="hidden min-w-0 flex-1 truncate lg:block">{status}</span>
        <div role="group" aria-label="Map actions" className="ml-auto flex items-center gap-1.5">
          <button type="button" className={`${toolButton} w-auto gap-1.5 px-2.5 text-xs font-medium`} title="Show my location on the map" onClick={onLocate}>
            <LocateIcon width={16} height={16} />
            <span>My location</span>
          </button>
          <button type="button" className={toolButton} aria-label="Copy a link to this view" title="Copy a link to this view" onClick={onShare}>
            <ShareIcon width={16} height={16} />
          </button>
          <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-rule" />
          <button type="button" className={toolButton} aria-label="Zoom in" title="Zoom in" onClick={() => engineRef.current?.zoomBy(ZOOM.step)}>
            <PlusIcon />
          </button>
          <button type="button" className={toolButton} aria-label="Zoom out" title="Zoom out" onClick={() => engineRef.current?.zoomBy(1 / ZOOM.step)}>
            <MinusIcon />
          </button>
          <button
            type="button" title="Reset view / zoom to fit" onClick={() => engineRef.current?.resetView()}
            className={`${toolButton} w-auto gap-1.5 px-2.5 text-xs font-medium`}
          >
            <FitIcon width={16} height={16} />
            <span className="max-sm:sr-only">Reset view</span>
          </button>
        </div>
      </div>

      <MapTooltip ref={tooltipRef} tip={tip} onClose={() => engineRef.current?.dismissTooltip()} />
    </section>
  );
}));
