import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'World Geographic Reference Map',
  description:
    'Interactive globe and world map with latitude and longitude lines, the Equator, tropics, polar circles, ' +
    'climate zones, pressure belts, winds, ocean currents, time zones, tectonic plates and day & night.'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f5f8' },
    { media: '(prefers-color-scheme: dark)', color: '#0a101c' }
  ]
};

/**
 * Runs before the page paints: use the saved theme, or follow the system setting.
 * (Kept inline so there is no flash of the wrong theme.)
 */
const themeScript = `(function(){var t;try{t=localStorage.getItem('world-map:theme')}catch(e){}
if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
document.documentElement.dataset.theme=t})()`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The theme script changes <html data-theme> before React hydrates, hence suppressHydrationWarning.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans text-sm leading-normal sm:text-[15px]">
        {children}
        <noscript>
          <p className="p-4">This interactive map needs JavaScript to draw the globe and its layers.</p>
        </noscript>
      </body>
    </html>
  );
}
