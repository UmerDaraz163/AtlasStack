'use client';

import { useId, useRef, useState, type ReactNode } from 'react';
import { ChevronIcon } from './icons';

interface DisclosureProps {
  title: string;
  /** Initial state when the component manages itself. */
  defaultOpen?: boolean;
  /** Pass `open` + `onOpenChange` to control it from outside. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/**
 * Collapsible section with an animated height. The content is laid out in a one-row grid
 * whose row animates between 0fr and 1fr, so no height measuring is needed. While closed
 * the content is `invisible`, which also takes it out of the tab order. (When open it sets
 * no visibility of its own, so it still hides together with a hidden parent such as the drawer.)
 */
export function Disclosure({ title, defaultOpen = true, open, onOpenChange, children }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = open ?? inner;
  const id = useId();

  const sectionRef = useRef<HTMLElement>(null);

  const toggle = () => {
    setInner(!isOpen);
    onOpenChange?.(!isOpen);
    // When a section opens near the bottom of a scrolling panel, bring its content into view
    // once the height animation has finished.
    if (!isOpen) {
      window.setTimeout(() => sectionRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 320);
    }
  };

  return (
    <section ref={sectionRef} className="border-b border-rule last:border-b-0">
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={id}
          onClick={toggle}
          className="flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-muted transition-colors hover:bg-hover hover:text-ink"
        >
          <span>{title}</span>
          <ChevronIcon className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </h2>
      <div
        id={id}
        className={`grid transition-[grid-template-rows,visibility] duration-300 ease-out ${
          isOpen ? 'grid-rows-[1fr]' : 'invisible grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-4 pb-4 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
