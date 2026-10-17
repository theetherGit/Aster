/** Width of a label line in the paper font, measured once per text and size. */
const cache = new Map<string, number>();
let ctx: CanvasRenderingContext2D | null | undefined;

export function textWidth(text: string, size: number): number {
	const key = `${size}|${text}`;
	const hit = cache.get(key);
	if (hit !== undefined) return hit;
	if (ctx === undefined)
		ctx =
			typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
	let w: number;
	if (ctx) {
		const family =
			getComputedStyle(document.documentElement).getPropertyValue('--font-paper') || 'sans-serif';
		ctx.font = `${size}px ${family}`;
		w = ctx.measureText(text).width;
	} else {
		// ponytail: no canvas (tests, SSR): a generous average glyph width
		w = text.length * size * 0.62;
	}
	cache.set(key, w);
	return w;
}
