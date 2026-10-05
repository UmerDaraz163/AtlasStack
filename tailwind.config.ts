import type { Config } from 'tailwindcss';

/**
 * Design tokens for the UI around the map. Loaded from app/globals.css with `@config`.
 * The colours point at CSS variables defined in globals.css, which is what lets the
 * light / dark theme switch without touching any component.
 * (Colours of the map layers themselves live with the data in data/*.ts.)
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--c-canvas)',      // page background
        surface: 'var(--c-surface)',    // cards, panels, inputs
        hover: 'var(--c-hover)',        // hover / pressed background
        track: 'var(--c-track)',        // switch track, drag handle
        ink: 'var(--c-ink)',            // main text
        muted: 'var(--c-muted)',        // secondary text
        rule: 'var(--c-rule)',          // borders and dividers
        accent: { DEFAULT: 'var(--c-accent)', dark: 'var(--c-accent-dark)', soft: 'var(--c-accent-soft)' }
      },
      boxShadow: {
        card: '0 1px 2px rgb(15 23 42 / 0.05)',
        sheet: '0 -12px 40px rgb(15 23 42 / 0.22)',
        pop: '0 10px 30px rgb(15 23 42 / 0.28)'
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        }
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out both'
      }
    }
  },
  plugins: []
};

export default config;
