/**
 * Validation of an `.aster` document, mirroring `src/lib/model/types.ts` field for field.
 * Objects are strict: an unknown key is an error, never silent data loss. Errors carry the JSON
 * path (board 22's "Show details"), never a stack trace.
 *
 * Hand-written for v1: zod (docs/file-format.md) would change the lockfile frozen until the lab;
 * it and the published JSON Schema follow after 24 Oct (DECISIONS.md).
 */
import type {
	Attribute,
	Classifier,
	Diagram,
	DisplayFlags,
	EdgeLayout,
	Element,
	End,
	LabelKey,
	Literal,
	NodeLayout,
	Note,
	Operation,
	Package,
	Parameter,
	Relationship,
	TextElement,
	Unknown
} from '#lib/model/types.ts';
import { ASTER_SCHEMA, ASTER_VERSION, type AsterFile, type AsterOrigin } from './format.ts';

export class AsterError extends Error {
	constructor(
		message: string,
		readonly path: string
	) {
		super(`${path}: ${message}`);
	}
}

type Json = Record<string, unknown>;
const fail = (path: string, message: string): never => {
	throw new AsterError(message, path);
};
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

// ---- primitives -------------------------------------------------------------

const str = (v: unknown, path: string): string =>
	typeof v === 'string' ? v : fail(path, `expected a string, got ${describe(v)}`);
const num = (v: unknown, path: string): number =>
	typeof v === 'number' && Number.isFinite(v)
		? v
		: fail(path, `expected a number, got ${describe(v)}`);
const bool = (v: unknown, path: string): boolean =>
	typeof v === 'boolean' ? v : fail(path, `expected true or false, got ${describe(v)}`);
const oneOf =
	<T extends string>(values: readonly T[]) =>
	(v: unknown, path: string): T =>
		values.includes(v as T)
			? (v as T)
			: fail(path, `expected one of ${values.join(', ')}, got ${describe(v)}`);
const optional =
	<T>(f: (v: unknown, path: string) => T) =>
	(v: unknown, path: string): T | undefined =>
		v === undefined ? undefined : f(v, path);
const arrayOf =
	<T>(f: (v: unknown, path: string) => T) =>
	(v: unknown, path: string): T[] =>
		Array.isArray(v)
			? v.map((x, i) => f(x, `${path}[${i}]`))
			: fail(path, `expected an array, got ${describe(v)}`);
const recordOf =
	<T>(f: (v: unknown, path: string) => T) =>
	(v: unknown, path: string): Record<string, T> => {
		if (!isObj(v)) return fail(path, `expected an object, got ${describe(v)}`);
		const out: Record<string, T> = {};
		for (const [k, x] of Object.entries(v)) out[k] = f(x, `${path}.${k}`);
		return out;
	};
function describe(v: unknown): string {
	if (v === null) return 'null';
	if (Array.isArray(v)) return 'an array';
	return typeof v === 'object'
		? 'an object'
		: typeof v === 'string'
			? JSON.stringify(v)
			: String(v);
}

/** A strict object: every key must be in `fields`; each field's reader runs; undefined results are dropped. */
function strict<T>(fields: { [K in keyof T]-?: (v: unknown, path: string) => T[K] }) {
	const known = new Set(Object.keys(fields));
	return (v: unknown, path: string): T => {
		if (!isObj(v)) return fail(path, `expected an object, got ${describe(v)}`);
		for (const k of Object.keys(v)) if (!known.has(k)) fail(`${path}.${k}`, 'unknown field');
		const out: Record<string, unknown> = {};
		for (const [k, f] of Object.entries(fields) as [string, (v: unknown, p: string) => unknown][]) {
			const r = f(v[k], `${path}.${k}`);
			if (r !== undefined) out[k] = r;
		}
		return out as T;
	};
}

// ---- model (types.ts order) ---------------------------------------------------

const visibility = oneOf(['public', 'protected', 'private', 'package'] as const);
const optVisibility = optional(visibility);
const optStr = optional(str);

const parameter = strict<Parameter>({
	name: str,
	type: optStr,
	direction: oneOf(['in', 'out', 'inout'] as const),
	defaultValue: optStr
});
const attribute = strict<Attribute>({
	id: str,
	name: str,
	type: optStr,
	visibility,
	multiplicity: optStr,
	defaultValue: optStr,
	isStatic: bool,
	isReadOnly: bool,
	isDerived: bool,
	isOrdered: bool,
	isUnique: bool,
	isID: bool,
	stereotype: optStr,
	documentation: str,
	raw: optStr
});
const operation = strict<Operation>({
	id: str,
	name: str,
	visibility,
	returnType: optStr,
	parameters: arrayOf(parameter),
	isStatic: bool,
	isAbstract: bool,
	isQuery: bool,
	stereotype: optStr,
	documentation: str,
	raw: optStr
});
const literal = strict<Literal>({ id: str, name: str, stereotype: optStr, documentation: str });
const classifier = strict<Classifier>({
	kind: oneOf(['classifier'] as const),
	id: str,
	classifierKind: oneOf(['class', 'interface', 'enum', 'dataType', 'primitiveType'] as const),
	name: str,
	stereotype: optStr,
	isAbstract: bool,
	isLeaf: bool,
	visibility,
	documentation: str,
	attributes: arrayOf(attribute),
	operations: arrayOf(operation),
	literals: arrayOf(literal),
	packageId: optStr
});
const end = strict<End>({
	role: optStr,
	multiplicity: optStr,
	navigable: oneOf(['unspecified', 'navigable', 'notNavigable'] as const),
	visibility: optVisibility,
	isDerived: bool,
	isOrdered: bool,
	isUnique: bool,
	ownsOther: bool
});
const relationship = strict<Relationship>({
	kind: oneOf(['relationship'] as const),
	id: str,
	relationshipKind: oneOf([
		'association',
		'aggregation',
		'composition',
		'generalization',
		'realization',
		'dependency'
	] as const),
	sourceId: str,
	targetId: str,
	name: optStr,
	stereotype: optStr,
	documentation: str,
	sourceEnd: optional(end),
	targetEnd: optional(end)
});
const pkg = strict<Package>({
	kind: oneOf(['package'] as const),
	id: str,
	name: str,
	memberIds: arrayOf(str),
	parentId: optStr,
	documentation: str
});
const note = strict<Note>({
	kind: oneOf(['note'] as const),
	id: str,
	text: str,
	linkedIds: arrayOf(str)
});
const textElement = strict<TextElement>({ kind: oneOf(['text'] as const), id: str, text: str });

const element = (v: unknown, path: string): Element => {
	const kind = isObj(v) ? v.kind : undefined;
	switch (kind) {
		case 'classifier':
			return classifier(v, path);
		case 'relationship':
			return relationship(v, path);
		case 'package':
			return pkg(v, path);
		case 'note':
			return note(v, path);
		case 'text':
			return textElement(v, path);
		default:
			return fail(
				`${path}.kind`,
				`expected classifier, relationship, package, note or text, got ${describe(kind)}`
			);
	}
};

// ---- layout -------------------------------------------------------------------

const stereotypeDisplay = oneOf([
	'none',
	'label',
	'decoration',
	'decoration-label',
	'icon',
	'icon-label'
] as const);
const flagFields = {
	showVisibility: bool,
	showType: bool,
	showMultiplicity: bool,
	showOperationSignature: bool,
	showNamespace: bool,
	showProperty: bool,
	suppressAttributes: bool,
	suppressOperations: bool,
	suppressLiterals: bool,
	stereotypeDisplay,
	wordWrap: bool,
	autoResize: bool
};
const displayFlags = strict<DisplayFlags>(flagFields);
const partialFlags = strict<Partial<DisplayFlags>>(
	Object.fromEntries(
		Object.entries(flagFields).map(([k, f]) => [
			k,
			optional(f as (v: unknown, p: string) => unknown)
		])
	) as never
);
const point = strict<{ x: number; y: number }>({ x: num, y: num });
const nodeLayout = strict<NodeLayout>({
	kind: oneOf(['node'] as const),
	x: num,
	y: num,
	w: num,
	h: num,
	fill: optStr,
	line: optStr,
	flags: optional(partialFlags)
});
const LABEL_KEYS: LabelKey[] = [
	'name',
	'sourceMultiplicity',
	'targetMultiplicity',
	'sourceRole',
	'targetRole',
	'sourceProperty',
	'targetProperty'
];
const labelOffset = strict<{ alpha: number; distance: number }>({ alpha: num, distance: num });
const labelOffsets = strict<Partial<Record<LabelKey, { alpha: number; distance: number }>>>(
	Object.fromEntries(LABEL_KEYS.map((k) => [k, optional(labelOffset)])) as never
);
const edgeLayout = strict<EdgeLayout>({
	kind: oneOf(['edge'] as const),
	waypoints: arrayOf(point),
	lineStyle: oneOf(['rectilinear', 'oblique', 'roundrect', 'curve'] as const),
	line: optStr,
	labelOffsets
});
const layout = (v: unknown, path: string) =>
	isObj(v) && v.kind === 'edge' ? edgeLayout(v, path) : nodeLayout(v, path);

const diagram = strict<
	Omit<Diagram, 'layout'> & { layout: Record<string, NodeLayout | EdgeLayout> }
>({
	id: str,
	name: str,
	diagramKind: oneOf(['class', 'object'] as const),
	elementIds: arrayOf(str),
	layout: recordOf(layout),
	defaults: displayFlags
});

const unknown = strict<Unknown>({
	json: (v) => v, // verbatim, by definition
	parentId: (v, path) => (v === null ? null : str(v, path)),
	path: str,
	index: num
});

// ---- file ---------------------------------------------------------------------

const project = strict<AsterFile['project']>({
	id: str,
	name: str,
	elements: recordOf(element),
	diagrams: arrayOf(diagram),
	unknown: arrayOf(unknown),
	importedIds: arrayOf(str)
});
const origin = strict<AsterOrigin>({
	kind: oneOf(['staruml'] as const),
	sourceHash: str,
	fileName: optStr
});
const meta = strict<{ app: string; savedAt: string }>({ app: str, savedAt: str });

/** Validate a parsed document; throws `AsterError` with the first offending path. */
export const validateAsterFile = strict<AsterFile>({
	$schema: (v, path) =>
		v === undefined || v === ASTER_SCHEMA ? ASTER_SCHEMA : fail(path, `expected ${ASTER_SCHEMA}`),
	version: (v, path) =>
		v === ASTER_VERSION
			? ASTER_VERSION
			: fail(path, `expected ${ASTER_VERSION}, got ${describe(v)}`),
	meta: optional(meta),
	origin: optional(origin),
	project
});
