'use client';

interface LayerToggleProps {
  id: string;
  label: string;
  /** Short explanation shown under the label. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Accessible on/off switch (role="switch") with a sliding thumb. Space or Enter toggles it. */
export function LayerToggle({ id, label, hint, checked, onChange }: LayerToggleProps) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <label id={`${id}-label`} htmlFor={id} className="flex-1 cursor-pointer select-none py-1">
        <span className="block leading-tight">{label}</span>
        {hint && <span id={`${id}-hint`} className="block text-xs leading-snug text-muted">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${
          checked ? 'bg-accent' : 'bg-track'
        }`}
      >
        <span
          aria-hidden="true"
          className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
