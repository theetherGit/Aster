/**
 * A diagram as standalone SVG, drawn from the model and layout with the canvas's own metrics
 * (docs/spec/ui.md, Node metrics), so the file matches the screen. No grid, no chrome; the paper
 * font is embedded by the caller through `fontCss`. Pure: no DOM, so it runs in tests and workers.
 */
import { compartmentsFor, headerLabel } from '#lib/canvas/inline.ts';
import {
	DEFAULT_OFFSETS,
	endFrame,
	midFrame,
	pathD,
	placeLabel,
	route,
	samplePath,
	type Pt,
	type Rect
} from '#lib/canvas/edges/geometry.ts';
import { textWidth } from '#lib/canvas/edges/measure.ts';
import { MARKER_LENGTH, labelsFor, markersFor } from '#lib/canvas/edges/notation.ts';
import { membersOf } from '#lib/commands/index.ts';
import { renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import type {
	Classifier,
	Diagram,
	Id,
	Note,
	Project,
	Relationship,
	TextElement
} from '#lib/model/types.ts';
import { clipToRect } from '#lib/canvas/edges/geometry.ts';
import { INK, PAPER, fillOf, lineOf } from '#lib/canvas/paint.ts';

export interface SvgOptions {
	/** Only these elements (and the edges between them); null for the whole diagram. */
	only?: ReadonlySet<Id> | null;
	background: 'white' | 'transparent';
	/** `@font-face` rules to embed, so the file renders the same everywhere. */
	fontCss?: string;
	padding?: number;
}
export interface SvgResult {
	svg: string;
	width: number;
	height: number;
}

const FONT = "'Source Sans 3', 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const NAME_ROW = 28;
const STEREO_ROW = 40;
const MEMBER_ROW = 20;
const PAD_Y = 6;
const PAD_X = 10;
const EMPTY = 8;
const LABEL_FONT = 12;
const LABEL_LINE = 15;

const esc = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => String(Math.round(v * 100) / 100);

/**
 * A classifier's rendered rectangle from its content alone (ui.md, Node metrics), for drawing a
 * diagram that is not on a canvas: the welcome's sample card. Width is the layout's or the widest
 * line, never under the 160 px minimum the node keeps on screen.
 */
export function contentRect(
	c: Classifier,
	flags: Diagram['defaults'],
	l: { x: number; y: number; w: number }
): Rect {
	const header = flags.stereotypeDisplay === 'none' ? undefined : headerLabel(c);
	let h = header ? STEREO_ROW : NAME_ROW;
	let w = Math.max(textWidth(c.name, 13) * 1.06, header ? textWidth(`«${header}»`, 12) : 0);
	const kinds: MemberKind[] = compartmentsFor(c).filter(
		(k) =>
			!(k === 'attribute' && flags.suppressAttributes) &&
			!(k === 'operation' && flags.suppressOperations) &&
			!(k === 'literal' && flags.suppressLiterals)
	);
	for (const kind of kinds) {
		const members = membersOf(c, kind);
		if (!members.length) {
			h += EMPTY;
			continue;
		}
		h += PAD_Y * 2 + members.length * MEMBER_ROW;
		for (const m of members)
			w = Math.max(
				w,
				textWidth(renderMember(kind, m, { ...flags, guillemets: true, keywords: false }), 12)
			);
	}
	return { x: l.x, y: l.y, w: Math.max(160, l.w, Math.ceil(w + PAD_X * 2)), h };
}

/** Every classifier's content rectangle in a diagram, keyed by id. */
export function contentRects(project: Project, diagram: Diagram): Map<Id, Rect> {
	const out = new Map<Id, Rect>();
	for (const id of diagram.elementIds) {
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if (el?.kind === 'classifier' && l?.kind === 'node')
			out.set(id, contentRect(el, diagram.defaults, l));
	}
	return out;
}

/** A view's own fill and line (paint.ts), or the paper's. */
interface Paint {
	fill: string;
	line: string;
}
const paintOf = (l: { fill?: string; line?: string } | undefined): Paint => ({
	fill: fillOf(l) ?? PAPER,
	line: lineOf(l) ?? INK
});

function nodeSvg(c: Classifier, r: Rect, flags: Diagram['defaults'], paint: Paint, out: string[]) {
	const header = flags.stereotypeDisplay === 'none' ? undefined : headerLabel(c);
	const nameH = header ? STEREO_ROW : NAME_ROW;
	out.push(
		`<g class="node" data-name="${esc(c.name)}"><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" fill="${paint.fill}" stroke="${paint.line}"/>`
	);
	const cx = r.x + r.w / 2;
	if (header)
		out.push(
			`<text x="${n(cx)}" y="${n(r.y + 11)}" text-anchor="middle" font-size="12">«${esc(header)}»</text>`
		);
	out.push(
		`<text x="${n(cx)}" y="${n(r.y + (header ? 29 : 14))}" text-anchor="middle" font-size="13" font-weight="600"${c.isAbstract ? ' font-style="italic"' : ''}>${esc(c.name)}</text>`
	);
	let y = r.y + nameH;
	const kinds: MemberKind[] = compartmentsFor(c).filter(
		(k) =>
			!(k === 'attribute' && flags.suppressAttributes) &&
			!(k === 'operation' && flags.suppressOperations) &&
			!(k === 'literal' && flags.suppressLiterals)
	);
	for (const kind of kinds) {
		const members = membersOf(c, kind);
		out.push(
			`<line x1="${n(r.x)}" y1="${n(y)}" x2="${n(r.x + r.w)}" y2="${n(y)}" stroke="${paint.line}"/>`
		);
		if (!members.length) {
			y += EMPTY;
			continue;
		}
		y += PAD_Y;
		for (const m of members) {
			const text = renderMember(kind, m, { ...flags, guillemets: true, keywords: false });
			const isStatic = 'isStatic' in m && m.isStatic;
			const isAbstract = 'isAbstract' in m && m.isAbstract;
			out.push(
				`<text x="${n(r.x + PAD_X)}" y="${n(y + 14)}" font-size="12"${isStatic ? ' text-decoration="underline"' : ''}${isAbstract ? ' font-style="italic"' : ''}>${esc(text)}</text>`
			);
			y += MEMBER_ROW;
		}
		y += PAD_Y;
	}
	out.push('</g>');
}

function edgeSvg(
	rel: Relationship,
	layout: Extract<Diagram['layout'] extends Map<Id, infer L> ? L : never, { kind: 'edge' }>,
	src: Rect,
	tgt: Rect,
	flags: Diagram['defaults'],
	background: SvgOptions['background'],
	out: string[],
	bounds: Rect[]
) {
	const style = layout.lineStyle;
	const ink = lineOf(layout);
	const stroke = ink ?? INK;
	const points = route(src, tgt, layout.waypoints, style, rel.sourceId === rel.targetId).points;
	if (points.length < 2) return;
	const line = samplePath(points, style);
	const notation = markersFor(rel);
	const url = (m: string) => `url(#${markerId(m, ink)})`;
	out.push(
		`<g class="edge" data-rel-id="${esc(rel.id)}"><path d="${pathD(points, style)}" fill="none" stroke="${stroke}"${notation.dashed ? ' stroke-dasharray="6 4"' : ''}${notation.start ? ` marker-start="${url(notation.start)}"` : ''}${notation.end ? ` marker-end="${url(notation.end)}"` : ''}/>`
	);
	for (const end of notation.dots) {
		const f = endFrame(line, end);
		const m = end === 'source' ? notation.start : notation.end;
		const k = (m ? MARKER_LENGTH[m] : 0) + 4;
		out.push(
			`<circle cx="${n(f.anchor.x + Math.cos(f.theta) * k)}" cy="${n(f.anchor.y + Math.sin(f.theta) * k)}" r="3.5" fill="${stroke}"/>`
		);
	}
	// Labels as the canvas places them: clear of their line, their end node and each other.
	const placed: Rect[] = [];
	for (const spec of labelsFor(rel, flags)) {
		const frame = spec.at === 'mid' ? midFrame(points, style) : endFrame(line, spec.at);
		const offset = layout.labelOffsets[spec.key] ?? DEFAULT_OFFSETS[spec.key];
		const w = Math.max(...spec.lines.map((l) => textWidth(l, LABEL_FONT))) + 6;
		const h = spec.lines.length * LABEL_LINE;
		const node = spec.at === 'source' ? src : spec.at === 'target' ? tgt : null;
		const c: Pt = placeLabel(frame, offset, { w, h }, line, node, placed);
		const box = { x: c.x - w / 2, y: c.y - h / 2, w, h };
		placed.push(box);
		bounds.push(box);
		if (background === 'white')
			out.push(
				`<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(w)}" height="${n(h)}" fill="${PAPER}"/>`
			);
		spec.lines.forEach((text, i) =>
			out.push(
				`<text x="${n(c.x)}" y="${n(box.y + i * LABEL_LINE + 11.5)}" text-anchor="middle" font-size="${LABEL_FONT}">${esc(text)}</text>`
			)
		);
	}
	out.push('</g>');
	for (const p of points) bounds.push({ x: p.x, y: p.y, w: 0, h: 0 });
}

function noteSvg(el: Note | TextElement, r: Rect, paint: Paint, out: string[]) {
	const lines = el.text.split(/\r?\n/);
	if (el.kind === 'note') {
		const f = 12; // folded corner (ui.md)
		out.push(
			`<g class="note"><path d="M${n(r.x)},${n(r.y)} H${n(r.x + r.w - f)} L${n(r.x + r.w)},${n(r.y + f)} V${n(r.y + r.h)} H${n(r.x)} Z" fill="${paint.fill}" stroke="${paint.line}"/><path d="M${n(r.x + r.w - f)},${n(r.y)} V${n(r.y + f)} H${n(r.x + r.w)}" fill="none" stroke="${paint.line}"/>`
		);
	} else out.push('<g class="text">');
	lines.forEach((line, i) =>
		out.push(
			`<text x="${n(r.x + PAD_X)}" y="${n(r.y + PAD_Y + 12 + i * 16)}" font-size="12">${esc(line)}</text>`
		)
	);
	out.push('</g>');
}

/** A marker set's id: the shared ink set, or one per line colour in use (`aster-m-arrow-b91c1c`). */
const markerId = (m: string, colour?: string) =>
	`aster-m-${m}${colour ? `-${colour.slice(1)}` : ''}`;
const markers = (colour?: string) => {
	const ink = colour ?? INK;
	const id = (m: string) => markerId(m, colour);
	return `<marker id="${id('triangle')}" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="14" refY="7" orient="auto-start-reverse" overflow="visible"><path d="M0,0 L14,7 L0,14 Z" fill="${PAPER}" stroke="${ink}"/></marker><marker id="${id('diamond-hollow')}" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="10" refX="14" refY="4" orient="auto-start-reverse" overflow="visible"><path d="M0,4 L7,0 L14,4 L7,8 Z" fill="${PAPER}" stroke="${ink}"/></marker><marker id="${id('diamond-filled')}" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="10" refX="14" refY="4" orient="auto-start-reverse" overflow="visible"><path d="M0,4 L7,0 L14,4 L7,8 Z" fill="${ink}" stroke="${ink}"/></marker><marker id="${id('arrow')}" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="12" refX="12" refY="5" orient="auto-start-reverse" overflow="visible"><path d="M0,0 L12,5 L0,10" fill="none" stroke="${ink}"/></marker>`;
};

/** The diagram (or the elements in `only`) as SVG text, cropped to its content plus padding. */
export function diagramToSvg(
	project: Project,
	diagram: Diagram,
	rects: ReadonlyMap<Id, Rect>,
	opts: SvgOptions
): SvgResult {
	const padding = opts.padding ?? 20;
	const nodes: [Classifier, Rect][] = [];
	for (const id of diagram.elementIds) {
		if (opts.only && !opts.only.has(id)) continue;
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if (el?.kind !== 'classifier' || l?.kind !== 'node') continue;
		nodes.push([el, rects.get(id) ?? { x: l.x, y: l.y, w: l.w, h: l.h }]);
	}
	const shown = new Map(nodes.map(([c, r]) => [c.id, r]));
	const body: string[] = [];
	const bounds: Rect[] = [...shown.values()];
	for (const [c, r] of nodes)
		nodeSvg(c, r, diagram.defaults, paintOf(diagram.layout.get(c.id)), body);
	// Notes and text, and the dashed links from notes to what they annotate.
	const notes: [Note | TextElement, Rect][] = [];
	for (const id of diagram.elementIds) {
		if (opts.only && !opts.only.has(id)) continue;
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if ((el?.kind !== 'note' && el?.kind !== 'text') || l?.kind !== 'node') continue;
		const r = rects.get(id) ?? { x: l.x, y: l.y, w: l.w, h: l.h };
		notes.push([el, r]);
		shown.set(id, r);
		bounds.push(r);
	}
	for (const [el, r] of notes) {
		noteSvg(el, r, paintOf(diagram.layout.get(el.id)), body);
		if (el.kind !== 'note') continue;
		for (const targetId of el.linkedIds) {
			const t = shown.get(targetId);
			if (!t) continue;
			const a = clipToRect(r, { x: t.x + t.w / 2, y: t.y + t.h / 2 });
			const b = clipToRect(t, { x: r.x + r.w / 2, y: r.y + r.h / 2 });
			body.push(
				`<line class="note-link" x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${INK}" stroke-dasharray="6 4"/>`
			);
		}
	}
	const colours = new Set<string>();
	for (const id of diagram.elementIds) {
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if (el?.kind !== 'relationship' || l?.kind !== 'edge') continue;
		const src = shown.get(el.sourceId);
		const tgt = shown.get(el.targetId);
		if (!src || !tgt) continue;
		edgeSvg(el, l, src, tgt, diagram.defaults, opts.background, body, bounds);
		const ink = lineOf(l);
		if (ink) colours.add(ink);
	}
	const minX = Math.min(...bounds.map((b) => b.x), 0) - padding;
	const minY = Math.min(...bounds.map((b) => b.y), 0) - padding;
	const maxX = Math.max(...bounds.map((b) => b.x + b.w), 0) + padding;
	const maxY = Math.max(...bounds.map((b) => b.y + b.h), 0) + padding;
	const width = Math.ceil(maxX - minX);
	const height = Math.ceil(maxY - minY);
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${n(minX)} ${n(minY)} ${width} ${height}" font-family="${FONT}" fill="${INK}" stroke-width="1" stroke-linejoin="miter">` +
		`<title>${esc(diagram.name)}</title><defs>${opts.fontCss ? `<style>${opts.fontCss}</style>` : ''}${markers()}${[...colours].map(markers).join('')}</defs>` +
		(opts.background === 'white'
			? `<rect x="${n(minX)}" y="${n(minY)}" width="${width}" height="${height}" fill="${PAPER}"/>`
			: '') +
		body.join('') +
		'</svg>';
	return { svg, width, height };
}

/** A safe file stem from a diagram name: "Class diagram" → "class-diagram". */
export const slug = (name: string) =>
	name
		.normalize('NFKD')
		.replace(/[^\w\s-]/g, '')
		.trim()
		.replace(/[\s_]+/g, '-')
		.toLowerCase() || 'diagram';
