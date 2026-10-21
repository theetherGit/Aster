import { describe, expect, it } from 'vitest';
import { freePosition, GRID, NEW_NODE, rightOf } from '#lib/canvas/place.ts';

const box = (x: number, y: number, w = 160, h = 80) => ({ x, y, w, h });

describe('free-space placement', () => {
	it('keeps the requested point when nothing is there', () => {
		expect(freePosition({ x: 33, y: 47 }, [])).toEqual({ x: 33, y: 47 });
		expect(freePosition({ x: 500, y: 500 }, [box(0, 0)])).toEqual({ x: 500, y: 500 });
	});

	it('moves to the nearest clear grid step, right or down, a gap away', () => {
		// A wide neighbour: below is nearer than beside.
		expect(freePosition({ x: 8, y: 8 }, [box(0, 0)])).toEqual({ x: 0, y: 80 + GRID });
		// A tall, narrow neighbour: beside is nearer.
		expect(freePosition({ x: 8, y: 8 }, [box(0, 0, 40, 200)])).toEqual({ x: 40 + GRID, y: 0 });
	});

	it('goes down when the row to the right is full', () => {
		// A wall of nodes to the right for 2000 px; below is free.
		const wall = Array.from({ length: 12 }, (_, i) => box(i * 170, 0));
		const p = freePosition({ x: 0, y: 0 }, wall);
		expect(p).toEqual({ x: 0, y: 80 + GRID });
	});

	it('counts the new node’s own size when testing overlap', () => {
		// Free point, but the node would hang into a neighbour 100 px to the right.
		const p = freePosition({ x: 0, y: 0 }, [box(100, 0)]);
		expect(p.x + NEW_NODE.w + GRID <= 100 || p.y >= 80 + GRID).toBe(true);
		expect(p).not.toEqual({ x: 0, y: 0 });
	});
});

describe('repeat-last-create placement (right of the selection)', () => {
	it('is one grid step past the right edge of the selection, level with its top', () => {
		expect(rightOf([box(100, 50)])).toEqual({ x: 100 + 160 + GRID, y: 50 });
		expect(rightOf([box(100, 50), box(400, 20, 100, 40)])).toEqual({ x: 500 + GRID, y: 20 });
	});

	it('is nothing without a selection, so the cursor rule applies', () => {
		expect(rightOf([])).toBeNull();
	});

	it('lands clear of the selection once freePosition has its say', () => {
		const sel = box(100, 50);
		const at = rightOf([sel])!;
		expect(freePosition(at, [sel])).toEqual(at);
	});
});
