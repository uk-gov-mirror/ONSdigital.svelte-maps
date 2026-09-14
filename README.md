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

**1. Copy the worker script into your own static assets**, e.g. as a `postinstall`/prebuild script (adapt paths to your bundler):

```js
// copy-maplibre-worker.js — run before `vite dev` / `vite build`
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "node_modules", "maplibre-gl", "dist");
const outDir = join(here, "static", "maplibre"); // or `public/maplibre` etc.

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

for (const name of [
	"maplibre-gl-worker.mjs",
	"maplibre-gl-worker.mjs.map",
	"maplibre-gl-shared.mjs", // the worker's own nested import — must sit alongside it
	"maplibre-gl-shared.mjs.map"
]) {
	const src = join(srcDir, name);
	if (existsSync(src)) copyFileSync(src, join(outDir, name));
}
```

**2. Call `setWorkerUrl()` pointing at that same-origin path, before mounting any `<Map>`:**

```js
import { setWorkerUrl } from "maplibre-gl";
setWorkerUrl("/maplibre/maplibre-gl-worker.mjs"); // prefix with your app's base path if it has one
```

This repo's own demo does exactly this — see `scripts/copy-maplibre-worker.js` (run before both `vite dev` and `vite build`) and the top of `src/routes/+page.svelte` for a worked reference.

**Faster unblock for `vite dev` only, if you haven't wired up the above yet:** the same underlying issue can surface as `The file does not exist at ".../node_modules/.vite/deps/maplibre-gl-worker.mjs" which is in the optimize deps directory` — this happens because Vite's dev-server dependency optimizer pre-bundles `maplibre-gl` by default, which relocates it and breaks its self-relative worker lookup. Excluding it from that optimizer avoids the relocation entirely:

```js
// vite.config.js
export default defineConfig({
	optimizeDeps: { exclude: ["maplibre-gl"] }
});
```

This fixes `vite dev` on its own, but **not** a production build (Rollup chunks/hashes maplibre-gl the same way) — steps 1–2 above are still required before deploying.

### Why this isn't handled automatically

We tried baking this into `Map.svelte` itself via Vite's `?worker&url` import syntax, which would have needed zero consumer-side config. It works when tested inside this repo's own demo — but breaks a real npm-installed consumer outright: `@sveltejs/vite-plugin-svelte` prebundles library `.svelte` files by default (`prebundleSvelteLibraries`), and Vite's worker-query plugin isn't part of that prebundling pipeline, so `vite dev` crashes before it even starts (`UNLOADABLE_DEPENDENCY ... Could not load node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url`). Special Vite import-query syntax can't reliably be used inside a _published_ Svelte library's own source — only in first-party app code, which is never subject to that prebundling step. Hence the copy-script + `setWorkerUrl()` pattern above stays a consumer-side step.

## Interaction options

You can mirror the Maps template `scrollZoomGuard` behaviour by enabling guarded scroll zoom:

```svelte
<Map id="map" style="./style.json" scrollZoomGuard={true} />
```

When enabled, map zoom via wheel/trackpad requires a modifier key (cmd/ctrl) plus scroll.

`scrollZoomGuard` maps to MapLibre `cooperativeGestures` and takes precedence over `options.cooperativeGestures` when both are provided.
