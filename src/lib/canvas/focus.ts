import type { Id } from '#lib/model/types.ts';
import { announce } from '#lib/stores/live.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection, type FocusPart } from '#lib/stores/selection.svelte.ts';
import { elementSummary } from './summary.ts';

/** The element that owns roving focus in the DOM (`data-focus-id` + `data-part`), if rendered. */
export function focusOwner(root: ParentNode): HTMLElement | SVGElement | null {
	const f = selection.focus;
	if (!f) return null;
	const sel = f.part.startsWith('edge:')
		? `.uml-edge[data-rel-id="${CSS.escape(f.part.slice(5))}"]`
		: f.part === 'self' && projectStore.project.elements.get(f.id)?.kind === 'relationship'
			? `.uml-edge[data-rel-id="${CSS.escape(f.id)}"]`
			: `[data-focus-id="${CSS.escape(f.id)}"][data-part="${CSS.escape(f.part)}"]`;
	return root.querySelector<HTMLElement | SVGElement>(sel);
}

/**
 * The focusable canvas container. `focus()` gives the keyboard back to the diagram: to the roving
 * owner when an element has focus (after inline editing, say), else to the container itself.
 */
export const canvasFocus = {
	el: null as HTMLElement | null,
	focus() {
		if (!this.el) return;
		(focusOwner(this.el) ?? this.el).focus({ preventScroll: true });
	},
	/** Registered by the route: Esc at the top level hands focus to the next panel (F6 order). */
	leave: () => {}
};

/**
 * Move roving focus to an element's part (accessibility.md). Selection follows: the element, or
 * the edge when the part is an attached edge. A new element is announced by its summary.
 */
export function focusElement(id: Id, part: FocusPart = 'self') {
	const prev = selection.focus;
	selection.focus = { id, part };
	selection.set([part.startsWith('edge:') ? part.slice(5) : id]);
	// Entering the diagram, the keys come with the first element (board 10).
	if (prev?.id !== id)
		announce(elementSummary(projectStore.project, projectStore.diagram, id, { hint: !prev }));
}

/** Registered by the Explorer while mounted: reveal and focus an element's row (⌘E). */
export const explorerFocus: { reveal: (id: Id | null) => void; pending: Id | null } = {
	reveal: () => {},
	pending: null
};

/** Registered by the canvas while mounted: the rendered rectangles of the diagram's nodes (export, thumbnails). */
export const canvasRects: { get: () => Map<Id, { x: number; y: number; w: number; h: number }> } = {
	get: () => new Map()
};
