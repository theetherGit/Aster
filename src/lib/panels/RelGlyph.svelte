<script lang="ts">
	import { markersFor } from '#lib/canvas/edges/notation.ts';
	import type { Relationship } from '#lib/model/types.ts';

	// The relationship's notation in miniature, drawn with the canvas's own rules (notation.ts):
	// the line, dashed or not, and the marker at each end. Decorative: the row's text says the rest.
	let { rel }: { rel: Relationship } = $props();
	const n = $derived(markersFor(rel));
	// Markers drawn pointing right, at x = 0; the line runs between the two ends.
	const HEAD: Record<string, { d: string; fill: boolean; len: number }> = {
		triangle: { d: 'M0,1 L9,6 L0,11 Z', fill: false, len: 9 },
		arrow: { d: 'M0,1 L8,6 L0,11', fill: false, len: 0 },
		'diamond-hollow': { d: 'M0,6 L5,2 L10,6 L5,10 Z', fill: false, len: 10 },
		'diamond-filled': { d: 'M0,6 L5,2 L10,6 L5,10 Z', fill: true, len: 10 }
	};
	const start = $derived(n.start ? HEAD[n.start] : null);
	const end = $derived(n.end ? HEAD[n.end] : null);
</script>

<svg class="rel-glyph" width="44" height="12" viewBox="0 0 44 12" aria-hidden="true">
	<line
		x1={start ? start.len : 0}
		y1="6"
		x2={end ? 44 - end.len : 44}
		y2="6"
		stroke-dasharray={n.dashed ? '4 3' : undefined}
	/>
	{#if start}
		<path
			d={start.d}
			class:filled={start.fill}
			transform="translate({start.len} 0) rotate(180 0 6)"
		/>
	{/if}
	{#if end}
		<path d={end.d} class:filled={end.fill} transform="translate({44 - end.len} 0)" />
	{/if}
</svg>

<style>
	.rel-glyph {
		flex-shrink: 0;
		color: var(--chrome-text);
	}
	line,
	path {
		fill: none;
		stroke: currentColor;
		stroke-width: 1.25;
		stroke-linejoin: round;
	}
	.filled {
		fill: currentColor;
	}
</style>
