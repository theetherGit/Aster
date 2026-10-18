<script lang="ts">
	import { useInternalNode, type EdgeProps, type InternalNode } from '@xyflow/svelte';
	import type { NoteLinkFlowEdge } from '#lib/stores/flow.svelte.ts';
	import { pathD, route, type Rect } from './geometry.ts';

	// A note link (UML 2.5): dashed, no arrowhead, border to border. View-only, never selectable.
	let { source, target }: EdgeProps<NoteLinkFlowEdge> = $props();
	// svelte-ignore state_referenced_locally
	const sourceNode = useInternalNode(source);
	// svelte-ignore state_referenced_locally
	const targetNode = useInternalNode(target);
	const rectOf = (n: InternalNode | undefined): Rect | null => {
		const w = n?.measured.width;
		const h = n?.measured.height;
		return n && w && h
			? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w, h }
			: null;
	};
	const src = $derived(rectOf(sourceNode.current));
	const tgt = $derived(rectOf(targetNode.current));
	const d = $derived(
		src && tgt ? pathD(route(src, tgt, [], 'oblique', false).points, 'oblique') : ''
	);
</script>

{#if d}
	<svg class="note-link" aria-hidden="true">
		<path {d} />
	</svg>
{/if}

<style>
	.note-link {
		position: absolute;
		top: 0;
		left: 0;
		overflow: visible;
		pointer-events: none;
	}
	.note-link path {
		fill: none;
		stroke: var(--paper-ink);
		stroke-width: var(--uml-stroke);
		stroke-dasharray: 6 4;
	}
</style>
