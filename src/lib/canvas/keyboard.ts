/**
 * The keyboard router: every binding comes from the command registry (src/lib/app/commands),
 * which is docs/spec/keyboard.md as data. Only the modal flows live here: a keyboard link in
 * progress (arrows, ↩, Esc) and the editing keys the line editor owns.
 */
import { COMMANDS, type Context } from '#lib/app/commands.svelte.ts';
import { matches } from '#lib/app/shortcuts.ts';
import type { Id } from '#lib/model/types.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import type { Rect } from './edges/geometry.ts';
import { focusElement } from './focus.ts';
import { firstElement, nearestInDirection, type Direction } from './link.ts';
import { selection, type FocusPart } from '#lib/stores/selection.svelte.ts';

const inTextField = (e: KeyboardEvent) =>
	e.target instanceof Element &&
	e.target.closest('input, textarea, select, [contenteditable="true"]') !== null;

/** Run the first registered command whose shortcut and context match; true when one did. */
function dispatch(e: KeyboardEvent, context: Context): boolean {
	const typing = inTextField(e);
	for (const c of COMMANDS) {
		if (c.context !== context) continue;
		if (!c.keys.some((s) => matches(e, s))) continue;
		if (typing && !c.inText) return false;
		if (c.when && !c.when()) continue; // another command may own the chord in this layout
		c.run();
		e.preventDefault();
		return true;
	}
	return false;
}

/** Bindings that work everywhere (window listener). */
export function handleGlobalKey(e: KeyboardEvent) {
	// Overlays own their keys while open.
	if (ui.paletteOpen || ui.shortcutsOpen || ui.exportOpen) return;
	dispatch(e, 'global');
}

const ARROWS: Record<string, Direction> = {
	ArrowLeft: 'left',
	ArrowRight: 'right',
	ArrowUp: 'up',
	ArrowDown: 'down'
};

export interface CanvasKeyContext {
	rects: () => Map<Id, Rect>;
	openPicker: (sourceId: Id, targetId: Id) => void;
	/** An element's parts in Tab order, as rendered: self, name, each member line, each attached edge. */
	parts: (id: Id) => FocusPart[];
	/** ⇧F10: the context menu for the focused element (keyboard.md). */
	openMenu: () => void;
}

/** Arrows: roving focus to the nearest element that way; the first press lands top-left. */
function moveFocus(dir: Direction, rects: Map<Id, Rect>) {
	const from = selection.focus?.id;
	const next = from && rects.has(from) ? nearestInDirection(rects, from, dir) : firstElement(rects);
	if (next) focusElement(next);
}

/** Tab / ⇧Tab: the next / previous part of the focused element, wrapping. */
function cyclePart(back: boolean, ctx: CanvasKeyContext) {
	const f = selection.focus;
	if (!f) return;
	const parts = ctx.parts(f.id);
	const i = parts.indexOf(f.part);
	if (parts.length < 2 || i < 0) return;
	focusElement(f.id, parts[(i + (back ? -1 : 1) + parts.length) % parts.length]);
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
		} else return; // Tab and the rest keep their meaning; only the link's own keys are taken
		e.preventDefault();
		return;
	}
	// Roving focus (accessibility.md): bare arrows move between elements, Tab cycles parts.
	const dir = ARROWS[e.key];
	if (dir && !mod && !e.altKey && !e.shiftKey) {
		moveFocus(dir, ctx.rects());
		e.preventDefault();
		return;
	}
	if (e.key === 'Tab' && !mod && !e.altKey && selection.focus) {
		cyclePart(e.shiftKey, ctx);
		e.preventDefault();
		return;
	}
	if (e.key === 'F10' && e.shiftKey && !mod && !e.altKey) {
		ctx.openMenu();
		e.preventDefault(); // Windows would also raise the native contextmenu event
		return;
	}
	dispatch(e, 'canvas');
}
