import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

// MapLibre GL JS resolves its tile-processing worker script relative to its
// own module URL by default. Since our Rollup output bundles maplibre-gl
// into a single dist/build/bundle.js, that default resolution would look for
// a worker script sitting next to bundle.js — so copy the worker file
// maplibre-gl ships as a separate dist asset to that location. (A CDN URL
// won't work here: Worker construction requires a same-origin script URL,
// regardless of CORS headers.)
//
// The worker script itself imports maplibre-gl-shared.mjs as a sibling
// module (`import ... from './maplibre-gl-shared.mjs'`), so that file has
// to be copied alongside it too, or the worker fails to load with a
// same-origin 404 on that nested import.
export default function copyMaplibreWorker() {
	return {
		name: 'copy-maplibre-worker',
		writeBundle(options) {
			const outDir = dirname(options.file);
			const srcDir = join('node_modules', 'maplibre-gl', 'dist');
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
		}
	};
}
