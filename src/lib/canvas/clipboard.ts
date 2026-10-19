/**
 * Copy and paste of diagram elements (keyboard.md: ⌘C / ⌘X / ⌘V, "Paste creates views, or
 * model+views across projects"). Pure: build a payload from a selection, check one read off the
 * system clipboard, and plan a paste as one batch command. The DOM side lives in actions.ts.
 */
import type { BatchArgs } from '#lib/commands/batch.ts';
import { addToDiagram, restoreElements } from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import type { SerialisedCommand } from '#lib/commands/types.ts';
import { t } from '#lib/i18n/index.ts';
import { newId } from '#lib/model/ids.ts';
import {
	createAttribute,
	createClassifier,
	createOperation,
	createRelationship,
	elementName,
	getDiagram
} from '#lib/model/project.ts';
import {
	DEFAULT_DISPLAY_FLAGS,
	type Attribute,
	type Classifier,
	type DisplayFlags,
	type EdgeLayout,
	type Element,
	type End,
	type Id,
	type LabelKey,
	type Layout,
	type Literal,
	type NodeLayout,
	type Note,
	type Operation,
	type Parameter,
	type Project,
	type Relationship,
	type TextElement
} from '#lib/model/types.ts';

/** The clipboard type Aster writes beside text/plain. */
export const PAYLOAD_MIME = 'application/x-aster+json';
const FORMAT = 'aster-clipboard';

export interface ClipboardPayload {
	format: typeof FORMAT;
	version: 1;
	/** Paste into the same project creates views; into another, model elements and views. */
	projectId: Id;
	/** Nodes first, then relationships, each in the source diagram's z-order. */
	elements: Element[];
	/** The source diagram's view of each element. */
	layouts: Record<Id, Layout>;
}

type Copyable = Exclude<Element, { kind: 'package' }>;
const isNode = (e: Element | undefined) =>
	e?.kind === 'classifier' || e?.kind === 'note' || e?.kind === 'text';

/** The selected nodes and edges on a diagram, plus every relationship between two selected nodes. */
export function copyPayload(
	project: Project,
	diagramId: Id,
	ids: Iterable<Id>
): ClipboardPayload | null {
	const d = getDiagram(project, diagramId);
	const picked = new Set(ids);
	const el = (id: Id) => project.elements.get(id);
	const nodes = d.elementIds.filter(
		(id) => picked.has(id) && isNode(el(id)) && d.layout.get(id)?.kind === 'node'
	);
	const copied = new Set(nodes);
	const rels = d.elementIds.filter((id) => {
		const r = el(id);
		return (
			r?.kind === 'relationship' &&
			d.layout.get(id)?.kind === 'edge' &&
			(picked.has(id) || (copied.has(r.sourceId) && copied.has(r.targetId)))
		);
	});
	const all = [...nodes, ...rels];
	if (!all.length) return null;
	return {
		format: FORMAT,
		version: 1,
		projectId: project.id,
		elements: all.map((id) => structuredClone(el(id)!)),
		layouts: Object.fromEntries(all.map((id) => [id, structuredClone(d.layout.get(id)!)]))
	};
}

/** What a paste does, as one undo step, and what to select after it. */
export interface PastePlan {
	args: BatchArgs;
	ids: Id[];
}

/** ⌘C ⌘V on the diagram that already shows every copied node duplicates them, offset by this. */
const DUPLICATE_OFFSET = 20;

/**
 * Same project: elements missing from this diagram get views at their copied positions. When every
 * copied node is already here, they are duplicated instead (new model elements, offset). Another
 * project, or an element deleted since the copy: new model elements with fresh ids, ends and note
 * links remapped; a relationship that would lose an end is left behind.
 */
export function planPaste(
	project: Project,
	diagramId: Id,
	payload: ClipboardPayload,
	mint: () => Id = newId
): PastePlan | null {
	const d = getDiagram(project, diagramId);
	const on = new Set(d.elementIds);
	const same = payload.projectId === project.id;
	const exists = (e: Element) => same && project.elements.get(e.id)?.kind === e.kind;
	const nodes = payload.elements.filter((e) => e.kind !== 'relationship');
	const rels = payload.elements.filter((e): e is Relationship => e.kind === 'relationship');
	const duplicate = nodes.length > 0 && nodes.every((e) => exists(e) && on.has(e.id));
	const off = duplicate ? DUPLICATE_OFFSET : 0;

	/** Old id → the id it has after the paste (itself when reused). */
	const map = new Map<Id, Id>();
	const kindAfter = new Map<Id, Element['kind']>();
	const reuse: Id[] = [];
	const clones: Element[] = [];
	const ids: Id[] = [];

	for (const e of nodes) {
		if (!duplicate && exists(e)) {
			map.set(e.id, e.id);
			if (!on.has(e.id)) {
				reuse.push(e.id);
				ids.push(e.id);
			}
		} else map.set(e.id, mint());
		kindAfter.set(map.get(e.id)!, e.kind);
	}
	/** Where a relationship end lands: a pasted node, or a classifier already on this diagram. */
	const end = (id: Id): Id | null => {
		const to = map.get(id) ?? (same && on.has(id) ? id : null);
		const kind = to && (kindAfter.get(to) ?? project.elements.get(to)?.kind);
		return kind === 'classifier' ? to : null;
	};
	for (const e of nodes) {
		const to = map.get(e.id)!;
		if (to === e.id) continue;
		const clone = cloneNode(e as Copyable, to, mint);
		if (clone.kind === 'note')
			clone.linkedIds = clone.linkedIds
				.map((x) => map.get(x) ?? (same && project.elements.has(x) ? x : null))
				.filter((x): x is Id => x !== null);
		clones.push(clone);
		ids.push(to);
	}
	for (const r of rels) {
		const s = end(r.sourceId);
		const tg = end(r.targetId);
		if (!s || !tg) continue;
		if (!duplicate && s === r.sourceId && tg === r.targetId && exists(r)) {
			if (!on.has(r.id)) {
				reuse.push(r.id);
				ids.push(r.id);
			}
			continue;
		}
		const id = mint();
		map.set(r.id, id);
		clones.push({ ...structuredClone(r), id, sourceId: s, targetId: tg });
		ids.push(id);
	}
	if (!ids.length) return null;

	const layoutOf = (oldId: Id): Layout => shift(payload.layouts[oldId], off);
	const oldIdOf = new Map([...map].map(([from, to]) => [to, from]));
	const commands: SerialisedCommand[] = [];
	if (clones.length)
		commands.push(
			serialise(
				restoreElements(project, {
					items: clones.map((element, k) => ({
						element,
						views: [
							{
								diagramId,
								index: d.elementIds.length + k,
								layout: layoutOf(oldIdOf.get(element.id)!)
							}
						]
					}))
				})
			)
		);
	if (reuse.length)
		commands.push(
			serialise(
				addToDiagram(project, {
					diagramId,
					entries: reuse.map((id) => ({ id, layout: layoutOf(id) }))
				})
			)
		);
	const first = clones.find((c) => c.id === ids[0]) ?? project.elements.get(ids[0])!;
	const name = ids.length === 1 ? elementName(first) : t('cmd.many', { count: ids.length });
	return { args: { label: t('cmd.paste', { name }), commands }, ids };
}

function cloneNode(e: Copyable, id: Id, mint: () => Id): Copyable {
	const c = { ...structuredClone(e), id };
	if (c.kind === 'classifier') {
		// Members are _ids in a .mdj too; packages are M3, so a copy lands at the top level.
		c.attributes = c.attributes.map((a) => ({ ...a, id: mint() }));
		c.operations = c.operations.map((o) => ({ ...o, id: mint() }));
		c.literals = c.literals.map((l) => ({ ...l, id: mint() }));
		delete c.packageId;
	}
	return c;
}

function shift(l: Layout, off: number): Layout {
	const c = structuredClone(l);
	if (!off) return c;
	if (c.kind === 'node') return { ...c, x: c.x + off, y: c.y + off };
	return { ...c, waypoints: c.waypoints.map((p) => ({ x: p.x + off, y: p.y + off })) };
}

/** The text/plain twin of a payload: one element name per line. */
export function plainText(p: ClipboardPayload): string {
	return p.elements.map(elementName).join('\n');
}

// ---------------------------------------------------------------------------
// Reading a payload back. Any page can put this type on the clipboard, so every field is
// checked and the elements are rebuilt through the model factories: only known keys come in.
// ---------------------------------------------------------------------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBool = (v: unknown): v is boolean => typeof v === 'boolean';
const isId = (v: unknown): v is Id => isStr(v) && v.length > 0 && v.length <= 64;
const optStr = (v: unknown) => v === undefined || isStr(v);
const oneOf =
	<T extends string>(...xs: T[]) =>
	(v: unknown): v is T =>
		xs.includes(v as T);
const isVisibility = oneOf('public', 'protected', 'private', 'package');
const isClassifierKind = oneOf('class', 'interface', 'enum', 'dataType', 'primitiveType');
const isRelKind = oneOf(
	'association',
	'aggregation',
	'composition',
	'generalization',
	'realization',
	'dependency'
);
const isLineStyle = oneOf('rectilinear', 'oblique', 'roundrect', 'curve');
const isNavigable = oneOf('unspecified', 'navigable', 'notNavigable');
const isDirection = oneOf('in', 'out', 'inout');
const isLabelKey = oneOf<LabelKey>(
	'name',
	'sourceMultiplicity',
	'targetMultiplicity',
	'sourceRole',
	'targetRole',
	'sourceProperty',
	'targetProperty'
);

/** `[key, test]` pairs: present keys must pass; `required` keys must be present. */
function fields(o: Obj, spec: Record<string, (v: unknown) => boolean>, required: string[]) {
	return (
		required.every((k) => k in o) &&
		Object.entries(spec).every(([k, test]) => o[k] === undefined || test(o[k]))
	);
}
const pick = <T>(o: Obj, keys: string[]) =>
	Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]])) as T;
const arrayOf = <T>(v: unknown, read: (x: unknown) => T | null): T[] | null => {
	if (!Array.isArray(v)) return null;
	const out = v.map(read);
	return out.every((x) => x !== null) ? (out as T[]) : null;
};

const ATTR = {
	id: isId,
	name: isStr,
	type: isStr,
	visibility: isVisibility,
	multiplicity: isStr,
	defaultValue: isStr,
	isStatic: isBool,
	isReadOnly: isBool,
	isDerived: isBool,
	isOrdered: isBool,
	isUnique: isBool,
	isID: isBool,
	stereotype: isStr,
	documentation: isStr,
	raw: isStr
};
const OP = {
	id: isId,
	name: isStr,
	visibility: isVisibility,
	returnType: isStr,
	isStatic: isBool,
	isAbstract: isBool,
	isQuery: isBool,
	stereotype: isStr,
	documentation: isStr,
	raw: isStr
};
const END = {
	role: isStr,
	multiplicity: isStr,
	navigable: isNavigable,
	visibility: isVisibility,
	isDerived: isBool,
	isOrdered: isBool,
	isUnique: isBool,
	ownsOther: isBool
};

const readAttr = (v: unknown): Attribute | null =>
	isObj(v) && fields(v, ATTR, ['id', 'name']) ? createAttribute(pick(v, Object.keys(ATTR))) : null;
const readParam = (v: unknown): Parameter | null =>
	isObj(v) &&
	fields(v, { name: isStr, type: isStr, direction: isDirection, defaultValue: isStr }, [
		'name',
		'direction'
	])
		? pick(v, ['name', 'type', 'direction', 'defaultValue'])
		: null;
const readOp = (v: unknown): Operation | null => {
	if (!isObj(v) || !fields(v, OP, ['id', 'name'])) return null;
	const parameters = arrayOf(v.parameters ?? [], readParam);
	return parameters && createOperation({ ...pick<Operation>(v, Object.keys(OP)), parameters });
};
const readLiteral = (v: unknown): Literal | null =>
	isObj(v) &&
	fields(v, { id: isId, name: isStr, stereotype: isStr, documentation: isStr }, ['id', 'name'])
		? {
				...pick<Literal>(v, ['id', 'name', 'stereotype']),
				documentation: (v.documentation as string) ?? ''
			}
		: null;
const readEnd = (v: unknown): End | null | undefined =>
	v === undefined
		? undefined
		: isObj(v) && fields(v, END, [])
			? {
					navigable: 'unspecified',
					isDerived: false,
					isOrdered: false,
					isUnique: false,
					ownsOther: false,
					...pick<Partial<End>>(v, Object.keys(END))
				}
			: null;

function readElement(v: unknown): Copyable | null {
	if (!isObj(v) || !isId(v.id)) return null;
	switch (v.kind) {
		case 'classifier': {
			const spec = {
				classifierKind: isClassifierKind,
				name: isStr,
				stereotype: isStr,
				isAbstract: isBool,
				isLeaf: isBool,
				visibility: isVisibility,
				documentation: isStr
			};
			if (!fields(v, spec, ['classifierKind', 'name'])) return null;
			const attributes = arrayOf(v.attributes ?? [], readAttr);
			const operations = arrayOf(v.operations ?? [], readOp);
			const literals = arrayOf(v.literals ?? [], readLiteral);
			if (!attributes || !operations || !literals) return null;
			return createClassifier({
				...pick<Partial<Classifier>>(v, ['id', ...Object.keys(spec)]),
				attributes,
				operations,
				literals
			});
		}
		case 'relationship': {
			const spec = {
				relationshipKind: isRelKind,
				sourceId: isId,
				targetId: isId,
				name: isStr,
				stereotype: isStr,
				documentation: isStr
			};
			if (!fields(v, spec, ['relationshipKind', 'sourceId', 'targetId'])) return null;
			const sourceEnd = readEnd(v.sourceEnd);
			const targetEnd = readEnd(v.targetEnd);
			if (sourceEnd === null || targetEnd === null) return null;
			return createRelationship({
				...pick<Relationship>(v, ['id', ...Object.keys(spec)]),
				...(sourceEnd && { sourceEnd }),
				...(targetEnd && { targetEnd })
			});
		}
		case 'note': {
			const linkedIds = arrayOf(v.linkedIds ?? [], (x) => (isId(x) ? x : null));
			return isStr(v.text) && linkedIds
				? ({ kind: 'note', id: v.id, text: v.text, linkedIds } satisfies Note)
				: null;
		}
		case 'text':
			return isStr(v.text)
				? ({ kind: 'text', id: v.id, text: v.text } satisfies TextElement)
				: null;
		default:
			return null;
	}
}

const FLAG_KEYS = Object.keys(DEFAULT_DISPLAY_FLAGS) as (keyof DisplayFlags)[];
function readLayout(v: unknown): Layout | null {
	if (!isObj(v) || !optStr(v.fill) || !optStr(v.line)) return null;
	if (v.kind === 'node') {
		if (![v.x, v.y, v.w, v.h].every(isNum)) return null;
		const flags = v.flags;
		if (flags !== undefined) {
			if (!isObj(flags)) return null;
			for (const [k, f] of Object.entries(flags))
				if (
					!FLAG_KEYS.includes(k as keyof DisplayFlags) ||
					typeof f !== typeof DEFAULT_DISPLAY_FLAGS[k as keyof DisplayFlags]
				)
					return null;
		}
		return pick<NodeLayout>(v, ['kind', 'x', 'y', 'w', 'h', 'fill', 'line', 'flags']);
	}
	if (v.kind === 'edge') {
		const waypoints = arrayOf(v.waypoints, (p) =>
			isObj(p) && isNum(p.x) && isNum(p.y) ? { x: p.x, y: p.y } : null
		);
		if (!waypoints || !isLineStyle(v.lineStyle) || !isObj(v.labelOffsets)) return null;
		const labelOffsets: EdgeLayout['labelOffsets'] = {};
		for (const [k, o] of Object.entries(v.labelOffsets)) {
			if (!isLabelKey(k) || !isObj(o) || !isNum(o.alpha) || !isNum(o.distance)) return null;
			labelOffsets[k] = { alpha: o.alpha, distance: o.distance };
		}
		return { ...pick<EdgeLayout>(v, ['kind', 'lineStyle', 'line']), waypoints, labelOffsets };
	}
	return null;
}

/** A payload off the system clipboard, or null when it is anything else or malformed. */
export function parsePayload(text: string): ClipboardPayload | null {
	if (text.length > 10_000_000) return null;
	let v: unknown;
	try {
		v = JSON.parse(text);
	} catch {
		return null;
	}
	if (
		!isObj(v) ||
		v.format !== FORMAT ||
		v.version !== 1 ||
		!isId(v.projectId) ||
		!isObj(v.layouts)
	)
		return null;
	const elements = arrayOf(v.elements, readElement);
	if (!elements || !elements.length) return null;
	const layouts: Record<Id, Layout> = {};
	for (const e of elements) {
		const l = readLayout(v.layouts[e.id]);
		if (!l || (l.kind === 'edge') !== (e.kind === 'relationship')) return null;
		layouts[e.id] = l;
	}
	if (Object.keys(v.layouts).length !== elements.length) return null;
	return { format: FORMAT, version: 1, projectId: v.projectId, elements, layouts };
}
