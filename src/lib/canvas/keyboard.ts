import type { ClassifierKind, Id, LineStyle } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import {
	deleteSelection,
	nudgeSelection,
	setLineStyleForSelection,
	startEditing,
	startLink,
	stopEditing
} from './actions.ts';
import type { Rect } from './edges/geometry.ts';
import { canvasFocus, explorerFocus } from './focus.ts';
import { nearestInDirection, type Direction } from './link.ts';

const inTextField = (e: KeyboardEvent) =>
	e.target instanceof Element &&
	e.target.closest('input, textarea, select, [contenteditable="true"]') !== null;

/** StarUML's line-style chords (keyboard.md). Matched on the physical key: ⌥ changes `key` on macOS. */
function lineStyleChord(e: KeyboardEvent): LineStyle | null {
	if (e.code === 'KeyL' && !e.shiftKey) return e.altKey ? 'roundrect' : 'rectilinear';
	if (e.code === 'KeyB' && e.altKey && !e.shiftKey) return 'curve';
	if (e.code === 'KeyB' && e.shiftKey && !e.altKey) return 'oblique';
	return null;
}

/** Bindings from docs/spec/keyboard.md that work everywhere. */
export function handleGlobalKey(e: KeyboardEvent) {
	const mod = e.metaKey || e.ctrlKey;
	if (!mod) return;
	const style = lineStyleChord(e);
	if (style) {
		if (!inTextField(e) && setLineStyleForSelection(style)) e.preventDefault();
		return;
	}
	if (e.altKey) return;
	const key = e.key.toLowerCase();
	if (key === 'b' && !e.shiftKey) {
		ui.panels.outline = !ui.panels.outline;
	} else if (key === 'e' && !e.shiftKey) {
		// Select in Outline: open the drawer and move focus to the selected element's row.
		ui.panels.outline = true;
		explorerFocus.reveal(selection.list[0] ?? null);
	} else if (key === 'd' && !e.shiftKey) {
		// Select in diagram: focus returns to the canvas with the same selection.
		canvasFocus.focus();
	} else if (inTextField(e)) {
		return;
	} else if (key === 'z') {
		if (e.shiftKey) projectStore.redo();
		else projectStore.undo();
	} else if (key === 'y' && !e.shiftKey) {
		projectStore.redo();
	} else return;
	e.preventDefault();
}

const CREATE_KEYS: Record<string, ClassifierKind> = {
	c: 'class',
	i: 'interface',
	e: 'enum',
	d: 'dataType'
};
const ARROWS: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down'
};

export interface CanvasKeyContext {
	create: (kind: ClassifierKind) => void;
	rects: () => Map<Id, Rect>;
	openPicker: (sourceId: Id, targetId: Id) => void;
}

/** Bindings that fire only while the canvas has focus and nothing is being edited. */
export function handleCanvasKey(e: KeyboardEvent, ctx: CanvasKeyContext) {
	if (inTextField(e)) return;
	const mod = e.metaKey || e.ctrlKey;

	// Keyboard link: arrows move the target, ↩ opens the picker, Esc cancels.
	if (ui.link) {
		if (mod || e.altKey) return;
		const dir = ARROWS[e.key];
		if (dir) {
			const next = nearestInDirection(ctx.rects(), ui.link.targetId, dir);
			if (next) ui.link = { ...ui.link, targetId: next };
		} else if (e.key === 'Enter') {
			ctx.openPicker(ui.link.sourceId, ui.link.targetId);
		} else if (e.key === 'Escape') {
			ui.link = null;
		}
		e.preventDefault();
		return;
	}

	if (e.altKey) return;
	const step = e.shiftKey ? 8 : 1;
	switch (e.key) {
		case 'ArrowLeft':
		case 'ArrowRight':
		case 'ArrowUp':
		case 'ArrowDown': {
			if (mod) return;
			const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
			const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
			nudgeSelection(dx, dy);
			break;
		}
		case 'Backspace':
		case 'Delete':
			deleteSelection(mod);
			break;
		case 'Escape':
			if (selection.editing) stopEditing();
			else selection.clear();
			break;
		case 'Enter':
		case 'F2':
			if (mod) return;
			startEditing();
			break;
		default: {
			if (mod || e.shiftKey) return;
			const k = e.key.toLowerCase();
			if (k === 'l') {
				if (!startLink(ctx.rects())) return;
				break;
			}
			const kind = CREATE_KEYS[k];
			if (!kind) return;
			ctx.create(kind);
		}
	}
	e.preventDefault();
}
