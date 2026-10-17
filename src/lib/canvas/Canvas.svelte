<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		SvelteFlow,
		useSvelteFlow,
		type NodeTargetEventWithPointer,
		type OnMove,
		type OnSelectionChange
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { moveNode } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { ClassifierKind } from '#lib/model/types.ts';
	import { flow, type ClassifierFlowNode } from '#lib/stores/flow.svelte.ts';
	import { layout } from '#lib/stores/layout.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import ClassifierNode from './ClassifierNode.svelte';
	import { createClassifierAt } from './actions.ts';
	import { canvasFocus } from './focus.ts';
	import { handleCanvasKey } from './keyboard.ts';

	const nodeTypes = {
		class: ClassifierNode,
		interface: ClassifierNode,
		enum: ClassifierNode,
		dataType: ClassifierNode
	};
	const { screenToFlowPosition, getInternalNode } = useSvelteFlow();

	// Derived nodes are fresh objects after every command. Without `measured`, Svelte Flow
	// resets them and hides each node until it re-measures, which flickers and drops focus.
	// Hand back its own last measurement as a hint: view-only, never model state. Content
	// that changes size is re-measured by Svelte Flow's ResizeObserver as usual.
	const nodes = $derived(
		flow.canvasNodes.map((n) => {
			const m = getInternalNode(n.id)?.measured;
			return m?.width && m.height ? { ...n, measured: { width: m.width, height: m.height } } : n;
		})
	);

	let el: HTMLDivElement;
	let pointer: { x: number; y: number } | null = null;

	$effect(() => {
		canvasFocus.el = el;
		el.focus();
		return () => {
			canvasFocus.el = null;
		};
	});

	function toPaper(screen: { x: number; y: number }) {
		const p = screenToFlowPosition(screen);
		return { x: Math.round(p.x), y: Math.round(p.y) };
	}

	/** Paper position under the pointer, or the viewport centre when the pointer is elsewhere. */
	function cursorPosition() {
		if (pointer) return toPaper(pointer);
		const r = el.getBoundingClientRect();
		return toPaper({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
	}

	// Svelte Flow moves its own copy of the nodes while dragging; the model follows through
	// coalesced moveNode commands, and the derived nodes replace Svelte Flow's copy.
	const onnodedrag: NodeTargetEventWithPointer<MouseEvent | TouchEvent, ClassifierFlowNode> = ({
		targetNode,
		nodes
	}) => {
		if (!targetNode) return;
		const l = layout.node(targetNode.id);
		const dx = Math.round(targetNode.position.x) - l.x;
		const dy = Math.round(targetNode.position.y) - l.y;
		if (!dx && !dy) return;
		projectStore.run(moveNode, {
			diagramId: projectStore.activeDiagramId,
			ids: nodes.map((n) => n.id),
			dx,
			dy
		});
	};

	const onselectionchange: OnSelectionChange<ClassifierFlowNode> = ({ nodes }) => {
		selection.set(nodes.map((n) => n.id));
	};

	const onmove: OnMove = (_event, viewport) => {
		ui.zoom = viewport.zoom;
	};

	function onpaneclick({ event }: { event: MouseEvent | TouchEvent }) {
		if (
			ui.tool === 'select' ||
			ui.tool === 'package' ||
			ui.tool === 'link' ||
			!('clientX' in event)
		)
			return;
		createClassifierAt(ui.tool, toPaper({ x: event.clientX, y: event.clientY }));
		ui.tool = 'select';
	}
</script>

<!-- One Tab stop for the whole diagram (docs/spec/keyboard.md, accessibility.md): a focusable
     role="application" region whose keys the app routes. Not a fake button, so the
     non-interactive-element warnings do not apply. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={el}
	class="aster-canvas"
	role="application"
	aria-label={t('ui.canvas')}
	tabindex="0"
	onkeydown={(e) =>
		handleCanvasKey(e, (kind: ClassifierKind) => createClassifierAt(kind, cursorPosition()))}
	onpointermove={(e) => (pointer = { x: e.clientX, y: e.clientY })}
	onpointerleave={() => (pointer = null)}
>
	<SvelteFlow
		{nodes}
		edges={flow.edges}
		{nodeTypes}
		snapGrid={[1, 1]}
		minZoom={0.1}
		maxZoom={4}
		deleteKey={null}
		selectionKey={null}
		selectionOnDrag
		panOnDrag={[1]}
		panOnScroll
		zoomOnScroll={false}
		zoomOnDoubleClick={false}
		nodesFocusable={false}
		disableKeyboardA11y
		nodesConnectable={false}
		{onnodedrag}
		{onselectionchange}
		{onmove}
		{onpaneclick}
	>
		<Background
			variant={BackgroundVariant.Dots}
			bgColor="var(--paper-bg)"
			patternColor="var(--paper-grid)"
			gap={20}
			size={1.5}
		/>
	</SvelteFlow>
</div>

<style>
	.aster-canvas {
		position: absolute;
		inset: 0;
	}
	.aster-canvas:focus-visible {
		outline: 2px dashed var(--accent);
		outline-offset: -5px;
	}
	.aster-canvas :global(.svelte-flow__selection) {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border: 1px dashed var(--accent);
	}
	.aster-canvas :global(.svelte-flow__node) {
		cursor: grab;
	}
	.aster-canvas :global(.svelte-flow__node.dragging) {
		cursor: grabbing;
	}
</style>
