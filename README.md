# @onsvisual/svelte-maps

[![npm version](https://badge.fury.io/js/@onsvisual%2Fsvelte-maps.svg)](https://www.npmjs.com/package/@onsvisual/svelte-maps)

Reusable map components for Svelte projects built on Maplibre GL JS.

Usage examples can be found in the **/src/routes/+page.svelte** file in this repo, which can be [previewed live here](https://onsdigital.github.io/svelte-maps/).

## Breaking changes in v2.0.0

- **Requires Svelte 5.0.0+.** The `"3 - 5"` peer range has been dropped.
- The package is now built via [`@sveltejs/package`](https://svelte.dev/docs/kit/packaging) from `src/lib`, matching the current `sv create --template library` convention, instead of shipping raw source from the repo root.
- `main`/`module` and the `exports["."].default` condition have been dropped — only the `svelte` (and `types`) export conditions are provided. This matches current SvelteKit library convention.
- **Requires a Vite-based bundler** (any SvelteKit app, or a plain Vite + Svelte setup). `<Map>` resolves MapLibre's worker script via a Vite-specific `?worker&url` import (see "Worker script setup" below) — this package is not expected to work under webpack or a non-Vite Rollup config.

## Styling

`<Map>` imports `maplibre-gl`'s own CSS itself (`import "maplibre-gl/dist/maplibre-gl.css"`), so it's included automatically by any bundler that handles CSS imports from a dependency's source — which covers Vite/SvelteKit (built in), the vast majority of webpack setups (via `css-loader`), and Rollup setups that already include a CSS plugin (e.g. `rollup-plugin-css-only`, which the official `degit sveltejs/template` starter includes by default). This package also sets `"sideEffects": ["**/*.css"]` so bundlers don't tree-shake that import away.

If you want to load a different/customized stylesheet instead, pass the `css` prop with a URL (local or CDN) — this is additive/override, not a replacement for the bundled import:

```svelte
<Map css="/path/to/custom-maplibre-gl.css" ... />
```

## Worker script setup

MapLibre GL JS resolves its tile-processing worker script relative to its own bundled module URL by default. That resolution breaks under any bundler that chunks, hashes, or dev-mode pre-bundles maplibre-gl's output (Vite's dependency optimizer in dev, hashed production chunks, etc.), because nothing then exists at the recomputed URL — for example, installing this package into a plain SvelteKit/Vite app can surface an error like `The file does not exist at ".../node_modules/.vite/deps/maplibre-gl-worker.mjs" which is in the optimize deps directory`.

**No consumer action needed** — `<Map>` handles this internally (via a Vite `?worker&url` import of the worker script plus maplibre-gl's own `setWorkerUrl()`, called once before any map mounts), verified working in both `vite dev` and a production `vite build`. This requires your app to be bundled by Vite (true of any SvelteKit app, and any other Vite-based Svelte setup) — it is not expected to work under webpack or a non-Vite Rollup config.

## Interaction options

You can mirror the Maps template `scrollZoomGuard` behaviour by enabling guarded scroll zoom:

```svelte
<Map id="map" style="./style.json" scrollZoomGuard={true} />
```

When enabled, map zoom via wheel/trackpad requires a modifier key (cmd/ctrl) plus scroll.

`scrollZoomGuard` maps to MapLibre `cooperativeGestures` and takes precedence over `options.cooperativeGestures` when both are provided.
