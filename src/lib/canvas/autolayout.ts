/**
 * features.md M3, "Auto-layout and tidy" (M3.3 prompt): ELK's layered algorithm in four
 * directions. "Orthogonal" is the same algorithm with orthogonal edge routing (ELK has no
 * separate orthogonal layout); "layered" routes edges as polylines. Pure given an ELK instance:
 * the app passes the worker-backed one (elk.ts), the tests the bundled one.
 *
 * Owner's review (2026-10-21, real StarUML files): classes with no edges are packed into a block
 * beside the graph rather than strung out by ELK; edges share one port per side, so a parent's
 * subclasses meet at one triangle and lines leave a box at its centre, where the canvas draws
 * them from; labelled edges get more room; the diagram's own order seeds ELK so a re-run is stable.
 */
import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js';
import type { Id, Point } from '#lib/model/types.ts';
import { GRID } from './place.ts';

export type Algorithm = 'layered' | 'orthogonal';
export type Direction = 'DOWN' | 'UP' | 'RIGHT' | 'LEFT';
export interface LayoutInput {
	/** In the diagram's own order, which seeds ELK; `x`, `y` (where it is now) order the loose block. */
	nodes: { id: Id; w: number; h: number; x?: number; y?: number }[];
	/**
	 * `upward`: the target belongs above the source (generalisation, realisation: parents on top).
	 * `labelled`: the edge carries a name, stereotype, role or multiplicity.
	 */
	edges: { id: Id; source: Id; target: Id; upward?: boolean; labelled?: boolean }[];
}
export interface LayoutOptions {
	algorithm: Algorithm;
	direction: Direction;
	/** The window's width over height: the loose block, and ELK's packing, lean toward it. */
	aspect?: number;
}
export interface LayoutResult {
	/** Top-left corners, offset so the layout's own top-left is at the origin given. */
	positions: Map<Id, Point>;
	/** Interior bend points, in the edge's own source → target order. */
	waypoints: Map<Id, Point[]>;
}

const GAP = GRID * 2;

export async function layout(
	elk: ELK,
	input: LayoutInput,
	{ algorithm, direction, aspect = 1.6 }: LayoutOptions,
	origin: Point
): Promise<LayoutResult> {
	const vertical = direction === 'DOWN' || direction === 'UP';
	const linked = new Set(input.edges.flatMap((e) => [e.source, e.target]));
	const nodes = input.nodes;
	const graphed = nodes.filter((n) => linked.has(n.id));
	// The loose block keeps the order its boxes have now, read the way the block fills: down the
	// columns beside a top-to-bottom layout, along the rows otherwise. A re-run refills it as is.
	const byColumn = graphed.length > 0 && vertical;
	const loose = nodes
		.filter((n) => !linked.has(n.id))
		.sort((a, b) => {
			const [ax, ay, bx, by] = [a.x ?? 0, a.y ?? 0, b.x ?? 0, b.y ?? 0];
			return byColumn ? ax - bx || ay - by : ay - by || ax - bx;
		});
	const rank = new Map(nodes.map((n, i) => [n.id, i]));
	const edges = [...input.edges].sort(
		(a, b) => rank.get(a.source)! - rank.get(b.source)! || rank.get(a.target)! - rank.get(b.target)!
	);
	const labelled = edges.some((e) => e.labelled);

	const positions = new Map<Id, Point>();
	const waypoints = new Map<Id, Point[]>();
	let main = { right: 0, bottom: 0 };

	if (graphed.length) {
		const graph: ElkNode = {
			id: '\u0000root',
			layoutOptions: {
				'elk.algorithm': 'layered',
				'elk.direction': direction,
				'elk.edgeRouting': algorithm === 'orthogonal' ? 'ORTHOGONAL' : 'POLYLINE',
				// One port per side: subclasses meet their parent at one point (one triangle), and a
				// line leaves a box at the centre of its side, where the canvas draws it from.
				'elk.layered.mergeEdges': 'true',
				// ELK's result depends on the graph and its order, never on where boxes are now: fed
				// in the diagram's own (stable) order, a second run reproduces the first.
				'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
				'elk.aspectRatio': String(aspect),
				// Room for multiplicities and role names between boxes, on the paper's grid.
				'elk.spacing.nodeNode': String(GRID * 3),
				'elk.layered.spacing.nodeNodeBetweenLayers': String(GRID * (labelled ? 5 : 4)),
				'elk.spacing.edgeNode': String(GRID),
				'elk.spacing.edgeEdge': String(labelled ? GRID : GRID / 2),
				'elk.layered.spacing.edgeEdgeBetweenLayers': String(labelled ? GRID : GRID / 2),
				'elk.layered.spacing.edgeNodeBetweenLayers': String(GRID),
				'elk.spacing.componentComponent': String(GRID * 4)
			},
			children: graphed.map((n) => ({ id: n.id, width: n.w, height: n.h })),
			edges: edges.map((e): ElkExtendedEdge => ({
				id: e.id,
				sources: [e.upward ? e.target : e.source],
				targets: [e.upward ? e.source : e.target]
			}))
		};
		const out = await elk.layout(graph);
		const placed = out.children ?? [];
		const dx = -Math.min(...placed.map((n) => n.x ?? 0));
		const dy = -Math.min(...placed.map((n) => n.y ?? 0));
		const shift = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
		for (const n of placed) {
			const at = shift({ x: n.x ?? 0, y: n.y ?? 0 });
			positions.set(n.id, at);
			main = {
				right: Math.max(main.right, at.x + (n.width ?? 0)),
				bottom: Math.max(main.bottom, at.y + (n.height ?? 0))
			};
		}
		const upward = new Set(edges.filter((e) => e.upward).map((e) => e.id));
		for (const e of out.edges ?? []) {
			const points = (e.sections?.[0]?.bendPoints ?? []).map(shift);
			waypoints.set(e.id, upward.has(e.id) ? points.reverse() : points);
		}
	}

	if (loose.length) {
		// The loose block sits beside the graph across its flow: right of a top-to-bottom layout,
		// below a left-to-right one; on its own it takes the window's shape.
		const avgW = loose.reduce((s, n) => s + n.w, 0) / loose.length;
		const avgH = loose.reduce((s, n) => s + n.h, 0) / loose.length;
		const span = (extent: number, size: number) =>
			Math.max(1, Math.floor((extent + GAP) / (size + GAP)));
		const lines = !graphed.length
			? Math.max(1, Math.round(Math.sqrt((loose.length * avgH * aspect) / avgW)))
			: vertical
				? span(main.bottom, avgH)
				: span(main.right, avgW);
		// Columns of `lines` boxes beside a vertical layout; rows of `lines` boxes otherwise.
		const cols = byColumn ? Math.ceil(loose.length / lines) : lines;
		const rows = byColumn ? lines : Math.ceil(loose.length / lines);
		const cell = (i: number) =>
			byColumn ? [Math.floor(i / rows), i % rows] : [i % cols, Math.floor(i / cols)];
		const colW = Array<number>(cols).fill(0);
		const rowH = Array<number>(rows).fill(0);
		loose.forEach((n, i) => {
			const [c, r] = cell(i);
			colW[c] = Math.max(colW[c], n.w);
			rowH[r] = Math.max(rowH[r], n.h);
		});
		const start = !graphed.length
			? { x: 0, y: 0 }
			: vertical
				? { x: main.right + GRID * 4, y: 0 }
				: { x: 0, y: main.bottom + GRID * 4 };
		const offset = (sizes: number[], k: number) =>
			sizes.slice(0, k).reduce((s, v) => s + v + GAP, 0);
		loose.forEach((n, i) => {
			const [c, r] = cell(i);
			positions.set(n.id, { x: start.x + offset(colW, c), y: start.y + offset(rowH, r) });
		});
	}

	// The whole layout's top-left lands on the origin, on whole pixels.
	const all = [...positions.values()];
	const ox = origin.x - Math.min(...all.map((p) => p.x));
	const oy = origin.y - Math.min(...all.map((p) => p.y));
	const place = (p: Point) => ({ x: Math.round(p.x + ox), y: Math.round(p.y + oy) });
	for (const [id, p] of positions) positions.set(id, place(p));
	for (const [id, points] of waypoints) waypoints.set(id, points.map(place));
	return { positions, waypoints };
}
