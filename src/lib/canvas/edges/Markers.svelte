<!--
	UML 2.5 marker definitions, rendered once per diagram and referenced by id from every edge.
	userSpaceOnUse: markers keep their size when the stroke changes and scale with zoom like the paper.
	Sizes from docs/spec/ui.md: arrowheads 12, diamonds 14 × 8, triangles 14.
-->
<svg class="aster-markers" width="0" height="0" aria-hidden="true" focusable="false">
	<defs>
		<marker
			id="aster-m-triangle"
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
			id="aster-m-diamond-hollow"
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
			id="aster-m-diamond-filled"
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
			id="aster-m-arrow"
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
		stroke: var(--paper-ink);
		stroke-width: var(--uml-stroke);
		stroke-dasharray: none;
		stroke-linejoin: miter;
	}
	.hollow {
		fill: var(--paper-fill);
	}
	.filled {
		fill: var(--paper-ink);
	}
	.open {
		fill: none;
	}
</style>
