'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './icons';

/** Where the chosen theme is remembered (also read by the inline script in app/layout.tsx). */
const THEME_KEY = 'world-map:theme';
type Theme = 'light' | 'dark';

/**
 * Light / dark switch. The first visit follows the system setting; after that the choice
 * is remembered. The theme itself is just <html data-theme="…"> plus CSS variables.
 */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light');

  // The inline script has already set the attribute; mirror it once mounted.
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* not remembered, still applied */ }
    setTheme(next);
  };

  const label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className={className}>
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
