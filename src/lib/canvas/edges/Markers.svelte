<!--
	UML 2.5 marker definitions, rendered once per diagram and referenced by id from every edge.
	userSpaceOnUse: markers keep their size when the stroke changes and scale with zoom like the paper.
	Sizes from docs/spec/ui.md: arrowheads 12, diamonds 14 × 8, triangles 14.
	A marker draws in its definition's colours, not its edge's, so each line colour in use gets its
	own set (`aster-m-arrow-b91c1c`); layout.css turns them back to ink in high contrast.
-->
<script lang="ts">
	let { colours = [] }: { colours?: string[] } = $props();
</script>

{#snippet set(colour?: string)}
	{@const id = (m: string) => `aster-m-${m}${colour ? `-${colour.slice(1)}` : ''}`}
	<g class="uml-paint" style:--line={colour}>
		<marker
			id={id('triangle')}
			markerUnits="userSpaceOnUse"
			markerWidth="16"
			markerHeight="16"
			refX="14"
			refY="7"
			orient="auto-start-reverse"
			overflow="visible"
		>
			<path class="hollow" d="M0,0 L14,7 L0,14 Z" />
		</marker>
		<marker
			id={id('diamond-hollow')}
			markerUnits="userSpaceOnUse"
			markerWidth="16"
			markerHeight="10"
			refX="14"
			refY="4"
			orient="auto-start-reverse"
			overflow="visible"
		>
			<path class="hollow" d="M0,4 L7,0 L14,4 L7,8 Z" />
		</marker>
		<marker
			id={id('diamond-filled')}
			markerUnits="userSpaceOnUse"
			markerWidth="16"
			markerHeight="10"
			refX="14"
			refY="4"
			orient="auto-start-reverse"
			overflow="visible"
		>
			<path class="filled" d="M0,4 L7,0 L14,4 L7,8 Z" />
		</marker>
		<marker
			id={id('arrow')}
			markerUnits="userSpaceOnUse"
			markerWidth="14"
			markerHeight="12"
			refX="12"
			refY="5"
			orient="auto-start-reverse"
			overflow="visible"
		>
			<path class="open" d="M0,0 L12,5 L0,10" />
		</marker>
	</g>
{/snippet}

<svg class="aster-markers" width="0" height="0" aria-hidden="true" focusable="false">
	<defs>
		{@render set()}
		{#each colours as colour (colour)}{@render set(colour)}{/each}
	</defs>
</svg>

<style>
	.aster-markers {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
	}
	path {
		stroke: var(--line, var(--paper-ink));
		stroke-width: var(--uml-stroke);
		stroke-dasharray: none;
		stroke-linejoin: miter;
	}
	.hollow {
		fill: var(--paper-fill);
	}
	.filled {
		fill: var(--line, var(--paper-ink));
	}
	.open {
		fill: none;
	}
</style>
