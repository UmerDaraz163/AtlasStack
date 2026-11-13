/** Small inline icons (decorative: always paired with a text label or aria-label). */
import type { ReactNode, SVGProps } from 'react';

function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}
    >
      {children}
    </svg>
  );
}

type Props = SVGProps<SVGSVGElement>;

export const SlidersIcon = (p: Props) => (
  <Icon {...p}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Icon>
);
export const CloseIcon = (p: Props) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>;
export const ChevronIcon = (p: Props) => <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>;
export const PlusIcon = (p: Props) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const MinusIcon = (p: Props) => <Icon {...p}><path d="M5 12h14" /></Icon>;
export const FitIcon = (p: Props) => (
  <Icon {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /><circle cx="12" cy="12" r="2.5" /></Icon>
);
export const SearchIcon = (p: Props) => <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></Icon>;
export const PlayIcon = (p: Props) => <Icon {...p}><path d="M7 5l12 7-12 7z" fill="currentColor" /></Icon>;
export const PauseIcon = (p: Props) => <Icon {...p}><path d="M8 5v14M16 5v14" /></Icon>;
export const SunIcon = (p: Props) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
);
export const MoonIcon = (p: Props) => <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" /></Icon>;
export const HelpIcon = (p: Props) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1 1-1.1 1.8M12 17h0" /></Icon>
);
export const LocateIcon = (p: Props) => (
  <Icon {...p}><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></Icon>
);
export const ShareIcon = (p: Props) => (
  <Icon {...p}><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="M8.2 10.8l7.6-4.5M8.2 13.2l7.6 4.5" /></Icon>
);
export const PinIcon = (p: Props) => (
  <Icon {...p}><path d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z" /><circle cx="12" cy="10.5" r="2.2" /></Icon>
);
export const ResetIcon = (p: Props) => <Icon {...p}><path d="M4 5v5h5" /><path d="M5.5 14.5A7 7 0 1 0 7 7.5L4 10" /></Icon>;
export const RulerIcon = (p: Props) => (
  <Icon {...p}><path d="M3 17L17 3l4 4L7 21z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></Icon>
);
export const ExploreIcon = (p: Props) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></Icon>
);
export const PlaneIcon = (p: Props) => (
  <Icon {...p}><path d="M10.5 21l1.5-1 1.5 1v-2.5l-1-1V13l7 2v-2l-7-4.5V4a1.5 1.5 0 0 0-3 0v4.5L3 13v2l7-2v4.5l-1 1z" transform="translate(0 0)" /></Icon>
);
export const SwapIcon = (p: Props) => <Icon {...p}><path d="M7 7h12l-3-3M17 17H5l3 3" /></Icon>;
export const MaximizeIcon = (p: Props) => <Icon {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></Icon>;
export const MinimizeIcon = (p: Props) => <Icon {...p}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></Icon>;
