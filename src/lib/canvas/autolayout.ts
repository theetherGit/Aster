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
	/**
	 * In the diagram's own order, which seeds ELK; `x`, `y` (where it is now) order the loose block.
	 * `parent`: the package frame in the layout that holds this node (M3.1). `frame`: this node is
	 * a package frame, sized by ELK to hold its members.
	 */
	nodes: { id: Id; w: number; h: number; x?: number; y?: number; parent?: Id; frame?: boolean }[];
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
	/** Package frames' new sizes, fitted to what they hold. */
	sizes: Map<Id, { w: number; h: number }>;
}

const GAP = GRID * 2;

export async function layout(
	elk: ELK,
	input: LayoutInput,
	options: LayoutOptions,
	origin: Point
): Promise<LayoutResult> {
	if (input.nodes.some((n) => n.frame)) return nested(elk, input, options, origin);
	const { algorithm, direction, aspect = 1.6 } = options;
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
	// Rows follow the hierarchy alone (lab audit, 2026-10-22: the Observer exercise became one
	// tall column). Generalisations and realisations go to ELK parent first; every other line goes
	// down the hierarchy too, so it never adds a row of its own. `flipped` maps back.
	const depth = hierarchyDepth(nodes, edges);
	const flipped = new Set(
		edges
			.filter((e) => e.upward || (depth.get(e.source) ?? 0) > (depth.get(e.target) ?? 0))
			.map((e) => e.id)
	);
	// ELK merges edges without ports per side, which brings a parent's subclasses in at one
	// triangle. Every other line gets ports of its own when routing is orthogonal, so it never
	// shares a run with a line of another kind.
	const ported = new Set(
		algorithm === 'orthogonal' ? edges.filter((e) => !e.upward).map((e) => e.id) : []
	);
	const ports = new Map<Id, { id: string; width: number; height: number }[]>();
	const port = (node: Id, id: string) => {
		const list = ports.get(node) ?? [];
		list.push({ id, width: 0, height: 0 });
		ports.set(node, list);
		return id;
	};
	/** Each edge's ends as ELK sees them (flipped or not), for pinning straight lines below. */
	const elkEnds = new Map<Id, [Id, Id]>();
	const elkEdges = edges.map((e): ElkExtendedEdge => {
		const [from, to] = flipped.has(e.id) ? [e.target, e.source] : [e.source, e.target];
		elkEnds.set(e.id, [from, to]);
		return ported.has(e.id)
			? { id: e.id, sources: [port(from, `${e.id}\u0000s`)], targets: [port(to, `${e.id}\u0000t`)] }
			: { id: e.id, sources: [from], targets: [to] };
	});

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
			children: graphed.map((n) => ({
				id: n.id,
				width: n.w,
				height: n.h,
				...(ports.has(n.id)
					? { ports: ports.get(n.id), layoutOptions: { 'elk.portConstraints': 'FREE' } }
					: {})
			})),
			edges: elkEdges
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
		const centre = new Map(
			placed.map((n) => [
				n.id,
				{ x: (n.x ?? 0) + (n.width ?? 0) / 2, y: (n.y ?? 0) + (n.height ?? 0) / 2 }
			])
		);
		for (const e of out.edges ?? []) {
			const section = e.sections?.[0];
			let points = (section?.bendPoints ?? []).map(shift);
			// A straight line between ports off the centre keeps its place with one pin.
			if (!points.length && section && ported.has(e.id)) {
				const [s, t] = [section.startPoint, section.endPoint];
				const [from, to] = elkEnds.get(e.id)!.map((id) => centre.get(id)!);
				const off =
					s.x === t.x
						? s.x !== from.x || t.x !== to.x
						: s.y === t.y
							? s.y !== from.y || t.y !== to.y
							: true;
				if (off) points = [shift({ x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 })];
			}
			waypoints.set(e.id, flipped.has(e.id) ? points.reverse() : points);
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
	return { positions, waypoints, sizes: new Map() };
}

/** ui.md: a package is at least 240 × 160 and its tab 24 px high; members sit two grid steps inside. */
const PAD = GRID * 2;
const PAD_TOP = 24 + GRID * 2;

/**
 * Packages (M3.1): each frame is laid out on its own, innermost first, so the members it holds pack
 * into a block of its own shape (owner's report: one compound pass strung a package's unconnected
 * members out in a single row); then the level above lays out with each frame as one fixed box. A
 * line between two frames' members is given to that level between the boxes that hold its ends,
 * and draws its own route afterwards (no bends): only a line inside one level gets ELK's.
 */
async function nested(
	elk: ELK,
	input: LayoutInput,
	options: LayoutOptions,
	origin: Point
): Promise<LayoutResult> {
	const frames = new Set(input.nodes.filter((n) => n.frame).map((n) => n.id));
	const byId = new Map(input.nodes.map((n) => [n.id, n]));
	const parentOf = (id: Id) => {
		const p = byId.get(id)?.parent;
		return p && frames.has(p) ? p : undefined;
	};
	/** The box directly in `frame` (or at the top) that holds `id`, if `id` is under it. */
	const holder = (id: Id, frame: Id | undefined): Id | undefined => {
		for (let cur: Id | undefined = id; cur !== undefined; cur = parentOf(cur))
			if (parentOf(cur) === frame) return cur;
		return undefined;
	};
	const rel = new Map<Id, Point>();
	const sizes = new Map<Id, { w: number; h: number }>();
	const bends: { frame: Id | undefined; id: Id; points: Point[] }[] = [];

	async function level(frame: Id | undefined): Promise<{ w: number; h: number }> {
		const members = input.nodes.filter((n) => parentOf(n.id) === frame);
		const boxes: LayoutInput['nodes'] = [];
		for (const m of members) {
			const size = frames.has(m.id) ? await level(m.id) : { w: m.w, h: m.h };
			if (frames.has(m.id)) sizes.set(m.id, size);
			boxes.push({ id: m.id, w: size.w, h: size.h, x: m.x, y: m.y });
		}
		const edges: LayoutInput['edges'] = [];
		const lifted = new Set<string>();
		for (const e of input.edges) {
			const s = holder(e.source, frame);
			const t = holder(e.target, frame);
			if (!s || !t || s === t) continue;
			if (s === e.source && t === e.target) {
				edges.push(e);
				continue;
			}
			const key = `${s}\u0000${t}`;
			if (lifted.has(key)) continue;
			lifted.add(key);
			edges.push({ id: `\u0000lift\u0000${key}`, source: s, target: t, upward: e.upward });
		}
		const out = await layout(elk, { nodes: boxes, edges }, options, { x: 0, y: 0 });
		let right = 0;
		let bottom = 0;
		for (const b of boxes) {
			const at = out.positions.get(b.id)!;
			rel.set(b.id, at);
			right = Math.max(right, at.x + b.w);
			bottom = Math.max(bottom, at.y + b.h);
		}
		for (const [id, points] of out.waypoints)
			if (!id.startsWith('\u0000lift')) bends.push({ frame, id, points });
		return { w: Math.max(240, right + PAD * 2), h: Math.max(160, bottom + PAD_TOP + PAD) };
	}
	await level(undefined);

	// Absolute places: the top level at the origin, a frame's members inside its padding.
	const positions = new Map<Id, Point>();
	const offsets = new Map<Id | undefined, Point>([[undefined, origin]]);
	const place = (frame: Id | undefined) => {
		const o = offsets.get(frame)!;
		for (const n of input.nodes)
			if (parentOf(n.id) === frame) {
				const r = rel.get(n.id)!;
				const at = { x: Math.round(o.x + r.x), y: Math.round(o.y + r.y) };
				positions.set(n.id, at);
				if (frames.has(n.id)) {
					offsets.set(n.id, { x: at.x + PAD, y: at.y + PAD_TOP });
					place(n.id);
				}
			}
	};
	place(undefined);
	const waypoints = new Map<Id, Point[]>();
	for (const { frame, id, points } of bends) {
		const o = offsets.get(frame)!;
		waypoints.set(
			id,
			points.map((p) => ({ x: Math.round(p.x + o.x), y: Math.round(p.y + o.y) }))
		);
	}
	return { positions, waypoints, sizes };
}

/** Each node's depth in the generalisation / realisation hierarchy: 0 at the top, a parent's + 1 below. */
function hierarchyDepth(nodes: LayoutInput['nodes'], edges: LayoutInput['edges']): Map<Id, number> {
	const depth = new Map(nodes.map((n) => [n.id, 0]));
	const up = edges.filter((e) => e.upward);
	// ponytail: relaxation bounded by the node count, so a cycle in the hierarchy cannot loop
	for (let i = 0; i < nodes.length; i++) {
		let changed = false;
		for (const e of up) {
			const d = (depth.get(e.target) ?? 0) + 1;
			if (d > (depth.get(e.source) ?? 0)) {
				depth.set(e.source, d);
				changed = true;
			}
		}
		if (!changed) break;
	}
	return depth;
}
