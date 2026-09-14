<script context="module">
	// MapLibre GL JS resolves its tile-processing worker script relative to its
	// own module URL by default. This is a Vite-only fix that allows workers to
    // run correctly in both dev and build without app-level config.
	import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
	import { setWorkerUrl } from "maplibre-gl";
	setWorkerUrl(workerUrl);
</script>

<script>
	import { setContext, createEventDispatcher, onMount } from "svelte";
	import { Map, NavigationControl, GeolocateControl } from "maplibre-gl";
	// Pulls in maplibre-gl's own CSS via whatever the consumer's bundler uses
	// to handle CSS imports (Vite, webpack, etc.) — no runtime CDN fetch, and
	// always matches whatever maplibre-gl version the consumer has installed.
	import "maplibre-gl/dist/maplibre-gl.css";

	const dispatch = createEventDispatcher();

	/** The MapLibre GL `Map` instance. Bindable — starts `undefined`, set internally once the map is created on mount. @type {import('maplibre-gl').Map} */
	export let map;
	/** DOM id given to the map's container `<div>`. @type {string} */
	export let id = "map";
	/**
	 * Initial camera position. Either `{ bounds }` (a `[[sw],[ne]]` LngLat pair)
	 * or `{ lng, lat, zoom, pitch?, bearing? }`. Only read on mount — use the
	 * bindable `zoom`/`center`/`pitch`/`bearing` props to read/drive the camera
	 * afterwards.
	 * @type {{ bounds?: [[number, number], [number, number]], lng?: number, lat?: number, zoom?: number, pitch?: number, bearing?: number }}
	 */
	export let location = {
		lng: 15,
		lat: 45,
		zoom: 1
	};
	/** MapLibre style spec object, or a URL to one. Reactive — reassigning triggers `setStyle`. @type {object | string} */
	export let style = {
		version: 8,
		sources: {},
		layers: [
			{
				id: "background",
				type: "background",
				paint: { "background-color": "lightgrey" }
			}
		]
	}; // Can be a json style definition or a url
	/** Extra MapLibre `MapOptions` merged into the options derived from `location`/`attribution`/`scrollZoomGuard`. @type {object} */
	export let options = {};
	/** Minimum allowed zoom level. @type {number} */
	export let minzoom = 0;
	/** Maximum allowed zoom level. @type {number} */
	export let maxzoom = 14;
	/** Which navigation controls to add: `true` for the default zoom buttons, or an array including `"compass"`/`"pitch"`/`"locate"`. @type {boolean | string[]} */
	export let controls = false;
	/** Whether the map canvas can receive keyboard focus via Tab. @type {boolean} */
	export let tabbable = false;
	/** When `true`/`false`, maps to MapLibre's `cooperativeGestures` (scroll-to-zoom requires cmd/ctrl); overrides `options.cooperativeGestures` when both are set. `null` leaves the default behaviour untouched. @type {boolean | null} */
	export let scrollZoomGuard = null;

	/** Current zoom level. Bindable — read after `load`/`moveend`, or set to move the camera. @type {number | null} */
	export let zoom = null;
	/** Current map center. Bindable, same read/write behaviour as `zoom`. @type {import('maplibre-gl').LngLat | null} */
	export let center = null;
	/** Current pitch (tilt), in degrees. Bindable, same read/write behaviour as `zoom`. @type {number | null} */
	export let pitch = null;
	/** Current bearing (rotation), in degrees. Bindable, same read/write behaviour as `zoom`. @type {number | null} */
	export let bearing = null;
	/** Whether the map responds to user interaction (pan/zoom/rotate). @type {boolean} */
	export let interactive = true;
	/** Whether to show the default MapLibre attribution control. @type {boolean} */
	export let attribution = true;
	/** Accessible label (`aria-label`) applied to the map canvas. @type {string} */
	export let mapDescription = "Map";

	let container;
	let _options = {};
	let loaded = false;

	setContext("map", { getMap: () => map });

	function sleep(ms = 1000) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	function updateLocation() {
		if (typeof map?.getZoom === "function") {
			zoom = map.getZoom();
			center = map.getCenter();
			pitch = map.getPitch();
			bearing = map.getBearing();
		}
	}

	// Function to update zoom button labels
	function updateZoomButtonLabels() {
		const zoomInButton = container.querySelector(".maplibregl-ctrl-zoom-in");
		if (zoomInButton) {
			zoomInButton.setAttribute("aria-label", "Zoom in on map");
			zoomInButton.title = "Zoom in on map";
		}

		const zoomOutButton = container.querySelector(".maplibregl-ctrl-zoom-out");
		if (zoomOutButton) {
			zoomOutButton.setAttribute("aria-label", "Zoom out on map");
			zoomOutButton.title = "Zoom out on map";
		}
	}

	// Interpret location
	if (location.bounds) {
		_options.bounds = location.bounds;
	} else if (location.lng && location.lat) {
		_options.center = [+location.lng, +location.lat];
		if (location.zoom) {
			_options.zoom = +location.zoom;
		}
		if (location.pitch) {
			_options.pitch = +location.pitch;
		}
		if (location.bearing) {
			_options.bearing = +location.bearing;
		}
	}
	// Disable attribution if attribution = false
	if (!attribution) {
		_options.attributionControl = false;
	}

	_options = { ..._options, ...options }; // Combine core options + custom user options
	if (typeof scrollZoomGuard === "boolean") {
		_options.cooperativeGestures = scrollZoomGuard;
	}

	onMount(() => {
		const newmap = new Map({
			container,
			style,
			minZoom: minzoom,
			maxZoom: maxzoom,
			interactive,
			..._options
		});

		map = newmap;

		const canvas = container.querySelector("canvas");
		if (canvas) {
			canvas.removeAttribute("role");
			canvas.setAttribute("aria-label", mapDescription);
		}

		if (controls && !Array.isArray(controls)) {
			map.addControl(new NavigationControl({ showCompass: false }));
		} else if (Array.isArray(controls) && controls != ["locate"]) {
			map.addControl(
				new NavigationControl({
					showCompass: controls.includes("compass"),
					visualizePitch: controls.includes("pitch")
				})
			);
		}

		if (Array.isArray(controls) && controls.includes("locate")) {
			map.addControl(new GeolocateControl());
		}

		// Get initial zoom level
		map.on("load", (e) => {
			updateLocation();
			loaded = true;

			// Prevent map from being tabbable
			if (!tabbable && document.querySelector(`#${id} canvas`)) {
				document.querySelector(`#${id} canvas`).tabIndex = "-1";
			}

			// Check for the button after the map is fully loaded
			updateZoomButtonLabels();

			dispatch("load", {
				event: e
			});
		});

		// Update zoom level and center when the view changes
		map.on("moveend", updateLocation);

		return async () => {
			await sleep(100);
			newmap.remove();
		};
	});

	// Function to switch map style if style prop changes
	async function setStyle(style) {
		if (map) {
			loaded = false;
			map.setStyle(style);
			map.once("idle", () => {
				loaded = true;
			});
			dispatch("style", {
				style
			});
		}
	}
	$: setStyle(style);
</script>

<div bind:this={container} {id} class="map">
	{#if loaded}
		<slot />
	{/if}
</div>

<style>
	:global(.maplibregl-control-container button) {
		margin: 0;
	}

	:global(.maplibregl-ctrl-group button:focus) {
		box-shadow:
			0 0 1px var(--ons-color-input-border, #222),
			0 0 0 4px var(--ons-color-focus, #fbc900) !important;
	}

	.map {
		width: 100%;
		height: 100%;
	}
</style>
