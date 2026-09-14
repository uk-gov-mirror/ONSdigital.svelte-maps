<script>
  import {
    setContext,
    createEventDispatcher,
    onMount
  } from "svelte";
  import { Map, NavigationControl, GeolocateControl } from "maplibre-gl";
  // Pulls in maplibre-gl's own CSS via whatever the consumer's bundler uses
  // to handle CSS imports (Vite, webpack, etc.) — no runtime CDN fetch, and
  // always matches whatever maplibre-gl version the consumer has installed.
  import "maplibre-gl/dist/maplibre-gl.css";

  // MapLibre GL JS resolves its tile-processing worker script relative to its
  // own module URL by default (same-origin only — the Worker constructor
  // rejects a cross-origin script URL regardless of CORS headers, so this
  // can't be pointed at a CDN). Whatever build produces the final bundle must
  // ensure maplibre-gl-worker.mjs is copied alongside it; see rollup configs.

  const dispatch = createEventDispatcher();

  export let map;
  export let id = "map";
  export let location = {
    lng: 15,
    lat: 45,
    zoom: 1,
  };
  export let style = {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: { "background-color": "lightgrey" },
      },
    ],
  }; // Can be a json style definition or a url
  export let options = {};
  export let minzoom = 0;
  export let maxzoom = 14;
  export let controls = false;
  export let tabbable = false;
  export let scrollZoomGuard = null;

  export let zoom = null;
  export let center = null;
  export let pitch = null;
  export let bearing = null;
  export let interactive = true;
  export let attribution = true;
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
      ..._options,
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
          visualizePitch: controls.includes("pitch"),
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
        event: e,
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
        style,
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