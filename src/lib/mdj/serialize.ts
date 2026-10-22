/**
 * Aster model → StarUML `.mdj`, the inverse of parse.ts (docs/spec/data-model.md, Export rules).
 *
 * Every object that came from a file keeps its own record (the `#source` Unknown). Export starts
 * from that record and overwrites only the fields whose model value no longer matches what the
 * record parses to, so a no-op load and save is byte-equal ignoring key order, and a change
 * touches only what changed. Unknowns are spliced back at their parent, path and index. New
 * objects get fresh 22-char ids and are remembered as records so the next save reuses them.
 */
import { clipToRect } from '#lib/canvas/edges/geometry.ts';
import { newId } from '#lib/model/ids.ts';
import { instanceLabel, isAssociationKind } from '#lib/model/project.ts';
import {
	DEFAULT_DISPLAY_FLAGS,
	type Attribute,
	type Classifier,
	type ClassifierKind,
	type Diagram,
	type DisplayFlags,
	type EdgeLayout,
	type Element,
	type End,
	type Id,
	type Instance,
	type Link,
	type LabelKey,
	type LabelOffset,
	type Literal,
	type LineStyle,
	type NodeLayout,
	type Operation,
	type Project,
	type Relationship,
	type RelationshipKind,
	type Unknown,
	type Visibility
} from '#lib/model/types.ts';
import { renderMember } from './expression.ts';
import { SOURCE_PATH, STARUML_VIEW_DEFAULTS, parsePoints } from './parse.ts';

type Json = Record<string, unknown>;
type Rect = { x: number; y: number; w: number; h: number };

// ---------------------------------------------------------------------------
// Vocabulary (mirrors parse.ts)
// ---------------------------------------------------------------------------

const CLASSIFIER_TYPE: Record<ClassifierKind, string> = {
	class: 'UMLClass',
	interface: 'UMLInterface',
	enum: 'UMLEnumeration',
	dataType: 'UMLDataType',
	primitiveType: 'UMLPrimitiveType'
};
const CLASSIFIER_VIEW: Record<ClassifierKind, string> = {
	class: 'UMLClassView',
	interface: 'UMLInterfaceView',
	enum: 'UMLEnumerationView',
	dataType: 'UMLDataTypeView',
	primitiveType: 'UMLPrimitiveTypeView'
};
const EDGE_VIEW: Record<RelationshipKind, string> = {
	association: 'UMLAssociationView',
	aggregation: 'UMLAssociationView',
	composition: 'UMLAssociationView',
	generalization: 'UMLGeneralizationView',
	realization: 'UMLInterfaceRealizationView',
	dependency: 'UMLDependencyView'
};
const LINE_STYLES: LineStyle[] = ['rectilinear', 'oblique', 'roundrect', 'curve'];
const VISIBILITIES = new Set<Visibility>(['public', 'protected', 'private', 'package']);
const FLAG_KEYS = Object.keys(DEFAULT_DISPLAY_FLAGS) as (keyof DisplayFlags)[];
/** Arrays the walk rebuilds from the model; never part of a record. */
const WALKED = [
	'ownedElements',
	'attributes',
	'operations',
	'literals',
	'parameters',
	'ownedViews',
	'slots'
];
const FONT = 'Arial;13;0';
const LABEL_REFS: [string, LabelKey][] = [
	['nameLabel', 'name'],
	['tailRoleNameLabel', 'sourceRole'],
	['tailMultiplicityLabel', 'sourceMultiplicity'],
	['tailPropertyLabel', 'sourceProperty'],
	['headRoleNameLabel', 'targetRole'],
	['headMultiplicityLabel', 'targetMultiplicity'],
	['headPropertyLabel', 'targetProperty']
];
const SWAP_LABEL: Partial<Record<LabelKey, LabelKey>> = {
	sourceRole: 'targetRole',
	sourceMultiplicity: 'targetMultiplicity',
	sourceProperty: 'targetProperty',
	targetRole: 'sourceRole',
	targetMultiplicity: 'sourceMultiplicity',
	targetProperty: 'sourceProperty'
};
/** StarUML's own label defaults for a fresh edge (alpha, distance), by reference key. */
const LABEL_DEFAULTS: Record<string, LabelOffset & { edgePosition?: number }> = {
	nameLabel: { alpha: Math.PI / 2, distance: 15, edgePosition: 1 },
	stereotypeLabel: { alpha: Math.PI / 2, distance: 30, edgePosition: 1 },
	propertyLabel: { alpha: -Math.PI / 2, distance: 15, edgePosition: 1 },
	tailRoleNameLabel: { alpha: Math.PI / 6, distance: 30, edgePosition: 2 },
	tailPropertyLabel: { alpha: Math.PI / 4, distance: 40, edgePosition: 2 },
	tailMultiplicityLabel: { alpha: -Math.PI / 6, distance: 25, edgePosition: 2 },
	headRoleNameLabel: { alpha: -Math.PI / 6, distance: 30 },
	headPropertyLabel: { alpha: -Math.PI / 4, distance: 40 },
	headMultiplicityLabel: { alpha: Math.PI / 6, distance: 25 }
};
/** Node metrics in StarUML's units: 13 px text rows 2 px apart, 5 px padding. */
const ROW = 15;
const PAD = 5;
const NAME_H = 25;
const STEREO_H = 13;

// ---------------------------------------------------------------------------
// Readers (the same rules parse.ts applies, so "unchanged" means "parses the same")
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const refOf = (v: unknown): string | undefined =>
	isObj(v) && typeof v.$ref === 'string' ? v.$ref : undefined;
const ref = (id: Id) => ({ $ref: id });
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
const text = (v: unknown): string | undefined =>
	typeof v === 'string' && v !== '' ? v : undefined;
const num = (v: unknown): number | undefined =>
	typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const bool = (v: unknown): boolean => v === true;
const vis = (v: unknown): Visibility =>
	typeof v === 'string' && VISIBILITIES.has(v as Visibility) ? (v as Visibility) : 'public';
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const clone = <T>(v: T): T => structuredClone(v);
function navigability(v: unknown): End['navigable'] {
	if (v === true || v === 'navigable') return 'navigable';
	if (v === false || v === 'notNavigable') return 'notNavigable';
	return 'unspecified';
}
const aggOf = (e: Json | undefined): RelationshipKind | null =>
	e?.aggregation === 'shared'
		? 'aggregation'
		: e?.aggregation === 'composite'
			? 'composition'
			: null;
const fmtPoints = (pts: { x: number; y: number }[]) =>
	pts.map((p) => `${Math.round(p.x)}:${Math.round(p.y)}`).join(';');
const normaliseAngle = (a: number) => {
	while (a > Math.PI) a -= 2 * Math.PI;
	while (a <= -Math.PI) a += 2 * Math.PI;
	return a;
};

interface Child {
	json: Json;
	index: number;
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

class Serializer {
	/** Own fields of every object that came from a file (or an earlier save), by its id. */
	readonly records = new Map<Id, Json>();
	readonly recordIndex = new Map<Id, number>();
	/** Unmapped objects by parent id ('' for the root) and array name. */
	readonly kids = new Map<string, Map<string, Unknown[]>>();
	/** Every JSON object with an id anywhere in the records and unknowns, for `$ref` lookups. */
	readonly index = new Map<string, Json>();
	readonly unknownJson = new WeakSet<object>();
	/** Elements whose own fields changed this export: their view text is regenerated. */
	readonly changed = new Set<Id>();
	/** Node view records by `diagramId/elementId`, to find a view for an element. */
	readonly viewRecords = new Map<string, Json>();
	readonly viewIds = new Map<string, Id>();
	readonly modelId: Id;
	readonly swappedCache = new Map<Id, boolean>();
	readonly nodeRects = new Map<string, { was: Rect | null; now: Rect }>();

	constructor(readonly project: Project) {
		for (const u of project.unknown) {
			if (u.path === SOURCE_PATH && u.parentId && isObj(u.json)) {
				this.records.set(u.parentId, u.json);
				this.recordIndex.set(u.parentId, u.index);
				this.indexTree(u.json);
			} else {
				const byPath = this.kids.get(u.parentId ?? '') ?? new Map<string, Unknown[]>();
				const list = byPath.get(u.path) ?? [];
				list.push(u);
				byPath.set(u.path, list);
				this.kids.set(u.parentId ?? '', byPath);
				if (isObj(u.json)) this.unknownJson.add(u.json);
				this.indexTree(u.json);
			}
		}
		for (const [id, r] of this.records) {
			const parent = refOf(r._parent);
			const model = refOf(r.model);
			if (parent && model && typeof r._type === 'string' && r._type.endsWith('View'))
				this.viewRecords.set(`${parent}/${model}`, r);
			void id;
		}
		this.modelId = this.ensureModel();
	}

	indexTree(o: unknown) {
		if (Array.isArray(o)) return o.forEach((v) => this.indexTree(v));
		if (!isObj(o)) return;
		if (typeof o._id === 'string') this.index.set(o._id, o);
		for (const [k, v] of Object.entries(o)) if (k !== '_parent') this.indexTree(v);
	}

	/** The first UMLModel of the project (folded in on import); created for a project born in Aster. */
	ensureModel(): Id {
		for (const [id, r] of this.records)
			if (
				r._type === 'UMLModel' &&
				refOf(r._parent) === this.project.id &&
				!this.project.elements.has(id)
			)
				return id;
		const id = newId();
		const json: Json = { _type: 'UMLModel', _id: id, _parent: ref(this.project.id), name: 'Model' };
		this.project.unknown.push({ json, parentId: id, path: SOURCE_PATH, index: 0 });
		this.records.set(id, json);
		this.recordIndex.set(id, 0);
		return id;
	}

	// ---- naming and references ---------------------------------------------

	nameAt(id: string): string | undefined {
		const el = this.project.elements.get(id);
		if (el && 'name' in el) return el.name;
		return str(this.index.get(id)?.name);
	}
	/** What a `type` / `stereotype` field parses to: a string, or the name behind a `$ref`. */
	parsedName(v: unknown): string | undefined {
		if (typeof v === 'string') return v || undefined;
		const id = refOf(v);
		return id === undefined ? undefined : this.nameAt(id) || undefined;
	}
	/**
	 * A type or stereotype: kept as it was when it still parses to the model's string; else a
	 * `$ref` to the classifier of that name when there is one, else the string.
	 */
	refOrName(was: unknown, want: string | undefined): unknown {
		if (this.parsedName(was) === want) return was;
		if (want === undefined) return undefined;
		for (const el of this.project.elements.values())
			if (el.kind === 'classifier' && el.name === want) return ref(el.id);
		return want;
	}

	// ---- field helpers: write only what no longer parses the same -----------

	put(o: Json, key: string, value: unknown, changed: boolean) {
		if (value === undefined) delete o[key];
		else o[key] = value;
		if (changed) return true;
		return true;
	}
	setStr(
		o: Json,
		rec: Json | undefined,
		key: string,
		want: string | undefined,
		dflt = ''
	): boolean {
		const was =
			(key === 'name' || key === 'documentation' ? str(rec?.[key]) : text(rec?.[key])) ?? dflt;
		if ((want ?? dflt) === was) return false;
		if (want === undefined || want === dflt) delete o[key];
		else o[key] = want;
		if (key === 'name') o[key] = want ?? '';
		return true;
	}
	setBool(o: Json, rec: Json | undefined, key: string, want: boolean): boolean {
		if (bool(rec?.[key]) === want) return false;
		if (want) o[key] = true;
		else delete o[key];
		return true;
	}
	setVis(o: Json, rec: Json | undefined, want: Visibility | undefined): boolean {
		const w = want ?? 'public';
		if (vis(rec?.visibility) === w) return false;
		if (w === 'public') delete o.visibility;
		else o.visibility = w;
		return true;
	}
	setRef(o: Json, rec: Json | undefined, key: string, want: Id): boolean {
		if (refOf(rec?.[key]) === want) return false;
		o[key] = ref(want);
		return true;
	}
	setNamed(o: Json, rec: Json | undefined, key: string, want: string | undefined): boolean {
		const v = this.refOrName(rec?.[key], want);
		if (v === rec?.[key]) return false;
		if (v === undefined) delete o[key];
		else o[key] = v;
		return true;
	}
	setNum(o: Json, rec: Json | undefined, key: string, want: number, dflt = 0): boolean {
		if ((num(rec?.[key]) ?? dflt) === want) return false;
		o[key] = want;
		return true;
	}

	/** A record's clone, or a fresh object with the conventional key order. */
	base(id: Id, type: string, parentId: Id | null): Json {
		const rec = this.records.get(id);
		if (rec) {
			const o = clone(rec);
			if (parentId && refOf(o._parent) !== parentId) o._parent = ref(parentId);
			return o;
		}
		return parentId ? { _type: type, _id: id, _parent: ref(parentId) } : { _type: type, _id: id };
	}

	// ---- arrays: children in order, unknowns spliced back -----------------

	merge(id: string, path: string, children: Child[]): Json[] {
		const all: Child[] = [
			...children,
			...(this.kids.get(id)?.get(path) ?? []).map((u) => ({ json: u.json as Json, index: u.index }))
		];
		all.sort((a, b) => a.index - b.index);
		return all.map((c) => c.json);
	}
	setArray(o: Json, id: string, path: string, children: Child[]) {
		const items = this.merge(id, path, children);
		if (items.length || Array.isArray(o[path])) o[path] = items;
	}
	/** Unknowns at arrays the model has no notion of (receptions, template parameters …). */
	spliceRest(o: Json, id: string, handled: string[]) {
		for (const path of this.kids.get(id)?.keys() ?? [])
			if (!handled.includes(path)) this.setArray(o, id, path, []);
	}
	indexOf(id: Id): number {
		return this.recordIndex.get(id) ?? Number.POSITIVE_INFINITY;
	}
	alive(id: string | undefined): id is Id {
		return (
			id !== undefined &&
			(id === this.project.id || id === this.modelId || this.project.elements.has(id))
		);
	}

	// ---- parents -------------------------------------------------------------

	swapped(r: Relationship): boolean {
		const cached = this.swappedCache.get(r.id);
		if (cached !== undefined) return cached;
		const rec = this.records.get(r.id);
		const e1 = isObj(rec?.end1) ? rec.end1 : undefined;
		const e2 = isObj(rec?.end2) ? rec.end2 : undefined;
		const result =
			!!e1 &&
			!!e2 &&
			refOf(e1.reference) === r.targetId &&
			refOf(e2.reference) === r.sourceId &&
			(r.sourceId !== r.targetId || (!!aggOf(e1) && !aggOf(e2)));
		this.swappedCache.set(r.id, result);
		return result;
	}
	/** Where an element is written: its original parent while that exists, else the spec's rule. */
	parentOf(el: Element | Diagram): Id {
		const p = refOf(this.records.get(el.id)?._parent);
		if (this.alive(p)) return p;
		if (!('kind' in el)) return this.modelId; // a diagram
		switch (el.kind) {
			case 'classifier':
				return el.packageId ?? this.modelId;
			case 'package':
				return el.parentId ?? this.modelId;
			case 'relationship':
				return isAssociationKind(el.relationshipKind) && this.swapped(el)
					? el.targetId
					: el.sourceId;
			case 'instance':
				return el.packageId ?? this.modelId;
			case 'link':
				// StarUML owns a link by its end1 object.
				return el.sourceId;
			default:
				return this.modelId;
		}
	}

	// ---- model elements ----------------------------------------------------

	serialize(): Json {
		const p = this.project;
		const root = this.base(p.id, 'Project', null);
		this.setStr(root, this.records.get(p.id), 'name', p.name);
		const owned = new Map<Id, Child[]>();
		const own = (parent: Id, child: Child) =>
			owned.set(parent, [...(owned.get(parent) ?? []), child]);
		const model = this.base(this.modelId, 'UMLModel', p.id);
		own(p.id, { json: model, index: this.indexOf(this.modelId) });

		// Diagrams first (their views need every element's view id), then elements.
		const diagramJson = new Map<Id, Json>();
		for (const d of p.diagrams) {
			const o = this.base(
				d.id,
				d.diagramKind === 'object' ? 'UMLObjectDiagram' : 'UMLClassDiagram',
				this.parentOf(d)
			);
			this.setStr(o, this.records.get(d.id), 'name', d.name);
			diagramJson.set(d.id, o);
			own(this.parentOf(d), { json: o, index: this.indexOf(d.id) });
		}
		const elementJson = new Map<Id, Json>();
		for (const el of p.elements.values()) {
			let o: Json;
			if (el.kind === 'classifier') o = this.emitClassifier(el);
			else if (el.kind === 'package') o = this.emitPackage(el);
			else if (el.kind === 'relationship') o = this.emitRelationship(el);
			else if (el.kind === 'instance') o = this.emitInstance(el);
			else if (el.kind === 'link') o = this.emitLink(el);
			else continue; // notes and texts are views
			elementJson.set(el.id, o);
			own(this.parentOf(el), { json: o, index: this.indexOf(el.id) });
		}
		for (const d of p.diagrams) this.emitViews(d, diagramJson.get(d.id)!);

		const fill = (o: Json, id: Id) => {
			this.setArray(o, id, 'ownedElements', owned.get(id) ?? []);
			this.spliceRest(o, id, [...WALKED]);
		};
		for (const [id, o] of elementJson) fill(o, id);
		fill(model, this.modelId);
		fill(root, p.id);
		this.remember(root);
		return root;
	}

	emitClassifier(c: Classifier): Json {
		const rec = this.records.get(c.id);
		const o = this.base(c.id, CLASSIFIER_TYPE[c.classifierKind], this.parentOf(c));
		if (o._type !== CLASSIFIER_TYPE[c.classifierKind]) o._type = CLASSIFIER_TYPE[c.classifierKind];
		let changed = !rec;
		if (this.setStr(o, rec, 'name', c.name)) {
			changed = true;
			this.changed.add(`${c.id}:name`);
		}
		changed = this.setVis(o, rec, c.visibility) || changed;
		changed = this.setBool(o, rec, 'isAbstract', c.isAbstract) || changed;
		changed = this.setBool(o, rec, 'isLeaf', c.isLeaf) || changed;
		changed = this.setStr(o, rec, 'documentation', c.documentation) || changed;
		if (this.setNamed(o, rec, 'stereotype', c.stereotype)) {
			changed = true;
			this.changed.add(`${c.id}:stereotype`);
		}
		if (changed) this.changed.add(c.id);
		this.setArray(
			o,
			c.id,
			'attributes',
			c.attributes.map((a) => ({ json: this.emitAttribute(a, c.id), index: this.indexOf(a.id) }))
		);
		this.setArray(
			o,
			c.id,
			'operations',
			c.operations.map((op) => ({ json: this.emitOperation(op, c.id), index: this.indexOf(op.id) }))
		);
		this.setArray(
			o,
			c.id,
			'literals',
			c.literals.map((l) => ({ json: this.emitLiteral(l, c.id), index: this.indexOf(l.id) }))
		);
		return o;
	}

	emitAttribute(a: Attribute, ownerId: Id): Json {
		const rec = this.records.get(a.id);
		const o = this.base(a.id, 'UMLAttribute', ownerId);
		let changed = !rec;
		changed = this.setStr(o, rec, 'name', a.name) || changed;
		changed = this.setVis(o, rec, a.visibility) || changed;
		changed = this.setNamed(o, rec, 'type', a.type) || changed;
		changed = this.setStr(o, rec, 'multiplicity', a.multiplicity) || changed;
		changed = this.setStr(o, rec, 'defaultValue', a.defaultValue) || changed;
		for (const k of [
			'isStatic',
			'isReadOnly',
			'isDerived',
			'isOrdered',
			'isUnique',
			'isID'
		] as const)
			changed = this.setBool(o, rec, k, a[k]) || changed;
		changed = this.setNamed(o, rec, 'stereotype', a.stereotype) || changed;
		changed = this.setStr(o, rec, 'documentation', a.documentation) || changed;
		if (changed) this.changed.add(a.id);
		this.setArray(o, a.id, 'ownedElements', []);
		this.spliceRest(o, a.id, ['ownedElements']);
		return o;
	}

	emitOperation(op: Operation, ownerId: Id): Json {
		const rec = this.records.get(op.id);
		const o = this.base(op.id, 'UMLOperation', ownerId);
		let changed = !rec;
		changed = this.setStr(o, rec, 'name', op.name) || changed;
		changed = this.setVis(o, rec, op.visibility) || changed;
		for (const k of ['isStatic', 'isAbstract', 'isQuery'] as const)
			changed = this.setBool(o, rec, k, op[k]) || changed;
		changed = this.setNamed(o, rec, 'stereotype', op.stereotype) || changed;
		changed = this.setStr(o, rec, 'documentation', op.documentation) || changed;

		// Parameters: records under this operation, in order; the return type is a 'return' one.
		const records = [...this.records.entries()]
			.filter(([, r]) => r._type === 'UMLParameter' && refOf(r._parent) === op.id)
			.sort(([a], [b]) => this.indexOf(a) - this.indexOf(b));
		const returns = records.filter(([, r]) => r.direction === 'return');
		const plain = records.filter(([, r]) => r.direction !== 'return');
		const children: Child[] = [];
		op.parameters.forEach((param, i) => {
			const [id, prec] = plain[i] ?? [newId(), undefined];
			const pj = this.base(id, 'UMLParameter', op.id);
			let pc = !prec;
			pc = this.setStr(pj, prec, 'name', param.name) || pc;
			pc = this.setNamed(pj, prec, 'type', param.type) || pc;
			pc = this.setStr(pj, prec, 'defaultValue', param.defaultValue) || pc;
			const wasDir =
				prec?.direction === 'out' || prec?.direction === 'inout' ? prec.direction : 'in';
			if (wasDir !== param.direction) {
				pc = true;
				if (param.direction === 'in') delete pj.direction;
				else pj.direction = param.direction;
			}
			if (pc) changed = true;
			children.push({ json: pj, index: prec ? this.indexOf(id) : Number.POSITIVE_INFINITY });
		});
		if (plain.length > op.parameters.length) changed = true;
		const [rid, rrec] = returns[0] ?? [undefined, undefined];
		if (rrec && rid) {
			const rj = this.base(rid, 'UMLParameter', op.id);
			if (this.setNamed(rj, rrec, 'type', op.returnType)) changed = true;
			children.push({ json: rj, index: this.indexOf(rid) });
			for (const [xid] of returns.slice(1))
				children.push({ json: this.base(xid, 'UMLParameter', op.id), index: this.indexOf(xid) });
		} else if (op.returnType) {
			changed = true;
			const rj: Json = {
				_type: 'UMLParameter',
				_id: newId(),
				_parent: ref(op.id),
				type: this.refOrName(undefined, op.returnType),
				direction: 'return'
			};
			children.push({ json: rj, index: Number.POSITIVE_INFINITY });
		}
		if (changed) this.changed.add(op.id);
		this.setArray(o, op.id, 'parameters', children);
		this.setArray(o, op.id, 'ownedElements', []);
		this.spliceRest(o, op.id, ['ownedElements', 'parameters']);
		return o;
	}

	emitLiteral(l: Literal, ownerId: Id): Json {
		const rec = this.records.get(l.id);
		const o = this.base(l.id, 'UMLEnumerationLiteral', ownerId);
		let changed = !rec;
		changed = this.setStr(o, rec, 'name', l.name) || changed;
		changed = this.setNamed(o, rec, 'stereotype', l.stereotype) || changed;
		changed = this.setStr(o, rec, 'documentation', l.documentation) || changed;
		if (changed) this.changed.add(l.id);
		this.setArray(o, l.id, 'ownedElements', []);
		this.spliceRest(o, l.id, ['ownedElements']);
		return o;
	}

	emitPackage(pkg: Extract<Element, { kind: 'package' }>): Json {
		const rec = this.records.get(pkg.id);
		const o = this.base(pkg.id, 'UMLPackage', this.parentOf(pkg));
		if (this.setStr(o, rec, 'name', pkg.name)) this.changed.add(`${pkg.id}:name`);
		this.setStr(o, rec, 'documentation', pkg.documentation);
		return o;
	}

	emitRelationship(r: Relationship): Json {
		const rec = this.records.get(r.id);
		const association = isAssociationKind(r.relationshipKind);
		const type = association
			? 'UMLAssociation'
			: r.relationshipKind === 'generalization'
				? 'UMLGeneralization'
				: r.relationshipKind === 'dependency'
					? 'UMLDependency'
					: rec?._type === 'UMLRealization' || rec?._type === 'UMLInterfaceRealization'
						? (rec._type as string)
						: this.project.elements.get(r.targetId)?.kind === 'classifier' &&
							  (this.project.elements.get(r.targetId) as Classifier).classifierKind === 'interface'
							? 'UMLInterfaceRealization'
							: 'UMLRealization';
		let o = this.base(r.id, type, this.parentOf(r));
		// A kind change across the association / directed divide starts the object over.
		const wasAssociation = rec?._type === 'UMLAssociation';
		if (rec && wasAssociation !== association) {
			o = { _type: type, _id: r.id, _parent: o._parent };
			if (str(rec.name)) o.name = rec.name;
			if (str(rec.documentation)) o.documentation = rec.documentation;
		}
		if (o._type !== type) o._type = type;
		const base = rec && wasAssociation === association ? rec : undefined;
		let changed = !base;
		if (this.setStr(o, base, 'name', r.name)) {
			changed = true;
			this.changed.add(`${r.id}:name`);
		}
		if (this.setNamed(o, base, 'stereotype', r.stereotype)) {
			changed = true;
			this.changed.add(`${r.id}:stereotype`);
		}
		changed = this.setStr(o, base, 'documentation', r.documentation) || changed;

		if (association) {
			const swapped = base ? this.swapped(r) : false;
			const [e1Model, e2Model] = swapped ? [r.targetEnd, r.sourceEnd] : [r.sourceEnd, r.targetEnd];
			const [e1Id, e2Id] = swapped ? [r.targetId, r.sourceId] : [r.sourceId, r.targetId];
			// The whole (diamond side) is Aster's target: end1 when swapped, else end2.
			changed = this.emitEnd(o, base, 'end1', r, e1Model, e1Id, swapped) || changed;
			changed = this.emitEnd(o, base, 'end2', r, e2Model, e2Id, !swapped) || changed;
		} else {
			changed = this.setRef(o, base, 'source', r.sourceId) || changed;
			changed = this.setRef(o, base, 'target', r.targetId) || changed;
		}
		if (changed) this.changed.add(r.id);
		this.setArray(o, r.id, 'ownedElements', []);
		this.spliceRest(o, r.id, ['ownedElements']);
		return o;
	}

	emitEnd(
		o: Json,
		base: Json | undefined,
		key: 'end1' | 'end2',
		r: Relationship,
		end: End | undefined,
		referenceId: Id,
		isWhole: boolean
	): boolean {
		const rec = isObj(base?.[key]) ? base[key] : undefined;
		const e: Json = rec
			? (o[key] as Json)
			: { _type: 'UMLAssociationEnd', _id: newId(), _parent: ref(r.id) };
		let changed = !rec;
		changed = this.setRef(e, rec, 'reference', referenceId) || changed;
		changed = this.setStr(e, rec, 'name', end?.role, '') || changed;
		if (end?.role === undefined && rec?.name === '') e.name = '';
		changed = this.setStr(e, rec, 'multiplicity', end?.multiplicity) || changed;
		const nav = end?.navigable ?? 'unspecified';
		if (navigability(rec?.navigable) !== nav) {
			changed = true;
			if (nav === 'unspecified') delete e.navigable;
			else e.navigable = nav;
		}
		changed = this.setVis(e, rec, end?.visibility) || changed;
		for (const k of ['isDerived', 'isOrdered', 'isUnique'] as const)
			changed = this.setBool(e, rec, k, end?.[k] ?? false) || changed;
		const wantAgg = isWhole && r.relationshipKind !== 'association' ? r.relationshipKind : null;
		if (aggOf(rec) !== wantAgg) {
			changed = true;
			if (wantAgg === null) delete e.aggregation;
			else e.aggregation = wantAgg === 'aggregation' ? 'shared' : 'composite';
		}
		o[key] = e;
		return changed;
	}

	// ---- objects and links (M3.2) -------------------------------------------

	emitInstance(inst: Instance): Json {
		const rec = this.records.get(inst.id);
		const o = this.base(inst.id, 'UMLObject', this.parentOf(inst));
		let changed = !rec;
		changed = this.setStr(o, rec, 'name', inst.name) || changed;
		changed = this.setNamed(o, rec, 'classifier', inst.classifier) || changed;
		changed = this.setNamed(o, rec, 'stereotype', inst.stereotype) || changed;
		this.setStr(o, rec, 'documentation', inst.documentation);
		const slots = inst.slots.map((sl) => {
			const srec = this.records.get(sl.id);
			const so = this.base(sl.id, 'UMLSlot', inst.id);
			let c = !srec;
			c = this.setStr(so, srec, 'name', sl.name) || c;
			c = this.setStr(so, srec, 'value', sl.value) || c;
			if (c) changed = true;
			return { json: so, index: this.indexOf(sl.id) };
		});
		// A removed slot changes the object's view too.
		const before = arr(rec?.slots).length;
		if (rec && before !== inst.slots.length) changed = true;
		this.setArray(o, inst.id, 'slots', slots);
		if (changed) this.changed.add(inst.id);
		return o;
	}

	emitLink(link: Link): Json {
		const rec = this.records.get(link.id);
		const o = this.base(link.id, 'UMLLink', this.parentOf(link));
		let changed = !rec;
		if (this.setStr(o, rec, 'name', link.name)) {
			changed = true;
			this.changed.add(`${link.id}:name`);
		}
		this.setStr(o, rec, 'documentation', link.documentation);
		// An association deleted since leaves the link plain rather than pointing at nothing.
		if (
			link.associationId &&
			this.project.elements.get(link.associationId)?.kind === 'relationship'
		)
			changed = this.setRef(o, rec, 'association', link.associationId) || changed;
		else if (rec?.association !== undefined) delete o.association;
		for (const [key, id] of [
			['end1', link.sourceId],
			['end2', link.targetId]
		] as const) {
			const erec = isObj(rec?.[key]) ? (rec[key] as Json) : undefined;
			const e: Json = erec
				? (o[key] as Json)
				: { _type: 'UMLLinkEnd', _id: newId(), _parent: ref(link.id) };
			changed = this.setRef(e, erec, 'reference', id) || changed;
			o[key] = e;
		}
		if (changed) this.changed.add(link.id);
		this.setArray(o, link.id, 'ownedElements', []);
		this.spliceRest(o, link.id, ['ownedElements']);
		return o;
	}

	// ---- views ---------------------------------------------------------------

	viewIdOf(d: Diagram, elementId: Id): Id {
		const key = `${d.id}/${elementId}`;
		const el = this.project.elements.get(elementId);
		if (el?.kind === 'note' || el?.kind === 'text') return elementId;
		let id = this.viewIds.get(key) ?? str(this.viewRecords.get(key)?._id);
		if (!id) id = newId();
		this.viewIds.set(key, id);
		return id;
	}
	nodeRect(d: Diagram, id: Id): Rect | null {
		const l = d.layout.get(id);
		return l?.kind === 'node' ? { x: l.x, y: l.y, w: l.w, h: l.h } : null;
	}

	emitViews(d: Diagram, o: Json) {
		const children: Child[] = [];
		const edges: [Relationship, EdgeLayout][] = [];
		const linkEdges: [Link, EdgeLayout][] = [];
		for (const id of d.elementIds) {
			const el = this.project.elements.get(id);
			const l = d.layout.get(id);
			if (!el || !l) continue;
			if (el.kind === 'relationship' && l.kind === 'edge') {
				edges.push([el, l]);
				continue;
			}
			if (el.kind === 'link' && l.kind === 'edge') {
				linkEdges.push([el, l]);
				continue;
			}
			if (l.kind !== 'node' || el.kind === 'relationship' || el.kind === 'link') continue;
			const rec =
				el.kind === 'note' || el.kind === 'text'
					? this.records.get(id)
					: this.viewRecords.get(`${d.id}/${id}`);
			const vid = this.viewIdOf(d, id);
			let v: Json;
			if (el.kind === 'classifier') v = this.emitClassifierView(d, el, l, rec, vid);
			else if (el.kind === 'package') v = this.emitPackageView(d, el, l, rec, vid);
			else if (el.kind === 'instance') v = this.emitObjectView(d, el, l, rec, vid);
			else v = this.emitNoteView(d, el, l, rec, vid);
			children.push({ json: v, index: rec ? this.indexOf(vid) : Number.POSITIVE_INFINITY });
		}
		for (const [rel, l] of edges) {
			const rec = this.viewRecords.get(`${d.id}/${rel.id}`);
			const vid = this.viewIdOf(d, rel.id);
			const v = this.emitEdgeView(d, rel, l, rec, vid);
			children.push({ json: v, index: rec ? this.indexOf(vid) : Number.POSITIVE_INFINITY });
		}
		for (const [link, l] of linkEdges) {
			const rec = this.viewRecords.get(`${d.id}/${link.id}`);
			const vid = this.viewIdOf(d, link.id);
			const v = this.emitLinkView(d, link, l, rec, vid);
			children.push({ json: v, index: rec ? this.indexOf(vid) : Number.POSITIVE_INFINITY });
		}
		// Note links come from Note.linkedIds: an existing view (either direction) is kept as it
		// was, a new link gets a view, a link that is gone takes its view with it.
		const shown = new Set(children.map((c) => c.json._id as string));
		const linkRecords = [...this.records.entries()].filter(
			([, r]) => r._type === 'UMLNoteLinkView' && refOf(r._parent) === d.id
		);
		for (const id of d.elementIds) {
			const el = this.project.elements.get(id);
			if (el?.kind !== 'note' || !shown.has(id)) continue;
			for (const targetId of el.linkedIds) {
				const otherVid = this.viewIdOf(d, targetId);
				if (!shown.has(otherVid)) continue;
				const found = linkRecords.find(([, r]) => {
					const ends = new Set([refOf(r.head), refOf(r.tail)]);
					return ends.has(id) && ends.has(otherVid);
				});
				if (found) {
					children.push({ json: clone(found[1]), index: this.indexOf(found[0]) });
					continue;
				}
				const a = this.nodeRect(d, id);
				const b = this.nodeRect(d, targetId);
				const c = (rr: Rect) => ({ x: rr.x + rr.w / 2, y: rr.y + rr.h / 2 });
				const points = a && b ? fmtPoints([clipToRect(b, c(a)), clipToRect(a, c(b))]) : '';
				children.push({
					json: {
						_type: 'UMLNoteLinkView',
						_id: newId(),
						_parent: ref(d.id),
						font: FONT,
						head: ref(id),
						tail: ref(otherVid),
						lineStyle: 1,
						points
					},
					index: Number.POSITIVE_INFINITY
				});
			}
		}
		this.setArray(o, d.id, 'ownedViews', children);
		this.spliceRest(o, d.id, [...WALKED]);
	}

	/** Rect fields and the colour / display flags shared by every node view. */
	nodeFields(d: Diagram, l: NodeLayout, rec: Json | undefined, v: Json): boolean {
		let moved = !rec;
		moved = this.setNum(v, rec, 'left', l.x) || moved;
		moved = this.setNum(v, rec, 'top', l.y) || moved;
		moved = this.setNum(v, rec, 'width', l.w) || moved;
		moved = this.setNum(v, rec, 'height', l.h) || moved;
		this.setStr(v, rec, 'fillColor', l.fill);
		this.setStr(v, rec, 'lineColor', l.line);
		const effective = { ...d.defaults, ...l.flags };
		for (const k of FLAG_KEYS) {
			const raw = rec?.[k];
			const was = typeof raw === typeof STARUML_VIEW_DEFAULTS[k] ? raw : STARUML_VIEW_DEFAULTS[k];
			const want = effective[k];
			if (was === want) continue;
			if (want === STARUML_VIEW_DEFAULTS[k]) delete v[k];
			else v[k] = want;
		}
		return moved;
	}

	emitClassifierView(
		d: Diagram,
		c: Classifier,
		l: NodeLayout,
		rec: Json | undefined,
		vid: Id
	): Json {
		const v = rec
			? clone(rec)
			: {
					_type: CLASSIFIER_VIEW[c.classifierKind],
					_id: vid,
					_parent: ref(d.id),
					model: ref(c.id),
					subViews: [],
					font: FONT
				};
		if (v._type !== CLASSIFIER_VIEW[c.classifierKind]) v._type = CLASSIFIER_VIEW[c.classifierKind];
		const moved = this.nodeFields(d, l, rec, v);
		this.regenerateCompartments(v, c, l, { ...d.defaults, ...l.flags }, moved);
		return v;
	}

	/**
	 * Compartments and their member views: present for every classifier view, reusing the
	 * subview objects (and ids) that exist, adding what is missing and dropping views of members
	 * that are gone. Geometry is recomputed when the node moved or resized or its members changed.
	 */
	regenerateCompartments(
		v: Json,
		c: Classifier,
		l: NodeLayout,
		flags: DisplayFlags,
		moved: boolean
	) {
		const subs = arr(v.subViews).filter(isObj) as Json[];
		const byType = (t: string) => subs.find((s) => s._type === t);
		const vid = v._id as Id;
		const make = (type: string, extra: Json = {}): Json => ({
			_type: type,
			_id: newId(),
			_parent: ref(vid),
			model: ref(c.id),
			font: FONT,
			...extra
		});
		const ensure = (type: string, refKey: string, extra?: Json) => {
			let s = byType(type);
			if (!s) {
				s = make(type, extra);
				subs.push(s);
				v[refKey] = ref(s._id as string);
			} else if (refOf(v[refKey]) !== s._id) v[refKey] = ref(s._id as string);
			return s;
		};
		const nameComp = ensure('UMLNameCompartmentView', 'nameCompartment', { subViews: [] });
		const attrComp = ensure('UMLAttributeCompartmentView', 'attributeCompartment');
		const opComp = ensure('UMLOperationCompartmentView', 'operationCompartment');
		const litComp =
			c.classifierKind === 'enum'
				? ensure('UMLEnumerationLiteralCompartmentView', 'enumerationLiteralCompartment')
				: undefined;

		// Name compartment labels: stereotype, name, namespace, property (in that order).
		const labels = arr(nameComp.subViews).filter(isObj) as Json[];
		const label = (refKey: string, i: number, extra: Json = {}) => {
			let s = labels.find((x) => x._id === refOf(nameComp[refKey]));
			if (!s) {
				s = {
					_type: 'LabelView',
					_id: newId(),
					_parent: ref(nameComp._id as string),
					font: FONT,
					...extra
				};
				labels.splice(Math.min(i, labels.length), 0, s);
				nameComp[refKey] = ref(s._id as string);
			}
			return s;
		};
		const stereoLabel = label('stereotypeLabel', 0, { visible: false });
		const nameLabel = label('nameLabel', 1, { font: 'Arial;13;1' });
		label('namespaceLabel', 2, { visible: false });
		label('propertyLabel', 3, { visible: false, horizontalAlignment: 1 });
		nameComp.subViews = labels;
		const stereo =
			c.stereotype ??
			(c.classifierKind === 'interface'
				? 'interface'
				: c.classifierKind === 'enum'
					? 'enumeration'
					: c.classifierKind === 'dataType'
						? 'dataType'
						: c.classifierKind === 'primitiveType'
							? 'primitive'
							: undefined);
		let memberChange = false;
		if (this.changed.has(`${c.id}:name`) || nameLabel.text === undefined) nameLabel.text = c.name;
		if (this.changed.has(`${c.id}:stereotype`) || (stereo && stereoLabel.text === undefined)) {
			if (stereo) {
				stereoLabel.text = `«${stereo}»`;
				delete stereoLabel.visible;
			} else {
				delete stereoLabel.text;
				stereoLabel.visible = false;
			}
			memberChange = true;
		}

		// Member views: one per member, in model order, keyed by model ref.
		const render = (kind: 'attribute' | 'operation' | 'literal', m: { id: Id }) =>
			renderMember(kind, m as never, {
				showVisibility: true,
				showType: true,
				showMultiplicity: true,
				showOperationSignature: true,
				showProperty: true
			});
		const members = (
			comp: Json,
			type: string,
			kind: 'attribute' | 'operation' | 'literal',
			list: { id: Id }[],
			hidden: boolean
		) => {
			const old = arr(comp.subViews).filter(isObj) as Json[];
			// StarUML does not keep a hidden compartment's views in step with the model (the lab's
			// reference files hold one view fewer than the class has operations there). A save
			// leaves it as written, dropping only views of members that are gone.
			if (hidden) {
				const alive = new Map(list.map((m) => [m.id, m]));
				const kept = old.filter((x) => alive.has(refOf(x.model) as Id));
				for (const x of kept) {
					const m = alive.get(refOf(x.model) as Id)!;
					if (this.changed.has(m.id)) x.text = render(kind, m);
				}
				if (kept.length !== old.length) {
					comp.subViews = kept;
					memberChange = true;
				}
				return;
			}
			const next: Json[] = [];
			for (const m of list) {
				let s = old.find((x) => refOf(x.model) === m.id);
				if (!s) {
					s = {
						_type: type,
						_id: newId(),
						_parent: ref(comp._id as string),
						model: ref(m.id),
						font: FONT,
						horizontalAlignment: 0
					};
					memberChange = true;
				}
				if (this.changed.has(m.id) || s.text === undefined) s.text = render(kind, m);
				next.push(s);
			}
			if (old.length !== next.length) memberChange = true;
			if (next.length || Array.isArray(comp.subViews)) comp.subViews = next;
		};
		members(attrComp, 'UMLAttributeView', 'attribute', c.attributes, flags.suppressAttributes);
		members(opComp, 'UMLOperationView', 'operation', c.operations, flags.suppressOperations);
		if (litComp)
			members(litComp, 'UMLEnumerationLiteralView', 'literal', c.literals, flags.suppressLiterals);

		if (moved || memberChange)
			this.layoutCompartments(
				v,
				l,
				flags,
				nameComp,
				attrComp,
				opComp,
				litComp,
				stereo !== undefined,
				subs
			);
		v.subViews = subs;
	}

	/** Absolute geometry in StarUML's units: 25 px name row (38 with a stereotype line), 15 px members. */
	layoutCompartments(
		v: Json,
		l: NodeLayout,
		flags: DisplayFlags,
		nameComp: Json,
		attrComp: Json,
		opComp: Json,
		litComp: Json | undefined,
		hasStereo: boolean,
		subs: Json[]
	) {
		const { x, y, w } = l;
		const rect = (o: Json, top: number, h: number, left = x, width = w) => {
			o.left = left;
			o.top = top;
			o.width = width;
			o.height = h;
		};
		let top = y;
		const nameH = hasStereo ? NAME_H + STEREO_H : NAME_H;
		rect(nameComp, top, nameH);
		const labels = arr(nameComp.subViews).filter(isObj) as Json[];
		const [stereoLabel, nameLabel] = labels;
		if (stereoLabel) rect(stereoLabel, top + PAD, 13, x + PAD, w - 2 * PAD);
		if (nameLabel)
			rect(nameLabel, top + PAD + (hasStereo ? STEREO_H : 0) + 1, 13, x + PAD, w - 2 * PAD);
		top += nameH;
		const compartment = (comp: Json, suppressed: boolean) => {
			const views = arr(comp.subViews).filter(isObj) as Json[];
			if (suppressed) {
				comp.visible = false;
				return;
			}
			delete comp.visible;
			const h = views.length ? 2 * PAD + views.length * ROW : 2 * PAD;
			rect(comp, top, h);
			views.forEach((s, i) => rect(s, top + PAD + i * ROW, 13, x + PAD, w - 2 * PAD));
			top += h;
		};
		if (litComp) compartment(litComp, flags.suppressLiterals);
		compartment(attrComp, flags.suppressAttributes);
		compartment(opComp, flags.suppressOperations);
		// Compartments Aster never fills stay hidden.
		for (const s of subs)
			if (
				s._type === 'UMLReceptionCompartmentView' ||
				s._type === 'UMLTemplateParameterCompartmentView'
			)
				s.visible = false;
		if (flags.autoResize !== false || v.height === undefined || (num(v.height) ?? 0) < top - y)
			v.height = top - y;
	}

	emitPackageView(
		d: Diagram,
		pkg: Extract<Element, { kind: 'package' }>,
		l: NodeLayout,
		rec: Json | undefined,
		vid: Id
	): Json {
		const v = rec
			? clone(rec)
			: {
					_type: 'UMLPackageView',
					_id: vid,
					_parent: ref(d.id),
					model: ref(pkg.id),
					subViews: [],
					font: FONT
				};
		this.nodeFields(d, l, rec, v);
		const subs = arr(v.subViews).filter(isObj) as Json[];
		let nameComp = subs.find((s) => s._type === 'UMLNameCompartmentView');
		if (!nameComp) {
			nameComp = {
				_type: 'UMLNameCompartmentView',
				_id: newId(),
				_parent: ref(vid),
				model: ref(pkg.id),
				subViews: [],
				font: FONT
			};
			subs.push(nameComp);
			v.nameCompartment = ref(nameComp._id as string);
		}
		if (this.changed.has(`${pkg.id}:name`)) {
			const nameLabel = (arr(nameComp.subViews).filter(isObj) as Json[]).find(
				(s) => s._id === refOf(nameComp!.nameLabel)
			);
			if (nameLabel) nameLabel.text = pkg.name;
		}
		v.subViews = subs;
		return v;
	}

	emitObjectView(d: Diagram, inst: Instance, l: NodeLayout, rec: Json | undefined, vid: Id): Json {
		const v: Json = rec
			? clone(rec)
			: {
					_type: 'UMLObjectView',
					_id: vid,
					_parent: ref(d.id),
					model: ref(inst.id),
					subViews: [],
					font: FONT
				};
		const moved = this.nodeFields(d, l, rec, v);
		// An untouched view is written back as it was read (StarUML's own geometry included).
		if (rec && !moved && !this.changed.has(inst.id)) return v;
		const subs = arr(v.subViews).filter(isObj) as Json[];
		const ensure = (type: string, refKey: string): Json => {
			let c = subs.find((x) => x._type === type);
			if (!c) {
				c = {
					_type: type,
					_id: newId(),
					_parent: ref(vid),
					model: ref(inst.id),
					subViews: [],
					font: FONT,
					parentStyle: true
				};
				subs.push(c);
			}
			if (refOf(v[refKey]) !== c._id) v[refKey] = ref(c._id as string);
			return c;
		};
		const nameComp = ensure('UMLNameCompartmentView', 'nameCompartment');
		const slotComp = ensure('UMLSlotCompartmentView', 'slotCompartment');
		const labels = arr(nameComp.subViews).filter(isObj) as Json[];
		const label = (refKey: string, extra: Json): Json => {
			let s = labels.find((x) => x._id === refOf(nameComp[refKey]));
			if (!s) {
				s = {
					_type: 'LabelView',
					_id: newId(),
					_parent: ref(nameComp._id as string),
					font: FONT,
					parentStyle: true,
					height: 13,
					...extra
				};
				labels.push(s);
				nameComp[refKey] = ref(s._id as string);
			}
			return s;
		};
		const stereo = label('stereotypeLabel', { visible: false });
		const name = label('nameLabel', { font: 'Arial;13;1', underline: true });
		label('namespaceLabel', { visible: false });
		label('propertyLabel', { visible: false, horizontalAlignment: 1 });
		nameComp.subViews = labels;
		if (name.text !== instanceLabel(inst)) name.text = instanceLabel(inst);
		if (inst.stereotype) {
			stereo.text = `«${inst.stereotype}»`;
			delete stereo.visible;
		} else if (stereo.text !== undefined) {
			delete stereo.text;
			stereo.visible = false;
		}
		const old = arr(slotComp.subViews).filter(isObj) as Json[];
		const { x, y, w } = { x: l.x, y: l.y, w: l.w };
		const fresh = !rec || moved;
		slotComp.subViews = inst.slots.map((sl, k) => {
			let sv = old.find((o) => refOf(o.model) === sl.id);
			const isNew = !sv;
			if (!sv)
				sv = {
					_type: 'UMLSlotView',
					_id: newId(),
					_parent: ref(slotComp._id as string),
					model: ref(sl.id),
					font: FONT,
					parentStyle: true,
					horizontalAlignment: 0
				};
			const text = `+${sl.name} = ${sl.value}`;
			if (sv.text !== text) sv.text = text;
			if (fresh || isNew)
				Object.assign(sv, { left: x + 5, top: y + 30 + 15 * k, width: w - 10, height: 13 });
			return sv;
		});
		if (fresh) {
			Object.assign(nameComp, { left: x, top: y, width: w, height: 25 });
			Object.assign(name, { left: x + 5, top: y + 7, width: w - 10 });
		}
		if (fresh || old.length !== inst.slots.length)
			Object.assign(slotComp, {
				left: x,
				top: y + 25,
				width: w,
				height: 10 + 15 * inst.slots.length
			});
		v.subViews = subs;
		return v;
	}

	emitLinkView(d: Diagram, link: Link, l: EdgeLayout, rec: Json | undefined, vid: Id): Json {
		const v: Json = rec
			? clone(rec)
			: {
					_type: 'UMLLinkView',
					_id: vid,
					_parent: ref(d.id),
					model: ref(link.id),
					subViews: [],
					font: FONT,
					head: ref(this.viewIdOf(d, link.targetId)),
					tail: ref(this.viewIdOf(d, link.sourceId))
				};
		this.setRef(v, rec, 'head', this.viewIdOf(d, link.targetId));
		this.setRef(v, rec, 'tail', this.viewIdOf(d, link.sourceId));
		const styleIndex = LINE_STYLES.indexOf(l.lineStyle);
		if (styleIndex !== (num(rec?.lineStyle) ?? 1)) {
			if (styleIndex === 1 && rec === undefined) delete v.lineStyle;
			else v.lineStyle = styleIndex;
		}
		this.setStr(v, rec, 'lineColor', l.line);
		this.edgePoints(d, v, rec, link.sourceId, link.targetId, l, false);
		const subs = arr(v.subViews).filter(isObj) as Json[];
		const labelFor = (refKey: string): Json => {
			let s = subs.find((x) => x._id === refOf(v[refKey]));
			if (!s) {
				const dflt = LABEL_DEFAULTS[refKey];
				s = {
					_type: 'EdgeLabelView',
					_id: newId(),
					_parent: ref(vid),
					model: ref(link.id),
					visible: false,
					font: FONT,
					alpha: dflt.alpha,
					distance: dflt.distance,
					hostEdge: ref(vid)
				};
				if (dflt.edgePosition !== undefined) s.edgePosition = dflt.edgePosition;
				subs.push(s);
				v[refKey] = ref(s._id as string);
			}
			return s;
		};
		for (const key of ['nameLabel', 'stereotypeLabel', 'propertyLabel']) labelFor(key);
		const nameLabel = labelFor('nameLabel');
		const offset = l.labelOffsets.name;
		if (offset) {
			if (num(nameLabel.alpha) !== offset.alpha) nameLabel.alpha = offset.alpha;
			if (num(nameLabel.distance) !== offset.distance) nameLabel.distance = offset.distance;
		}
		if (!rec || this.changed.has(`${link.id}:name`)) {
			if (link.name) {
				nameLabel.text = link.name;
				delete nameLabel.visible;
			} else if (nameLabel.text !== undefined) {
				delete nameLabel.text;
				nameLabel.visible = false;
			}
		}
		v.subViews = subs;
		return v;
	}

	emitNoteView(
		d: Diagram,
		el: Extract<Element, { kind: 'note' | 'text' }>,
		l: NodeLayout,
		rec: Json | undefined,
		vid: Id
	): Json {
		const v = rec
			? clone(rec)
			: {
					_type: el.kind === 'note' ? 'UMLNoteView' : 'UMLTextView',
					_id: vid,
					_parent: ref(d.id),
					font: FONT
				};
		this.nodeFields(d, l, rec, v);
		this.setStr(v, rec, 'text', el.text);
		return v;
	}

	/** Points on the node borders, recomputed when an end moved or a waypoint changed. */
	edgePoints(
		d: Diagram,
		v: Json,
		base: Json | undefined,
		sourceId: Id,
		targetId: Id,
		l: EdgeLayout,
		swapped: boolean
	) {
		// Points: endpoints on the node borders, recomputed when an end moved or a waypoint changed.
		const srcRect = this.nodeRect(d, sourceId);
		const tgtRect = this.nodeRect(d, targetId);
		const wasPoints = parsePoints(base?.points);
		let wasWaypoints = wasPoints.slice(1, -1);
		if (swapped) wasWaypoints = wasWaypoints.reverse();
		const sameWaypoints =
			wasWaypoints.length === l.waypoints.length &&
			wasWaypoints.every((p, i) => p.x === l.waypoints[i].x && p.y === l.waypoints[i].y);
		const endMoved = [sourceId, targetId].some((id) => {
			const vr = this.viewRecords.get(`${d.id}/${id}`) ?? this.records.get(id);
			const now = this.nodeRect(d, id);
			return (
				!vr ||
				!now ||
				num(vr.left) !== now.x ||
				num(vr.top) !== now.y ||
				num(vr.width) !== now.w ||
				num(vr.height) !== now.h
			);
		});
		if (!base || !sameWaypoints || endMoved || wasPoints.length < 2) {
			if (srcRect && tgtRect) {
				const c = (rr: Rect) => ({ x: rr.x + rr.w / 2, y: rr.y + rr.h / 2 });
				const first = l.waypoints[0] ?? c(tgtRect);
				const last = l.waypoints.at(-1) ?? c(srcRect);
				let pts = [clipToRect(srcRect, first), ...l.waypoints, clipToRect(tgtRect, last)];
				if (swapped) pts = pts.reverse();
				v.points = fmtPoints(pts);
			}
		}
	}

	emitEdgeView(d: Diagram, r: Relationship, l: EdgeLayout, rec: Json | undefined, vid: Id): Json {
		const type = EDGE_VIEW[r.relationshipKind];
		const swapped = this.swapped(r);
		const [tailEl, headEl] = swapped ? [r.targetId, r.sourceId] : [r.sourceId, r.targetId];
		const fresh = !rec || (rec._type === 'UMLAssociationView') !== (type === 'UMLAssociationView');
		const v: Json = fresh
			? {
					_type: type,
					_id: vid,
					_parent: ref(d.id),
					model: ref(r.id),
					subViews: [],
					font: FONT,
					head: ref(this.viewIdOf(d, headEl)),
					tail: ref(this.viewIdOf(d, tailEl)),
					showVisibility: true
				}
			: clone(rec!);
		const base = fresh ? undefined : rec;
		if (v._type !== type) v._type = type;
		if (
			r.relationshipKind === 'realization' &&
			base &&
			base._type !== type &&
			(base._type === 'UMLRealizationView' || base._type === 'UMLInterfaceRealizationView')
		)
			v._type = base._type;
		this.setRef(v, base, 'head', this.viewIdOf(d, headEl));
		this.setRef(v, base, 'tail', this.viewIdOf(d, tailEl));
		const styleIndex = LINE_STYLES.indexOf(l.lineStyle);
		const wasStyle = num(base?.lineStyle) ?? 1;
		if (styleIndex !== wasStyle) {
			if (styleIndex === 1 && base === undefined) delete v.lineStyle;
			else v.lineStyle = styleIndex;
		}
		this.setStr(v, base, 'lineColor', l.line);

		this.edgePoints(d, v, base, r.sourceId, r.targetId, l, swapped);

		// Labels: reuse the EdgeLabelView each reference key points at; create the full set for a new view.
		const subs = arr(v.subViews).filter(isObj) as Json[];
		const keys =
			type === 'UMLAssociationView'
				? Object.keys(LABEL_DEFAULTS)
				: ['nameLabel', 'stereotypeLabel', 'propertyLabel'];
		const labelFor = (refKey: string): Json => {
			let s = subs.find((x) => x._id === refOf(v[refKey]));
			if (!s) {
				const dflt = LABEL_DEFAULTS[refKey];
				s = {
					_type: 'EdgeLabelView',
					_id: newId(),
					_parent: ref(vid),
					model: ref(r.id),
					visible: false,
					font: FONT,
					alpha: dflt.alpha,
					distance: dflt.distance,
					hostEdge: ref(vid)
				};
				if (dflt.edgePosition !== undefined) s.edgePosition = dflt.edgePosition;
				subs.push(s);
				v[refKey] = ref(s._id as string);
			}
			return s;
		};
		for (const key of keys) labelFor(key);
		if (type === 'UMLAssociationView')
			for (const key of ['tailQualifiersCompartment', 'headQualifiersCompartment']) {
				if (subs.some((x) => x._id === refOf(v[key]))) continue;
				const s: Json = {
					_type: 'UMLQualifierCompartmentView',
					_id: newId(),
					_parent: ref(vid),
					model: ref(r.id),
					visible: false,
					font: FONT
				};
				subs.push(s);
				v[key] = ref(s._id as string);
			}
		const textOf = (key: LabelKey): string | undefined => {
			const end = (which: 'source' | 'target') => (which === 'source' ? r.sourceEnd : r.targetEnd);
			switch (key) {
				case 'name':
					return r.name;
				case 'sourceRole':
					return end('source')?.role;
				case 'targetRole':
					return end('target')?.role;
				case 'sourceMultiplicity':
					return end('source')?.multiplicity;
				case 'targetMultiplicity':
					return end('target')?.multiplicity;
				default:
					return undefined;
			}
		};
		for (const [refKey, fileKey] of LABEL_REFS) {
			if (!keys.includes(refKey)) continue;
			const s = labelFor(refKey);
			// The file's tail is end1; Aster's source is end1 unless the association was swapped.
			const modelKey: LabelKey =
				swapped && fileKey !== 'name' ? (SWAP_LABEL[fileKey] ?? fileKey) : fileKey;
			const o = l.labelOffsets[modelKey];
			if (o) {
				const alpha = swapped && fileKey === 'name' ? normaliseAngle(o.alpha - Math.PI) : o.alpha;
				if (num(s.alpha) !== alpha) s.alpha = alpha;
				if (num(s.distance) !== o.distance) s.distance = o.distance;
			}
			const t = textOf(modelKey);
			if (this.changed.has(r.id) || !base) {
				if (t !== undefined) {
					s.text = t;
					delete s.visible;
				} else if (s.text !== undefined) {
					delete s.text;
					s.visible = false;
				}
			}
		}
		if (this.changed.has(`${r.id}:stereotype`) || !base) {
			const s = labelFor('stereotypeLabel');
			if (r.stereotype) {
				s.text = `«${r.stereotype}»`;
				delete s.visible;
			} else if (s.text !== undefined) {
				delete s.text;
				s.visible = false;
			}
		}
		v.subViews = subs;
		return v;
	}

	// ---- records for the next save -----------------------------------------

	/** Keep every emitted object as a record so the next save reuses its id and compares to it. */
	remember(root: Json) {
		const byId = new Map<Id, Unknown>();
		for (const u of this.project.unknown)
			if (u.path === SOURCE_PATH && u.parentId) byId.set(u.parentId, u);
		const walk = (o: Json, index: number) => {
			if (this.unknownJson.has(o)) return;
			const id = str(o._id);
			if (!id) return;
			const own: Json = {};
			for (const [k, val] of Object.entries(o)) {
				if (WALKED.includes(k)) {
					if (Array.isArray(val) && val.length === 0) own[k] = val;
					continue;
				}
				if (!(o._type as string)?.endsWith('View') && this.kids.get(id)?.has(k)) continue;
				own[k] = val;
			}
			const existing = byId.get(id);
			if (existing) {
				existing.json = own;
				existing.index = index;
			} else {
				const u: Unknown = { json: own, parentId: id, path: SOURCE_PATH, index };
				this.project.unknown.push(u);
				byId.set(id, u);
			}
			for (const k of WALKED) arr(o[k]).forEach((child, i) => isObj(child) && walk(child, i));
		};
		walk(root, 0);
	}
}

/** The project as a `.mdj` document (an object; stringify to write). Records are refreshed for the next save. */
export function serializeMdj(project: Project): Json {
	return new Serializer(project).serialize();
}

/** `.mdj` text as StarUML writes it: tab-indented JSON. */
export function serializeMdjText(project: Project): string {
	return JSON.stringify(serializeMdj(project), null, '\t');
}
