import { describe, expect, it } from 'vitest';
import { connect, restack, setWaypoints, Stack } from '#lib/commands/index.ts';
import { align, distribute, sameSize } from '#lib/canvas/tidy.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { getDiagram } from '#lib/model/project.ts';
import { structural } from './helpers.ts';

/** features.md M3, "Auto-layout and tidy": align, distribute, same-size, front/back, all undoable. */
const rects = new Map([
	['a', { x: 0, y: 0, w: 100, h: 50 }],
	['b', { x: 300, y: 100, w: 160, h: 80 }],
	['c', { x: 120, y: 40, w: 60, h: 30 }]
]);
const at = (r: { id: string; x: number; y: number }[]) =>
	Object.fromEntries(r.map(({ id, x, y }) => [id, [x, y]]));

describe('align', () => {
	it('lines up edges and centres on the selection bounding box', () => {
		const ids = ['a', 'b', 'c'];
		expect(at(align(rects, ids, 'left'))).toEqual({ a: [0, 0], b: [0, 100], c: [0, 40] });
		expect(at(align(rects, ids, 'right'))).toEqual({ a: [360, 0], b: [300, 100], c: [400, 40] });
		expect(at(align(rects, ids, 'top'))).toEqual({ a: [0, 0], b: [300, 0], c: [120, 0] });
		expect(at(align(rects, ids, 'bottom'))).toEqual({ a: [0, 130], b: [300, 100], c: [120, 150] });
		// Centre is horizontal (x), middle vertical (y), as StarUML names them.
		expect(at(align(rects, ids, 'centre'))).toEqual({ a: [180, 0], b: [150, 100], c: [200, 40] });
		expect(at(align(rects, ids, 'middle'))).toEqual({ a: [0, 65], b: [300, 50], c: [120, 75] });
	});
});

describe('distribute', () => {
	it('keeps the outer two and spaces the gaps between boxes evenly', () => {
		// Horizontally, by x: a (0–100), c (120–180), b (300–460): span 460, boxes 320, gaps 70.
		expect(at(distribute(rects, ['a', 'b', 'c'], 'horizontal'))).toEqual({
			a: [0, 0],
			c: [170, 40],
			b: [300, 100]
		});
		// Vertically, by y: a (0–50), c (40–70), b (100–180): span 180, boxes 160, gaps 10.
		expect(at(distribute(rects, ['a', 'b', 'c'], 'vertical'))).toEqual({
			a: [0, 0],
			c: [120, 60],
			b: [300, 100]
		});
	});
	it('needs three', () => {
		expect(distribute(rects, ['a', 'b'], 'horizontal')).toEqual([]);
	});
});

describe('same size', () => {
	it('takes the largest of the selection', () => {
		expect(sameSize(rects, ['a', 'c'], 'width')).toEqual([
			{ id: 'a', w: 100, h: 50 },
			{ id: 'c', w: 100, h: 30 }
		]);
		expect(sameSize(rects, ['a', 'c'], 'size')).toEqual([
			{ id: 'a', w: 100, h: 50 },
			{ id: 'c', w: 100, h: 50 }
		]);
	});
});

describe('stacking order', () => {
	it('brings to the front or sends to the back, keeping the moved ones in their order', () => {
		const project = sampleProject();
		const d = getDiagram(project, 'd1');
		d.elementIds = ['a', 'b', 'c', 'd'];
		const stack = new Stack(() => project);
		stack.run(restack(project, { diagramId: 'd1', ids: ['c', 'a'], place: 'front' }));
		expect(d.elementIds).toEqual(['b', 'd', 'a', 'c']);
		stack.undo();
		stack.run(restack(project, { diagramId: 'd1', ids: ['d', 'b'], place: 'back' }));
		expect(d.elementIds).toEqual(['b', 'd', 'a', 'c']);
		stack.undo();
		expect(d.elementIds).toEqual(['a', 'b', 'c', 'd']);
	});
});

describe('tidy commands', () => {
	it('restack and setWaypoints invert exactly', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		const d = getDiagram(project, 'd1');
		stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 'r1',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'association'
			})
		);
		const before = structural(project);
		stack.run(restack(project, { diagramId: 'd1', ids: ['Account'], place: 'front' }));
		expect(d.elementIds.at(-1)).toBe('Account');
		stack.run(
			setWaypoints(project, {
				diagramId: 'd1',
				id: 'r1',
				waypoints: [
					{ x: 10, y: 20 },
					{ x: 30, y: 40 }
				]
			})
		);
		expect(d.layout.get('r1')).toMatchObject({
			waypoints: [
				{ x: 10, y: 20 },
				{ x: 30, y: 40 }
			]
		});
		stack.undo();
		stack.undo();
		expect(structural(project)).toEqual(before);
	});
});
