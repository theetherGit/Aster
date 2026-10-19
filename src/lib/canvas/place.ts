import type { Point } from '#lib/model/types.ts';
import type { Rect } from './edges/geometry.ts';

export const GRID = 20;
/** Default footprint of a brand-new classifier: 160 wide, name row plus two empty compartments. */
export const NEW_NODE = { w: 160, h: 44 };

const clear = (r: Rect, taken: Rect[], gap: number) =>
	!taken.some(
		(t) =>
			r.x < t.x + t.w + gap &&
			r.x + r.w + gap > t.x &&
			r.y < t.y + t.h + gap &&
			r.y + r.h + gap > t.y
	);
const snap = (v: number) => Math.round(v / GRID) * GRID;

/**
 * Where a new node of `size` goes when the user asked for `at`: `at` itself when nothing is
 * there, else the nearest grid step to the right, below, or diagonally that is clear of every
 * `taken` rect by `gap`. Nodes never land on top of each other.
 */
export function freePosition(at: Point, taken: Iterable<Rect>, size = NEW_NODE, gap = GRID): Point {
	const rects = [...taken];
	if (clear({ ...at, ...size }, rects, gap)) return at;
	const sx = snap(at.x);
	const sy = snap(at.y);
	for (let k = 1; k < 200; k++) {
		const step = k * GRID;
		for (const p of [
			{ x: sx + step, y: sy },
			{ x: sx, y: sy + step },
			{ x: sx + step, y: sy + step }
		])
			if (clear({ ...p, ...size }, rects, gap)) return p;
	}
	return at;
}

/** ⌘⇧D (keyboard.md): the spot right of a selection, one grid step past its right edge, level with its top. */
export function rightOf(selected: Iterable<Rect>): Point | null {
	const boxes = [...selected];
	if (!boxes.length) return null;
	return {
		x: Math.max(...boxes.map((b) => b.x + b.w)) + GRID,
		y: Math.min(...boxes.map((b) => b.y))
	};
}
