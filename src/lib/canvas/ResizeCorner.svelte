<script lang="ts">
	import type { Id } from '#lib/model/types.ts';
	import { resizeTo } from './actions.ts';
	import { dragSize, type Size } from './resize.ts';

	// The corner handle every box shares (packages, notes, classes, objects): a 24 px target round
	// the 6 px corner (CLAUDE.md rule 4), on the selected box and the one under the pointer. Pointer
	// only; ⇧+arrows and the inspector's Size are the keyboard paths (accessibility.md). One resize
	// runs when the pointer lets go.
	let {
		id,
		shown,
		from,
		min,
		onlive
	}: {
		id: Id;
		shown: boolean;
		/** The box's size as drawn when the drag starts. */
		from: () => Size;
		min: Size;
		/** The size while dragging, for the box to draw; null when the pointer lets go. */
		onlive: (s: Size | null) => void;
	} = $props();
</script>

<span
	class="nodrag nopan resize"
	class:shown
	aria-hidden="true"
	onpointerdown={(e) =>
		dragSize(e, from(), min, onlive, (s) => {
			onlive(null);
			if (s) resizeTo(id, s);
		})}><span class="corner"></span></span
>

<style>
	.resize {
		position: absolute;
		right: -12px;
		bottom: -12px;
		width: 24px;
		height: 24px;
		cursor: nwse-resize;
		opacity: 0;
	}
	.resize.shown,
	:global(.svelte-flow__node:hover) .resize {
		opacity: 1;
	}
	/* Board 01/13, ui.md: the hollow 6 px corner handle, centred on the corner. */
	.corner {
		position: absolute;
		top: 9px;
		left: 9px;
		box-sizing: border-box;
		width: 6px;
		height: 6px;
		background: var(--paper-bg);
		border: 1.5px solid var(--paper-accent);
	}
</style>
