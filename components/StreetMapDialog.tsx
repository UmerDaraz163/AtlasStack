'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { STREET_MAP } from '@/data';
import type { LonLat } from '@/lib/types';
import { CloseIcon } from './icons';

/** A place to show on the street map. */
export interface StreetMapTarget {
  point: LonLat;
  label: string;
  zoom: number;
}

interface StreetMapDialogProps {
  target: StreetMapTarget | null;
  onClose: () => void;
}

const linkClass =
  'inline-flex items-center rounded-full border border-rule bg-surface px-3 py-1 text-xs font-medium transition-colors hover:border-accent hover:bg-accent-soft';

/**
 * Street-level map of one place, in a dialog. Built with Leaflet (loaded only when opened) on
 * OpenStreetMap's free tiles, with links to open the same spot on OpenStreetMap.org or Google Maps.
 */
export function StreetMapDialog({ target, onClose }: StreetMapDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // Open / close the native dialog with the target.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  // Build the Leaflet map while the dialog is open.
  useEffect(() => {
    if (!target || !mapRef.current) return;
    let cancelled = false;
    let map: import('leaflet').Map | null = null;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapRef.current) return;
      const [lon, lat] = target.point;
      map = L.map(mapRef.current, { zoomControl: true, attributionControl: true }).setView([lat, lon], target.zoom);
      L.tileLayer(STREET_MAP.tiles, { maxZoom: STREET_MAP.maxZoom, attribution: STREET_MAP.attribution }).addTo(map);
      L.circleMarker([lat, lon], { radius: 8, color: '#ffffff', weight: 2, fillColor: '#2457d6', fillOpacity: 1 })
        .addTo(map).bindTooltip(target.label, { direction: 'top', offset: [0, -8] });
      // The dialog has just been laid out: let Leaflet measure it.
      requestAnimationFrame(() => map?.invalidateSize());
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [target]);

  const [lon, lat] = target?.point ?? [0, 0];
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={event => { if (event.target === dialogRef.current) onClose(); }}     // click on the backdrop
      aria-labelledby="street-title"
      className="help-dialog m-auto w-[min(60rem,calc(100vw-1.5rem))] rounded-2xl border border-rule bg-surface p-0 text-ink shadow-pop"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule py-2 pl-5 pr-2">
        <h2 id="street-title" className="min-w-0 truncate text-base font-bold">Street map · {target?.label}</h2>
        <button
          type="button" onClick={onClose} aria-label="Close street map"
          className="inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <CloseIcon />
        </button>
      </div>
      {/* Leaflet draws into this box. */}
      <div ref={mapRef} className="h-[min(65dvh,36rem)] w-full bg-hover" role="region" aria-label={`Street map of ${target?.label ?? ''}`} />
      <div className="flex flex-wrap items-center gap-2 border-t border-rule px-4 py-2.5 text-xs text-muted">
        <span className="mr-auto">Map data © OpenStreetMap contributors · drag to pan, scroll or pinch to zoom</span>
        {target && (
          <>
            <a className={linkClass} href={STREET_MAP.openStreetMapUrl(lat, lon, target.zoom)} target="_blank" rel="noreferrer">
              Open in OpenStreetMap
            </a>
            <a className={linkClass} href={STREET_MAP.googleMapsUrl(lat, lon)} target="_blank" rel="noreferrer">
              Open in Google Maps
            </a>
          </>
        )}
      </div>
    </dialog>
  );
}
