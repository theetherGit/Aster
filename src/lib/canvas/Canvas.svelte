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
	import { prefersReducedMotion } from 'svelte/motion';
	import { linkNote, moveNode } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { ClassifierKind, Id } from '#lib/model/types.ts';
	import { flow, type FlowEdge, type FlowNode } from '#lib/stores/flow.svelte.ts';
	import { layout } from '#lib/stores/layout.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import ClassifierNode from './ClassifierNode.svelte';
	import NoteNode from './NoteNode.svelte';
	import NoteLinkEdge from './edges/NoteLinkEdge.svelte';
	import { createClassifierAt, createNoteAt, createTextAt, startLink } from './actions.ts';
	import Markers from './edges/Markers.svelte';
	import UmlEdge from './edges/UmlEdge.svelte';
	import { center, type Rect } from './edges/geometry.ts';
	import { canvasApi } from './api.ts';
	import { canvasFocus, canvasRects } from './focus.ts';
	import { handleCanvasKey } from './keyboard.ts';

	const nodeTypes = {
		class: ClassifierNode,
		interface: ClassifierNode,
		enum: ClassifierNode,
		dataType: ClassifierNode,
		primitiveType: ClassifierNode,
		note: NoteNode,
		text: NoteNode
	};
	const edgeTypes = { uml: UmlEdge, noteLink: NoteLinkEdge };
	const {
		screenToFlowPosition,
		flowToScreenPosition,
		getInternalNode,
		getZoom,
		setZoom,
		fitView,
		fitBounds
	} = useSvelteFlow();

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

	/** Zoom and fit animate unless the reader asked for less motion. */
	const dur = (ms: number) => (prefersReducedMotion.current ? 0 : ms);
	let el: HTMLDivElement;
	let pointer: { x: number; y: number } | null = null;

	$effect(() => {
		canvasFocus.el = el;
		canvasRects.get = rects;
		// What commands outside the canvas (palette, shortcuts) can ask of it.
		Object.assign(canvasApi, {
			create: (kind: ClassifierKind) =>
				createClassifierAt(kind, cursorPosition(), rects().values()),
			createNote: () => createNoteAt(cursorPosition(), rects().values()),
			createText: () => createTextAt(cursorPosition(), rects().values()),
			startLink: () => startLink(rects()),
			zoomBy: (f: number) =>
				setZoom(Math.min(4, Math.max(0.1, getZoom() * f)), { duration: dur(120) }),
			zoomTo: (z: number) => setZoom(z, { duration: dur(120) }),
			fitAll: () => fitView({ padding: 0.1, duration: dur(200) }),
			fitSelection: () => {
				const r = rects();
				const boxes = selection.list.map((id) => r.get(id)).filter((b): b is Rect => !!b);
				if (!boxes.length) return;
				const x = Math.min(...boxes.map((b) => b.x));
				const y = Math.min(...boxes.map((b) => b.y));
				const x2 = Math.max(...boxes.map((b) => b.x + b.w));
				const y2 = Math.max(...boxes.map((b) => b.y + b.h));
				fitBounds({ x, y, width: x2 - x, height: y2 - y }, { padding: 0.2, duration: dur(200) });
			},
			rects
		} satisfies Partial<typeof canvasApi>);
		el.focus();
		return () => {
			canvasFocus.el = null;
			canvasRects.get = () => new Map();
		};
	});

	function toPaper(screen: { x: number; y: number }) {
		const p = screenToFlowPosition(screen);
		return { x: Math.round(p.x), y: Math.round(p.y) };
	}

	/**
	 * Paper position under the pointer, or the viewport centre when the pointer is elsewhere.
	 * The pointer is tracked on the window and tested against the canvas rectangle: an overlay
	 * (a menu, a dialog) opening under the mouse must not make the canvas forget where it was.
	 */
	function cursorPosition() {
		const r = el.getBoundingClientRect();
		if (
			pointer &&
			pointer.x >= r.left &&
			pointer.x <= r.right &&
			pointer.y >= r.top &&
			pointer.y <= r.bottom
		)
			return toPaper(pointer);
		return toPaper({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
	}

	const rectOf = (n: InternalNode | undefined): Rect | null => {
		const w = n?.measured.width;
		const h = n?.measured.height;
		return n && w && h
			? { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w, h }
			: null;
	};
	/**
	 * Rectangles of the nodes on the diagram, for keyboard targeting, placement and export: as
	 * rendered, or from the layout for a node Svelte Flow has not measured yet (just created).
	 */
	function rects(): Map<Id, Rect> {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- built per call, never observed
		const out = new Map<Id, Rect>();
		for (const n of flow.nodes) {
			const r = rectOf(getInternalNode(n.id));
			if (r) out.set(n.id, r);
			else {
				const l = layout.map.get(n.id);
				if (l?.kind === 'node') out.set(n.id, { x: l.x, y: l.y, w: l.w, h: l.h });
			}
		}
		return out;
	}
	/** Open the relationship picker over the target node's centre; a note at either end links instead. */
	function openPicker(sourceId: Id, targetId: Id) {
		if (linkIfNote(sourceId, targetId)) return;
		const r = rects().get(targetId);
		if (!r) return;
		const p = flowToScreenPosition(center(r));
		ui.picker = { sourceId, targetId, x: p.x, y: p.y };
	}
	/** Note links have no kinds (UML): a connection touching a note is made on the spot. */
	function linkIfNote(a: Id, b: Id): boolean {
		const kind = (id: Id) => projectStore.project.elements.get(id)?.kind;
		const noteId = kind(a) === 'note' ? a : kind(b) === 'note' ? b : null;
		if (!noteId) return false;
		const targetId = noteId === a ? b : a;
		if (targetId !== noteId && kind(targetId) !== 'text') {
			ui.link = null;
			projectStore.run(linkNote, { noteId, targetId });
			selection.set([noteId]);
		} else ui.link = null;
		canvasFocus.focus();
		return true;
	}

	// Svelte Flow moves its own copy of the nodes while dragging; the model follows through
	// coalesced moveNode commands, and the derived nodes replace Svelte Flow's copy.
	const onnodedrag: NodeTargetEventWithPointer<MouseEvent | TouchEvent, FlowNode> = ({
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

	const onselectionchange: OnSelectionChange<FlowNode, FlowEdge> = ({ nodes, edges }) => {
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
		if (to && !linkIfNote(from, to))
			ui.picker = { sourceId: from, targetId: to, x: p.clientX, y: p.clientY };
	};

	function onpaneclick({ event }: { event: MouseEvent | TouchEvent }) {
		if (
			ui.tool === 'select' ||
			ui.tool === 'package' ||
			ui.tool === 'link' ||
			!('clientX' in event)
		)
			return;
		createClassifierAt(ui.tool, toPaper({ x: event.clientX, y: event.clientY }), rects().values());
		if (ui.pinned !== ui.tool) ui.tool = 'select'; // a pinned tool keeps placing (features.md)
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

<svelte:window onpointermove={(e) => (pointer = { x: e.clientX, y: e.clientY })} />

<!-- One Tab stop for the whole diagram (docs/spec/keyboard.md, accessibility.md): a focusable
     role="application" region whose keys the app routes. Not a fake button, so the
     non-interactive-element warnings do not apply. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	bind:this={el}
	class="aster-canvas"
	role="application"
	aria-label={t('ui.canvasNamed', { name: projectStore.diagram.name })}
	tabindex="0"
	onkeydown={(e) => handleCanvasKey(e, { rects, openPicker })}
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
		onlyRenderVisibleElements={flow.nodes.length > 100}
		proOptions={{ hideAttribution: true }}
		connectionMode={ConnectionMode.Loose}
		connectionLineType={ConnectionLineType.Straight}
		onbeforeconnect={() => false}
		{onconnectend}
		{onnodedrag}
		{onselectionchange}
		{onmove}
		{onpaneclick}
	>
		<!-- ui.md: Modern's soft dot grid; Classic's fine line grid (board 03). -->
		<Background
			variant={ui.layoutPreset === 'classic' ? BackgroundVariant.Lines : BackgroundVariant.Dots}
			bgColor="var(--paper-bg)"
			patternColor="var(--paper-grid)"
			gap={20}
			size={1.5}
			lineWidth={1}
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
		outline: 2px dashed var(--paper-accent);
		outline-offset: -5px;
	}
	.aster-canvas :global(.svelte-flow__selection) {
		background: color-mix(in srgb, var(--paper-accent) 8%, transparent);
		border: 1px dashed var(--paper-accent);
	}
	.aster-canvas :global(.svelte-flow__node) {
		cursor: grab;
	}
	.aster-canvas :global(.svelte-flow__node.dragging) {
		cursor: grabbing;
	}
	/* Connection previews are the one other place the accent appears on paper (ui.md). */
	.aster-canvas :global(.svelte-flow__connection-path) {
		stroke: var(--paper-accent);
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
		stroke: var(--paper-accent);
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
