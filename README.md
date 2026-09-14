# @onsvisual/svelte-maps

[![npm version](https://badge.fury.io/js/@onsvisual%2Fsvelte-maps.svg)](https://www.npmjs.com/package/@onsvisual/svelte-maps)

Reusable map components for Svelte projects built on Maplibre GL JS.

Usage examples can be found in the **/src/routes/+page.svelte** file in this repo, which can be [previewed live here](https://onsdigital.github.io/svelte-maps/).

## Breaking changes in v2.0.0

- **Requires Svelte 5.0.0+.** The `"3 - 5"` peer range has been dropped.
- The package is now built via [`@sveltejs/package`](https://svelte.dev/docs/kit/packaging) from `src/lib`, matching the current `sv create --template library` convention, instead of shipping raw source from the repo root.
- `main`/`module` and the `exports["."].default` condition have been dropped — only the `svelte` (and `types`) export conditions are provided. This matches current SvelteKit library convention and works with any Svelte-aware bundler (Vite, webpack + `svelte-loader`, Rollup + `rollup-plugin-svelte`), but a consumer on tooling that isn't Svelte-condition-aware will need to check their setup.

## Styling

`<Map>` imports `maplibre-gl`'s own CSS itself (`import "maplibre-gl/dist/maplibre-gl.css"`), so it's included automatically by any bundler that handles CSS imports from a dependency's source — which covers Vite/SvelteKit (built in), the vast majority of webpack setups (via `css-loader`), and Rollup setups that already include a CSS plugin (e.g. `rollup-plugin-css-only`, which the official `degit sveltejs/template` starter includes by default). This package also sets `"sideEffects": ["**/*.css"]` so bundlers don't tree-shake that import away.

If you want to load a different/customized stylesheet instead, pass the `css` prop with a URL (local or CDN) — this is additive/override, not a replacement for the bundled import:

```svelte
<Map css="/path/to/custom-maplibre-gl.css" ... />
```

## Worker script setup

MapLibre GL JS resolves its tile-processing worker script relative to its own bundled module URL by default. That resolution breaks under any bundler that chunks or hashes maplibre-gl's output (Vite's dependency pre-bundling in dev, SvelteKit's hashed client chunks in production, etc.), because nothing at that computed URL actually exists.

The supported fix is to copy `maplibre-gl-worker.mjs` and its own nested `maplibre-gl-shared.mjs` import (plus their `.map` files) from `node_modules/maplibre-gl/dist/` into your app's static assets, and call maplibre-gl's own `setWorkerUrl()` — pointing it at that same-origin path — before mounting any `<Map>`:

```js
import { setWorkerUrl } from "maplibre-gl";
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
```

This repo's own demo does exactly this — see `scripts/copy-maplibre-worker.js` (run before both `vite dev` and `vite build`) and the top of `src/routes/+page.svelte` for a worked reference.

## Interaction options

You can mirror the Maps template `scrollZoomGuard` behaviour by enabling guarded scroll zoom:

```svelte
<Map id="map" style="./style.json" scrollZoomGuard={true} />
```

When enabled, map zoom via wheel/trackpad requires a modifier key (cmd/ctrl) plus scroll.

`scrollZoomGuard` maps to MapLibre `cooperativeGestures` and takes precedence over `options.cooperativeGestures` when both are provided.
