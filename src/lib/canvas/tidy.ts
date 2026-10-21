/**
 * features.md M3, "Auto-layout and tidy": the arithmetic behind align, distribute and same size,
 * on the node rects as measured on screen; front / back is the restack command itself. Pure;
 * the canvas actions turn the results into commands.
 */
import type { Id } from '#lib/model/types.ts';
import type { Rect } from './edges/geometry.ts';

/** StarUML's names: centre lines up x, middle lines up y. */
export type Side = 'left' | 'right' | 'top' | 'bottom' | 'centre' | 'middle';
export type Axis = 'horizontal' | 'vertical';
export type Dimension = 'width' | 'height' | 'size';

const boxes = (rects: Map<Id, Rect>, ids: Id[]) =>
	ids.flatMap((id) => {
		const r = rects.get(id);
		return r ? [{ id, ...r }] : [];
	});

/** New positions lining the boxes up on one side (or centre line) of their bounding box. */
export function align(rects: Map<Id, Rect>, ids: Id[], side: Side) {
	const b = boxes(rects, ids);
	const left = Math.min(...b.map((r) => r.x));
	const top = Math.min(...b.map((r) => r.y));
	const right = Math.max(...b.map((r) => r.x + r.w));
	const bottom = Math.max(...b.map((r) => r.y + r.h));
	return b.map((r) => ({
		id: r.id,
		x:
			side === 'left'
				? left
				: side === 'right'
					? right - r.w
					: side === 'centre'
						? Math.round((left + right) / 2 - r.w / 2)
						: r.x,
		y:
			side === 'top'
				? top
				: side === 'bottom'
					? bottom - r.h
					: side === 'middle'
						? Math.round((top + bottom) / 2 - r.h / 2)
						: r.y
	}));
}

/** The outer two stay; the boxes between are moved so every gap is the same. Needs three. */
export function distribute(rects: Map<Id, Rect>, ids: Id[], axis: Axis) {
	const b = boxes(rects, ids);
	if (b.length < 3) return [];
	const [pos, size] = axis === 'horizontal' ? (['x', 'w'] as const) : (['y', 'h'] as const);
	b.sort((p, q) => p[pos] - q[pos]);
	const last = b.at(-1)!;
	const span = last[pos] + last[size] - b[0][pos];
	const gap = (span - b.reduce((s, r) => s + r[size], 0)) / (b.length - 1);
	let at = b[0][pos];
	return b.map((r, i) => {
		const placed = i === 0 || i === b.length - 1 ? r[pos] : Math.round(at);
		at = placed + r[size] + gap;
		return {
			id: r.id,
			x: axis === 'horizontal' ? placed : r.x,
			y: axis === 'vertical' ? placed : r.y
		};
	});
}

/** Every box as wide, as high, or both, as the largest in the selection. */
export function sameSize(rects: Map<Id, Rect>, ids: Id[], dim: Dimension) {
	const b = boxes(rects, ids);
	const w = Math.max(...b.map((r) => r.w));
	const h = Math.max(...b.map((r) => r.h));
	return b.map((r) => ({
		id: r.id,
		w: dim === 'height' ? r.w : w,
		h: dim === 'width' ? r.h : h
	}));
}
