/**
 * The Text view's PlantUML class-diagram subset (accessibility.md, Text view dialect): classes,
 * abstract classes, interfaces, enums (and `<<dataType>>` / `<<primitive>>` classes), members as
 * UML text, the six relationship arrows with multiplicities and a label, notes and note links.
 * Lines it does not model are kept, not errors; only braces that do not pair are errors.
 */
import type { MemberKind } from '#lib/mdj/expression.ts';
import type { ClassifierKind, Navigability, RelationshipKind } from '#lib/model/types.ts';

export interface PLine {
	kind: MemberKind;
	/** The member as Aster's UML text (`+{static} count: int`). */
	text: string;
	line: number;
}
export interface PClassifier {
	name: string;
	kind: ClassifierKind;
	isAbstract: boolean;
	stereotype?: string;
	lines: PLine[];
	/** False when it is only named by a relationship (PlantUML makes it): its members are not said. */
	declared: boolean;
	line: number;
}
export interface PEnd {
	multiplicity?: string;
	navigable?: Navigability;
}
export interface PRelationship {
	kind: RelationshipKind;
	/** As the model has it: child, part, implementer, client, the left of an association. */
	source: string;
	target: string;
	sourceEnd: PEnd;
	targetEnd: PEnd;
	name?: string;
	stereotype?: string;
	line: number;
}
export interface PNote {
	alias: string;
	text: string;
	line: number;
}
export interface PLink {
	alias: string;
	target: string;
	line: number;
}
export interface PError {
	line: number;
	message: 'missingBrace' | 'strayBrace';
	name?: string;
}
export interface PumlDoc {
	classifiers: PClassifier[];
	relationships: PRelationship[];
	notes: PNote[];
	links: PLink[];
	/** Lines kept as typed (comments, skinparam, what Aster does not model). */
	kept: string[];
	errors: PError[];
}

const NAME = String.raw`"[^"]+"|[A-Za-z_$][\w$.]*`;
const HEADER = new RegExp(
	String.raw`^(abstract\s+class|abstract|class|interface|enum)\s+(${NAME})(?:\s+as\s+([\w$]+))?((?:\s*<<[^>]+>>)*)\s*(\{)?(.*)$`
);
// An arrow: optional head, dashes or dots with an optional direction word, optional tail.
const ARROW = String.raw`(<\|?|\*|o)?([-.]+)(?:(?:up|down|left|right|u|d|l|r)[-.]*)?(\|?>|\*|o)?`;
const REL = new RegExp(
	String.raw`^(${NAME})\s*(?:"([^"]*)")?\s*${ARROW}\s*(?:"([^"]*)")?\s*(${NAME})\s*(?::\s*(.*))?$`
);
const NOTE_INLINE = /^note\s+"((?:[^"\\]|\\.)*)"\s+as\s+([\w$]+)\s*$/;
const NOTE_BLOCK = /^note\s+as\s+([\w$]+)\s*$/;

const unquote = (s: string) => (s.startsWith('"') ? s.slice(1, -1) : s);
/** PlantUML puts `{static}` / `{abstract}` before the visibility; Aster's grammar after it. */
const toUml = (s: string) =>
	s.trim().replace(/^\{(static|abstract)\}\s*([+\-#~])?\s*/, (_, mod, v) => `${v ?? ''}{${mod}} `);

export function parsePuml(text: string): PumlDoc {
	const doc: PumlDoc = {
		classifiers: [],
		relationships: [],
		notes: [],
		links: [],
		kept: [],
		errors: []
	};
	const byName = new Map<string, PClassifier>();
	const alias = new Map<string, string>();
	const noteAliases = new Set<string>();
	const resolve = (raw: string) => alias.get(raw) ?? unquote(raw);
	function classifier(name: string, line: number): PClassifier {
		let c = byName.get(name);
		if (!c) {
			c = { name, kind: 'class', isAbstract: false, lines: [], declared: false, line };
			byName.set(name, c);
			doc.classifiers.push(c);
		}
		return c;
	}
	function member(c: PClassifier, raw: string, line: number) {
		const s = raw.trim();
		if (!s) return;
		const kind: MemberKind =
			c.kind === 'enum' && !/[(:]/.test(s)
				? 'literal'
				: s.includes('(')
					? 'operation'
					: 'attribute';
		c.lines.push({ kind, text: kind === 'literal' ? s : toUml(s), line });
	}

	const lines = text.split('\n');
	let open: PClassifier | null = null;
	let openLine = 0;
	let packages = 0;
	let note: { alias: string; text: string[]; line: number } | null = null;
	lines.forEach((rawLine, i) => {
		const n = i + 1;
		const line = rawLine.trim();
		if (note) {
			if (/^end\s*note$/.test(line)) {
				doc.notes.push({ alias: note.alias, text: note.text.join('\n'), line: note.line });
				note = null;
			} else note.text.push(rawLine.trim());
			return;
		}
		if (open) {
			if (line === '}') open = null;
			else member(open, line, n);
			return;
		}
		if (!line || /^@(start|end)uml/.test(line)) return;
		if (line.startsWith("'") || /^\/'.*'\/$/.test(line)) return void doc.kept.push(rawLine.trim());
		if (line === '}') {
			if (packages > 0) packages--;
			else doc.errors.push({ line: n, message: 'strayBrace' });
			return;
		}
		// Packages are M3: the frame is kept as typed, its classes read as if outside it.
		if (/^(package|namespace)\b.*\{\s*$/.test(line)) {
			packages++;
			return void doc.kept.push(rawLine.trim());
		}
		const h = HEADER.exec(line);
		if (h) {
			const [, keyword, rawName, as, stereos, brace, rest] = h;
			const name = unquote(rawName);
			if (as) alias.set(as, name);
			const c = classifier(name, n);
			c.declared = true;
			c.line = n;
			c.isAbstract = keyword.startsWith('abstract');
			c.kind = keyword === 'interface' ? 'interface' : keyword === 'enum' ? 'enum' : 'class';
			for (const [, s] of (stereos ?? '').matchAll(/<<\s*([^>]+?)\s*>>/g)) {
				if (c.kind === 'class' && s === 'dataType') c.kind = 'dataType';
				else if (c.kind === 'class' && s === 'primitive') c.kind = 'primitiveType';
				else c.stereotype ??= s;
			}
			if (brace) {
				const close = rest.lastIndexOf('}');
				if (close >= 0) {
					// One line: `enum LoanStatus { ACTIVE; RETURNED; OVERDUE }`.
					for (const part of rest.slice(0, close).split(/[;,]/)) member(c, part, n);
				} else {
					member(c, rest, n);
					open = c;
					openLine = n;
				}
			}
			return;
		}
		const ni = NOTE_INLINE.exec(line);
		if (ni) {
			noteAliases.add(ni[2]);
			return void doc.notes.push({ alias: ni[2], text: ni[1].replace(/\\n/g, '\n'), line: n });
		}
		const nb = NOTE_BLOCK.exec(line);
		if (nb) {
			noteAliases.add(nb[1]);
			note = { alias: nb[1], text: [], line: n };
			return;
		}
		const r = REL.exec(line);
		if (r) {
			const [, left, lm, head, body, tail, rm, right, label] = r;
			const [l, rr] = [resolve(left), resolve(right)];
			// A note link: `N1 .. Account` or the other way round.
			if (body.includes('.') && !head && !tail && (noteAliases.has(l) || noteAliases.has(rr))) {
				const [a, target] = noteAliases.has(l) ? [l, rr] : [rr, l];
				return void doc.links.push({ alias: a, target, line: n });
			}
			const rel = relationship(l, rr, lm, rm, head, body, tail, n);
			if (!rel) return void doc.kept.push(rawLine.trim());
			classifier(l, n);
			classifier(rr, n);
			const lab = label?.trim();
			const st = lab && /^<<\s*(.+?)\s*>>$/.exec(lab);
			if (st) rel.stereotype = st[1];
			else if (lab) rel.name = lab;
			return void doc.relationships.push(rel);
		}
		doc.kept.push(rawLine.trim());
	});
	if (open)
		doc.errors.push({ line: openLine, message: 'missingBrace', name: (open as PClassifier).name });
	return doc;
}

/** The arrow's kind and which side is the model's source; null for an arrow Aster does not model. */
function relationship(
	l: string,
	r: string,
	lm: string | undefined,
	rm: string | undefined,
	head = '',
	body: string,
	tail = '',
	line: number
): PRelationship | null {
	const dotted = body.includes('.');
	const end = (m?: string, nav?: boolean): PEnd => ({
		...(m !== undefined && m !== '' && { multiplicity: m }),
		...(nav && { navigable: 'navigable' as const })
	});
	const make = (
		kind: RelationshipKind,
		source: string,
		target: string,
		sm?: string,
		tm?: string
	) => ({
		kind,
		source,
		target,
		sourceEnd: end(sm),
		targetEnd: end(tm),
		line
	});
	if (tail === '|>') return make(dotted ? 'realization' : 'generalization', l, r, lm, rm);
	if (head === '<|') return make(dotted ? 'realization' : 'generalization', r, l, rm, lm);
	if (dotted) {
		if (tail === '>' && !head) return make('dependency', l, r, lm, rm);
		if (head === '<' && !tail) return make('dependency', r, l, rm, lm);
		if (!head && !tail) return make('dependency', l, r, lm, rm);
		return null;
	}
	// The diamond is on the whole; the model's source is the part.
	if (head === '*' || head === 'o')
		return make(head === '*' ? 'composition' : 'aggregation', r, l, rm, lm);
	if (tail === '*' || tail === 'o')
		return make(tail === '*' ? 'composition' : 'aggregation', l, r, lm, rm);
	if ((head === '' || head === '<') && (tail === '' || tail === '>')) {
		const rel = make('association', l, r, lm, rm);
		if (head === '<') rel.sourceEnd.navigable = 'navigable';
		if (tail === '>') rel.targetEnd.navigable = 'navigable';
		return rel;
	}
	return null;
}
