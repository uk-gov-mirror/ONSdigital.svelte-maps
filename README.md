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

MapLibre GL JS resolves its tile-processing worker script relative to its own bundled module URL by default. That resolution breaks under any bundler that chunks or hashes maplibre-gl's output (Vite's dependency pre-bundling in dev, SvelteKit's hashed client chunks in production, etc.), because nothing at that computed URL actually exists. This package can't fix it for you internally — see "Why this isn't handled automatically" below — so it's a required setup step in your own app.

If you're on Vite (any SvelteKit app included), import the worker with Vite's own `?worker&url` syntax and call `setWorkerUrl()` before mounting any `<Map>` — same pattern used by [dimfeld/svelte-maplibre](https://github.com/dimfeld/svelte-maplibre#usage). Put this in your root layout (`<script module>` in a `+layout.svelte`) so it runs once before any page:

```svelte
<script module>
	import { setWorkerUrl } from "maplibre-gl";
	import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
	setWorkerUrl(maplibreWorkerUrl);
</script>
```

`?worker&url` runs the worker file through Vite's own module graph, so it correctly bundles the worker's own nested `maplibre-gl-shared.mjs` import too (inlined in a production build; resolved to a real URL in dev) — no manual file-copying needed, in dev or prod. This repo's own demo does exactly this — see the module script at the top of `src/routes/+page.svelte`.

**If you're not on Vite**, see the [MapLibre installation docs](https://maplibre.org/maplibre-gl-js/docs/#installation) for configuring the worker on your bundler; the general fix is copying `maplibre-gl-worker.mjs` and its nested `maplibre-gl-shared.mjs` import into your own static assets and calling `setWorkerUrl()` pointing at that same-origin path.

**Faster unblock for `vite dev` only, if you haven't wired up the above yet:** the same underlying issue can surface as `The file does not exist at ".../node_modules/.vite/deps/maplibre-gl-worker.mjs" which is in the optimize deps directory` — this happens because Vite's dev-server dependency optimizer pre-bundles `maplibre-gl` by default, which relocates it and breaks its self-relative worker lookup. Excluding it from that optimizer avoids the relocation entirely:

```js
// vite.config.js
export default defineConfig({
	optimizeDeps: { exclude: ["maplibre-gl"] }
});
```

This fixes `vite dev` on its own, but **not** a production build (Rollup chunks/hashes maplibre-gl the same way) — the `?worker&url` snippet above is still required before deploying.

### Why this isn't handled automatically

We tried baking this into `Map.svelte` itself via the same `?worker&url` import syntax, which would have needed zero consumer-side config. It works when tested inside this repo's own demo — but breaks a real npm-installed consumer outright: `@sveltejs/vite-plugin-svelte` prebundles library `.svelte` files by default (`prebundleSvelteLibraries`), and Vite's worker-query plugin isn't part of that prebundling pipeline, so `vite dev` crashes before it even starts (`UNLOADABLE_DEPENDENCY ... Could not load node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url`). Special Vite import-query syntax can't reliably be used inside a _published_ Svelte library's own source — only in first-party app code, which is never subject to that prebundling step. `dimfeld/svelte-maplibre` hits the exact same constraint and documents the identical workaround: the `setWorkerUrl()` call lives in their demo's routes, never inside their own `MapLibre.svelte` component. Hence it stays a consumer-side step here too.

## Interaction options

You can mirror the Maps template `scrollZoomGuard` behaviour by enabling guarded scroll zoom:

```svelte
<Map id="map" style="./style.json" scrollZoomGuard={true} />
```

When enabled, map zoom via wheel/trackpad requires a modifier key (cmd/ctrl) plus scroll.

`scrollZoomGuard` maps to MapLibre `cooperativeGestures` and takes precedence over `options.cooperativeGestures` when both are provided.
