import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// MapLibre GL JS resolves its tile-processing worker script relative to its
// own bundled module URL by default — a resolution strategy that breaks
// under any bundler that chunks/hashes maplibre-gl's output (Vite dev's
// esbuild pre-bundling, SvelteKit's hashed client chunks, etc.).
//
// Instead of relying on that default resolution, copy the worker script and
// its nested `./maplibre-gl-shared.mjs` import into a fixed, known static
// path, and point maplibre-gl at it explicitly via the library's own public
// setWorkerUrl() API (see src/routes/+page.svelte). This sidesteps bundler
// chunking entirely — dev and prod behave identically because neither one's
// worker-loading behavior depends on how the main maplibre-gl bundle is
// chunked.
const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'node_modules', 'maplibre-gl', 'dist');
const outDir = join(here, '..', 'static', 'maplibre');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

for (const name of [
	'maplibre-gl-worker.mjs',
	'maplibre-gl-worker.mjs.map',
	'maplibre-gl-shared.mjs',
	'maplibre-gl-shared.mjs.map'
]) {
	const src = join(srcDir, name);
	if (existsSync(src)) copyFileSync(src, join(outDir, name));
}
