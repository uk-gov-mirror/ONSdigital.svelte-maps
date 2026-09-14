# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@onsvisual/svelte-maps` is a Svelte component library wrapping MapLibre GL JS, published to npm. `src/App.svelte` is a demo/dev harness (built via `src/main.js`), not part of the published package — the published surface is defined entirely by `index.mjs`, which re-exports the four components in `src/`.

## Commands

- `npm run dev` — builds the demo app with `rollup.config.dev.js` in watch mode, then runs `npm run start` (serves `dist/` via `sirv`) with livereload. Use this to interactively test component changes against `src/App.svelte`.
- `npm run build` — production build of the demo app via `rollup.config.build.js` (minified, no sourcemaps difference but `dev: false` in the Svelte compiler options).
- `npm run start` — serves the already-built `dist/` folder (invoked automatically by `dev`).
- `npm run deploy` — publishes `dist/` to GitHub Pages via `gh-pages` (the live demo at onsdigital.github.io/svelte-maps).
- There is no test suite (`npm test` is a no-op) and no linter configured.
- There is no separate library-build step: consumers import directly from `index.mjs` → `src/*.svelte`, so the package is shipped as raw Svelte source (see `files` in `package.json`: `index.mjs`, `src`, `dist`). When bumping the published version, update the `version` field in `package.json`.

## Architecture

Four components compose in a strict parent/child hierarchy, wired together with Svelte context rather than props — this is the key thing to understand before changing any of them:

```
<Map>                                  creates the MapLibre GL instance, setContext('map', { getMap })
  <MapSource>                          adds a source, setContext('source', { source, layer, promoteId })
    <MapLayer>                         adds a layer, setContext('layer', ...) + setContext('hover', hoverObj store)
      <MapTooltip>                     reads getContext('hover'), shows a MapLibre Popup on hover
```

- **Map.svelte**: instantiates `maplibre-gl`'s `Map` in `onMount`, exposes it via `export let map` (bindable) and via context so descendants can call `getContext('map').getMap()`. Reactive `style` changes trigger `setStyle`. Only renders its `<slot>` once the map's `load` event fires (`loaded` flag) — so children can assume the map is ready. `scrollZoomGuard` maps to MapLibre's `cooperativeGestures` and overrides `options.cooperativeGestures` if both are set.
- **MapSource.svelte**: adds a source of type `geojson` | `vector` | `raster` | `raster-dem`. Removes any pre-existing source with the same `id` before adding. Polls `map.isSourceLoaded(id)` (recursive `sleep`-based retry) and only renders its `<slot>` (i.e. `<MapLayer>` children) once loaded. Reactive blocks update data/tiles in place (`setData`, `setVectorTiles`, `setRasterTiles`) rather than recreating the source. On destroy, removes any layers still referencing this source before removing the source itself (MapLibre requires layers removed first).
- **MapLayer.svelte**: adds a layer bound to the parent source's context (`source`, `sourceLayer` from `layer`/`promoteId`). Key patterns:
  - Uses MapLibre **feature-state** (not paint data-driven expressions on GeoJSON properties) for `color`/`value`/`name`/`selected`/`hovered`/`highlighted`, keyed by each feature's `id` (`idKey`, defaulting to the source's `promoteId`). `updateColors(data, colorKey)` is exported so a parent can call it directly via a bound component instance, in addition to it running reactively off `data`/`colorKey`.
  - `select`/`hover` props wire up MapLibre click/mousemove/mouseleave listeners that both set feature-state and dispatch Svelte events (`select`, `hover`) and update bindable `selected`/`hovered` props — these are meant to be used bidirectionally (bound from the parent app *and* updated by user interaction), so the reactive blocks guard against feedback loops with `*Prev` tracking variables.
  - `hover` also sets a Svelte context (`hover`, a `writable` store) that `MapTooltip` consumes — this is how tooltips are decoupled from layer click/hover logic.
  - Reactive blocks (`setFilter`, `setLayout`, `setPaint`, `toggleVisibility`) all check `map.getLayer(id)` exists before mutating, since layers can be added/removed independently by consumers toggling `{#if}` blocks around `<MapSource>`/`<MapLayer>` (see `App.svelte`'s `showSources`/`showLayers` checkboxes).
- **MapTooltip.svelte**: no `id`/`type` props — purely reads the `hover` context store set by its parent `MapLayer` and shows/hides a MapLibre `Popup`.
- **src/js/utils.js**: standalone data helpers used by the demo (`getData` — fetch+parse CSV via `d3-dsv`, `getTopo` — fetch TopoJSON and convert to GeoJSON via `topojson-client`, `getColor` — bucket a value into a color scale from `breaks`). Not exported from `index.mjs`; consumers of the library are expected to write their own equivalents.

## Conventions to preserve when editing components

- All map mutations that can happen after mount must guard on `map.getLayer(id)` / `map.getSource(id)` existing, because sources/layers are torn down and recreated whenever a parent `{#if}` block toggles.
- `onDestroy` handlers must remove layers before their source (MapLibre throws otherwise) and check `typeof map?.getX === "function"` since the map itself may already be gone during teardown.
- New bindable interaction props (like `selected`/`hovered`) should follow the existing `prop` + `propPrev` + reactive-block pattern to support two-way binding without infinite reactive loops.
- Context keys (`map`, `source`, `layer`, `hover`) are the integration surface between these four components — don't rename them without updating every consumer in this chain.
