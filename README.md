# World Geographic Reference Map

Interactive globe and world map (Next.js App Router · TypeScript · Tailwind CSS · D3).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build: `npm run build && npm start`. Type check: `npm run typecheck`.

## Where things are

| Path | What it holds |
| --- | --- |
| `data/*.ts` | Every editable definition: views, layer toggles, reference lines, climate zones, pressure belts, winds, ocean currents, time zones, tectonic plates, Sun settings |
| `lib/map-engine.ts` | The D3 map engine: drawing, zoom / rotation, labels, hit-testing |
| `lib/geo.ts`, `lib/legend.ts`, `lib/types.ts` | Geometry and formatting helpers, legend builder, shared types |
| `components/` | `MapExplorer` (app shell and state), `WorldMap`, `ControlPanel`, `Legend`, `MapTooltip`, `DetailsPanel`, `FeatureSearch`, and small UI pieces |
| `app/` | Layout, page and global styles (including the map's SVG styles) |

To change what the map shows, edit the arrays in `data/` — the map, legend, tooltips and search are all generated from them.
For example: `data/sun.ts` sets how dark the night side is (`nightBands`), `data/view.ts` holds the layer toggles,
their hints and the quick views, and the theme colours are the CSS variables at the top of `app/globals.css`.

## Features

- Globe and three flat maps; drag, pinch / scroll and keyboard control; reset view
- Layer switches with quick views, larger-label option and a "Reset controls" button
- Hover / tap tooltips, pinned details, and a "This place" card with daylight, solar time and Sun height
- Day & night with twilight shading, date / time sliders and "Play year"
- Search, "My location", shareable links, light / dark theme, built-in help
- Choices (view, layers, theme) are remembered in the browser

`index.html` in the project root is the earlier single-file version; the Next.js app does not use it.
