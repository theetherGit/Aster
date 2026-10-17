import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { deleteSelection, nudgeSelection, startEditing, stopEditing } from './actions.ts';

const inTextField = (e: KeyboardEvent) =>
	e.target instanceof Element &&
	e.target.closest('input, textarea, [contenteditable="true"]') !== null;

/** Bindings from docs/spec/keyboard.md that work everywhere: undo and redo. */
export function handleGlobalKey(e: KeyboardEvent) {
	const mod = e.metaKey || e.ctrlKey;
	if (!mod || e.altKey || inTextField(e)) return;
	const key = e.key.toLowerCase();
	if (key === 'z') {
		if (e.shiftKey) projectStore.redo();
		else projectStore.undo();
		e.preventDefault();
	} else if (key === 'y' && !e.shiftKey) {
		projectStore.redo();
		e.preventDefault();
	}
}

/** Bindings that fire only while the canvas has focus and nothing is being edited. */
export function handleCanvasKey(e: KeyboardEvent, createClass: () => void) {
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
			if (selection.editingId) stopEditing();
			else selection.clear();
			break;
		case 'Enter':
		case 'F2':
			if (mod) return;
			startEditing();
			break;
		default:
			if (mod || e.shiftKey) return;
			if (e.key.toLowerCase() === 'c') createClass();
			else return;
	}
	e.preventDefault();
}
