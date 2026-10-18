/**
 * Pure edge geometry: routing between node rectangles in the four StarUML line styles,
 * SVG paths, and label placement that never lands on its own line or its end node.
 * Coordinates are paper units, y down.
 */
import type { LabelKey, LabelOffset, LineStyle } from '#lib/model/types.ts';

export interface Pt {
	x: number;
	y: number;
}
export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}
/** A point on the edge and the direction (radians) pointing into the edge from it. */
export interface Frame {
	anchor: Pt;
	theta: number;
}
export interface Route {
	/** Polyline from the source border to the target border, waypoints included. */
	points: Pt[];
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
const pt = (x: number, y: number): Pt => ({ x: r3(x), y: r3(y) });
export const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);
const same = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
const inside = (r: Rect, p: Pt) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;

/** Border point on the ray from the rectangle's centre toward `toward`. */
export function clipToRect(r: Rect, toward: Pt): Pt {
	const c = center(r);
	const dx = toward.x - c.x;
	const dy = toward.y - c.y;
	if (dx === 0 && dy === 0) return pt(c.x, c.y);
	const s = Math.min(
		dx ? r.w / 2 / Math.abs(dx) : Infinity,
		dy ? r.h / 2 / Math.abs(dy) : Infinity
	);
	return pt(c.x + dx * s, c.y + dy * s);
}

/** The loop a self-association draws off the node's top-right corner. */
function selfLoop(r: Rect): Pt[] {
	const R = r.x + r.w;
	const T = r.y;
	const d = Math.max(8, Math.min(28, r.h / 2 - 2, r.w / 2 - 2));
	return [pt(R - d, T), pt(R - d, T - d), pt(R + d, T - d), pt(R + d, T + d), pt(R, T + d)];
}

function orthogonal(src: Rect, tgt: Rect, waypoints: Pt[]): Pt[] {
	if (waypoints.length === 0) {
		const lo = Math.max(src.x, tgt.x);
		const hi = Math.min(src.x + src.w, tgt.x + tgt.w);
		const below = tgt.y >= src.y + src.h;
		const above = tgt.y + tgt.h <= src.y;
		if (hi > lo && (below || above)) {
			const x = (lo + hi) / 2;
			return below ? [pt(x, src.y + src.h), pt(x, tgt.y)] : [pt(x, src.y), pt(x, tgt.y + tgt.h)];
		}
		const top = Math.max(src.y, tgt.y);
		const bottom = Math.min(src.y + src.h, tgt.y + tgt.h);
		const right = tgt.x >= src.x + src.w;
		const left = tgt.x + tgt.w <= src.x;
		if (bottom > top && (right || left)) {
			const y = (top + bottom) / 2;
			return right ? [pt(src.x + src.w, y), pt(tgt.x, y)] : [pt(src.x, y), pt(tgt.x + tgt.w, y)];
		}
		const cs = center(src);
		const ct = center(tgt);
		if (Math.abs(ct.x - cs.x) >= Math.abs(ct.y - cs.y)) {
			const a = clipToRect(src, { x: ct.x, y: cs.y });
			const b = clipToRect(tgt, { x: cs.x, y: ct.y });
			const mx = (a.x + b.x) / 2;
			return [a, pt(mx, a.y), pt(mx, b.y), b];
		}
		const a = clipToRect(src, { x: cs.x, y: ct.y });
		const b = clipToRect(tgt, { x: ct.x, y: cs.y });
		const my = (a.y + b.y) / 2;
		return [a, pt(a.x, my), pt(b.x, my), b];
	}
	const seq = [center(src), ...waypoints, center(tgt)];
	const out: Pt[] = [seq[0]];
	for (let i = 1; i < seq.length; i++) {
		const a = out[out.length - 1];
		const b = seq[i];
		if (a.x !== b.x && a.y !== b.y) {
			const h = { x: b.x, y: a.y };
			const v = { x: a.x, y: b.y };
			const first = i === 1;
			const last = i === seq.length - 1;
			const wide = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
			// Leave and enter the nodes through the side facing the next point, never through the node itself.
			let corner = h;
			if (first) corner = wide ? h : v;
			if (last) corner = wide ? v : h;
			if (first && inside(src, corner)) corner = corner === h ? v : h;
			if (last && inside(tgt, corner)) corner = corner === h ? v : h;
			out.push(pt(corner.x, corner.y));
		}
		out.push(b);
	}
	out[0] = clipToRect(src, out[1]);
	out[out.length - 1] = clipToRect(tgt, out[out.length - 2]);
	return out.filter((p, i) => i === 0 || !same(p, out[i - 1]));
}

/** Route an edge. Waypoints are interior points; endpoints are recomputed from the node borders. */
export function route(
	src: Rect,
	tgt: Rect,
	waypoints: Pt[],
	style: LineStyle,
	self: boolean
): Route {
	if (self && waypoints.length === 0) return { points: selfLoop(src) };
	if (style === 'rectilinear' || style === 'roundrect')
		return { points: orthogonal(src, tgt, waypoints) };
	const first = clipToRect(src, waypoints[0] ?? center(tgt));
	const last = clipToRect(tgt, waypoints[waypoints.length - 1] ?? center(src));
	return { points: [first, ...waypoints.map((w) => pt(w.x, w.y)), last] };
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const f = (v: number) => String(Math.round(v * 100) / 100);
const xy = (p: Pt) => `${f(p.x)},${f(p.y)}`;

interface Cubic {
	p0: Pt;
	c1: Pt;
	c2: Pt;
	p3: Pt;
}
/** Catmull-Rom through every point, as cubic Béziers. */
function cubics(points: Pt[]): Cubic[] {
	const out: Cubic[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[i - 1] ?? points[i];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[i + 2] ?? p2;
		out.push({
			p0: p1,
			c1: { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 },
			c2: { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 },
			p3: p2
		});
	}
	return out;
}

export function pathD(points: Pt[], style: LineStyle): string {
	if (points.length < 2) return '';
	if (style === 'curve' && points.length > 2) {
		return (
			`M${xy(points[0])} ` +
			cubics(points)
				.map((c) => `C${xy(c.c1)} ${xy(c.c2)} ${xy(c.p3)}`)
				.join(' ')
		);
	}
	if (style === 'roundrect' && points.length > 2) {
		let d = `M${xy(points[0])}`;
		for (let i = 1; i < points.length - 1; i++) {
			const [a, c, b] = [points[i - 1], points[i], points[i + 1]];
			const r = Math.min(8, dist(a, c) / 2, dist(c, b) / 2);
			const p = {
				x: c.x + ((a.x - c.x) * r) / (dist(a, c) || 1),
				y: c.y + ((a.y - c.y) * r) / (dist(a, c) || 1)
			};
			const q = {
				x: c.x + ((b.x - c.x) * r) / (dist(c, b) || 1),
				y: c.y + ((b.y - c.y) * r) / (dist(c, b) || 1)
			};
			d += ` L${xy(p)} Q${xy(c)} ${xy(q)}`;
		}
		return `${d} L${xy(points[points.length - 1])}`;
	}
	return (
		`M${xy(points[0])} ` +
		points
			.slice(1)
			.map((p) => `L${xy(p)}`)
			.join(' ')
	);
}

/** The drawn line as a polyline: curves are sampled, straight styles are their points. */
export function samplePath(points: Pt[], style: LineStyle): Pt[] {
	if (style !== 'curve' || points.length < 3) return points;
	const out: Pt[] = [points[0]];
	for (const { p0, c1, c2, p3 } of cubics(points)) {
		for (let k = 1; k <= 12; k++) {
			const t = k / 12;
			const u = 1 - t;
			out.push({
				x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
				y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y
			});
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Frames and label placement
// ---------------------------------------------------------------------------

export function endFrame(line: Pt[], end: 'source' | 'target'): Frame {
	const pts = end === 'source' ? line : [...line].reverse();
	const anchor = pts[0];
	const next = pts.find((p) => !same(p, anchor)) ?? anchor;
	return { anchor, theta: Math.atan2(next.y - anchor.y, next.x - anchor.x) };
}

/** Where the name label hangs: half way along the drawn line. */
export function midFrame(points: Pt[], style: LineStyle): Frame {
	const line = samplePath(points, style);
	let total = 0;
	for (let i = 1; i < line.length; i++) total += dist(line[i - 1], line[i]);
	let left = total / 2;
	for (let i = 1; i < line.length; i++) {
		const [a, b] = [line[i - 1], line[i]];
		const len = dist(a, b);
		if (len > 0 && left <= len) {
			const t = left / len;
			return {
				anchor: pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t),
				theta: Math.atan2(b.y - a.y, b.x - a.x)
			};
		}
		left -= len;
	}
	return { anchor: line[0], theta: 0 };
}

/**
 * Default label offsets, as StarUML writes them for a new edge. The angle convention is
 * StarUML's (types.ts stores offsets "as StarUML stores it"): the label sits at
 * `distance` from the anchor, at `theta − alpha`, where theta points into the edge from
 * that end (tail = source) or, for the name, along the edge from source to target. y is down.
 */
export const DEFAULT_OFFSETS: Record<LabelKey, LabelOffset> = {
	name: { alpha: Math.PI / 2, distance: 15 },
	// Board 12: multiplicity above the line, role below (StarUML's own defaults are the reverse).
	sourceRole: { alpha: -Math.PI / 6, distance: 30 },
	sourceMultiplicity: { alpha: Math.PI / 6, distance: 25 },
	sourceProperty: { alpha: -Math.PI / 4, distance: 40 },
	targetRole: { alpha: Math.PI / 6, distance: 30 },
	targetMultiplicity: { alpha: -Math.PI / 6, distance: 25 },
	targetProperty: { alpha: Math.PI / 4, distance: 40 }
};

export function polar(frame: Frame, o: LabelOffset): Pt {
	const a = frame.theta - o.alpha;
	return {
		x: frame.anchor.x + o.distance * Math.cos(a),
		y: frame.anchor.y + o.distance * Math.sin(a)
	};
}

/** Inverse of `polar`: the offset that puts a label's centre at `p`. */
export function offsetFor(frame: Frame, p: Pt): LabelOffset {
	const dx = p.x - frame.anchor.x;
	const dy = p.y - frame.anchor.y;
	let alpha = frame.theta - Math.atan2(dy, dx);
	while (alpha > Math.PI) alpha -= 2 * Math.PI;
	while (alpha <= -Math.PI) alpha += 2 * Math.PI;
	return { alpha, distance: Math.hypot(dx, dy) };
}

const boxAt = (c: Pt, s: { w: number; h: number }): Rect => ({
	x: c.x - s.w / 2,
	y: c.y - s.h / 2,
	w: s.w,
	h: s.h
});

export function boxHitsRect(a: Rect, b: Rect): boolean {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Liang–Barsky: does segment pq cross the box's interior? */
function segmentHitsBox(p: Pt, q: Pt, b: Rect): boolean {
	let t0 = 0;
	let t1 = 1;
	const dx = q.x - p.x;
	const dy = q.y - p.y;
	const edges: [number, number][] = [
		[-dx, p.x - b.x],
		[dx, b.x + b.w - p.x],
		[-dy, p.y - b.y],
		[dy, b.y + b.h - p.y]
	];
	for (const [pp, qq] of edges) {
		if (pp === 0) {
			if (qq <= 0) return false;
		} else {
			const r = qq / pp;
			if (pp < 0) t0 = Math.max(t0, r);
			else t1 = Math.min(t1, r);
			if (t0 >= t1) return false;
		}
	}
	return true;
}

export function boxHitsPolyline(b: Rect, line: Pt[]): boolean {
	for (let i = 1; i < line.length; i++) if (segmentHitsBox(line[i - 1], line[i], b)) return true;
	return line.length === 1 && inside(b, line[0]);
}

const grow = (r: Rect, g: number): Rect => ({
	x: r.x - g,
	y: r.y - g,
	w: r.w + 2 * g,
	h: r.h + 2 * g
});

/**
 * Centre of a label of `size` at `offset` from `frame`, moved the least needed so it clears
 * its own line, its end node and the edge's other labels (`placed`) by `gap`. Both sides of the
 * line are tried; the spot nearest the requested offset wins, the offset's own side on a tie.
 */
export function placeLabel(
	frame: Frame,
	offset: LabelOffset,
	size: { w: number; h: number },
	line: Pt[],
	node: Rect | null,
	placed: Rect[] = [],
	gap = 4
): Pt {
	const n = { x: -Math.sin(frame.theta), y: Math.cos(frame.theta) };
	const d = { x: Math.cos(frame.theta), y: Math.sin(frame.theta) };
	const start = polar(frame, offset);
	const s0 = (start.x - frame.anchor.x) * n.x + (start.y - frame.anchor.y) * n.y;
	const preferred = s0 !== 0 ? Math.sign(s0) : Math.sin(offset.alpha) >= 0 ? 1 : -1;
	const zone = node && grow(node, gap);
	const clear = (c: Pt) => {
		const b = grow(boxAt(c, size), gap);
		return (
			!boxHitsPolyline(b, line) &&
			!(zone && boxHitsRect(boxAt(c, size), zone)) &&
			!placed.some((o) => boxHitsRect(b, o))
		);
	};

	const found: Pt[] = [];
	for (const side of [preferred, -preferred]) {
		let c = { ...start };
		// Off the line through the anchor, on this side.
		const s = (c.x - frame.anchor.x) * n.x + (c.y - frame.anchor.y) * n.y;
		const need = (size.w / 2) * Math.abs(n.x) + (size.h / 2) * Math.abs(n.y) + gap;
		if (Math.sign(s) !== side || Math.abs(s) < need) {
			c = { x: c.x + n.x * (side * need - s), y: c.y + n.y * (side * need - s) };
		}
		for (let i = 0; i < 400 && !clear(c); i++) {
			const b = boxAt(c, size);
			if (zone && boxHitsRect(b, zone)) {
				// Out of the node, along the edge direction (away from it).
				const tx =
					d.x > 0
						? (zone.x + zone.w - b.x) / d.x
						: d.x < 0
							? (b.x + b.w - zone.x) / -d.x
							: Infinity;
				const ty =
					d.y > 0
						? (zone.y + zone.h - b.y) / d.y
						: d.y < 0
							? (b.y + b.h - zone.y) / -d.y
							: Infinity;
				const tt = Math.min(tx, ty);
				const step = Number.isFinite(tt) && tt > 0 ? tt + 0.5 : 2;
				c = { x: c.x + d.x * step, y: c.y + d.y * step };
			} else {
				c = { x: c.x + n.x * side * 2, y: c.y + n.y * side * 2 };
			}
		}
		if (clear(c)) found.push(c);
	}
	if (!found.length) {
		// ponytail: no clear spot within 800 px on either side; keep the offset rather than loop forever
		return pt(start.x, start.y);
	}
	const away = (c: Pt) => Math.hypot(c.x - start.x, c.y - start.y);
	const best = found.reduce((a, b) => (away(b) < away(a) - 0.5 ? b : a));
	return pt(best.x, best.y);
}
