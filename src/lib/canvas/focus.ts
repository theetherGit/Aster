/** The focusable canvas container; focus returns here whenever inline editing ends. */
export const canvasFocus = {
	el: null as HTMLElement | null,
	focus() {
		this.el?.focus();
	}
};
