import type { ClassifierKind } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import { deleteSelection, nudgeSelection, startEditing, stopEditing } from './actions.ts';
import { canvasFocus } from './focus.ts';
import { explorerFocus } from './focus.ts';

const inTextField = (e: KeyboardEvent) =>
	e.target instanceof Element &&
	e.target.closest('input, textarea, select, [contenteditable="true"]') !== null;

/** Bindings from docs/spec/keyboard.md that work everywhere. */
export function handleGlobalKey(e: KeyboardEvent) {
	const mod = e.metaKey || e.ctrlKey;
	if (!mod || e.altKey) return;
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

/** Bindings that fire only while the canvas has focus and nothing is being edited. */
export function handleCanvasKey(e: KeyboardEvent, create: (kind: ClassifierKind) => void) {
	if (inTextField(e) || e.altKey) return;
	const mod = e.metaKey || e.ctrlKey;
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
			const kind = CREATE_KEYS[e.key.toLowerCase()];
			if (!kind) return;
			create(kind);
		}
	}
	e.preventDefault();
}
