# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@onsvisual/svelte-maps` is a Svelte 5 component library wrapping MapLibre GL JS, published to npm, built as a SvelteKit-style package (via `@sveltejs/package`, matching the current `sv create --template library` convention). `src/lib/` is the published package — `src/lib/index.js` re-exports the four components. `src/routes/` is a SvelteKit demo app, not part of the published package; it's built and deployed separately to GitHub Pages.

Requires Svelte 5.0.0+ (peer dependency). Ships plain JS/Svelte source, no TypeScript in components — `jsconfig.json` exists only so `svelte-package`'s type-declaration emission (best-effort `.d.ts` files, no source annotations needed) and `svelte-check` have something to resolve against.

## Commands

- `npm run dev` — runs `vite dev`. Use this to interactively test component changes against `src/routes/+page.svelte`.
- `npm run build` — runs `build:demo` (production build of the demo app via `vite build` + `@sveltejs/adapter-static`, output to `build/`) then `package` (builds the npm-publishable library from `src/lib` via `@sveltejs/package`, output to `dist/`). These are independent — run `npm run package` alone to build just the library.
- `npm run preview` — serves the already-built demo (`build/`) via `vite preview`.
- `npm run deploy` — runs `build:demo` then publishes `build/` to GitHub Pages via `gh-pages` (the live demo at onsdigital.github.io/svelte-maps).
- `npm run check` — type-checks via `svelte-check` against `jsconfig.json`.
- `npm run format` / `npm run format:check` — Prettier, write or check-only. Config (`.prettierrc`, tabs/100-width/no-trailing-commas) and the VS Code format-on-save setup (`.vscode/settings.json`) are copied from [ONSdigital/svelte-components](https://github.com/ONSdigital/svelte-components) to keep formatting consistent across ONS's Svelte repos — check that repo before diverging from it here.
- There is no test suite (`npm test` is a no-op) and no linter (ESLint) configured — only formatting.
- **`dist/` vs `build/`**: easy to conflate — `dist/` is the npm-publish output of `src/lib` (via `svelte-package`); `build/` is the demo's static site output (via `adapter-static`), what gets deployed to GitHub Pages. Both are gitignored.
- When bumping the published version, update the `version` field in `package.json`.

### Worker-script loading

MapLibre GL JS resolves its tile-processing worker script relative to its own bundled module URL by default — a resolution that breaks under any bundler that chunks/hashes its output (Vite's dev-mode dependency pre-bundling, SvelteKit's hashed production chunks). The demo's module script at the top of `src/routes/+page.svelte` sidesteps this via Vite's own `?worker&url` import (`import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"`) plus MapLibre's public `setWorkerUrl()`, called before any `<Map>` mounts. `?worker&url` runs the worker file through Vite's module graph, so it also correctly bundles the worker's own nested `maplibre-gl-shared.mjs` import — no manual file-copying script needed, in either dev or the production `build/` output (verified via curl in both, not just reasoned about). Same pattern documented and used by [dimfeld/svelte-maplibre](https://github.com/dimfeld/svelte-maplibre).

**This is deliberately demo/consumer-owned, not baked into `Map.svelte` — do not retry that.** The identical `<script context="module">` snippet was tried inside `Map.svelte` itself and reverted: it works when the component is consumed via `$lib` inside this repo's own demo, but crashes a real npm-installed consumer's `vite dev` outright, because `@sveltejs/vite-plugin-svelte`'s default `prebundleSvelteLibraries` compiles library `.svelte` files during Vite's dependency-optimization pass, where Vite's worker-query plugin isn't loaded (`UNLOADABLE_DEPENDENCY ... Could not load .../maplibre-gl-worker.mjs?worker&url`). Confirmed via a real `npm pack` + external consumer install, not just an in-repo test — special Vite import-query syntax can't survive being published inside a Svelte library's own source; `dimfeld/svelte-maplibre` hits the same constraint and keeps the identical call in its own demo routes, never in `MapLibre.svelte`. If a consumer's `vite dev` fails with a `.../node_modules/.vite/deps/maplibre-gl-worker.mjs` "file does not exist" error before they've wired up the `?worker&url`/`setWorkerUrl()` pattern, `optimizeDeps: { exclude: ["maplibre-gl"] }` in their own `vite.config.js` fixes dev only (not a production build) — documented in the README's "Worker script setup" section.

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
  - `select`/`hover` props wire up MapLibre click/mousemove/mouseleave listeners that both set feature-state and dispatch Svelte events (`select`, `hover`) and update bindable `selected`/`hovered` props — these are meant to be used bidirectionally (bound from the parent app _and_ updated by user interaction), so the reactive blocks guard against feedback loops with `*Prev` tracking variables.
  - `hover` also sets a Svelte context (`hover`, a `writable` store) that `MapTooltip` consumes — this is how tooltips are decoupled from layer click/hover logic.
  - Reactive blocks (`setFilter`, `setLayout`, `setPaint`, `toggleVisibility`) all check `map.getLayer(id)` exists before mutating, since layers can be added/removed independently by consumers toggling `{#if}` blocks around `<MapSource>`/`<MapLayer>` (see `+page.svelte`'s `showSources`/`showLayers` checkboxes).
- **MapTooltip.svelte**: no `id`/`type` props — purely reads the `hover` context store set by its parent `MapLayer` and shows/hides a MapLibre `Popup`.
- **src/routes/utils.js**: standalone data helpers used by the demo (`getData` — fetch+parse CSV via `d3-dsv`, `getTopo` — fetch TopoJSON and convert to GeoJSON via `topojson-client`, `getColor` — bucket a value into a color scale from `breaks`). Demo-only, not exported from `src/lib`; consumers of the library are expected to write their own equivalents.

## Conventions to preserve when editing components

- All map mutations that can happen after mount must guard on `map.getLayer(id)` / `map.getSource(id)` existing, because sources/layers are torn down and recreated whenever a parent `{#if}` block toggles.
- `onDestroy` handlers must remove layers before their source (MapLibre throws otherwise) and check `typeof map?.getX === "function"` since the map itself may already be gone during teardown.
- New bindable interaction props (like `selected`/`hovered`) should follow the existing `prop` + `propPrev` + reactive-block pattern to support two-way binding without infinite reactive loops.
- Context keys (`map`, `source`, `layer`, `hover`) are the integration surface between these four components — don't rename them without updating every consumer in this chain.
- Every exported prop (`export let ...`) on the four components has a `/** ... @type {...} */` JSDoc comment above it — this is what `svelte-package` uses to emit real `.d.ts` types for consumers instead of TypeScript's inferred (and much worse) guesses from usage. New or changed props should follow the same pattern.
