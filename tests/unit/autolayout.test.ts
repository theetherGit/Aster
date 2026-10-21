import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';
import { layout, type LayoutInput } from '#lib/canvas/autolayout.ts';

/**
 * features.md M3, "Auto-layout and tidy": "100-class imported diagram with no layout lays out
 * readably in under 1 s". Readably here: no two boxes overlap, parents sit above their children.
 */
const elk = new ELK();

function hundred(): LayoutInput {
	const nodes = Array.from({ length: 100 }, (_, i) => ({
		id: `C${i}`,
		w: 160,
		h: 60 + (i % 5) * 20
	}));
	const edges = [];
	// A tree of generalisations (child → parent), plus associations across it.
	for (let i = 1; i < 100; i++)
		edges.push({
			id: `g${i}`,
			source: `C${i}`,
			target: `C${Math.floor((i - 1) / 3)}`,
			upward: true
		});
	for (let i = 0; i < 30; i++)
		edges.push({ id: `a${i}`, source: `C${(i * 7) % 100}`, target: `C${(i * 13 + 5) % 100}` });
	return { nodes, edges: edges.filter((e) => e.source !== e.target) };
}

const overlap = (a: { x: number; y: number; w: number; h: number }, b: typeof a) =>
	a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('auto-layout', () => {
	it('lays out 100 classes in under a second with no overlaps, parents above children', async () => {
		const input = hundred();
		const t0 = performance.now();
		const out = await layout(
			elk,
			input,
			{ algorithm: 'orthogonal', direction: 'DOWN' },
			{ x: 40, y: 40 }
		);
		expect(performance.now() - t0).toBeLessThan(1000);
		const boxes = input.nodes.map((n) => ({ ...out.positions.get(n.id)!, w: n.w, h: n.h }));
		expect(boxes.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y))).toBe(true);
		for (let i = 0; i < boxes.length; i++)
			for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j])).toBe(false);
		// The layout starts at the origin given.
		expect(Math.min(...boxes.map((b) => b.x))).toBe(40);
		expect(Math.min(...boxes.map((b) => b.y))).toBe(40);
		// Generalisations point up: the parent's bottom is above the child's top.
		const y = (id: string) => out.positions.get(id)!.y;
		expect(y('C0') + 60).toBeLessThanOrEqual(y('C1'));
		// Orthogonal routing: every waypoint run turns at right angles.
		for (const points of out.waypoints.values())
			for (let k = 1; k < points.length; k++)
				expect(points[k].x === points[k - 1].x || points[k].y === points[k - 1].y).toBe(true);
	});

	it('runs in each of the four directions', async () => {
		const input: LayoutInput = {
			nodes: [
				{ id: 'A', w: 100, h: 50 },
				{ id: 'B', w: 100, h: 50 }
			],
			edges: [{ id: 'e', source: 'A', target: 'B' }]
		};
		const go = (direction: 'DOWN' | 'UP' | 'RIGHT' | 'LEFT') =>
			layout(elk, input, { algorithm: 'layered', direction }, { x: 0, y: 0 });
		const down = await go('DOWN');
		expect(down.positions.get('A')!.y).toBeLessThan(down.positions.get('B')!.y);
		const up = await go('UP');
		expect(up.positions.get('A')!.y).toBeGreaterThan(up.positions.get('B')!.y);
		const right = await go('RIGHT');
		expect(right.positions.get('A')!.x).toBeLessThan(right.positions.get('B')!.x);
		const left = await go('LEFT');
		expect(left.positions.get('A')!.x).toBeGreaterThan(left.positions.get('B')!.x);
	});
});

describe('auto-layout quality (owner review, 2026-10-21)', () => {
	const box = (id: string, x = 0, y = 0, w = 140, h = 60) => ({ id, w, h, x, y });
	const opts = { algorithm: 'orthogonal', direction: 'DOWN', aspect: 1.6 } as const;

	it('packs unconnected classes into a block beside the graph, not a strip', async () => {
		const input: LayoutInput = {
			nodes: [
				...['A', 'B', 'C', 'D'].map((id) => box(id)),
				...Array.from({ length: 12 }, (_, i) => box(`E${i}`, 1000, i * 70))
			],
			edges: [
				{ id: 'ab', source: 'A', target: 'B' },
				{ id: 'bc', source: 'B', target: 'C' },
				{ id: 'cd', source: 'C', target: 'D' }
			]
		};
		const out = await layout(elk, input, opts, { x: 0, y: 0 });
		const at = (id: string) => out.positions.get(id)!;
		const mainRight = Math.max(...['A', 'B', 'C', 'D'].map((id) => at(id).x + 140));
		const loose = Array.from({ length: 12 }, (_, i) => at(`E${i}`));
		// Beside the graph (to its right, in a top-to-bottom layout) …
		for (const p of loose) expect(p.x).toBeGreaterThan(mainRight);
		// … in a block, not a single row or column.
		expect(new Set(loose.map((p) => p.x)).size).toBeGreaterThan(1);
		expect(new Set(loose.map((p) => p.y)).size).toBeGreaterThan(1);
		// Kept in the order they were in (top to bottom here).
		expect(loose[0].y).toBeLessThanOrEqual(loose[1].y);
	});

	it('brings every subclass into its parent at one point, so one triangle shows', async () => {
		const input: LayoutInput = {
			nodes: [box('P'), ...['a', 'b', 'c', 'd', 'e'].map((id, i) => box(id, i * 200, 200))],
			edges: ['a', 'b', 'c', 'd', 'e'].map((id) => ({
				id: `g${id}`,
				source: id,
				target: 'P',
				upward: true
			}))
		};
		const out = await layout(elk, input, opts, { x: 0, y: 0 });
		const centre = out.positions.get('P')!.x + 70;
		for (const id of ['a', 'b', 'c', 'd', 'e']) {
			const bends = out.waypoints.get(`g${id}`) ?? [];
			const lastX = bends.length ? bends.at(-1)!.x : out.positions.get(id)!.x + 70;
			expect(lastX).toBe(centre);
		}
	});

	it('leaves more room between rows when edges carry labels', async () => {
		const pair = (labelled: boolean): LayoutInput => ({
			nodes: [box('A'), box('B')],
			edges: [{ id: 'e', source: 'A', target: 'B', labelled }]
		});
		const gap = async (labelled: boolean) => {
			const out = await layout(elk, pair(labelled), opts, { x: 0, y: 0 });
			return out.positions.get('B')!.y - out.positions.get('A')!.y;
		};
		expect(await gap(true)).toBeGreaterThan(await gap(false));
	});

	it('gives the same layout when run again on its own result, loose classes included', async () => {
		const base = hundred();
		const input: LayoutInput = {
			...base,
			nodes: [
				...base.nodes,
				...Array.from({ length: 9 }, (_, i) => box(`L${i}`, 500 - i * 40, i * 30))
			]
		};
		const first = await layout(elk, input, opts, { x: 40, y: 40 });
		const again: LayoutInput = {
			...input,
			nodes: input.nodes.map((n) => ({ ...n, ...first.positions.get(n.id)! }))
		};
		const second = await layout(elk, again, opts, { x: 40, y: 40 });
		expect([...second.positions]).toEqual([...first.positions]);
	});
});
