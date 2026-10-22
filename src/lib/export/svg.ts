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
import {
	MARKER_LENGTH,
	labelsFor,
	linkAsRelationship,
	markersFor
} from '#lib/canvas/edges/notation.ts';
import { membersOf } from '#lib/commands/index.ts';
import { renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import { instanceLabel, namespaceOf } from '#lib/model/project.ts';
import type {
	Classifier,
	Diagram,
	Id,
	Instance,
	Note,
	Package,
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
/** ClassifierNode's "(from A::B)" line under the name when Show namespace is on (M3.1). */
const NAMESPACE_ROW = 16;
/** ui.md: a package's tab is 24 px high and 40 % of its width. */
const TAB_H = 24;
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

/** A node's display flags: its own over the diagram's, as the canvas reads them (flow.svelte.ts). */
const flagsOf = (diagram: Diagram, id: Id): Diagram['defaults'] => {
	const l = diagram.layout.get(id);
	return { ...diagram.defaults, ...(l?.kind === 'node' ? l.flags : undefined) };
};

/** Every classifier's content rectangle in a diagram, keyed by id. */
export function contentRects(project: Project, diagram: Diagram): Map<Id, Rect> {
	const out = new Map<Id, Rect>();
	for (const id of diagram.elementIds) {
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if (el?.kind === 'classifier' && l?.kind === 'node')
			out.set(id, contentRect(el, flagsOf(diagram, id), l));
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

/**
 * Word wrap (StarUML's wordWrap) as the canvas does it: words to the width, and a word longer than
 * a line broken inside. Widths are the export's own text metrics, so lines break where they would.
 */
export function wrapLines(text: string, size: number, width: number): string[] {
	const out: string[] = [];
	let line = '';
	const fits = (t: string) => textWidth(t, size) <= width;
	for (const word of text.split(' ')) {
		const next = line ? `${line} ${word}` : word;
		if (fits(next)) {
			line = next;
			continue;
		}
		if (line) out.push(line);
		line = '';
		for (const ch of word) {
			if (line && !fits(line + ch)) {
				out.push(line);
				line = '';
			}
			line += ch;
		}
	}
	out.push(line);
	return out;
}

function nodeSvg(
	c: Classifier,
	r: Rect,
	flags: Diagram['defaults'],
	paint: Paint,
	out: string[],
	namespace?: string
) {
	const header = flags.stereotypeDisplay === 'none' ? undefined : headerLabel(c);
	const inner = r.w - PAD_X * 2;
	const names = flags.wordWrap ? wrapLines(c.name, 13, inner) : [c.name];
	const nameH =
		(header ? STEREO_ROW : NAME_ROW) + (namespace ? NAMESPACE_ROW : 0) + (names.length - 1) * 18;
	out.push(
		`<g class="node" data-name="${esc(c.name)}"><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" fill="${paint.fill}" stroke="${paint.line}"/>`
	);
	const cx = r.x + r.w / 2;
	if (header)
		out.push(
			`<text x="${n(cx)}" y="${n(r.y + 11)}" text-anchor="middle" font-size="12">«${esc(header)}»</text>`
		);
	names.forEach((line, i) =>
		out.push(
			`<text x="${n(cx)}" y="${n(r.y + (header ? 29 : 14) + i * 18)}" text-anchor="middle" font-size="13" font-weight="600"${c.isAbstract ? ' font-style="italic"' : ''}>${esc(line)}</text>`
		)
	);
	const extra = (names.length - 1) * 18;
	if (namespace)
		out.push(
			`<text x="${n(cx)}" y="${n(r.y + (header ? 45 : 30) + extra)}" text-anchor="middle" font-size="12">(from ${esc(namespace)})</text>`
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
			for (const line of flags.wordWrap ? wrapLines(text, 12, inner) : [text]) {
				out.push(
					`<text x="${n(r.x + PAD_X)}" y="${n(y + 14)}" font-size="12"${isStatic ? ' text-decoration="underline"' : ''}${isAbstract ? ' font-style="italic"' : ''}>${esc(line)}</text>`
				);
				y += MEMBER_ROW;
			}
		}
		y += PAD_Y;
	}
	out.push('</g>');
}

/** A package: the name in a tab over the frame (PackageNode's shape). */
function packageSvg(p: Package, r: Rect, paint: Paint, out: string[]) {
	const tw = Math.max(80, r.w * 0.4);
	out.push(
		`<g class="package" data-name="${esc(p.name)}"><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(tw)}" height="${TAB_H}" fill="${paint.fill}" stroke="${paint.line}"/><rect x="${n(r.x)}" y="${n(r.y + TAB_H)}" width="${n(r.w)}" height="${n(r.h - TAB_H)}" fill="${paint.fill}" stroke="${paint.line}"/>`,
		`<text x="${n(r.x + 8)}" y="${n(r.y + 16)}" font-size="13" font-weight="600">${esc(p.name)}</text></g>`
	);
}

const slotText = (s: Instance['slots'][number]) => (s.value ? `${s.name} = ${s.value}` : s.name);

/** An object's rectangle from its content (InstanceNode's metrics), when the canvas has none. */
function instanceRect(o: Instance, l: { x: number; y: number; w: number }): Rect {
	const h =
		(o.stereotype ? STEREO_ROW : NAME_ROW) +
		(o.slots.length ? PAD_Y * 2 + o.slots.length * MEMBER_ROW : EMPTY);
	const w = Math.max(
		textWidth(instanceLabel(o), 13) * 1.06,
		...o.slots.map((s) => textWidth(slotText(s), 12))
	);
	return { x: l.x, y: l.y, w: Math.max(120, l.w, Math.ceil(w + PAD_X * 2)), h };
}

/** An object (M3.2): the underlined "name: Class" over its slots. */
function instanceSvg(o: Instance, r: Rect, paint: Paint, out: string[]) {
	const nameH = o.stereotype ? STEREO_ROW : NAME_ROW;
	const cx = r.x + r.w / 2;
	out.push(
		`<g class="object" data-name="${esc(o.name)}"><rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" fill="${paint.fill}" stroke="${paint.line}"/>`
	);
	if (o.stereotype)
		out.push(
			`<text x="${n(cx)}" y="${n(r.y + 11)}" text-anchor="middle" font-size="12">«${esc(o.stereotype)}»</text>`
		);
	out.push(
		`<text x="${n(cx)}" y="${n(r.y + (o.stereotype ? 29 : 14))}" text-anchor="middle" font-size="13" font-weight="600" text-decoration="underline">${esc(instanceLabel(o))}</text>`,
		`<line x1="${n(r.x)}" y1="${n(r.y + nameH)}" x2="${n(r.x + r.w)}" y2="${n(r.y + nameH)}" stroke="${paint.line}"/>`
	);
	o.slots.forEach((s, i) =>
		out.push(
			`<text x="${n(r.x + PAD_X)}" y="${n(r.y + nameH + PAD_Y + i * MEMBER_ROW + 14)}" font-size="12">${esc(slotText(s))}</text>`
		)
	);
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
	// Package frames first, outer before inner, so they sit behind what they hold (M3.1).
	const packages: [Package, Rect][] = [];
	for (const id of diagram.elementIds) {
		if (opts.only && !opts.only.has(id)) continue;
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if (el?.kind !== 'package' || l?.kind !== 'node') continue;
		packages.push([el, rects.get(id) ?? { x: l.x, y: l.y, w: l.w, h: l.h }]);
	}
	const depth = (p: Package) => namespaceOf(project, p)?.split('::').length ?? 0;
	for (const [p, r] of packages.sort(([a], [b]) => depth(a) - depth(b))) {
		packageSvg(p, r, paintOf(diagram.layout.get(p.id)), body);
		bounds.push(r);
	}
	for (const [c, r] of nodes) {
		const f = flagsOf(diagram, c.id);
		const ns = f.showNamespace ? namespaceOf(project, c) : undefined;
		nodeSvg(c, r, f, paintOf(diagram.layout.get(c.id)), body, ns);
	}
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
	// Objects (M3.2), and below the links between them.
	for (const id of diagram.elementIds) {
		if (opts.only && !opts.only.has(id)) continue;
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if (el?.kind !== 'instance' || l?.kind !== 'node') continue;
		const r = rects.get(id) ?? instanceRect(el, l);
		instanceSvg(el, r, paintOf(l), body);
		shown.set(id, r);
		bounds.push(r);
	}
	const colours = new Set<string>();
	for (const id of diagram.elementIds) {
		const el = project.elements.get(id);
		const l = diagram.layout.get(id);
		if ((el?.kind !== 'relationship' && el?.kind !== 'link') || l?.kind !== 'edge') continue;
		const src = shown.get(el.sourceId);
		const tgt = shown.get(el.targetId);
		if (!src || !tgt) continue;
		const rel = el.kind === 'link' ? linkAsRelationship(el) : el;
		edgeSvg(rel, l, src, tgt, diagram.defaults, opts.background, body, bounds);
		const ink = lineOf(l);
		if (ink) colours.add(ink);
	}
	// Cropped to what is drawn, wherever it sits; the origin only stands in for an empty diagram.
	const drawn = bounds.length ? bounds : [{ x: 0, y: 0, w: 0, h: 0 }];
	const minX = Math.min(...drawn.map((b) => b.x)) - padding;
	const minY = Math.min(...drawn.map((b) => b.y)) - padding;
	const maxX = Math.max(...drawn.map((b) => b.x + b.w)) + padding;
	const maxY = Math.max(...drawn.map((b) => b.y + b.h)) + padding;
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
