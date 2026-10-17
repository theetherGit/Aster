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
