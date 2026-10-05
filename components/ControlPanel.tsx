'use client';

import { INFO_LAYER_IDS, LAYERS, PROJECTIONS, QUICK_VIEWS, SUN } from '@/data';
import { describeSun, fmtDay, fmtHour } from '@/lib/geo';
import type { LayerDef, LayerId, LayerState, ProjectionDef, ProjectionId, QuickView, SunState } from '@/lib/types';
import { Disclosure } from './Disclosure';
import { LayerToggle } from './LayerToggle';
import { PauseIcon, PlayIcon, ResetIcon } from './icons';

interface ControlPanelProps {
  projection: ProjectionId;
  onProjection: (id: ProjectionId) => void;
  layers: LayerState;
  onLayer: (id: LayerId, on: boolean) => void;
  onQuickView: (view: QuickView) => void;
  sun: SunState;
  onSun: (patch: Partial<SunState>) => void;
  onSunNow: () => void;
  playing: boolean;
  onTogglePlay: () => void;
  /** Put the view, layers and Sun back to their starting values. */
  onReset: () => void;
}

/** LAYERS grouped by their `group` label, in definition order. */
const LAYER_GROUPS = LAYERS.reduce<{ title: string; items: LayerDef[] }[]>((groups, layer) => {
  const group = groups.find(g => g.title === layer.group);
  if (group) group.items.push(layer); else groups.push({ title: layer.group, items: [layer] });
  return groups;
}, []);

const chip =
  'inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors ';
const chipIdle = 'border-rule bg-surface hover:border-accent hover:bg-accent-soft';
const chipActive = 'border-accent bg-accent-soft text-accent-dark';

/** True when exactly this quick view's info layers are switched on. */
const matches = (view: QuickView, layers: LayerState) =>
  INFO_LAYER_IDS.every(id => layers[id] === view.layers.includes(id));

/**
 * The control form: view picker, quick views, layer switches and the Sun & seasons sliders.
 * Everything is generated from data/view.ts and data/sun.ts.
 */
export function ControlPanel(props: ControlPanelProps) {
  const { projection, onProjection, layers, onLayer, onQuickView, sun, onSun, onSunNow, playing, onTogglePlay, onReset } = props;

  return (
    <form onSubmit={e => e.preventDefault()} aria-label="Map controls">
      {/* Reset controls: always within reach at the top of the panel */}
      <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-2">
        <span className="text-xs text-muted">View, layers and Sun</span>
        <button type="button" onClick={onReset} title="Put the view, layers and Sun back to their defaults" className={chip + chipIdle}>
          <ResetIcon width={14} height={14} />
          Reset controls
        </button>
      </div>

      {/* View / projection */}
      <Disclosure title="View">
        <fieldset>
          <legend className="sr-only">Map view</legend>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(PROJECTIONS) as [ProjectionId, ProjectionDef][]).map(([id, def]) => (
              <label key={id} className="cursor-pointer">
                <input
                  type="radio" name="projection" value={id} className="peer sr-only"
                  checked={projection === id} onChange={() => onProjection(id)}
                />
                <span className="block h-full rounded-lg border border-rule px-3 py-2 transition-colors duration-200 hover:border-accent peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2">
                  <span className="block font-semibold">{def.label}</span>
                  <span className="block text-xs text-muted">{def.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Disclosure>

      {/* Quick views + individual layer switches */}
      <Disclosure title="Layers">
        <div role="group" aria-labelledby="quick-views-title" className="mb-4">
          <h3 id="quick-views-title" className="mb-1.5 text-[13px] font-semibold">Quick views</h3>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_VIEWS.map(view => {
              const active = matches(view, layers);
              return (
                <button
                  key={view.id} type="button" aria-pressed={active} onClick={() => onQuickView(view)}
                  className={chip + (active ? chipActive : chipIdle)}
                >
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {LAYER_GROUPS.map(group => (
            <fieldset key={group.title}>
              <legend className="mb-0.5 text-[13px] font-semibold">{group.title}</legend>
              {group.items.map(layer => (
                <LayerToggle
                  key={layer.id} id={`layer-${layer.id}`} label={layer.label} hint={layer.hint}
                  checked={layers[layer.id]} onChange={on => onLayer(layer.id, on)}
                />
              ))}
            </fieldset>
          ))}
        </div>
      </Disclosure>

      {/* Sun & seasons: the sliders drive the day & night layer */}
      <Disclosure title="Sun & seasons">
        <p className="mb-2 text-xs tabular-nums text-muted">{describeSun(sun)}</p>
        <label className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-[13px]">
          <span>Date</span>
          <input
            type="range" min={1} max={365} step={1} value={sun.day} className="h-8 w-full"
            aria-valuetext={fmtDay(sun.day)}
            onChange={e => onSun({ day: Number(e.target.value) })}
          />
        </label>
        <label className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-[13px]">
          <span>Time (UTC)</span>
          <input
            type="range" min={0} max={23.75} step={0.25} value={sun.hour} className="h-8 w-full"
            aria-valuetext={`${fmtHour(sun.hour)} UTC`}
            onChange={e => onSun({ hour: Number(e.target.value) })}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className={chip + chipIdle} onClick={onSunNow}>Now</button>
          {SUN.jumps.map(jump => (
            <button key={jump.label} type="button" className={chip + chipIdle} onClick={() => onSun({ day: jump.day })}>
              {jump.label}
            </button>
          ))}
          <button type="button" className={chip + (playing ? chipActive : chipIdle)} aria-pressed={playing} onClick={onTogglePlay}>
            {playing ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
            {playing ? 'Pause' : 'Play year'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          Tip: select a place on the map, then move these sliders to see its daylight change.
        </p>
      </Disclosure>
    </form>
  );
}
