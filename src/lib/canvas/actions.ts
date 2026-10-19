import {
	addClassifier,
	addNote,
	addText,
	batch,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	resizeNode,
	setLineStyle
} from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import { t } from '#lib/i18n/index.ts';
import { newId } from '#lib/model/ids.ts';
import { createClassifier, elementName, nextClassName } from '#lib/model/project.ts';
import type { ClassifierKind, Id, LineStyle, Point } from '#lib/model/types.ts';
import type { MemberKind } from '#lib/mdj/expression.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import type { Rect } from './edges/geometry.ts';
import { announce } from '#lib/stores/live.svelte.ts';
import {
	copyPayload,
	parsePayload,
	PAYLOAD_MIME,
	planPaste,
	plainText,
	type ClipboardPayload
} from './clipboard.ts';
import { canvasFocus, explorerFocus, focusElement } from './focus.ts';
import { edit, endEditing } from './inline.ts';
import { firstTarget } from './link.ts';
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
	projectStore.run(addClassifier, {
		diagramId: projectStore.activeDiagramId,
		classifier,
		at: freePosition(at, taken)
	});
	edit(classifier.id, { part: 'name' });
}

const selectedWith = (kind: 'node' | 'edge') =>
	selection.list.filter((id) => projectStore.diagram.layout.get(id)?.kind === kind);

/** Arrows: nudge the selected nodes. Edges follow their nodes. */
export function nudgeSelection(dx: number, dy: number) {
	const ids = selectedWith('node');
	if (!ids.length) return;
	projectStore.run(moveNode, { diagramId: projectStore.activeDiagramId, ids, dx, dy });
}

/** ⇧+arrows: resize the one selected note by 8 px (keyboard.md; packages come with M3). */
export function resizeSelection(dw: number, dh: number): boolean {
	const ids = selectedWith('node').filter(
		(id) => projectStore.project.elements.get(id)?.kind === 'note'
	);
	if (ids.length !== 1 || selection.size !== 1) return false;
	const l = projectStore.diagram.layout.get(ids[0]);
	if (l?.kind !== 'node') return false;
	projectStore.run(resizeNode, {
		diagramId: projectStore.activeDiagramId,
		id: ids[0],
		w: Math.max(120, l.w + dw),
		h: Math.max(60, l.h + dh)
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
	else if (kind === 'note' || kind === 'text') edit(id, { part: 'text' });
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
