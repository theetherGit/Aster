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
	import { ContextMenu, Tooltip } from 'bits-ui';
	import { untrack } from 'svelte';
	import { runCommand } from '#lib/app/commands.svelte.ts';
	import { contextEntries, entryKey, type ContextKind } from '#lib/app/menus.ts';
	import { format } from '#lib/app/shortcuts.ts';
	import Icon from '#lib/ui/atoms/Icon.svelte';
	import Kbd from '#lib/ui/atoms/Kbd.svelte';
	import Separator from '#lib/ui/atoms/Separator.svelte';
	import MenuItem from '#lib/ui/atoms/MenuItem.svelte';
	import { menu, menuItem, tooltip } from '#lib/ui/styles.ts';
	import { prefersReducedMotion } from 'svelte/motion';
	import { linkNote, moveNode } from '#lib/commands/index.ts';
	import { t } from '#lib/i18n/index.ts';
	import type { ClassifierKind, Id, Point } from '#lib/model/types.ts';
	import { flow, type FlowEdge, type FlowNode } from '#lib/stores/flow.svelte.ts';
	import { layout } from '#lib/stores/layout.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { selection } from '#lib/stores/selection.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import { GRID } from './place.ts';
	import ClassifierNode from './ClassifierNode.svelte';
	import NoteNode from './NoteNode.svelte';
	import NoteLinkEdge from './edges/NoteLinkEdge.svelte';
	import {
		clipboardFromMenu,
		copySelection,
		createClassifierAt,
		createNoteAt,
		createTextAt,
		cutSelection,
		pasteFrom,
		startLink
	} from './actions.ts';
	import Markers from './edges/Markers.svelte';
	import UmlEdge from './edges/UmlEdge.svelte';
	import { center, type Rect } from './edges/geometry.ts';
	import { canvasApi } from './api.ts';
	import { canvasFocus, canvasRects, focusElement, focusOwner } from './focus.ts';
	import { handleCanvasKey } from './keyboard.ts';
	import { nearestInDirection } from './link.ts';
	import { elementName } from '#lib/model/project.ts';
	import type { FocusPart } from '#lib/stores/selection.svelte.ts';

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
		setCenter,
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
			create: (kind: ClassifierKind, at?: Point) =>
				createClassifierAt(kind, at ?? cursorPosition(), rects().values()),
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
				// Only edges selected: nothing to frame, so fit everything (keyboard.md's fallback).
				if (!boxes.length) return fitView({ padding: 0.1, duration: dur(200) });
				const x = Math.min(...boxes.map((b) => b.x));
				const y = Math.min(...boxes.map((b) => b.y));
				const x2 = Math.max(...boxes.map((b) => b.x + b.w));
				const y2 = Math.max(...boxes.map((b) => b.y + b.h));
				fitBounds({ x, y, width: x2 - x, height: y2 - y }, { padding: 0.2, duration: dur(200) });
			},
			centreOn: (id: Id) => {
				centring = { id, until: performance.now() + 600 };
				centre(id, dur(200));
			},
			rects
		} satisfies Partial<typeof canvasApi>);
		el.focus();
		return () => {
			canvasFocus.el = null;
			canvasRects.get = () => new Map();
		};
	});

	/** The focused element's parts in Tab order, as rendered: itself, its name, its lines, its edges. */
	function parts(id: Id): FocusPart[] {
		const key = CSS.escape(id);
		const own = [...el.querySelectorAll<HTMLElement>(`[data-focus-id="${key}"]`)].map(
			(p) => p.dataset.part as FocusPart
		);
		const edges = [
			...el.querySelectorAll<SVGGElement>(
				`.uml-edge[data-source="${key}"], .uml-edge[data-target="${key}"]`
			)
		].map((g): FocusPart => `edge:${g.dataset.relId}`);
		return [...new Set([...own, ...edges])];
	}

	// keyboard.md: right-click or ⇧F10 opens, for the element under the pointer or in focus, the
	// commands the palette has for it. One Bits ContextMenu on the container; the hit decides.
	let menuOpen = $state(false);
	let menuKind: ContextKind = $state('node');
	function oncontextmenu(e: MouseEvent, open: ((e: MouseEvent) => void) | undefined) {
		const hit = (e.target as Element | null)?.closest<HTMLElement | SVGElement>(
			'[data-focus-id], .uml-edge'
		);
		// Empty paper has its own menu (auto-layout, grid, snap), never the browser's.
		if (!hit) {
			menuKind = 'pane';
			return open?.(e);
		}
		const edge = hit.classList.contains('uml-edge');
		const id = edge ? hit.dataset.relId : hit.dataset.focusId;
		if (!id) return;
		menuKind = edge ? 'edge' : 'node';
		// A right-click inside a selection of several keeps them all (align needs them); the
		// focus ring still moves to the one under the pointer.
		if (!edge && selection.size > 1 && selection.has(id)) selection.focus = { id, part: 'self' };
		else focusElement(id);
		open?.(e);
	}
	/** ⇧F10: the same menu, raised at the focused element, or the paper's at its centre. */
	function openMenu() {
		const owner = focusOwner(el) ?? el.querySelector<HTMLElement>('.svelte-flow__pane');
		if (!owner) return;
		const r = owner.getBoundingClientRect();
		owner.dispatchEvent(
			new MouseEvent('contextmenu', {
				bubbles: true,
				cancelable: true,
				clientX: r.left + r.width / 2,
				clientY: r.top + Math.min(r.height / 2, 20)
			})
		);
	}

	// ⌘C / ⌘X / ⌘V: the browser's clipboard events land on the body when no text field has focus,
	// so they are heard on the document and taken only while the diagram has the keyboard.
	/** The diagram has the keyboard (not a text field in it): clipboard keys are the diagram's. */
	function canvasHasKeys() {
		const active = document.activeElement;
		return el.contains(active) && !active?.closest('input, textarea, [contenteditable="true"]');
	}
	// Chromium on Linux and Windows runs Ctrl+C / X / V with no text selected only when a
	// before-event is handled; claiming them here makes the copy, cut and paste events fire.
	function onbeforeclipboard(e: Event) {
		if (canvasHasKeys() && !selection.editing) e.preventDefault();
	}
	$effect(() => {
		const kinds = ['beforecopy', 'beforecut', 'beforepaste'];
		for (const k of kinds) document.addEventListener(k, onbeforeclipboard);
		return () => kinds.forEach((k) => document.removeEventListener(k, onbeforeclipboard));
	});
	function onclipboard(e: ClipboardEvent) {
		const active = document.activeElement;
		const onCanvas =
			el.contains(active) && !active?.closest('input, textarea, [contenteditable="true"]');
		if (!(onCanvas || (e.type === 'copy' && clipboardFromMenu()))) return;
		if (selection.editing || ui.link || ui.picker) return;
		const done =
			e.type === 'copy'
				? copySelection(e.clipboardData)
				: e.type === 'cut'
					? cutSelection(e.clipboardData)
					: (pasteFrom(e.clipboardData), true);
		if (done) e.preventDefault();
	}

	// Board 10: while a node shows the keyboard ring, a "Focus" tag and the neighbour each arrow
	// reaches sit above it. Seen only with :focus-visible, so a click never shows them.
	let ringId: Id | null = $state(null);
	function onfocusin(e: FocusEvent) {
		const t = e.target as HTMLElement;
		ringId =
			t.dataset?.part === 'self' && !t.closest('.uml-edge') && t.matches(':focus-visible')
				? (t.dataset.focusId ?? null)
				: null;
	}
	const ARROW = { left: '←', right: '→', up: '↑', down: '↓' } as const;
	const hints = $derived.by(() => {
		if (!ringId) return null;
		void flow.nodes; // follow moves and renames
		const r = rects();
		const at = r.get(ringId);
		if (!at) return null;
		// One hint per neighbour: an element both up and right of here is named on its main axis.
		const c = center(at);
		const items = (['left', 'right', 'up', 'down'] as const).flatMap((d) => {
			const id = nearestInDirection(r, ringId!, d);
			const el = id && projectStore.project.elements.get(id);
			if (!el) return [];
			const o = center(r.get(id)!);
			const horizontal = Math.abs(o.x - c.x) >= Math.abs(o.y - c.y);
			return horizontal === (d === 'left' || d === 'right')
				? [`${ARROW[d]} ${elementName(el)}`]
				: [];
		});
		return { at, items };
	});

	// Owner's ruling #30: markers and visibility symbols carry `data-tip`; one Bits tooltip, anchored
	// to whichever the pointer rests on, rather than one per symbol on a large diagram.
	let tip: { text: string; el: HTMLElement } | null = $state(null);
	let tipTimer: ReturnType<typeof setTimeout> | undefined;
	function onpointerover(e: PointerEvent) {
		const el = (e.target as Element | null)?.closest<HTMLElement>('[data-tip]') ?? null;
		clearTimeout(tipTimer);
		if (!el) tip = null;
		else if (tip?.el !== el)
			tipTimer = setTimeout(() => (tip = { text: el.dataset.tip!, el }), 400);
	}
	function hideTip() {
		clearTimeout(tipTimer);
		tip = null;
	}
	// WCAG 1.4.13: the pointer may move onto the tooltip without losing it, and Esc dismisses it.
	function onpointerleave(e: PointerEvent) {
		if ((e.relatedTarget as Element | null)?.closest?.('[data-notation-tip]')) return;
		hideTip();
	}

	/** Pan so the focused element is inside the viewport (accessibility.md); zoom stays. */
	function reveal(id: Id) {
		const r = rects().get(id);
		if (!r) return;
		const box = el.getBoundingClientRect();
		const a = flowToScreenPosition({ x: r.x, y: r.y });
		const b = flowToScreenPosition({ x: r.x + r.w, y: r.y + r.h });
		const m = 24;
		if (a.x >= box.left + m && b.x <= box.right - m && a.y >= box.top + m && b.y <= box.bottom - m)
			return;
		setCenter(r.x + r.w / 2, r.y + r.h / 2, { zoom: getZoom(), duration: dur(160) });
	}

	// Roving focus in the DOM: after any re-render, the owner part takes real focus, but only while
	// the diagram has the keyboard (a selection made from the inspector must not steal it).
	$effect(() => {
		const f = selection.focus;
		void selection.editing;
		void flow.canvasNodes;
		if (!f || selection.editing) return;
		const active = document.activeElement;
		if (!(active === document.body || el.contains(active))) return;
		// The focused part is gone (deleted, undone, another diagram): step out to its element,
		// or to the diagram itself, so the keyboard never drops to the page.
		const shown = projectStore.diagram.elementIds;
		const edge = f.part.startsWith('edge:') ? f.part.slice(5) : null;
		if (!shown.includes(f.id) || (edge && !shown.includes(edge))) {
			selection.focus = shown.includes(f.id) ? { id: f.id, part: 'self' } : null;
			if (!selection.focus) el.focus({ preventScroll: true });
			return;
		}
		let tries = 0;
		const attempt = () => {
			const owner = focusOwner(el);
			if (owner) {
				if (document.activeElement !== owner) owner.focus({ preventScroll: true });
				reveal(f.id);
			} else if (tries++ < 10) requestAnimationFrame(attempt);
		};
		attempt();
	});
	// Selection made by the pointer, the Outline or undo: focus follows a single selection.
	$effect(() => {
		const ids = selection.list;
		if (ids.length !== 1) return;
		const f = untrack(() => selection.focus);
		const current = f ? (f.part.startsWith('edge:') ? f.part.slice(5) : f.id) : null;
		if (current !== ids[0]) selection.focus = { id: ids[0], part: 'self' };
	});

	// Quick find centres its hit; selecting it may slide the inspector in, which narrows the
	// canvas, so for a moment a resize centres it again.
	let centring: { id: Id; until: number } | null = null;
	function centre(id: Id, duration: number) {
		const r = rects().get(id);
		if (r) setCenter(r.x + r.w / 2, r.y + r.h / 2, { zoom: getZoom(), duration });
	}
	$effect(() => {
		const ro = new ResizeObserver(() => {
			if (centring && performance.now() < centring.until) centre(centring.id, 0);
		});
		ro.observe(el);
		return () => ro.disconnect();
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

	/** Link in progress: a click on a node picks it as the target, the same as ↩ (keyboard.md). */
	function onnodeclick({ node }: { node: FlowNode }) {
		if (!ui.link) return;
		ui.link = { ...ui.link, targetId: node.id };
		openPicker(ui.link.sourceId, node.id);
	}

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
<svelte:document oncopy={onclipboard} oncut={onclipboard} onpaste={onclipboard} />

<!-- One Tab stop for the whole diagram (docs/spec/keyboard.md, accessibility.md): a focusable
     role="application" region whose keys the app routes. Not a fake button, so the
     non-interactive-element warnings do not apply. -->
<ContextMenu.Root bind:open={menuOpen}>
	<ContextMenu.Trigger>
		{#snippet child({ props })}
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				{...props}
				bind:this={el}
				class="aster-canvas"
				dir="ltr"
				role="application"
				aria-label={t('ui.canvasNamed', { name: projectStore.diagram.name })}
				tabindex={selection.focus ? -1 : 0}
				onkeydown={(e) => {
					if (e.key === 'Escape' && tip) {
						hideTip();
						e.preventDefault();
						return;
					}
					handleCanvasKey(e, { rects, openPicker, parts, openMenu });
				}}
				{onfocusin}
				onfocusout={() => (ringId = null)}
				{onpointerover}
				{onpointerleave}
				onpointerdown={hideTip}
				oncontextmenu={(e) =>
					oncontextmenu(e, props.oncontextmenu as ((e: MouseEvent) => void) | undefined)}
			>
				<Markers />
				<SvelteFlow
					{nodes}
					edges={flow.canvasEdges}
					{nodeTypes}
					{edgeTypes}
					snapGrid={ui.snap ? [GRID, GRID] : [1, 1]}
					minZoom={0.1}
					maxZoom={4}
					deleteKey={null}
					selectionKey={null}
					multiSelectionKey="Shift"
					selectionOnDrag
					panOnDrag={[1]}
					panActivationKey=" "
					panOnScroll
					zoomOnScroll={false}
					zoomOnDoubleClick={false}
					nodesFocusable={false}
					edgesFocusable={false}
					disableKeyboardA11y
					role={undefined}
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
					{onnodeclick}
				>
					<!-- ui.md: Modern's soft dot grid; Classic's fine line grid (board 03). -->
					<Background
						variant={ui.layoutPreset === 'classic'
							? BackgroundVariant.Lines
							: BackgroundVariant.Dots}
						bgColor="var(--paper-bg)"
						patternColor={ui.showGrid ? 'var(--paper-grid)' : 'transparent'}
						gap={GRID}
						size={1.5}
						lineWidth={1}
					/>
					{#if hints}
						<ViewportPortal target="front">
							<div
								class="focus-hints"
								data-testid="focus-hints"
								aria-hidden="true"
								style:left="{hints.at.x - 7}px"
								style:top="{hints.at.y - 32}px"
							>
								<span class="focus-tag">{t('ui.focusTag')}</span>
								{#each hints.items as item (item)}<span class="focus-hint">{item}</span>{/each}
							</div>
						</ViewportPortal>
					{/if}
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
		{/snippet}
	</ContextMenu.Trigger>
	<ContextMenu.Portal>
		<ContextMenu.Content
			class={menu}
			aria-label={menuKind === 'pane' ? t('ui.paperMenu') : t('ui.elementMenu')}
			onCloseAutoFocus={(e) => {
				e.preventDefault();
				canvasFocus.focus(); // back to the element, or the container when it was deleted
			}}
		>
			{#each contextEntries(menuKind) as entry (entryKey(entry))}
				{#if entry.kind === 'separator'}
					<Separator class="my-1" />
				{:else if entry.kind === 'sub'}
					<!-- Owner's review: the arrange tools as submenus (Bits ContextMenu.Sub). -->
					<ContextMenu.Sub>
						<ContextMenu.SubTrigger
							class={menuItem}
							disabled={entry.commands.every((c) => c.when && !c.when())}
						>
							<span>{t(entry.label)}</span>
							<Icon
								name="chevron-right"
								size={12}
								class="ms-auto text-chrome-muted rtl:-scale-x-100"
							/>
						</ContextMenu.SubTrigger>
						<ContextMenu.SubContent class={menu} sideOffset={4}>
							{#each entry.commands as c (c.id)}
								<MenuItem
									kind="context"
									label={c.short?.() ?? c.label()}
									disabled={c.when ? !c.when() : false}
									onSelect={() => runCommand(c.id)}
								/>
							{/each}
						</ContextMenu.SubContent>
					</ContextMenu.Sub>
				{:else if entry.command.state}
					{@const c = entry.command}
					<!-- A toggle (grid, snap): the MenuItem atom has no checked state, so the Bits item
					     keeps its row class, as the project menu's checkbox rows do. -->
					<ContextMenu.CheckboxItem
						class={menuItem}
						checked={c.state?.() ?? false}
						onCheckedChange={() => runCommand(c.id)}
					>
						{#snippet children({ checked })}
							<span class="w-4 text-(length:--text-caption)" aria-hidden="true"
								>{checked ? '✓' : ''}</span
							>
							<span>{c.label()}</span>
							{#if c.keys[0]}<Kbd quiet class="ms-auto">{format(c.keys[0])}</Kbd>{/if}
						{/snippet}
					</ContextMenu.CheckboxItem>
				{:else}
					{@const c = entry.command}
					<MenuItem
						kind="context"
						label={c.label()}
						keys={c.keys[0] ? format(c.keys[0]) : undefined}
						disabled={c.when ? !c.when() : false}
						onSelect={() => runCommand(c.id)}
					/>
				{/if}
			{/each}
		</ContextMenu.Content>
	</ContextMenu.Portal>
</ContextMenu.Root>
<Tooltip.Root
	open={tip !== null}
	onOpenChange={(o) => {
		if (!o) hideTip();
	}}
>
	<Tooltip.Portal>
		<Tooltip.Content
			class={tooltip}
			customAnchor={tip?.el ?? null}
			side="top"
			sideOffset={6}
			data-notation-tip=""
			onpointerleave={(e: PointerEvent) => {
				if (!(e.relatedTarget as Element | null)?.closest?.('[data-tip]')) hideTip();
			}}
		>
			<div role="tooltip">{tip?.text}</div>
		</Tooltip.Content>
	</Tooltip.Portal>
</Tooltip.Root>

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
	/* Board 10: on the paper, so paper tokens; the tag is a tint, since text on the solid accent
	   falls short of 4.5:1 in the dark theme. */
	.focus-hints {
		position: absolute;
		display: flex;
		gap: 4px;
		align-items: center;
		font-size: 10.5px;
		line-height: 16px;
		color: var(--paper-ink);
		white-space: nowrap;
		pointer-events: none;
	}
	.focus-tag {
		padding: 1px 6px;
		font-weight: 600;
		background: color-mix(in srgb, var(--paper-accent) 14%, var(--paper-bg));
		border: 1px solid var(--paper-accent);
		border-radius: 4px;
	}
	.focus-hint {
		padding: 1px 6px;
		font-family: var(--font-mono);
		background: var(--paper-bg);
		border: 1px solid var(--paper-grid);
		border-radius: 4px;
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
	/* Chrome over the paper: the same layer, shadow and radius as the toolbox. */
	.link-hint {
		position: absolute;
		bottom: var(--space-3);
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-toolbox);
		margin: 0;
		padding: var(--space-1) var(--space-3);
		font-size: var(--text-body);
		color: var(--chrome-text);
		background: var(--chrome-surface);
		border: 1px solid var(--chrome-border);
		border-radius: var(--control-radius);
		box-shadow: var(--shadow-float);
	}
</style>
