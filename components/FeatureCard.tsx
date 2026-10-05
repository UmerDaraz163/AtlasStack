import type { FeatureInfo } from '@/lib/types';

interface FeatureCardProps {
  info: FeatureInfo;
  /** 'dark' is used inside the tooltip. */
  tone?: 'light' | 'dark';
}

/** Name, classification, coordinates and description of one feature. */
export function FeatureCard({ info, tone = 'light' }: FeatureCardProps) {
  const dim = tone === 'dark' ? 'text-slate-400' : 'text-muted';
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-bold">
        <span
          aria-hidden="true"
          className={`size-2.5 shrink-0 rounded-full ring-1 ${tone === 'dark' ? 'ring-white/40' : 'ring-rule'}`}
          style={{ background: info.color }}
        />
        {info.name}
      </div>
      <dl className="my-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        <dt className={dim}>Classification</dt>
        <dd>{info.cls}{info.sub ? ` · ${info.sub}` : ''}</dd>
        <dt className={dim}>{info.coordLabel}</dt>
        <dd>{info.coord}</dd>
      </dl>
      <p>{info.desc}</p>
    </div>
  );
}
