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
| `data/*.ts` | Every editable definition: views, layer toggles, reference lines, climate zones, pressure belts, winds, ocean currents, time zones, plate names and boundary styles, cities, earthquakes, street map, Sun settings |
| `data/geo/*.json` | Generated city, time-zone and plate data (see Data sources) |
| `scripts/build-geodata.mjs` | Rebuilds `data/geo/` from the original datasets |
| `lib/map-engine.ts` | The D3 map engine: drawing, zoom / rotation, labels, hit-testing |
| `lib/geo.ts`, `lib/geodata.ts`, `lib/legend.ts`, `lib/types.ts` | Geometry and formatting helpers; data loaders, look-ups and clock-time helpers; legend builder; shared types |
| `components/` | `MapExplorer` (app shell and state), `WorldMap`, `ControlPanel`, `Legend`, `MapTooltip`, `DetailsPanel`, `FeatureSearch`, and small UI pieces |
| `app/` | Layout, page and global styles (including the map's SVG styles) |

To change what the map shows, edit the arrays in `data/` — the map, legend, tooltips and search are all generated from them.
For example: `data/sun.ts` sets how dark the night side is (`nightBands`), `data/view.ts` holds the layer toggles,
their hints and the quick views, and the theme colours are the CSS variables at the top of `app/globals.css`.

## Data sources

| Data | Source | Licence |
| --- | --- | --- |
| Country shapes | [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth 1:110m) | Public domain |
| Cities and their time zones (`data/geo/cities.json`, `country-zones.json`) | Natural Earth 1:50m populated places | Public domain |
| Tectonic plates and boundaries (`data/geo/plates.json`) | PB2002 model, Bird (2003), GeoJSON by Hugo Ahlenius / Nordpil | ODC Attribution |
| Earthquakes (loaded live when the layer is on) | US Geological Survey feed, M4.5+ past 30 days | Public domain |
| Street maps (opened for a picked place) | OpenStreetMap tiles via Leaflet, no API key | © OpenStreetMap contributors, ODbL; [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) |

Clock times come from the browser's own time-zone database, so offsets such as India's UTC+5:30 and daylight-saving changes are exact for the chosen date.

To rebuild the files in `data/geo/` from the original datasets: `node scripts/build-geodata.mjs` (downloads into `.cache/`).

## Features

- Globe and three flat maps; drag, pinch / scroll and keyboard control; reset view
- Layer switches with quick views, larger-label option and a "Reset controls" button
- Hover / tap tooltips, pinned details, and a "This place" card with daylight, solar time and Sun height
- Day & night with twilight shading, date / time sliders and "Play year"
- Search, "My location", shareable links, light / dark theme, built-in help
- Cities layer; "Explore" a country to list its cities with clock time, tectonic plate and distance to the nearest plate boundary
- Civil time zones (the clock time each country really uses, daylight saving included) next to the 15° solar zones
- PB2002 tectonic plates with boundary type and plate speed; live recent earthquakes
- Distance tool (great-circle distance, direction, flight time, clock difference)
- Street map of any place on OpenStreetMap, with "Open in OpenStreetMap / Google Maps" links
- Choices (view, layers, theme) are remembered in the browser

`index.html` in the project root is the earlier single-file version; the Next.js app does not use it.
