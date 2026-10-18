import { clearTextWidths } from './measure.ts';

/**
 * Turns true once the bundled paper font has loaded. Label widths measured before then came
 * from a fallback font, so the cache is dropped and edge labels lay out again.
 */
export const paperFont = $state({ ready: false });

if (typeof document !== 'undefined' && 'fonts' in document) {
	Promise.all([
		document.fonts.load('12px "Source Sans 3"'),
		document.fonts.load('italic 12px "Source Sans 3"')
	])
		.then(() => document.fonts.ready)
		.then(() => {
			clearTextWidths();
			paperFont.ready = true;
		});
}
