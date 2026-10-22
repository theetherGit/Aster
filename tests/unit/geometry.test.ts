import { describe, expect, it } from 'vitest';
import {
	DEFAULT_OFFSETS,
	boxHitsPolyline,
	boxHitsRect,
	clipToRect,
	endFrame,
	midFrame,
	offsetFor,
	pathD,
	placeLabel,
	polar,
	route,
	samplePath,
	type Rect
} from '#lib/canvas/edges/geometry.ts';
import type { LineStyle } from '#lib/model/types.ts';
import { rng } from './helpers.ts';

const A: Rect = { x: 0, y: 0, w: 100, h: 60 };
const B: Rect = { x: 300, y: 200, w: 120, h: 80 };
const STYLES: LineStyle[] = ['oblique', 'rectilinear', 'roundrect', 'curve'];

describe('routing', () => {
	it('clips to the border on the ray from the centre', () => {
		expect(clipToRect(A, { x: 500, y: 30 })).toEqual({ x: 100, y: 30 });
		expect(clipToRect(A, { x: 50, y: -500 })).toEqual({ x: 50, y: 0 });
	});

	it('oblique: straight from border to border', () => {
		const { points } = route(A, B, [], 'oblique', false);
		const onBorder = (r: Rect, p: { x: number; y: number }) =>
			(Math.abs(p.x - r.x) < 1e-6 ||
				Math.abs(p.x - r.x - r.w) < 1e-6 ||
				Math.abs(p.y - r.y) < 1e-6 ||
				Math.abs(p.y - r.y - r.h) < 1e-6) &&
			p.x >= r.x &&
			p.x <= r.x + r.w &&
			p.y >= r.y &&
			p.y <= r.y + r.h;
		expect(points).toHaveLength(2);
		expect(onBorder(A, points[0]) && onBorder(B, points[1])).toBe(true);
		// Both endpoints lie on the line between the centres.
		const cross = (p: { x: number; y: number }) =>
			(p.x - 50) * (240 - 30) - (p.y - 30) * (360 - 50);
		expect(Math.abs(cross(points[0])) + Math.abs(cross(points[1]))).toBeLessThan(1);
	});

	it('rectilinear: every segment is horizontal or vertical, with or without waypoints', () => {
		for (const wps of [
			[],
			[{ x: 200, y: 400 }],
			[
				{ x: 150, y: -50 },
				{ x: 500, y: 100 }
			]
		]) {
			const { points } = route(A, B, wps, 'rectilinear', false);
			for (let i = 1; i < points.length; i++) {
				const [p, q] = [points[i - 1], points[i]];
				expect(p.x === q.x || p.y === q.y).toBe(true);
			}
			expect(points[0]).not.toEqual(points[1]);
		}
	});

	it('rectilinear: overlapping spans give one straight segment', () => {
		const below: Rect = { x: 20, y: 200, w: 100, h: 60 };
		const { points } = route(A, below, [], 'rectilinear', false);
		expect(points).toHaveLength(2);
		expect(points[0].x).toBe(points[1].x);
		expect(points[0].y).toBe(60);
		expect(points[1].y).toBe(200);
	});

	it('rectilinear: a first or last bend straight above, below or beside a node is where the line meets it', () => {
		// ELK's ports and StarUML's own attachments sit off the centre; the line drops straight from them.
		const below: Rect = { x: 0, y: 300, w: 100, h: 60 };
		const { points } = route(A, below, [{ x: 80, y: 150 }], 'rectilinear', false);
		expect(points[0]).toEqual({ x: 80, y: 60 });
		expect(points.at(-1)).toEqual({ x: 80, y: 300 });
		expect(points).toHaveLength(3);
		const beside: Rect = { x: 300, y: 0, w: 100, h: 60 };
		const side = route(A, beside, [{ x: 200, y: 15 }], 'rectilinear', false).points;
		expect(side[0]).toEqual({ x: 100, y: 15 });
		expect(side.at(-1)).toEqual({ x: 300, y: 15 });
	});

	it('passes through user waypoints in every style', () => {
		const wp = { x: 220, y: -40 };
		for (const style of STYLES) {
			const { points } = route(A, B, [wp], style, false);
			expect(points).toContainEqual(wp);
		}
	});

	it('a self-association is a loop off the top-right corner, starting on the top edge and ending on the right edge', () => {
		const { points } = route(A, A, [], 'oblique', true);
		expect(points[0].y).toBe(A.y);
		expect(points[0].x).toBeGreaterThan(A.x + A.w / 2);
		expect(points.at(-1)!.x).toBe(A.x + A.w);
		expect(points.at(-1)!.y).toBeLessThan(A.y + A.h / 2);
		expect(Math.max(...points.map((p) => p.x))).toBeGreaterThan(A.x + A.w + 20);
		expect(Math.min(...points.map((p) => p.y))).toBeLessThan(A.y - 20);
	});

	it('paths: straight, rounded corners and curves', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 100 }
		];
		expect(pathD(pts, 'oblique')).toBe('M0,0 L100,0 L100,100');
		expect(pathD(pts, 'roundrect')).toMatch(/Q100,0 /);
		expect(pathD(pts, 'curve')).toMatch(/^M0,0 C/);
		expect(samplePath(pts, 'curve').length).toBeGreaterThan(pts.length);
	});
});

describe('label placement', () => {
	it('polar placement and offsetFor are inverses', () => {
		const frame = endFrame(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 50 }
			],
			'source'
		);
		const p = polar(frame, { alpha: 0.7, distance: 33 });
		const o = offsetFor(frame, p);
		expect(o.alpha).toBeCloseTo(0.7);
		expect(o.distance).toBeCloseTo(33);
	});

	it('end frames point into the edge; the mid frame sits at half length', () => {
		const pts = [
			{ x: 0, y: 0 },
			{ x: 100, y: 0 }
		];
		expect(endFrame(pts, 'source')).toEqual({ anchor: { x: 0, y: 0 }, theta: 0 });
		expect(endFrame(pts, 'target').theta).toBeCloseTo(Math.PI);
		expect(midFrame(pts, 'oblique').anchor).toEqual({ x: 50, y: 0 });
	});

	it('never puts a label on its own line or over its end node, whatever the offset, size or style', () => {
		const r = rng(7);
		for (let i = 0; i < 400; i++) {
			const src: Rect = { x: r.int(400), y: r.int(400), w: 120 + r.int(100), h: 60 + r.int(200) };
			const tgt: Rect = { x: r.int(900), y: r.int(900), w: 120 + r.int(100), h: 60 + r.int(200) };
			const self = r.int(8) === 0;
			const style = r.pick(STYLES);
			const wps = r.int(3) === 0 ? [{ x: r.int(900), y: r.int(900) }] : [];
			const { points } = route(src, self ? src : tgt, wps, style, self);
			const line = samplePath(points, style);
			const end = r.pick(['source', 'target'] as const);
			const frame = endFrame(line, end);
			const size = { w: 10 + r.int(140), h: 14 + r.int(20) };
			const offset = r.int(2)
				? DEFAULT_OFFSETS.targetRole
				: { alpha: r.next() * 6.28 - 3.14, distance: r.int(60) };
			const node = end === 'source' ? src : self ? src : tgt;
			const c = placeLabel(frame, offset, size, line, node);
			const box = { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h };
			expect(boxHitsPolyline(box, line), `case ${i}`).toBe(false);
			expect(boxHitsRect(box, node), `case ${i}`).toBe(false);
		}
	});

	it('labels at the same end clear each other as well as the line, including on a self-loop', () => {
		const r = rng(11);
		for (let i = 0; i < 200; i++) {
			const node: Rect = { x: 0, y: 0, w: 120 + r.int(100), h: 60 + r.int(120) };
			const self = i % 2 === 0;
			const other: Rect = { x: 300 + r.int(400), y: r.int(500) - 250, w: 140, h: 80 };
			const style = r.pick(STYLES);
			const { points } = route(node, self ? node : other, [], style, self);
			const line = samplePath(points, style);
			const placed: Rect[] = [];
			for (const end of ['source', 'target'] as const) {
				const frame = endFrame(line, end);
				const near = end === 'source' || self ? node : other;
				for (const key of [`${end}Role`, `${end}Multiplicity`] as const) {
					const size = { w: 20 + r.int(60), h: 15 };
					const c = placeLabel(frame, DEFAULT_OFFSETS[key], size, line, near, placed);
					const box = { x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h };
					expect(boxHitsPolyline(box, line), `case ${i} ${key}`).toBe(false);
					expect(
						placed.some((o) => boxHitsRect(box, o)),
						`case ${i} ${key}`
					).toBe(false);
					placed.push(box);
				}
			}
		}
	});
});
