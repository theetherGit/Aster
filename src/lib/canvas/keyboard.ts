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
import { nearestInDirection, type Direction } from './link.ts';

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
		if (c.when && !c.when()) return false;
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
	dispatch(e, 'canvas');
}
