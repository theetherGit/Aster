<script lang="ts">
	import {
		useInternalNode,
		useSvelteFlow,
		type EdgeProps,
		type InternalNode
	} from '@xyflow/svelte';
	import {
		addWaypoint,
		moveWaypoint,
		removeWaypoint,
		setLabelOffset
	} from '#lib/commands/index.ts';
	import { elementSummary } from '../summary.ts';
	import type { LabelOffset, LabelKey } from '#lib/model/types.ts';
	import type { RelationshipFlowEdge } from '#lib/stores/flow.svelte.ts';
	import { projectStore } from '#lib/stores/project.svelte.ts';
	import { ui } from '#lib/stores/ui.svelte.ts';
	import {
		DEFAULT_OFFSETS,
		endFrame,
		midFrame,
		offsetFor,
		pathD,
		placeLabel,
		route,
		samplePath,
		type Frame,
		type Pt,
		type Rect
	} from './geometry.ts';
	import { paperFont } from './fonts.svelte.ts';
	import { textWidth } from './measure.ts';
	import { MARKER_LENGTH, labelsFor, markersFor, type EdgeLabelSpec } from './notation.ts';

	let { id, source, target, data, selected }: EdgeProps<RelationshipFlowEdge> = $props();
	const { screenToFlowPosition } = useSvelteFlow();
	// An edge's endpoints never change for its id (connect fixes them), so the lookups are stable.
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

	const rel = $derived(data!.relationship);
	const layout = $derived(data!.layout);
	const style = $derived(layout.lineStyle);
	const src = $derived(rectOf(sourceNode.current));
	const tgt = $derived(rectOf(targetNode.current));

	// View-only drag previews; the model changes once, on release, through a command.
	let draftWaypoints: Pt[] | null = $state(null);
	let draftLabel: { key: LabelKey; offset: LabelOffset } | null = $state(null);

	const waypoints = $derived(draftWaypoints ?? layout.waypoints);
	const points = $derived(
		src && tgt ? route(src, tgt, waypoints, style, source === target).points : []
	);
	const line = $derived(samplePath(points, style));
	const d = $derived(pathD(points, style));
	const notation = $derived(markersFor(rel));
	const zoom = $derived(ui.zoom);
	// Labels stay at least 10 CSS px tall when zoomed out, so they remain legible at 50 %.
	const fontSize = $derived(Math.max(12, 10 / zoom));
	const lineHeight = $derived(fontSize * 1.25);

	interface PlacedLabel extends EdgeLabelSpec {
		frame: Frame;
		c: Pt;
		w: number;
		h: number;
	}
	const labels: PlacedLabel[] = $derived.by(() => {
		if (points.length < 2) return [];
		void paperFont.ready; // re-measure once the paper font is in
		const placed: Rect[] = [];
		return labelsFor(rel, data!.flags).map((spec) => {
			const frame = spec.at === 'mid' ? midFrame(points, style) : endFrame(line, spec.at);
			const offset =
				draftLabel?.key === spec.key
					? draftLabel.offset
					: (layout.labelOffsets[spec.key] ?? DEFAULT_OFFSETS[spec.key]);
			const w = Math.max(...spec.lines.map((l) => textWidth(l, fontSize))) + 6;
			const h = spec.lines.length * lineHeight;
			const node = spec.at === 'source' ? src : spec.at === 'target' ? tgt : null;
			// Labels clear their line, their end node and the labels placed before them.
			const c = placeLabel(frame, offset, { w, h }, line, node, placed);
			placed.push({ x: c.x - w / 2, y: c.y - h / 2, w, h });
			return { ...spec, frame, w, h, c };
		});
	});

	const dots = $derived(
		points.length < 2
			? []
			: notation.dots.map((end) => {
					const f = endFrame(line, end);
					const marker = end === 'source' ? notation.start : notation.end;
					const k = (marker ? MARKER_LENGTH[marker] : 0) + 4;
					return { x: f.anchor.x + Math.cos(f.theta) * k, y: f.anchor.y + Math.sin(f.theta) * k };
				})
	);

	/** Midpoint handle of each user segment (between consecutive waypoints, or an endpoint). */
	const midpoints = $derived.by(() => {
		if (points.length < 2) return [];
		const user = [points[0], ...waypoints, points[points.length - 1]];
		const out: { index: number; point: Pt }[] = [];
		let from = 0;
		for (let k = 0; k < user.length - 1; k++) {
			const next = user[k + 1];
			let to = line.findIndex((p, i) => i > from && p.x === next.x && p.y === next.y);
			if (to < 0) to = line.length - 1;
			out.push({ index: k, point: midFrame(line.slice(from, to + 1), 'oblique').anchor });
			from = to;
		}
		return out;
	});

	const diagramId = () => projectStore.activeDiagramId;
	const toPaper = (e: PointerEvent): Pt => {
		const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
		return { x: Math.round(p.x), y: Math.round(p.y) };
	};

	/** Pointer drag with capture; a press without movement is not a drag. */
	function drag(e: PointerEvent, onmove: (p: Pt) => void, onend: (p: Pt, moved: boolean) => void) {
		if (e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();
		const el = e.currentTarget as Element;
		el.setPointerCapture(e.pointerId);
		const start = { x: e.clientX, y: e.clientY };
		let moved = false;
		const move = (ev: Event) => {
			const pe = ev as PointerEvent;
			if (!moved && Math.hypot(pe.clientX - start.x, pe.clientY - start.y) < 3) return;
			moved = true;
			onmove(toPaper(pe));
		};
		const stop = () => {
			el.removeEventListener('pointermove', move);
			el.removeEventListener('pointerup', up);
			el.removeEventListener('pointercancel', cancel);
		};
		const up = (ev: Event) => {
			stop();
			onend(toPaper(ev as PointerEvent), moved);
		};
		// A cancelled pointer (touch taken by the browser, capture lost) drops the draft; nothing commits.
		const cancel = (ev: Event) => {
			stop();
			onend(toPaper(ev as PointerEvent), false);
		};
		el.addEventListener('pointermove', move);
		el.addEventListener('pointerup', up);
		el.addEventListener('pointercancel', cancel);
	}

	function dragWaypoint(e: PointerEvent, i: number) {
		const base = layout.waypoints;
		const ends = [points[0], points[points.length - 1]];
		drag(
			e,
			(p) => (draftWaypoints = base.map((w, j) => (j === i ? p : w))),
			(p, moved) => {
				draftWaypoints = null;
				if (!moved) return;
				const prev = i === 0 ? ends[0] : base[i - 1];
				const next = i === base.length - 1 ? ends[1] : base[i + 1];
				const near = (q: Pt) => Math.hypot(q.x - p.x, q.y - p.y) <= 10 / zoom;
				// Dropped onto a neighbour: the waypoint goes (StarUML's gesture).
				if (near(prev) || near(next))
					projectStore.run(removeWaypoint, { diagramId: diagramId(), id, index: i });
				else projectStore.run(moveWaypoint, { diagramId: diagramId(), id, index: i, point: p });
			}
		);
	}

	function dragMidpoint(e: PointerEvent, index: number) {
		const base = layout.waypoints;
		drag(
			e,
			(p) => (draftWaypoints = [...base.slice(0, index), p, ...base.slice(index)]),
			(p, moved) => {
				draftWaypoints = null;
				if (moved) projectStore.run(addWaypoint, { diagramId: diagramId(), id, index, point: p });
			}
		);
	}

	function dragLabel(e: PointerEvent, label: PlacedLabel) {
		const grab = toPaper(e);
		const delta = { x: label.c.x - grab.x, y: label.c.y - grab.y };
		const at = (p: Pt) => offsetFor(label.frame, { x: p.x + delta.x, y: p.y + delta.y });
		drag(
			e,
			(p) => (draftLabel = { key: label.key, offset: at(p) }),
			(p, moved) => {
				draftLabel = null;
				if (!moved) return;
				const o = at(p);
				const offset = {
					alpha: Math.round(o.alpha * 10000) / 10000,
					distance: Math.round(o.distance * 10) / 10
				};
				projectStore.run(setLabelOffset, { diagramId: diagramId(), id, key: label.key, offset });
			}
		);
	}

	const marker = (m: string | null) => (m ? `url(#aster-m-${m})` : undefined);
	const summary = $derived(elementSummary(projectStore.project, projectStore.diagram, id));
</script>

<!--
	Drag affordances here are pointer shortcuts. Each has a non-drag path: waypoints and label
	positions in the Inspector, selection through the Explorer tree (accessibility.md).
-->
{#if points.length >= 2}
	<!-- Hovering the edge lights up both end nodes; the hit band below is what the pointer meets. -->
	<!-- A part of each end node for roving focus (accessibility.md): Tab reaches it, ↩ and ⌫ act on it. -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<g
		class="uml-edge"
		class:selected
		class:focused={data!.focused}
		class:hovered={ui.hoveredEdge === id}
		role="group"
		aria-label={summary}
		tabindex={data!.focused ? 0 : -1}
		data-source={source}
		data-target={target}
		onpointerenter={() => (ui.hoveredEdge = id)}
		onpointerleave={() => {
			if (ui.hoveredEdge === id) ui.hoveredEdge = null;
		}}
		data-rel-id={id}
		data-kind={rel.relationshipKind}
		data-line-style={style}
		data-waypoints={layout.waypoints.length}
	>
		{#if data!.focused}
			<!-- The dashed accent focus ring, as a halo along the line. -->
			<path class="edge-focus" {d} style:stroke-width={6 / zoom} />
		{/if}
		<path
			class="edge-line"
			{d}
			marker-start={marker(notation.start)}
			marker-end={marker(notation.end)}
			stroke-dasharray={notation.dashed ? '6 4' : undefined}
		/>
		<!-- 10 CSS px invisible hit band at every zoom (ui.md). -->
		<path class="edge-hit" {d} style:stroke-width={10 / zoom} />
		{#each dots as p, i (i)}<circle class="edge-dot" cx={p.x} cy={p.y} r="3" />{/each}
		{#each labels as label (label.key)}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<g
				class="edge-label nodrag nopan"
				data-label={label.key}
				onpointerdown={(e) => dragLabel(e, label)}
			>
				<!-- The fill masks the line; an invisible stroke pads the drag target to 24 CSS px tall. -->
				<rect
					x={label.c.x - label.w / 2}
					y={label.c.y - label.h / 2}
					width={label.w}
					height={label.h}
					stroke-width={Math.max(0, 24 / zoom - label.h)}
				/>
				{#each label.lines as text, i (i)}
					<text
						x={label.c.x}
						y={label.c.y - label.h / 2 + lineHeight * i + fontSize}
						font-size={fontSize}
						text-anchor="middle">{text}</text
					>
				{/each}
			</g>
		{/each}
		{#if selected}
			<!-- Kept mounted while a drag runs: removing the captured element would lose the release. -->
			{#each midpoints as m (m.index)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					class="edge-handle midpoint nodrag nopan"
					class:dragging={draftWaypoints !== null}
					data-index={m.index}
					onpointerdown={(e) => dragMidpoint(e, m.index)}
				>
					<circle class="hit" cx={m.point.x} cy={m.point.y} r={12 / zoom} />
					<circle
						class="mark"
						cx={m.point.x}
						cy={m.point.y}
						r={3 / zoom}
						stroke-width={1.5 / zoom}
					/>
				</g>
			{/each}
		{/if}
		{#if selected}
			<!-- Board 12: square marks at both ends of a selected relationship (view only until reconnect lands). -->
			{#each [points[0], points[points.length - 1]] as p, i (i)}
				<rect
					class="edge-end"
					x={p.x - 3 / zoom}
					y={p.y - 3 / zoom}
					width={6 / zoom}
					height={6 / zoom}
					stroke-width={1 / zoom}
				/>
			{/each}
			{#each waypoints as w, i (i)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<g
					class="edge-handle waypoint nodrag nopan"
					data-index={i}
					onpointerdown={(e) => dragWaypoint(e, i)}
				>
					<circle class="hit" cx={w.x} cy={w.y} r={12 / zoom} />
					<rect
						class="mark"
						x={w.x - 3 / zoom}
						y={w.y - 3 / zoom}
						width={6 / zoom}
						height={6 / zoom}
						stroke-width={1.5 / zoom}
					/>
				</g>
			{/each}
		{/if}
	</g>
{/if}

<style>
	.edge-line {
		fill: none;
		stroke: var(--paper-ink);
		stroke-width: var(--uml-stroke);
	}
	/* Board 12/13: the selected line itself turns accent, 2 px. */
	.uml-edge.hovered:not(.selected) .edge-line {
		stroke: color-mix(in srgb, var(--paper-accent) 60%, var(--paper-ink));
	}
	.uml-edge.selected .edge-line {
		stroke: var(--paper-accent);
		stroke-width: max(2px, var(--uml-stroke));
	}
	.edge-end {
		fill: var(--paper-bg);
		stroke: var(--paper-accent);
		pointer-events: none;
	}
	.uml-edge:focus {
		outline: none; /* the halo below is the ring */
	}
	.edge-focus {
		fill: none;
		stroke: var(--paper-accent);
		stroke-dasharray: 6 4;
		opacity: 0.45;
		pointer-events: none;
	}
	.edge-hit {
		fill: none;
		stroke: transparent;
		pointer-events: stroke;
		cursor: pointer;
	}
	.edge-dot {
		fill: var(--paper-ink);
	}
	.edge-label {
		pointer-events: all;
		cursor: move;
	}
	.edge-label rect {
		fill: var(--paper-bg);
		stroke: transparent;
	}
	.edge-label text {
		fill: var(--paper-ink);
		font-family: var(--font-paper);
		user-select: none;
	}
	.edge-handle .hit {
		fill: transparent;
		pointer-events: all;
		cursor: grab;
	}
	.edge-handle .mark {
		fill: var(--paper-bg);
		stroke: var(--paper-accent);
		pointer-events: none;
	}
	.edge-handle.waypoint .mark {
		fill: var(--paper-accent);
	}
	.edge-handle.midpoint.dragging .mark {
		opacity: 0;
	}
</style>
