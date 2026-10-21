/**
 * features.md M3, "Auto-layout and tidy" (M3.3 prompt): ELK's layered algorithm in four
 * directions. "Orthogonal" is the same algorithm with orthogonal edge routing (ELK has no
 * separate orthogonal layout); "layered" routes edges as polylines. Pure given an ELK instance:
 * the app passes the worker-backed one (elk.ts), the tests the bundled one.
 */
import type { ELK, ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api.js';
import type { Id, Point } from '#lib/model/types.ts';
import { GRID } from './place.ts';

export type Algorithm = 'layered' | 'orthogonal';
export type Direction = 'DOWN' | 'UP' | 'RIGHT' | 'LEFT';
export interface LayoutInput {
	nodes: { id: Id; w: number; h: number }[];
	/** `upward`: the target belongs above the source (generalisation, realisation: parents on top). */
	edges: { id: Id; source: Id; target: Id; upward?: boolean }[];
}
export interface LayoutResult {
	/** Top-left corners, offset so the layout's own top-left is at the origin given. */
	positions: Map<Id, Point>;
	/** Interior bend points, in the edge's own source → target order. */
	waypoints: Map<Id, Point[]>;
}

export async function layout(
	elk: ELK,
	input: LayoutInput,
	{ algorithm, direction }: { algorithm: Algorithm; direction: Direction },
	origin: Point
): Promise<LayoutResult> {
	const graph: ElkNode = {
		id: '\u0000root',
		layoutOptions: {
			'elk.algorithm': 'layered',
			'elk.direction': direction,
			'elk.edgeRouting': algorithm === 'orthogonal' ? 'ORTHOGONAL' : 'POLYLINE',
			// Room for multiplicities and role names between boxes, on the paper's grid.
			'elk.spacing.nodeNode': String(GRID * 3),
			'elk.layered.spacing.nodeNodeBetweenLayers': String(GRID * 4),
			'elk.spacing.edgeNode': String(GRID),
			'elk.spacing.edgeEdge': String(GRID / 2),
			'elk.spacing.componentComponent': String(GRID * 4)
		},
		children: input.nodes.map((n) => ({ id: n.id, width: n.w, height: n.h })),
		edges: input.edges.map((e): ElkExtendedEdge => ({
			id: e.id,
			sources: [e.upward ? e.target : e.source],
			targets: [e.upward ? e.source : e.target]
		}))
	};
	const out = await elk.layout(graph);
	const nodes = out.children ?? [];
	const dx = origin.x - Math.min(...nodes.map((n) => n.x ?? 0));
	const dy = origin.y - Math.min(...nodes.map((n) => n.y ?? 0));
	const shift = (p: { x: number; y: number }) => ({
		x: Math.round(p.x + dx),
		y: Math.round(p.y + dy)
	});
	const positions = new Map(nodes.map((n) => [n.id, shift({ x: n.x ?? 0, y: n.y ?? 0 })]));
	const upward = new Set(input.edges.filter((e) => e.upward).map((e) => e.id));
	const waypoints = new Map(
		(out.edges ?? []).map((e) => {
			const points = (e.sections?.[0]?.bendPoints ?? []).map(shift);
			return [e.id, upward.has(e.id) ? points.reverse() : points];
		})
	);
	return { positions, waypoints };
}
