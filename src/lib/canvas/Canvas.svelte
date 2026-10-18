<script lang="ts">
	import {
		Background,
		BackgroundVariant,
		ConnectionLineType,
		ConnectionMode,
		SvelteFlow,
		ViewportPortal,
		useSvelteFlow,
		type InternalNode,
		type NodeTargetEventWithPointer,
		type OnConnectEnd,
		type OnMove,
		type OnSelectionChange
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { untrack } from 'svelte';
	import { moveNode } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { ClassifierKind, Id } from '#lib/model/types.ts';
	import {
		flow,
		type ClassifierFlowNode,
		type RelationshipFlowEdge
	} from '#lib/stores/flow.svelte.ts';
	import { layout } from '#lib/stores/layout.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import ClassifierNode from './ClassifierNode.svelte';
	import { createClassifierAt } from './actions.ts';
	import Markers from './edges/Markers.svelte';
	import UmlEdge from './edges/UmlEdge.svelte';
	import { center, type Rect } from './edges/geometry.ts';
	import { canvasFocus } from './focus.ts';
	import { handleCanvasKey } from './keyboard.ts';

	const nodeTypes = {
		class: ClassifierNode,
		interface: ClassifierNode,
		enum: ClassifierNode,
		dataType: ClassifierNode,
		primitiveType: ClassifierNode
	};
	const edgeTypes = { uml: UmlEdge };
	const { screenToFlowPosition, flowToScreenPosition, getInternalNode } = useSvelteFlow();

	// Derived nodes are fresh objects after every command. Without `measured`, Svelte Flow
	// resets them and hides each node until it re-measures, which flickers and drops focus.
	// Hand back its own last measurement as a hint: view-only, never model state. Content
	// that changes size is re-measured by Svelte Flow's ResizeObserver as usual.
	// Read untracked: subscribing to Svelte Flow's internals here would re-derive on every
	// internal update (handle bounds included) and loop.
	const nodes = $derived(
		flow.canvasNodes.map((n) => {
			const m = untrack(() => getInternalNode(n.id)?.measured);
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

	const rectOf = (n: InternalNode | undefined): Rect | null => {
		const w = n?.measured.width;
		const h = n?.measured.height;
		return n && w && h
			? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w, h }
			: null;
	};
	/** Rendered rectangles of the nodes on the diagram, for keyboard targeting. */
	function rects(): Map<Id, Rect> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built per call, never observed
		const out = new Map<Id, Rect>();
		for (const n of flow.nodes) {
			const r = rectOf(getInternalNode(n.id));
			if (r) out.set(n.id, r);
		}
		return out;
	}
	/** Open the relationship picker over the target node's centre. */
	function openPicker(sourceId: Id, targetId: Id) {
		const r = rects().get(targetId);
		if (!r) return;
		const p = flowToScreenPosition(center(r));
		ui.picker = { sourceId, targetId, x: p.x, y: p.y };
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

	const onselectionchange: OnSelectionChange<ClassifierFlowNode, RelationshipFlowEdge> = ({
		nodes,
		edges
	}) => {
		selection.set([...nodes.map((n) => n.id), ...edges.map((e) => e.id)]);
	};

	const onmove: OnMove = (_event, viewport) => {
		ui.zoom = viewport.zoom;
	};

	// A connection dropped on a node (its body or a handle, the source included) opens the
	// picker at the drop point; Svelte Flow never adds the edge itself.
	const onconnectend: OnConnectEnd = (event, state) => {
		const from = state.fromNode?.id;
		const p = 'changedTouches' in event ? event.changedTouches[0] : event;
		if (!from || !p) return;
		const hit = document.elementFromPoint(p.clientX, p.clientY)?.closest('.svelte-flow__node');
		const to = hit?.getAttribute('data-id');
		if (to) ui.picker = { sourceId: from, targetId: to, x: p.clientX, y: p.clientY };
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

	/** Link preview: source centre to target centre, in paper space. */
	const preview = $derived.by(() => {
		if (!ui.link) return null;
		void flow.nodes;
		const r = rects();
		const a = r.get(ui.link.sourceId);
		const b = r.get(ui.link.targetId);
		return a && b && ui.link.sourceId !== ui.link.targetId ? { a: center(a), b: center(b) } : null;
	});
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
		handleCanvasKey(e, {
			create: (kind: ClassifierKind) => createClassifierAt(kind, cursorPosition()),
			rects,
			openPicker
		})}
	onpointermove={(e) => (pointer = { x: e.clientX, y: e.clientY })}
	onpointerleave={() => (pointer = null)}
>
	<Markers />
	<SvelteFlow
		{nodes}
		edges={flow.canvasEdges}
		{nodeTypes}
		{edgeTypes}
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
		edgesFocusable={false}
		disableKeyboardA11y
		connectionMode={ConnectionMode.Loose}
		connectionLineType={ConnectionLineType.Straight}
		onbeforeconnect={() => false}
		{onconnectend}
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
		{#if preview}
			<ViewportPortal target="front">
				<svg class="link-preview" aria-hidden="true">
					<line x1={preview.a.x} y1={preview.a.y} x2={preview.b.x} y2={preview.b.y} />
				</svg>
			</ViewportPortal>
		{/if}
	</SvelteFlow>
	{#if ui.link}
		<p class="link-hint" role="status">{t('link.hint')}</p>
	{/if}
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
	/* Connection previews are the one other place the accent appears on paper (ui.md). */
	.aster-canvas :global(.svelte-flow__connection-path) {
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
	}
	.link-preview {
		position: absolute;
		overflow: visible;
		width: 1px;
		height: 1px;
		pointer-events: none;
	}
	.link-preview line {
		stroke: var(--accent);
		stroke-width: 1.5;
		stroke-dasharray: 6 4;
	}
	.link-hint {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10;
		margin: 0;
		padding: 4px 12px;
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: 6px;
		box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
	}
</style>
