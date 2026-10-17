import { describe, expect, it } from 'vitest';
import { firstTarget, nearestInDirection } from '#lib/canvas/link.ts';
import type { Rect } from '#lib/canvas/edges/geometry.ts';

const r = (x: number, y: number): Rect => ({ x, y, w: 100, h: 50 });
const rects = new Map<string, Rect>([
	['src', r(400, 400)],
	['left', r(100, 410)],
	['farLeft', r(-300, 400)],
	['upLeft', r(250, 100)],
	['right', r(700, 380)],
	['down', r(420, 700)]
]);

describe('keyboard link targeting', () => {
	it('moves to the nearest element in the arrow direction, weighted toward the axis', () => {
		expect(nearestInDirection(rects, 'src', 'left')).toBe('left');
		expect(nearestInDirection(rects, 'src', 'right')).toBe('right');
		expect(nearestInDirection(rects, 'src', 'down')).toBe('down');
		expect(nearestInDirection(rects, 'src', 'up')).toBe('upLeft');
		expect(nearestInDirection(rects, 'left', 'left')).toBe('farLeft');
		expect(nearestInDirection(rects, 'farLeft', 'left')).toBeNull();
	});

	it('starts on the nearest other element, or on the source itself when it is alone', () => {
		expect(firstTarget(rects, 'src')).toBe('left');
		expect(firstTarget(new Map([['only', r(0, 0)]]), 'only')).toBe('only');
	});
});
