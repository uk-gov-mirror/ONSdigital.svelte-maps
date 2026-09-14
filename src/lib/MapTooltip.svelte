<script>
  import { getContext, onDestroy } from 'svelte';
  import { Popup } from 'maplibre-gl';

  /** HTML/text shown in the popup while a feature is hovered on the parent `<MapLayer>` (which must have `hover={true}`). Reactive — updates the open popup as it changes. @type {string} */
  export let content;

  const tooltip = new Popup({
		closeButton: false,
		closeOnClick: false
	});

  const { getMap } = getContext('map');
	const map = getMap();
  const hoverObj = getContext('hover');

  function updateTooltip(obj, content) {
    if (obj.id) {
      tooltip
			.setLngLat(obj.event.lngLat)
      .setHTML(content ? content : obj.code)
      .addTo(map);
    } else {
      tooltip.remove();
    }
  }

  $: updateTooltip($hoverObj, content);

  onDestroy(() => tooltip.remove());
</script>

<style>
  :global(.maplibregl-popup-content) {
		padding: 5px 10px !important;
	}
</style>