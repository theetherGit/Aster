import { cubicOut } from 'svelte/easing';
import { slide, type SlideParams, type TransitionConfig } from 'svelte/transition';

/**
 * Side panels (Outline, inspector) slide open and shut along x in 160 ms, ease-out; nothing moves
 * when the user asked for reduced motion (ui.md, accessibility.md). Svelte drives the frames, so
 * the CSS reduced-motion rule in layout.css cannot reach them: the check lives here.
 */
export function panelSlide(node: Element, params: SlideParams = {}): TransitionConfig {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { duration: 0 };
	return slide(node, { axis: 'x', duration: 160, easing: cubicOut, ...params });
}
