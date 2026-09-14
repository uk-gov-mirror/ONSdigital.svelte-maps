import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import adapter from "@sveltejs/adapter-static";

// Project-page base path for GitHub Pages (onsdigital.github.io/svelte-maps/).
// Vite sets NODE_ENV to 'production' for `vite build`/`vite preview` and
// 'development' for `vite dev` automatically. No trailing slash: SvelteKit's
// default trailingSlash:'never' means a trailing slash here double-slashes
// every generated URL.
const base = process.env.NODE_ENV === "production" ? "/svelte-maps" : "";

export default defineConfig({
	plugins: [
		sveltekit({
			// Deliberately NOT setting compilerOptions.runes here. Svelte 5's
			// default per-file auto-detection (legacy syntax -> legacy mode,
			// runes syntax -> runes mode) is what we want: the four published
			// components in src/lib use legacy syntax throughout (export let,
			// $:, <slot>, createEventDispatcher), which stays fully supported
			// under Svelte 5 as long as runes mode isn't forced. Forcing
			// runes:true (as some scaffolds do) is a hard compile error
			// against export let.
			adapter: adapter(),
			paths: { base }
		})
	]
});
