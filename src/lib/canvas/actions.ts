import {
	PACKAGE_MIN,
	addClassifier,
	addInstance,
	addNote,
	addPackage,
	moveToPackage,
	addText,
	batch,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	resizeNode,
	restack,
	setLineStyle,
	setNodePositions,
	setWaypoints
} from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import { t } from '#lib/i18n/index.ts';
import { newId } from '#lib/model/ids.ts';
import {
	createClassifier,
	createInstance,
	createPackage,
	descendantsOf,
	elementName,
	nextClassName,
	nextInstanceName,
	nextPackageName,
	ownerOf
} from '#lib/model/project.ts';
import type { ClassifierKind, Id, LineStyle, NodeLayout, Point } from '#lib/model/types.ts';
import type { MemberKind } from '#lib/mdj/expression.ts';
import { flow } from '#lib/stores/flow.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import type { Rect } from './edges/geometry.ts';
import { announce, announceAssertive } from '#lib/stores/live.svelte.ts';
import { tick } from 'svelte';
import {
	copyPayload,
	parsePayload,
	PAYLOAD_MIME,
	planPaste,
	plainText,
	type ClipboardPayload
} from './clipboard.ts';
import { canvasApi } from './api.ts';
import type { Algorithm, Direction, LayoutInput } from './autolayout.ts';
import { canvasFocus, explorerFocus, focusElement } from './focus.ts';
import { align, distribute, sameSize, type Axis, type Dimension, type Side } from './tidy.ts';
import { edit, endEditing } from './inline.ts';
import { firstTarget } from './link.ts';
import { linkAsRelationship } from './edges/notation.ts';
import { freePosition } from './place.ts';

/**
 * Creates a classifier near a paper position (in free space, never on another node), selects it
 * and opens its name for typing. `taken` is the diagram's node rects as measured on screen.
 */
export function createClassifierAt(kind: ClassifierKind, at: Point, taken: Iterable<Rect>) {
	const classifier = createClassifier({
		classifierKind: kind,
		name: nextClassName(projectStore.project, kind)
	});
	const inside = packageAt(at);
	if (inside) classifier.packageId = inside;
	projectStore.run(addClassifier, {
		diagramId: projectStore.activeDiagramId,
		classifier,
		at: freePosition(at, taken)
	});
	edit(classifier.id, { part: 'name' });
}

/** An object near a paper position, selected, its text open with the name ready for typing (M3.2). */
export function createInstanceAt(at: Point, taken: Iterable<Rect>) {
	const instance = createInstance({ name: nextInstanceName(projectStore.project) });
	const inside = packageAt(at);
	if (inside) instance.packageId = inside;
	projectStore.run(addInstance, {
		diagramId: projectStore.activeDiagramId,
		instance,
		at: freePosition(at, taken)
	});
	edit(instance.id, { part: 'text' });
}

/** A package near a paper position (M3.1, key P), inside the package drawn there, its name open. */
export function createPackageAt(at: Point, taken: Iterable<Rect>) {
	const parentId = packageAt(at);
	const pkg = createPackage({ name: nextPackageName(projectStore.project), parentId });
	projectStore.run(addPackage, {
		diagramId: projectStore.activeDiagramId,
		pkg,
		at: freePosition(at, taken, PACKAGE_MIN)
	});
	edit(pkg.id, { part: 'name' });
}

const kindOf = (id: Id) => projectStore.project.elements.get(id)?.kind;

/**
 * The innermost package drawn on this diagram whose frame holds a paper point, leaving out
 * `exclude` (a package being moved, and what it holds).
 */
export function packageAt(at: Point, exclude: ReadonlySet<Id> = new Set()): Id | undefined {
	let best: { id: Id; area: number } | undefined;
	for (const [id, r] of canvasApi.rects()) {
		if (kindOf(id) !== 'package' || exclude.has(id)) continue;
		if (at.x < r.x || at.x > r.x + r.w || at.y < r.y || at.y > r.y + r.h) continue;
		if (!best || r.w * r.h < best.area) best = { id, area: r.w * r.h };
	}
	return best?.id;
}

/** Nodes to move with `ids`: every package's members drawn on this diagram go along (keyboard.md). */
export function withMembers(ids: Id[]): Id[] {
	const d = projectStore.diagram;
	const out = new Set(ids);
	for (const id of ids)
		if (kindOf(id) === 'package')
			for (const m of descendantsOf(projectStore.project, id))
				if (d.layout.get(m)?.kind === 'node') out.add(m);
	return [...out];
}

/**
 * After a drag (M3.1): a node let go inside a package frame joins that package; one let go
 * outside the frame of the package that holds it leaves it. Packages not on this diagram are
 * left alone. One undo step, said aloud.
 */
export function dropIntoPackages(ids: Id[]) {
	const p = projectStore.project;
	const d = projectStore.diagram;
	const r = canvasApi.rects();
	const moves: { id: Id; to: Id | null }[] = [];
	for (const id of ids) {
		const el = p.elements.get(id);
		const box = r.get(id);
		if (
			!el ||
			!box ||
			(el.kind !== 'classifier' && el.kind !== 'package' && el.kind !== 'instance')
		)
			continue;
		const now = ownerOf(el);
		// Members dragged along with their package stay where they are.
		if (now && ids.includes(now)) continue;
		const exclude = new Set(el.kind === 'package' ? [id, ...descendantsOf(p, id)] : [id]);
		const to = packageAt({ x: box.x + box.w / 2, y: box.y + box.h / 2 }, exclude);
		if (to === now || (!to && !(now && d.layout.get(now)?.kind === 'node'))) continue;
		moves.push({ id, to: to ?? null });
	}
	if (!moves.length) return;
	projectStore.run(moveToPackage, { moves });
	const to = moves[0].to;
	announce(
		t('live.movedToPackage', {
			name:
				moves.length === 1
					? elementName(p.elements.get(moves[0].id)!)
					: t('cmd.many', { count: moves.length }),
			package: to ? elementName(p.elements.get(to)!) : t('cmd.topLevel')
		})
	);
}

const selectedWith = (kind: 'node' | 'edge') =>
	selection.list.filter((id) => projectStore.diagram.layout.get(id)?.kind === kind);

/** Arrows: nudge the selected nodes, and what a selected package holds. Edges follow their nodes. */
export function nudgeSelection(dx: number, dy: number) {
	const ids = withMembers(selectedWith('node'));
	if (!ids.length) return;
	projectStore.run(moveNode, { diagramId: projectStore.activeDiagramId, ids, dx, dy });
}

/** ⇧+arrows: resize the one selected note or package by 8 px (keyboard.md). */
export function resizeSelection(dw: number, dh: number): boolean {
	const ids = selectedWith('node').filter(
		(id) => kindOf(id) === 'note' || kindOf(id) === 'package'
	);
	if (ids.length !== 1 || selection.size !== 1) return false;
	const l = projectStore.diagram.layout.get(ids[0]);
	if (l?.kind !== 'node') return false;
	// ui.md: a note is at least 120 × 60, a package 240 × 160.
	const min = kindOf(ids[0]) === 'package' ? PACKAGE_MIN : { w: 120, h: 60 };
	projectStore.run(resizeNode, {
		diagramId: projectStore.activeDiagramId,
		id: ids[0],
		w: Math.max(min.w, l.w + dw),
		h: Math.max(min.h, l.h + dh)
	});
	return true;
}

export function deleteSelection(fromModel: boolean) {
	const ids = selection.list;
	if (!ids.length) return;
	const first = projectStore.project.elements.get(ids[0]);
	const name =
		ids.length === 1 && first ? elementName(first) : t('cmd.many', { count: ids.length });
	selection.editing = null;
	selection.clear();
	if (fromModel) projectStore.run(deleteFromModel, { ids });
	else projectStore.run(deleteFromDiagram, { diagramId: projectStore.activeDiagramId, ids });
	// Board 19: say what happened and offer the way back.
	ui.toast = {
		text: fromModel ? t('toast.deleted', { name }) : t('toast.removed', { name }),
		undo: true,
		at: Date.now()
	};
}

/** F2 / ↩ on a selected classifier: edit its name, or the member line that has roving focus. */
export function startEditing() {
	if (selection.size !== 1) return;
	const [id] = selection.list;
	const kind = projectStore.project.elements.get(id)?.kind;
	const part = selection.focus?.id === id ? selection.focus.part : 'self';
	const line = /^(attribute|operation|literal):(\d+)$/.exec(part);
	if (kind === 'classifier' && line)
		edit(id, { part: line[1] as MemberKind, index: Number(line[2]) });
	else if (kind === 'classifier') edit(id, { part: 'name' });
	else if (kind === 'note' || kind === 'text' || kind === 'instance') edit(id, { part: 'text' });
	else if (kind === 'package') edit(id, { part: 'name' });
}

/** L: start a keyboard link from the one selected node. */
export function startLink(rects: Map<Id, Rect>) {
	const nodes = selectedWith('node');
	if (nodes.length !== 1 || selection.size !== 1) return false;
	ui.link = { sourceId: nodes[0], targetId: firstTarget(rects, nodes[0]) };
	return true;
}

/** ⌘L, ⌘⇧B, ⌘⌥L, ⌘⌥B: line style of the selected edges, as one undo step. */
export function setLineStyleForSelection(lineStyle: LineStyle): boolean {
	const ids = selectedWith('edge');
	if (!ids.length) return false;
	const diagramId = projectStore.activeDiagramId;
	if (ids.length === 1) {
		projectStore.run(setLineStyle, { diagramId, id: ids[0], lineStyle });
	} else {
		const p = projectStore.project;
		projectStore.run(batch, {
			label: t('cmd.setLineStyle', { name: t('cmd.many', { count: ids.length }) }),
			commands: ids.map((id) => serialise(setLineStyle(p, { diagramId, id, lineStyle })))
		});
	}
	return true;
}

export { endEditing as stopEditing };

// ---- Tidy tools and auto-layout (features.md M3, "Auto-layout and tidy") -------------------------

/** The node's rect as drawn, or as laid out when it has not been measured (off screen). */
function rectOf(id: Id) {
	const drawn = canvasApi.rects().get(id);
	if (drawn) return drawn;
	const l = projectStore.diagram.layout.get(id) as NodeLayout | undefined;
	return l && { x: l.x, y: l.y, w: l.w, h: l.h };
}
const rectsOf = (ids: Id[]) =>
	new Map(ids.flatMap((id) => (rectOf(id) ? [[id, rectOf(id)!] as const] : [])));
/** How many selected nodes a tool needs before the palette offers it. */
export const selectedNodes = () => selectedWith('node').length;
/**
 * The nodes the canvas draws, in the diagram's order. Views it does not draw yet (packages until
 * M3.1, as an imported .mdj can carry) are left where they are rather than laid out unseen.
 */
export const drawnNodes = () => flow.nodes.map((n) => n.id);

/** One undo step under the tool's own label, from the positions that actually change. */
function placeAll(positions: { id: Id; x: number; y: number }[], label: string) {
	const diagramId = projectStore.activeDiagramId;
	const moved = positions.filter((q) => {
		const r = rectOf(q.id);
		return r && (r.x !== q.x || r.y !== q.y);
	});
	if (!moved.length) return;
	const p = projectStore.project;
	projectStore.run(batch, {
		label,
		commands: [serialise(setNodePositions(p, { diagramId, positions: moved }))]
	});
}
const many = (ids: Id[]) => t('cmd.many', { count: ids.length });

export function alignSelection(side: Side) {
	const ids = selectedWith('node');
	if (ids.length < 2) return;
	placeAll(align(rectsOf(ids), ids, side), t('cmd.tidy.align', { name: many(ids) }));
}

export function distributeSelection(axis: Axis) {
	const ids = selectedWith('node');
	if (ids.length < 3) return;
	placeAll(distribute(rectsOf(ids), ids, axis), t('cmd.tidy.distribute', { name: many(ids) }));
}

export function sameSizeSelection(dim: Dimension) {
	const ids = selectedWith('node');
	if (ids.length < 2) return;
	const diagramId = projectStore.activeDiagramId;
	const p = projectStore.project;
	const commands = sameSize(rectsOf(ids), ids, dim).flatMap(({ id, w, h }) => {
		const l = projectStore.diagram.layout.get(id) as NodeLayout;
		return l.w === w && l.h === h ? [] : [serialise(resizeNode(p, { diagramId, id, w, h }))];
	});
	if (commands.length)
		projectStore.run(batch, { label: t('cmd.tidy.size', { name: many(ids) }), commands });
}

export function restackSelection(place: 'front' | 'back') {
	if (!selection.size) return;
	projectStore.run(restack, {
		diagramId: projectStore.activeDiagramId,
		ids: [...selection.list],
		place
	});
}

/**
 * ELK on the selected nodes (two or more), else the whole diagram, as one undo step: the nodes
 * move, the edges between them take ELK's bends as waypoints and the line style that matches
 * them (rectilinear for orthogonal, oblique for layered), and edges that leave the laid-out set
 * lose their old bends. The layout keeps its top-left where the nodes' top-left was.
 */
export async function autoLayout(algorithm: Algorithm, direction: Direction) {
	const d = projectStore.diagram;
	const diagramId = d.id;
	const all = drawnNodes();
	const picked = selectedWith('node');
	// The diagram's own order, whatever order the selection was made in: it seeds ELK (stable). A
	// picked package brings what it holds (M3.1).
	const scoped = new Set(withMembers(picked));
	const ids = picked.length >= 2 ? all.filter((id) => scoped.has(id)) : all;
	if (ids.length < 2) return;
	const rects = rectsOf(ids);
	const inScope = new Set(rects.keys());
	const project = projectStore.project;
	/** The nearest package that holds `id` and is laid out with it: its frame is the node's parent. */
	const frameOf = (id: Id): Id | undefined => {
		const seen = new Set<Id>();
		const el = project.elements.get(id);
		for (let o = el && ownerOf(el); o && !seen.has(o);) {
			if (inScope.has(o)) return o;
			seen.add(o);
			const up = project.elements.get(o);
			o = up && ownerOf(up);
		}
		return undefined;
	};
	const input: LayoutInput = { nodes: [], edges: [] };
	for (const [id, r] of rects)
		input.nodes.push({
			id,
			w: r.w,
			h: r.h,
			x: r.x,
			y: r.y,
			parent: frameOf(id),
			frame: kindOf(id) === 'package'
		});
	const laidOut: Id[] = [];
	const leaving: Id[] = [];
	for (const id of d.elementIds) {
		const found = projectStore.project.elements.get(id);
		// A link lays out as the plain association it draws as (M3.2).
		const el = found?.kind === 'link' ? linkAsRelationship(found) : found;
		if (el?.kind === 'note')
			for (const target of el.linkedIds)
				if (inScope.has(id) && inScope.has(target))
					input.edges.push({ id: `${id}\u0000${target}`, source: id, target });
		if (el?.kind !== 'relationship' || d.layout.get(id)?.kind !== 'edge') continue;
		const ends = [inScope.has(el.sourceId), inScope.has(el.targetId)];
		if (ends[0] && ends[1] && el.sourceId !== el.targetId) {
			laidOut.push(id);
			const upward =
				el.relationshipKind === 'generalization' || el.relationshipKind === 'realization';
			const labelled = !!(
				el.name ||
				el.stereotype ||
				[el.sourceEnd, el.targetEnd].some((end) => end?.role || end?.multiplicity)
			);
			input.edges.push({ id, source: el.sourceId, target: el.targetId, upward, labelled });
		} else if (ends[0] || ends[1]) leaving.push(id);
	}
	const origin = {
		x: Math.min(...[...rects.values()].map((r) => r.x)),
		y: Math.min(...[...rects.values()].map((r) => r.y))
	};
	const name = ids === all ? d.name : many(ids);
	// The first run fetches ELK's worker: say so, and ignore the command until it is done.
	if (ui.layingOut) return;
	ui.layingOut = true;
	ui.lastLayout = { algorithm, direction };
	announce(t('live.layingOut', { name }));
	let out: Awaited<ReturnType<typeof import('./autolayout.ts').layout>>;
	try {
		const [{ layout }, { workerElk }] = await Promise.all([
			import('./autolayout.ts'),
			import('./elk.ts')
		]);
		const aspect = innerWidth / Math.max(1, innerHeight);
		out = await layout(workerElk(), input, { algorithm, direction, aspect }, origin);
	} catch {
		announceAssertive(t('live.layoutFailed'));
		return;
	} finally {
		ui.layingOut = false;
	}
	// Another diagram opened while ELK worked: this result is not for it.
	if (projectStore.activeDiagramId !== diagramId) return;

	const p = projectStore.project;
	const positions = [...out.positions].map(([id, at]) => ({ id, ...at }));
	const lineStyle: LineStyle = algorithm === 'orthogonal' ? 'rectilinear' : 'oblique';
	const commands = [serialise(setNodePositions(p, { diagramId, positions }))];
	// Package frames take the size that holds what ELK put in them.
	for (const [id, { w, h }] of out.sizes) {
		const l = d.layout.get(id);
		if (l?.kind === 'node' && (l.w !== w || l.h !== h))
			commands.push(serialise(resizeNode(p, { diagramId, id, w, h })));
	}
	for (const id of laidOut) {
		const l = d.layout.get(id);
		if (l?.kind !== 'edge') continue;
		commands.push(
			serialise(setWaypoints(p, { diagramId, id, waypoints: out.waypoints.get(id) ?? [] }))
		);
		if (l.lineStyle !== lineStyle)
			commands.push(serialise(setLineStyle(p, { diagramId, id, lineStyle })));
	}
	for (const id of leaving) {
		const l = d.layout.get(id);
		if (l?.kind === 'edge' && l.waypoints.length)
			commands.push(serialise(setWaypoints(p, { diagramId, id, waypoints: [] })));
	}
	projectStore.run(batch, { label: t('cmd.autoLayout', { name }), commands });
	// A layout moves everything: the undo toast keeps the way back in sight (board 19), and the
	// view frames the result once the canvas has drawn it.
	ui.toast = { text: t('toast.laidOut', { name }), undo: true, at: Date.now() };
	await tick();
	requestAnimationFrame(() => (ids === all ? canvasApi.fitAll() : canvasApi.fitSelection()));
}

/** N: a note at a paper position, its text open for typing. */
export function createNoteAt(at: Point, taken: Iterable<Rect>) {
	const id = newId();
	projectStore.run(addNote, {
		diagramId: projectStore.activeDiagramId,
		note: { kind: 'note', id, text: '', linkedIds: [] },
		at: freePosition(at, taken, { w: 160, h: 60 })
	});
	edit(id, { part: 'text' });
}

/** A free text element (no key in keyboard.md; the palette reaches it). */
export function createTextAt(at: Point, taken: Iterable<Rect>) {
	const id = newId();
	projectStore.run(addText, {
		diagramId: projectStore.activeDiagramId,
		text: { kind: 'text', id, text: '' },
		at: freePosition(at, taken, { w: 120, h: 24 })
	});
	edit(id, { part: 'text' });
}

// ---------------------------------------------------------------------------
// Clipboard (keyboard.md ⌘C / ⌘X / ⌘V). The keyboard path is the browser's own copy, cut and
// paste events, so the system clipboard carries the payload between tabs and projects; menus and
// the palette go through execCommand('copy') for the same effect. The last copy is also held in
// this tab, for paste from a menu (reading the clipboard there would ask for permission) and for
// browsers that keep only text/plain.
// ---------------------------------------------------------------------------

let held: { payload: ClipboardPayload; text: string } | null = null;
export const hasClipboard = () => held !== null;

/** Copy the selection to the event's clipboard (when there is one) and to the tab. */
export function copySelection(data: DataTransfer | null): boolean {
	const payload = copyPayload(projectStore.project, projectStore.activeDiagramId, selection.list);
	if (!payload) return false;
	const text = plainText(payload);
	held = { payload, text };
	data?.setData(PAYLOAD_MIME, JSON.stringify(payload));
	data?.setData('text/plain', text);
	const n = payload.elements.length;
	announce(
		t('live.copied', {
			name: n === 1 ? elementName(payload.elements[0]) : t('cmd.many', { count: n })
		})
	);
	return true;
}

/** ⌘X: copy, then remove from the diagram (view only, the same as ⌫, with its undo toast). */
export function cutSelection(data: DataTransfer | null): boolean {
	if (!copySelection(data)) return false;
	deleteSelection(false);
	return true;
}

/** ⌘V: what the clipboard holds, or (from a menu, or text-only browsers) what this tab copied. */
export function pasteFrom(data: DataTransfer | null) {
	const json = data?.getData(PAYLOAD_MIME);
	let payload = json ? parsePayload(json) : null;
	if (!payload && held && (!data || data.getData('text/plain') === held.text))
		payload = held.payload;
	const plan = payload && planPaste(projectStore.project, projectStore.activeDiagramId, payload);
	if (!plan) return announce(t('live.nothingToPaste'));
	selection.editing = null;
	projectStore.run(batch, plan.args);
	selection.set(plan.ids);
}

/** Copy or cut run from a menu or the palette: through a real copy event when the browser allows. */
let fromMenu = false;
export const clipboardFromMenu = () => fromMenu;
export function copyFromMenu(cut: boolean) {
	fromMenu = true;
	let done = false;
	const mark = () => (done = true);
	document.addEventListener('copy', mark, { once: true });
	try {
		document.execCommand('copy');
	} finally {
		fromMenu = false;
		document.removeEventListener('copy', mark);
	}
	if (!done) copySelection(null);
	if (cut) deleteSelection(false);
}

/**
 * Jump to an element (the validation panel): on the diagram that shows it, this one first, with
 * roving focus on it; an element no diagram shows is revealed in the Outline instead.
 */
export function jumpTo(id: Id) {
	const p = projectStore.project;
	const d = projectStore.diagram.elementIds.includes(id)
		? projectStore.diagram
		: p.diagrams.find((x) => x.elementIds.includes(id));
	if (!d) {
		selection.set([id]);
		explorerFocus.reveal(id);
		return;
	}
	projectStore.activeDiagramId = d.id;
	focusElement(id);
	requestAnimationFrame(() => canvasFocus.focus());
}
