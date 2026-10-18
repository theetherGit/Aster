import type { Id } from '#lib/model/types.ts';

/** The focusable canvas container; focus returns here whenever inline editing ends. */
export const canvasFocus = {
	el: null as HTMLElement | null,
	focus() {
		this.el?.focus();
	}
};

/** Registered by the Explorer while mounted: reveal and focus an element's row (⌘E). */
export const explorerFocus: { reveal: (id: Id | null) => void; pending: Id | null } = {
	reveal: () => {},
	pending: null
};

/** Registered by the canvas while mounted: the rendered rectangles of the diagram's nodes (export, thumbnails). */
export const canvasRects: { get: () => Map<Id, { x: number; y: number; w: number; h: number }> } = {
	get: () => new Map()
};
