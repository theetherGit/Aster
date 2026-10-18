/**
 * StarUML `.mdj` → Aster model, per the mapping table in docs/spec/data-model.md.
 *
 * One walk over the document maps what the table covers and indexes every `_id`; `$ref`s
 * resolve lazily once the walk is done. Anything unmapped is kept verbatim as an Unknown at
 * its parent and array position. Every mapped object also keeps its own source fields under
 * path `#source`, so export can write back the fields Aster does not model.
 */
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
	type LabelKey,
	type LabelOffset,
	type Literal,
	type LineStyle,
	type NodeLayout,
	type Note,
	type Operation,
	type Package,
	type Parameter,
	type Point,
	type Project,
	type Relationship,
	type RelationshipKind,
	type TextElement,
	type Unknown,
	type Visibility
} from '#lib/model/types.ts';

type Json = Record<string, unknown>;

export const SOURCE_PATH = '#source';

export type ParseWarning =
	| { code: 'viewWithoutModel'; diagram: string; type: string }
	| { code: 'duplicateView'; diagram: string; element: string }
	| { code: 'relationshipEndpoint'; type: string; name: string }
	| { code: 'edgeEndNotShown'; diagram: string; relationship: string }
	| { code: 'headTailMismatch'; diagram: string; relationship: string }
	| { code: 'unresolvedRef'; field: string; owner: string }
	| { code: 'containerMismatch'; diagram: string; element: string; package: string }
	| { code: 'noteLinkUnresolved'; diagram: string };

export interface DiagramReport {
	id: Id;
	name: string;
	nodes: number;
	edges: number;
	notes: number;
	texts: number;
	/** Views kept in the file but not drawn (constraints, actors, frames, …). */
	hiddenViews: number;
}

export interface ParseReport {
	diagrams: DiagramReport[];
	model: {
		classifiers: number;
		relationships: number;
		packages: number;
		attributes: number;
		operations: number;
		literals: number;
		notes: number;
		texts: number;
	};
	/** Diagrams of kinds Aster does not show yet, kept for saving back (board 08). */
	hiddenDiagrams: { type: string; name: string }[];
	/** Unknown objects (not counting the `#source` field records). */
	unknownElements: number;
	unknownTypes: Record<string, number>;
	warnings: ParseWarning[];
}

export interface ParseResult {
	project: Project;
	unknown: Unknown[];
	report: ParseReport;
	/** The diagram to show first: never an empty one when something can be drawn. */
	openDiagramId: Id | null;
}

export class MdjError extends Error {}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

const CLASSIFIERS: Record<string, ClassifierKind> = {
	UMLClass: 'class',
	UMLInterface: 'interface',
	UMLEnumeration: 'enum',
	UMLDataType: 'dataType',
	UMLPrimitiveType: 'primitiveType'
};
const RELATIONSHIPS: Record<string, RelationshipKind> = {
	UMLAssociation: 'association',
	UMLGeneralization: 'generalization',
	UMLInterfaceRealization: 'realization',
	UMLRealization: 'realization',
	UMLDependency: 'dependency'
};
// A subsystem owns model elements like a package does; later models are packages too.
const PACKAGES = new Set(['UMLPackage', 'UMLModel', 'UMLSubsystem']);
const NODE_VIEWS: Record<string, 'classifier' | 'package'> = {
	UMLClassView: 'classifier',
	UMLInterfaceView: 'classifier',
	UMLEnumerationView: 'classifier',
	UMLDataTypeView: 'classifier',
	UMLPrimitiveTypeView: 'classifier',
	UMLPackageView: 'package',
	UMLModelView: 'package',
	UMLSubsystemView: 'package'
};
const EDGE_VIEWS = new Set([
	'UMLAssociationView',
	'UMLGeneralizationView',
	'UMLInterfaceRealizationView',
	'UMLRealizationView',
	'UMLDependencyView'
]);
const LINE_STYLES: LineStyle[] = ['rectilinear', 'oblique', 'roundrect', 'curve'];
const VISIBILITIES = new Set<Visibility>(['public', 'protected', 'private', 'package']);

/** What StarUML assumes when a view leaves a flag out (it omits defaults since v4). */
export const STARUML_VIEW_DEFAULTS: DisplayFlags = {
	...DEFAULT_DISPLAY_FLAGS,
	showProperty: true,
	autoResize: false
};
const FLAG_KEYS = Object.keys(DEFAULT_DISPLAY_FLAGS) as (keyof DisplayFlags)[];

/** Edge label views by the reference key StarUML uses on the edge view, tail being end1/source. */
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

// ---------------------------------------------------------------------------
// Small readers
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const refOf = (v: unknown): string | undefined =>
	isObj(v) && typeof v.$ref === 'string' ? v.$ref : undefined;
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);
/** Empty strings mean "not set" in StarUML files. */
const text = (v: unknown): string | undefined =>
	typeof v === 'string' && v !== '' ? v : undefined;
const num = (v: unknown): number | undefined =>
	typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const bool = (v: unknown, fallback = false): boolean => (typeof v === 'boolean' ? v : fallback);
const vis = (v: unknown): Visibility | undefined =>
	typeof v === 'string' && VISIBILITIES.has(v as Visibility) ? (v as Visibility) : undefined;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** Drop undefined fields so absent optionals are absent, not `undefined`. */
function compact<T extends object>(o: T): T {
	for (const k of Object.keys(o) as (keyof T)[]) if (o[k] === undefined) delete o[k];
	return o;
}
/** A readable name for warnings: the element's name, else its id. */
const labelOf = (e: Element): string => ('name' in e && e.name) || e.id;
function normaliseAngle(a: number): number {
	while (a > Math.PI) a -= 2 * Math.PI;
	while (a <= -Math.PI) a += 2 * Math.PI;
	return a;
}

/** `"x:y;x:y;…"` → points. */
export function parsePoints(v: unknown): Point[] {
	if (typeof v !== 'string' || !v.trim()) return [];
	const out: Point[] = [];
	for (const pair of v.split(';')) {
		const [x, y] = pair.split(':').map(Number);
		if (Number.isFinite(x) && Number.isFinite(y)) out.push({ x, y });
	}
	return out;
}

/** StarUML ≤ 5 writes `navigable` as a boolean; 6+ writes the three-valued string. */
function navigability(v: unknown): End['navigable'] {
	if (v === true || v === 'navigable') return 'navigable';
	if (v === false || v === 'notNavigable') return 'notNavigable';
	return 'unspecified';
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

interface PendingRelationship {
	json: Json;
	parentId: Id;
	index: number;
}

class Parser {
	readonly index = new Map<string, Json>();
	readonly unknown: Unknown[] = [];
	readonly warnings: ParseWarning[] = [];
	readonly hiddenDiagrams: { type: string; name: string }[] = [];
	readonly elements = new Map<Id, Element>();
	readonly diagrams: Diagram[] = [];
	readonly diagramJson = new Map<Id, Json>();
	readonly relationships: PendingRelationship[] = [];
	/** Deferred `$ref` lookups (types, stereotypes) that need the whole index. */
	readonly late: (() => void)[] = [];
	/** Associations stored with their ends swapped so the diamond side is the target. */
	readonly swapped = new Set<Id>();
	readonly reports: DiagramReport[] = [];
	project!: Project;
	foldedModelId: Id | null = null;

	keepUnknown(json: unknown, parentId: Id | null, path: string, index: number) {
		this.unknown.push({ json, parentId, path, index });
		this.indexTree(json, true);
	}

	/** Index a subtree; inside unknown subtrees, note diagrams that will not be shown. */
	indexTree(o: unknown, insideUnknown: boolean) {
		if (Array.isArray(o)) {
			for (const v of o) this.indexTree(v, insideUnknown);
			return;
		}
		if (!isObj(o)) return;
		if (typeof o._id === 'string') this.index.set(o._id, o);
		const type = str(o._type);
		if (insideUnknown && type?.endsWith('Diagram'))
			this.hiddenDiagrams.push({ type, name: str(o.name) ?? '' });
		for (const [k, v] of Object.entries(o)) if (k !== '_parent') this.indexTree(v, insideUnknown);
	}

	/**
	 * Keep a mapped object's own fields for export, without the arrays the walk maps (`walked`).
	 * On model elements, any other array of typed objects (receptions, template parameters,
	 * owned rules …) is kept item by item as Unknowns at that path. View subviews are
	 * compartments and labels that export regenerates, so they stay in the record.
	 */
	keepSource(o: Json, walked: string[] = [], isView = false) {
		const own: Json = {};
		const id = o._id as Id;
		for (const [k, v] of Object.entries(o)) {
			if (walked.includes(k)) continue;
			if (!isView && Array.isArray(v) && v.some((x) => isObj(x) && typeof x._type === 'string')) {
				v.forEach((item, i) => this.keepUnknown(item, id, k, i));
				continue;
			}
			own[k] = v;
		}
		this.unknown.push({ json: own, parentId: id, path: SOURCE_PATH, index: -1 });
		if (typeof o._id === 'string') this.index.set(o._id, o);
		// Index nested objects that stay inside the record (association ends, subviews, label views).
		for (const [k, v] of Object.entries(own)) if (k !== '_parent') this.indexTree(v, false);
	}

	resolve(v: unknown): Json | undefined {
		const id = refOf(v);
		return id === undefined ? undefined : this.index.get(id);
	}

	/** A type or stereotype field: a string, or a `$ref` to something with a name. */
	nameOf(v: unknown, field: string, owner: string): string | undefined {
		if (typeof v === 'string') return v || undefined;
		const id = refOf(v);
		if (id === undefined) return undefined;
		const target = this.index.get(id);
		if (target === undefined || typeof target.name !== 'string') {
			this.warnings.push({ code: 'unresolvedRef', field, owner });
			return undefined;
		}
		return target.name || undefined;
	}

	// ---- model -------------------------------------------------------------

	parse(root: unknown): ParseResult {
		if (!isObj(root) || root._type !== 'Project' || typeof root._id !== 'string') {
			throw new MdjError('not a StarUML project');
		}
		this.keepSource(root, ['ownedElements']);
		this.project = {
			id: root._id,
			name: str(root.name) ?? '',
			diagrams: this.diagrams,
			elements: this.elements,
			unknown: this.unknown,
			importedIds: new Set()
		};
		arr(root.ownedElements).forEach((child, i) => {
			if (isObj(child) && child._type === 'UMLModel' && this.foldedModelId === null) {
				// The first model is folded into the project (mapping table, UMLModel row).
				this.foldedModelId = child._id as Id;
				this.keepSource(child, ['ownedElements']);
				this.walkOwned(child, undefined);
			} else if (isObj(child) && child._type === 'UMLModel') {
				// Later models carry real content in the wild; they become packages so it shows.
				this.mapPackage(child, undefined);
			} else {
				this.keepUnknown(child, root._id as Id, 'ownedElements', i);
			}
		});
		for (const r of this.relationships) this.mapRelationship(r);
		for (const f of this.late) f();
		for (const d of this.diagrams) this.mapViews(d, this.diagramJson.get(d.id)!);
		for (const id of this.elements.keys()) this.project.importedIds.add(id);
		for (const d of this.diagrams) this.project.importedIds.add(d.id);
		const report = this.report();
		return {
			project: this.project,
			unknown: this.unknown,
			report,
			openDiagramId: this.openDiagram(report)
		};
	}

	walkOwned(container: Json, packageId: Id | undefined) {
		const parentId = container._id as Id;
		arr(container.ownedElements).forEach((child, i) => {
			const type = isObj(child) ? str(child._type) : undefined;
			if (!isObj(child) || type === undefined)
				return this.keepUnknown(child, parentId, 'ownedElements', i);
			if (type === 'UMLClassDiagram') return this.mapDiagram(child);
			if (PACKAGES.has(type)) return this.mapPackage(child, packageId);
			if (type in CLASSIFIERS) return this.mapClassifier(child, packageId);
			if (type in RELATIONSHIPS)
				return this.relationships.push({ json: child, parentId, index: i });
			this.keepUnknown(child, parentId, 'ownedElements', i);
		});
	}

	mapPackage(o: Json, parentId: Id | undefined) {
		this.keepSource(o, ['ownedElements']);
		const p: Package = compact({
			kind: 'package',
			id: o._id as Id,
			name: str(o.name) ?? '',
			memberIds: [],
			parentId,
			documentation: str(o.documentation) ?? ''
		});
		this.elements.set(p.id, p);
		if (parentId) (this.elements.get(parentId) as Package).memberIds.push(p.id);
		this.walkOwned(o, p.id);
	}

	mapClassifier(o: Json, packageId: Id | undefined) {
		this.keepSource(o, ['ownedElements', 'attributes', 'operations', 'literals']);
		const id = o._id as Id;
		const type = o._type as string;
		const c: Classifier = compact({
			kind: 'classifier',
			id,
			classifierKind: CLASSIFIERS[type],
			name: str(o.name) ?? '',
			isAbstract: bool(o.isAbstract),
			isLeaf: bool(o.isLeaf),
			visibility: vis(o.visibility) ?? 'public',
			documentation: str(o.documentation) ?? '',
			attributes: [],
			operations: [],
			literals: [],
			packageId
		});
		this.elements.set(id, c);
		if (packageId) (this.elements.get(packageId) as Package).memberIds.push(id);
		this.late.push(() => {
			const s = this.nameOf(o.stereotype, 'stereotype', c.name);
			if (s) c.stereotype = s;
		});
		arr(o.attributes).forEach((a, i) =>
			isObj(a) && a._type === 'UMLAttribute'
				? c.attributes.push(this.mapAttribute(a))
				: this.keepUnknown(a, id, 'attributes', i)
		);
		arr(o.operations).forEach((op, i) =>
			isObj(op) && op._type === 'UMLOperation'
				? c.operations.push(this.mapOperation(op))
				: this.keepUnknown(op, id, 'operations', i)
		);
		arr(o.literals).forEach((l, i) =>
			isObj(l) && l._type === 'UMLEnumerationLiteral'
				? c.literals.push(this.mapLiteral(l))
				: this.keepUnknown(l, id, 'literals', i)
		);
		// A class's own ownedElements hold its relationships, and occasionally nested classifiers.
		this.walkOwned(o, packageId);
	}

	/** Members keep anything they own (constraints, tags) as Unknowns. */
	ownedUnknowns(o: Json) {
		arr(o.ownedElements).forEach((child, i) =>
			this.keepUnknown(child, o._id as Id, 'ownedElements', i)
		);
	}

	mapAttribute(o: Json): Attribute {
		this.keepSource(o, ['ownedElements']);
		this.ownedUnknowns(o);
		const a: Attribute = compact({
			id: o._id as Id,
			name: str(o.name) ?? '',
			visibility: vis(o.visibility) ?? 'public',
			multiplicity: text(o.multiplicity),
			defaultValue: text(o.defaultValue),
			isStatic: bool(o.isStatic),
			isReadOnly: bool(o.isReadOnly),
			isDerived: bool(o.isDerived),
			isOrdered: bool(o.isOrdered),
			isUnique: bool(o.isUnique),
			isID: bool(o.isID),
			documentation: str(o.documentation) ?? ''
		});
		this.late.push(() => {
			const type = this.nameOf(o.type, 'type', a.name);
			if (type) a.type = type;
			const s = this.nameOf(o.stereotype, 'stereotype', a.name);
			if (s) a.stereotype = s;
		});
		return a;
	}

	mapOperation(o: Json): Operation {
		this.keepSource(o, ['ownedElements', 'parameters']);
		this.ownedUnknowns(o);
		const op: Operation = compact({
			id: o._id as Id,
			name: str(o.name) ?? '',
			visibility: vis(o.visibility) ?? 'public',
			parameters: [],
			isStatic: bool(o.isStatic),
			isAbstract: bool(o.isAbstract),
			isQuery: bool(o.isQuery),
			documentation: str(o.documentation) ?? ''
		});
		arr(o.parameters).forEach((p, i) => {
			if (!isObj(p) || p._type !== 'UMLParameter')
				return this.keepUnknown(p, op.id, 'parameters', i);
			this.keepSource(p);
			if (p.direction === 'return') {
				// The return type is stored on the operation, not as a parameter (data-model.md).
				this.late.push(() => {
					const type = this.nameOf(p.type, 'type', op.name);
					if (type && op.returnType === undefined) op.returnType = type;
				});
				return;
			}
			const param: Parameter = compact({
				name: str(p.name) ?? '',
				direction: p.direction === 'out' || p.direction === 'inout' ? p.direction : 'in',
				defaultValue: text(p.defaultValue)
			});
			op.parameters.push(param);
			this.late.push(() => {
				const type = this.nameOf(p.type, 'type', op.name);
				if (type) param.type = type;
			});
		});
		this.late.push(() => {
			const s = this.nameOf(o.stereotype, 'stereotype', op.name);
			if (s) op.stereotype = s;
		});
		return op;
	}

	mapLiteral(o: Json): Literal {
		this.keepSource(o, ['ownedElements']);
		this.ownedUnknowns(o);
		const l: Literal = {
			id: o._id as Id,
			name: str(o.name) ?? '',
			documentation: str(o.documentation) ?? ''
		};
		this.late.push(() => {
			const s = this.nameOf(o.stereotype, 'stereotype', l.name);
			if (s) l.stereotype = s;
		});
		return l;
	}

	isEndpoint(id: string | undefined) {
		const el = id === undefined ? undefined : this.elements.get(id);
		return el?.kind === 'classifier' || el?.kind === 'package';
	}

	mapRelationship({ json: o, parentId, index }: PendingRelationship) {
		const type = o._type as string;
		const id = o._id as Id;
		let sourceId: string | undefined;
		let targetId: string | undefined;
		let kind = RELATIONSHIPS[type];
		let sourceEnd: End | undefined;
		let targetEnd: End | undefined;
		if (type === 'UMLAssociation') {
			const e1 = isObj(o.end1) ? o.end1 : {};
			const e2 = isObj(o.end2) ? o.end2 : {};
			const end = (e: Json): End =>
				compact({
					role: text(e.name),
					multiplicity: text(e.multiplicity),
					navigable: navigability(e.navigable),
					visibility: vis(e.visibility) ?? 'public',
					isDerived: bool(e.isDerived),
					isOrdered: bool(e.isOrdered),
					isUnique: bool(e.isUnique),
					ownsOther: false
				});
			let [a, b] = [e1, e2];
			let [ea, eb] = [end(e1), end(e2)];
			// ownerAttribute on an end: the class at the other end owns the attribute for it.
			if (refOf(e1.ownerAttribute)) eb.ownsOther = true;
			if (refOf(e2.ownerAttribute)) ea.ownsOther = true;
			const agg = (e: Json) =>
				e.aggregation === 'shared'
					? 'aggregation'
					: e.aggregation === 'composite'
						? 'composition'
						: null;
			// The diamond goes on the end whose aggregation is set; Aster keeps the whole as target.
			if (agg(e1) && !agg(e2)) {
				[a, b] = [e2, e1];
				[ea, eb] = [eb, ea];
				this.swapped.add(id);
			}
			kind = agg(b) ?? agg(a) ?? 'association';
			sourceId = refOf(a.reference);
			targetId = refOf(b.reference);
			sourceEnd = ea;
			targetEnd = eb;
		} else {
			sourceId = refOf(o.source);
			targetId = refOf(o.target);
		}
		if (!this.isEndpoint(sourceId) || !this.isEndpoint(targetId)) {
			// An end is something Aster does not model (an actor, a use case …): keep the whole thing.
			this.warnings.push({ code: 'relationshipEndpoint', type, name: str(o.name) ?? id });
			return this.keepUnknown(o, parentId, 'ownedElements', index);
		}
		this.keepSource(o, ['ownedElements']);
		this.ownedUnknowns(o);
		const r: Relationship = compact({
			kind: 'relationship',
			id,
			relationshipKind: kind,
			sourceId: sourceId!,
			targetId: targetId!,
			name: text(o.name),
			documentation: str(o.documentation) ?? '',
			sourceEnd,
			targetEnd
		});
		const s = this.nameOf(o.stereotype, 'stereotype', r.name ?? id);
		if (s) r.stereotype = s;
		this.elements.set(id, r);
	}

	// ---- diagrams and views ------------------------------------------------

	mapDiagram(o: Json) {
		this.keepSource(o, ['ownedViews']);
		const d: Diagram = {
			id: o._id as Id,
			name: str(o.name) ?? '',
			diagramKind: 'class',
			elementIds: [],
			layout: new Map(),
			defaults: { ...STARUML_VIEW_DEFAULTS }
		};
		this.diagrams.push(d);
		this.diagramJson.set(d.id, o);
		// Views are mapped after the walk, once every model element is known.
		for (const v of arr(o.ownedViews)) this.indexTree(v, false);
	}

	nodeLayout(v: Json): NodeLayout {
		const flags: Partial<DisplayFlags> = {};
		for (const k of FLAG_KEYS) {
			const value = v[k];
			if (value === undefined || value === STARUML_VIEW_DEFAULTS[k]) continue;
			if (typeof value === typeof STARUML_VIEW_DEFAULTS[k])
				(flags as Record<string, unknown>)[k] = value;
		}
		return compact({
			kind: 'node' as const,
			x: num(v.left) ?? 0,
			y: num(v.top) ?? 0,
			w: num(v.width) ?? 0,
			h: num(v.height) ?? 0,
			fill: str(v.fillColor),
			line: str(v.lineColor),
			flags: Object.keys(flags).length ? flags : undefined
		});
	}

	mapViews(d: Diagram, o: Json) {
		const report: DiagramReport = {
			id: d.id,
			name: d.name,
			nodes: 0,
			edges: 0,
			notes: 0,
			texts: 0,
			hiddenViews: 0
		};
		this.reports.push(report);
		const viewToElement = new Map<string, Id>();
		const edges: [Json, number][] = [];
		const links: [Json, number][] = [];
		const containers: [Json, Id][] = [];
		const hide = (v: unknown, i: number) => {
			report.hiddenViews++;
			this.keepUnknown(v, d.id, 'ownedViews', i);
		};
		const place = (id: Id, layout: NodeLayout | EdgeLayout) => {
			d.elementIds.push(id);
			d.layout.set(id, layout);
		};

		arr(o.ownedViews).forEach((v, i) => {
			const type = isObj(v) ? str(v._type) : undefined;
			if (!isObj(v) || !type) return hide(v, i);
			if (type in NODE_VIEWS) {
				const el = this.elements.get(refOf(v.model) ?? '');
				const want = NODE_VIEWS[type];
				if (!el || el.kind !== want) {
					this.warnings.push({ code: 'viewWithoutModel', diagram: d.name, type });
					return hide(v, i);
				}
				if (d.layout.has(el.id)) {
					this.warnings.push({
						code: 'duplicateView',
						diagram: d.name,
						element: labelOf(el)
					});
					return hide(v, i);
				}
				this.keepSource(v, [], true);
				viewToElement.set(v._id as string, el.id);
				place(el.id, this.nodeLayout(v));
				if (el.kind === 'classifier') report.nodes++;
				if (refOf(v.containerView)) containers.push([v, el.id]);
				return;
			}
			if (type === 'UMLNoteView' || type === 'UMLTextView') {
				this.keepSource(v, [], true);
				const id = v._id as Id;
				const el: Note | TextElement =
					type === 'UMLNoteView'
						? { kind: 'note', id, text: str(v.text) ?? '', linkedIds: [] }
						: { kind: 'text', id, text: str(v.text) ?? '' };
				this.elements.set(id, el);
				viewToElement.set(id, id);
				place(id, this.nodeLayout(v));
				if (el.kind === 'note') report.notes++;
				else report.texts++;
				return;
			}
			if (EDGE_VIEWS.has(type)) return edges.push([v, i]);
			if (type === 'UMLNoteLinkView') return links.push([v, i]);
			hide(v, i);
		});

		for (const [v, i] of edges) {
			const rel = this.elements.get(refOf(v.model) ?? '');
			if (!rel || rel.kind !== 'relationship') {
				this.warnings.push({ code: 'viewWithoutModel', diagram: d.name, type: v._type as string });
				hide(v, i);
				continue;
			}
			if (d.layout.has(rel.id)) {
				this.warnings.push({ code: 'duplicateView', diagram: d.name, element: rel.name ?? rel.id });
				hide(v, i);
				continue;
			}
			this.keepSource(v, [], true);
			const swapped = this.swapped.has(rel.id);
			const [tail, head] = [
				viewToElement.get(refOf(v.tail) ?? ''),
				viewToElement.get(refOf(v.head) ?? '')
			];
			const [expectTail, expectHead] = swapped
				? [rel.targetId, rel.sourceId]
				: [rel.sourceId, rel.targetId];
			if (tail === undefined || head === undefined) {
				this.warnings.push({
					code: 'edgeEndNotShown',
					diagram: d.name,
					relationship: rel.name ?? rel.id
				});
			} else if (tail !== expectTail || head !== expectHead) {
				this.warnings.push({
					code: 'headTailMismatch',
					diagram: d.name,
					relationship: rel.name ?? rel.id
				});
			}
			place(rel.id, this.edgeLayout(v, swapped));
			report.edges++;
		}

		for (const [v, i] of links) {
			const [a, b] = [refOf(v.tail) ?? '', refOf(v.head) ?? ''];
			const [ea, eb] = [viewToElement.get(a), viewToElement.get(b)];
			const note = [ea, eb]
				.map((id) => (id ? this.elements.get(id) : undefined))
				.find((e) => e?.kind === 'note') as Note | undefined;
			const other = note && (ea === note.id ? eb : ea);
			if (!note || !other) {
				this.warnings.push({ code: 'noteLinkUnresolved', diagram: d.name });
				hide(v, i);
				continue;
			}
			// Note links are view-only: the note lists what it is linked to; the view's own fields stay in #source.
			this.keepSource(v, [], true);
			if (!note.linkedIds.includes(other)) note.linkedIds.push(other);
		}

		// containerView: a view drawn inside a package view makes the element a member of that package.
		for (const [v, elementId] of containers) {
			const pkgId = viewToElement.get(refOf(v.containerView) ?? '');
			const pkg = pkgId ? this.elements.get(pkgId) : undefined;
			const el = this.elements.get(elementId);
			if (pkg?.kind !== 'package' || !el) continue;
			if (!pkg.memberIds.includes(elementId)) pkg.memberIds.push(elementId);
			const owner =
				el.kind === 'classifier' ? el.packageId : el.kind === 'package' ? el.parentId : undefined;
			if (owner !== pkg.id) {
				this.warnings.push({
					code: 'containerMismatch',
					diagram: d.name,
					element: labelOf(el),
					package: pkg.name
				});
			}
		}
	}

	edgeLayout(v: Json, swapped: boolean): EdgeLayout {
		const points = parsePoints(v.points);
		let waypoints = points.slice(1, -1);
		if (swapped) waypoints = waypoints.reverse();
		const labelOffsets: Partial<Record<LabelKey, LabelOffset>> = {};
		for (const [refKey, key] of LABEL_REFS) {
			const label = this.resolve(v[refKey]);
			const alpha = num(label?.alpha);
			const distance = num(label?.distance);
			if (alpha === undefined || distance === undefined) continue;
			if (!swapped) labelOffsets[key] = { alpha, distance };
			// Reversed direction: end labels swap ends; the middle label's direction turns half round.
			else if (key === 'name')
				labelOffsets.name = { alpha: normaliseAngle(alpha + Math.PI), distance };
			else labelOffsets[SWAP_LABEL[key]!] = { alpha, distance };
		}
		const style = num(v.lineStyle);
		return compact({
			kind: 'edge' as const,
			waypoints,
			// StarUML's default edge style is oblique when the key is left out.
			lineStyle: style !== undefined && LINE_STYLES[style] ? LINE_STYLES[style] : 'oblique',
			line: str(v.lineColor),
			labelOffsets
		});
	}

	/**
	 * StarUML's default diagram when it is a class diagram with something Aster draws; else the
	 * first diagram that has classifiers; else the default; else the first. Opening onto an empty
	 * canvas looks like a failed import.
	 */
	openDiagram(report: ParseReport): Id | null {
		const drawn = new Set(report.diagrams.filter((d) => d.nodes > 0).map((d) => d.id));
		const defaults = this.diagrams
			.filter((d) => this.diagramJson.get(d.id)?.defaultDiagram === true)
			.map((d) => d.id);
		return (
			defaults.find((id) => drawn.has(id)) ??
			this.diagrams.find((d) => drawn.has(d.id))?.id ??
			defaults[0] ??
			this.diagrams[0]?.id ??
			null
		);
	}

	report(): ParseReport {
		const els = [...this.elements.values()];
		const classifiers = els.filter((e): e is Classifier => e.kind === 'classifier');
		const unknownTypes: Record<string, number> = {};
		let unknownElements = 0;
		for (const u of this.unknown) {
			if (u.path === SOURCE_PATH) continue;
			unknownElements++;
			const t = isObj(u.json) ? (str(u.json._type) ?? '(untyped)') : '(value)';
			unknownTypes[t] = (unknownTypes[t] ?? 0) + 1;
		}
		return {
			diagrams: this.reports,
			model: {
				classifiers: classifiers.length,
				relationships: els.filter((e) => e.kind === 'relationship').length,
				packages: els.filter((e) => e.kind === 'package').length,
				attributes: classifiers.reduce((n, c) => n + c.attributes.length, 0),
				operations: classifiers.reduce((n, c) => n + c.operations.length, 0),
				literals: classifiers.reduce((n, c) => n + c.literals.length, 0),
				notes: els.filter((e) => e.kind === 'note').length,
				texts: els.filter((e) => e.kind === 'text').length
			},
			hiddenDiagrams: this.hiddenDiagrams,
			unknownElements,
			unknownTypes,
			warnings: this.warnings
		};
	}
}

/** Map a parsed `.mdj` document. Throws `MdjError` when it is not a StarUML project. */
export function parseMdj(json: unknown): ParseResult {
	return new Parser().parse(json);
}

/** Text of a `.mdj` file (BOM tolerated) → result. */
export function parseMdjText(source: string): ParseResult {
	let json: unknown;
	try {
		json = JSON.parse(source.charCodeAt(0) === 0xfeff ? source.slice(1) : source);
	} catch {
		throw new MdjError('not valid JSON');
	}
	return parseMdj(json);
}
