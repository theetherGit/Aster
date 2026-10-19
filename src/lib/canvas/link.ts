/** Keyboard link targeting: spatial navigation between node rectangles. */
import type { Id } from '#lib/model/types.ts';
import { center, type Rect } from './edges/geometry.ts';

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Nearest element in a direction, by centre distance weighted toward the axis (accessibility.md). */
export function nearestInDirection(
	rects: ReadonlyMap<Id, Rect>,
	fromId: Id,
	dir: Direction
): Id | null {
	const from = rects.get(fromId);
	if (!from) return null;
	const c = center(from);
	let best: Id | null = null;
	let bestScore = Infinity;
	for (const [id, r] of rects) {
		if (id === fromId) continue;
		const o = center(r);
		const dx = o.x - c.x;
		const dy = o.y - c.y;
		const primary = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
		if (primary <= 0) continue;
		const score = primary + 2 * (dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx));
		if (score < bestScore) [best, bestScore] = [id, score];
	}
	return best;
}

/** Where a link starts pointing: the nearest other element, or the source itself (a self-association). */
export function firstTarget(rects: ReadonlyMap<Id, Rect>, sourceId: Id): Id {
	const from = rects.get(sourceId);
	if (!from) return sourceId;
	const c = center(from);
	let best = sourceId;
	let bestDist = Infinity;
	for (const [id, r] of rects) {
		if (id === sourceId) continue;
		const o = center(r);
		const d = Math.hypot(o.x - c.x, o.y - c.y);
		if (d < bestDist) [best, bestDist] = [id, d];
	}
	return best;
}

/** Where roving focus starts when nothing has it: the top-left element (reading order). */
export function firstElement(rects: ReadonlyMap<Id, Rect>): Id | null {
	let best: Id | null = null;
	let bestKey = Infinity;
	for (const [id, r] of rects) {
		const key = r.y * 4 + r.x; // rows first, then columns; a node a little lower but far left still reads first
		if (key < bestKey) [best, bestKey] = [id, key];
	}
	return best;
}
