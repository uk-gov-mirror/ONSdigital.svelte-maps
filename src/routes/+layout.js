// The demo mounts maplibre-gl (WebGL/canvas), which cannot run during SSR
// prerendering. Prerender a static shell and hydrate purely client-side —
// the standard SvelteKit pattern for canvas/WebGL-heavy pages, and required
// for adapter-static, which needs at least one prerenderable page.
export const prerender = true;
export const ssr = false;
