/**
 * StarUML QuickEdit grammar for member lines (docs/spec/data-model.md). Parsing is forgiving
 * about whitespace; rendering is canonical. `fixtures/grammar/lines.json` is the truth.
 */
import type { Attribute, Literal, Operation, Parameter, Visibility } from '#lib/model/types.ts';

export type MemberKind = 'attribute' | 'operation' | 'literal';
export type Member = Attribute | Operation | Literal;
export interface Raw {
	raw: string;
}
export type ParsedAttribute = Omit<Attribute, 'id' | 'documentation' | 'raw'>;
export type ParsedOperation = Omit<Operation, 'id' | 'documentation' | 'raw'>;
export type ParsedLiteral = Omit<Literal, 'id' | 'documentation'>;
export type Parsed = ParsedAttribute | ParsedOperation | ParsedLiteral;

export const isRaw = (p: unknown): p is Raw => typeof p === 'object' && p !== null && 'raw' in p;

const VIS_OF: Record<string, Visibility> = {
	'+': 'public',
	'-': 'private',
	'#': 'protected',
	'~': 'package'
};
const SYM_OF: Record<Visibility, string> = {
	public: '+',
	private: '-',
	protected: '#',
	package: '~'
};

const IDENT = String.raw`[A-Za-z_$][\w$]*`;
const STEREO = String.raw`(?:<<\s*(?<stereotype>[^<>]+?)\s*>>\s*)?`;
const MULT = String.raw`\*|\d+|\d+\.\.(?:\d+|\*)`;
const PROPS = String.raw`(?:\{(?<props>[^{}]*)\})?`;

const ATTRIBUTE = new RegExp(
	String.raw`^\s*${STEREO}(?<vis>[+\-#~])?\s*(?:\{\s*(?<prefix>static)\s*\}\s*)?(?<derived>/)?\s*(?<name>${IDENT})\s*(?::\s*(?<type>[^\[={]+?))?\s*(?:\[\s*(?<mult>${MULT})\s*\])?\s*(?:=\s*(?<def>[^{}]+?))?\s*${PROPS}\s*$`
);
const OPERATION = new RegExp(
	String.raw`^\s*${STEREO}(?<vis>[+\-#~])?\s*(?:\{\s*(?<prefix>static|abstract)\s*\}\s*)?(?<name>${IDENT})\s*\((?<params>.*)\)\s*(?::\s*(?<ret>[^{]+?))?\s*${PROPS}\s*$`
);
const PARAMETER = new RegExp(
	String.raw`^\s*(?:(?<dir>in|out|inout)\s+)?(?<name>${IDENT})\s*(?::\s*(?<type>[^=]+?))?\s*(?:=\s*(?<def>.+?))?\s*$`
);
const LITERAL = new RegExp(String.raw`^\s*${STEREO}(?<name>${IDENT})\s*$`);

/** Splits on commas that are not inside <>, (), [] or quotes. */
function splitTopLevel(s: string): string[] {
	const out: string[] = [];
	let depth = 0;
	let quote: string | null = null;
	let start = 0;
	for (let i = 0; i < s.length; i++) {
		const ch = s[i];
		if (quote) {
			if (ch === quote) quote = null;
		} else if (ch === '"' || ch === "'") quote = ch;
		else if ('<(['.includes(ch)) depth++;
		else if ('>)]'.includes(ch)) depth--;
		else if (ch === ',' && depth === 0) {
			out.push(s.slice(start, i));
			start = i + 1;
		}
	}
	out.push(s.slice(start));
	return out;
}

/** Property block → set of names, or null when a name is not one we know for this kind. */
function props(block: string | undefined, allowed: readonly string[]): Set<string> | null {
	const set = new Set<string>();
	if (!block?.trim()) return set;
	for (const p of block.split(',')) {
		const name = p.trim();
		if (!allowed.includes(name)) return null;
		set.add(name);
	}
	return set;
}

export function parseParameter(line: string): Parameter | Raw {
	const m = PARAMETER.exec(line)?.groups;
	if (!m) return { raw: line };
	return {
		name: m.name,
		direction: (m.dir as Parameter['direction']) ?? 'in',
		...(m.type && { type: m.type.trim() }),
		...(m.def !== undefined && { defaultValue: m.def.trim() })
	};
}

export function parseAttribute(line: string): ParsedAttribute | Raw {
	const m = ATTRIBUTE.exec(line)?.groups;
	if (!m) return { raw: line };
	const p = props(m.props, ['static', 'readOnly', 'derived', 'ordered', 'unique', 'id']);
	if (!p) return { raw: line };
	return {
		name: m.name,
		visibility: VIS_OF[m.vis ?? '+'],
		isStatic: m.prefix === 'static' || p.has('static'),
		isReadOnly: p.has('readOnly'),
		isDerived: m.derived === '/' || p.has('derived'),
		isOrdered: p.has('ordered'),
		isUnique: p.has('unique'),
		isID: p.has('id'),
		...(m.type && { type: m.type.trim() }),
		...(m.mult && { multiplicity: m.mult }),
		...(m.def !== undefined && { defaultValue: m.def.trim() }),
		...(m.stereotype && { stereotype: m.stereotype })
	};
}

export function parseOperation(line: string): ParsedOperation | Raw {
	const m = OPERATION.exec(line)?.groups;
	if (!m) return { raw: line };
	const p = props(m.props, ['static', 'abstract', 'query']);
	if (!p) return { raw: line };
	const parameters: Parameter[] = [];
	if (m.params.trim()) {
		for (const part of splitTopLevel(m.params)) {
			const param = parseParameter(part);
			if (isRaw(param)) return { raw: line };
			parameters.push(param);
		}
	}
	return {
		name: m.name,
		visibility: VIS_OF[m.vis ?? '+'],
		parameters,
		isStatic: m.prefix === 'static' || p.has('static'),
		isAbstract: m.prefix === 'abstract' || p.has('abstract'),
		isQuery: p.has('query'),
		...(m.ret && { returnType: m.ret.trim() }),
		...(m.stereotype && { stereotype: m.stereotype })
	};
}

export function parseLiteral(line: string): ParsedLiteral | Raw {
	const m = LITERAL.exec(line)?.groups;
	if (!m) return { raw: line };
	return { name: m.name, ...(m.stereotype && { stereotype: m.stereotype }) };
}

export function parseMember(kind: 'attribute', line: string): ParsedAttribute | Raw;
export function parseMember(kind: 'operation', line: string): ParsedOperation | Raw;
export function parseMember(kind: 'literal', line: string): ParsedLiteral | Raw;
export function parseMember(kind: MemberKind, line: string): Parsed | Raw;
export function parseMember(kind: MemberKind, line: string): Parsed | Raw {
	return kind === 'attribute'
		? parseAttribute(line)
		: kind === 'operation'
			? parseOperation(line)
			: parseLiteral(line);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderOptions {
	showVisibility?: boolean;
	showType?: boolean;
	showMultiplicity?: boolean;
	showOperationSignature?: boolean;
	showProperty?: boolean;
	/** Draw stereotypes as «x» (paper) instead of <<x>> (text). */
	guillemets?: boolean;
	/** `false` on paper: static and abstract show as underline and italics, not as {static} / {abstract}. */
	keywords?: boolean;
}

const stereo = (s: string | undefined, o: RenderOptions) =>
	s ? (o.guillemets ? `«${s}» ` : `<<${s}>> `) : '';
// Canonical form has a space after the visibility symbol (data-model.md, board 12).
const vis = (v: Visibility, o: RenderOptions) =>
	o.showVisibility === false ? '' : `${SYM_OF[v]} `;

export function renderParameter(p: Parameter): string {
	let s = p.direction === 'in' ? '' : `${p.direction} `;
	s += p.name;
	if (p.type) s += `: ${p.type}`;
	if (p.defaultValue !== undefined) s += ` = ${p.defaultValue}`;
	return s;
}

export function renderAttribute(a: ParsedAttribute | Attribute, o: RenderOptions = {}): string {
	if ('raw' in a && a.raw !== undefined) return a.raw;
	let s = stereo(a.stereotype, o) + vis(a.visibility, o);
	if (a.isStatic && o.keywords !== false) s += '{static} ';
	if (a.isDerived) s += '/';
	s += a.name;
	if (a.type && o.showType !== false) s += `: ${a.type}`;
	if (a.multiplicity && o.showMultiplicity !== false) s += `[${a.multiplicity}]`;
	if (a.defaultValue !== undefined && o.showType !== false) s += ` = ${a.defaultValue}`;
	const props = [
		...(a.isReadOnly ? ['readOnly'] : []),
		...(a.isOrdered ? ['ordered'] : []),
		...(a.isUnique ? ['unique'] : []),
		...(a.isID ? ['id'] : [])
	];
	if (props.length && o.showProperty !== false) s += ` {${props.join(', ')}}`;
	return s;
}

export function renderOperation(op: ParsedOperation | Operation, o: RenderOptions = {}): string {
	if ('raw' in op && op.raw !== undefined) return op.raw;
	let s = stereo(op.stereotype, o) + vis(op.visibility, o);
	if (o.keywords !== false) {
		if (op.isStatic) s += '{static} ';
		else if (op.isAbstract) s += '{abstract} ';
	}
	s += op.name;
	if (o.showOperationSignature === false) s += '()';
	else {
		s += `(${op.parameters.map(renderParameter).join(', ')})`;
		if (op.returnType) s += `: ${op.returnType}`;
	}
	const trailing = [
		...(op.isStatic && op.isAbstract && o.keywords !== false ? ['abstract'] : []),
		...(op.isQuery ? ['query'] : [])
	];
	if (trailing.length && o.showProperty !== false) s += ` {${trailing.join(', ')}}`;
	return s;
}

export function renderLiteral(l: ParsedLiteral | Literal, o: RenderOptions = {}): string {
	return stereo(l.stereotype, o) + l.name;
}

export function renderMember(kind: MemberKind, m: Member | Parsed, o: RenderOptions = {}): string {
	if (kind === 'attribute') return renderAttribute(m as Attribute, o);
	if (kind === 'operation') return renderOperation(m as Operation, o);
	return renderLiteral(m as Literal, o);
}

// ---------------------------------------------------------------------------
// Members from text (what inline editing and the inspector commit)
// ---------------------------------------------------------------------------

const BASE = { documentation: '' };

/** Builds a member of `kind` from a line. Unparseable text is kept verbatim under `raw`. */
export function memberFromText(
	kind: MemberKind,
	text: string,
	id: string,
	previous?: Member
): Member {
	const documentation = previous?.documentation ?? BASE.documentation;
	const parsed = parseMember(kind, text);
	if (kind === 'literal') {
		// Literals have no raw slot in the model; an unparseable literal keeps the text as its name.
		return { id, documentation, ...(isRaw(parsed) ? { name: text.trim() } : parsed) } as Literal;
	}
	if (isRaw(parsed)) {
		const name = (previous && 'name' in previous ? previous.name : '') || text.trim();
		return kind === 'attribute'
			? {
					id,
					documentation,
					name,
					visibility: 'public',
					isStatic: false,
					isReadOnly: false,
					isDerived: false,
					isOrdered: false,
					isUnique: false,
					isID: false,
					raw: text
				}
			: {
					id,
					documentation,
					name,
					visibility: 'public',
					parameters: [],
					isStatic: false,
					isAbstract: false,
					isQuery: false,
					raw: text
				};
	}
	return { id, documentation, ...parsed } as Member;
}
