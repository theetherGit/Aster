import { t } from '#lib/i18n/index.ts';
import { newId } from './ids.ts';
import {
	DEFAULT_DISPLAY_FLAGS,
	type Attribute,
	type Classifier,
	type ClassifierKind,
	type Diagram,
	type EdgeLayout,
	type End,
	type Element,
	type Id,
	type NodeLayout,
	type Operation,
	type Project,
	type Relationship,
	type RelationshipKind
} from './types.ts';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createProject(init: { id?: Id; name?: string } = {}): Project {
	return {
		id: init.id ?? newId(),
		name: init.name ?? t('app.name'),
		diagrams: [],
		elements: new Map(),
		unknown: [],
		importedIds: new Set()
	};
}

export function createDiagram(init: Partial<Omit<Diagram, 'layout'>> = {}): Diagram {
	return {
		id: init.id ?? newId(),
		name: init.name ?? t('model.defaultDiagramName'),
		diagramKind: init.diagramKind ?? 'class',
		elementIds: init.elementIds ?? [],
		layout: new Map(),
		defaults: init.defaults ?? { ...DEFAULT_DISPLAY_FLAGS }
	};
}

export function createClassifier(init: Partial<Omit<Classifier, 'kind'>> = {}): Classifier {
	return {
		kind: 'classifier',
		id: init.id ?? newId(),
		classifierKind: init.classifierKind ?? 'class',
		name: init.name ?? '',
		isAbstract: init.isAbstract ?? false,
		isLeaf: init.isLeaf ?? false,
		visibility: init.visibility ?? 'public',
		documentation: init.documentation ?? '',
		attributes: init.attributes ?? [],
		operations: init.operations ?? [],
		literals: init.literals ?? [],
		...(init.stereotype !== undefined && { stereotype: init.stereotype }),
		...(init.packageId !== undefined && { packageId: init.packageId })
	};
}

export function createAttribute(init: Partial<Attribute> & { name: string }): Attribute {
	return {
		id: init.id ?? newId(),
		name: init.name,
		visibility: init.visibility ?? 'private',
		isStatic: init.isStatic ?? false,
		isReadOnly: init.isReadOnly ?? false,
		isDerived: init.isDerived ?? false,
		isOrdered: init.isOrdered ?? false,
		isUnique: init.isUnique ?? false,
		isID: init.isID ?? false,
		documentation: init.documentation ?? '',
		...(init.type !== undefined && { type: init.type }),
		...(init.multiplicity !== undefined && { multiplicity: init.multiplicity }),
		...(init.defaultValue !== undefined && { defaultValue: init.defaultValue }),
		...(init.stereotype !== undefined && { stereotype: init.stereotype }),
		...(init.raw !== undefined && { raw: init.raw })
	};
}

export function createOperation(init: Partial<Operation> & { name: string }): Operation {
	return {
		id: init.id ?? newId(),
		name: init.name,
		visibility: init.visibility ?? 'public',
		parameters: init.parameters ?? [],
		isStatic: init.isStatic ?? false,
		isAbstract: init.isAbstract ?? false,
		isQuery: init.isQuery ?? false,
		documentation: init.documentation ?? '',
		...(init.returnType !== undefined && { returnType: init.returnType }),
		...(init.stereotype !== undefined && { stereotype: init.stereotype }),
		...(init.raw !== undefined && { raw: init.raw })
	};
}

/** Association, aggregation and composition carry ends; the other kinds do not. */
export const isAssociationKind = (kind: RelationshipKind) =>
	kind === 'association' || kind === 'aggregation' || kind === 'composition';

export const defaultEnd = (): End => ({
	navigable: 'unspecified',
	isDerived: false,
	isOrdered: false,
	isUnique: false,
	ownsOther: false
});

/** For aggregation and composition the target is the whole (the diamond side). */
export function createRelationship(
	init: Partial<Omit<Relationship, 'kind'>> &
		Pick<Relationship, 'relationshipKind' | 'sourceId' | 'targetId'>
): Relationship {
	const { sourceEnd, targetEnd, name, stereotype, ...rest } = init;
	return {
		kind: 'relationship',
		id: rest.id ?? newId(),
		relationshipKind: rest.relationshipKind,
		sourceId: rest.sourceId,
		targetId: rest.targetId,
		documentation: rest.documentation ?? '',
		...(name !== undefined && { name }),
		...(stereotype !== undefined && { stereotype }),
		...(isAssociationKind(rest.relationshipKind) && {
			sourceEnd: sourceEnd ?? defaultEnd(),
			targetEnd: targetEnd ?? defaultEnd()
		})
	};
}

/** Edges start straight, as the spec's default routing. */
export const defaultEdgeLayout = (): EdgeLayout => ({
	kind: 'edge',
	waypoints: [],
	lineStyle: 'oblique',
	labelOffsets: {}
});

export function defaultNodeLayout(x: number, y: number): NodeLayout {
	return { kind: 'node', x, y, w: 160, h: 80 };
}

/** First unused "Class1", "Interface1", … in the project for the given kind. */
export function nextClassName(project: Project, kind: ClassifierKind = 'class'): string {
	const taken = new Set<string>();
	for (const el of project.elements.values()) if (el.kind === 'classifier') taken.add(el.name);
	for (let n = 1; ; n++) {
		const name = t(`model.defaultName.${kind}`, { n });
		if (!taken.has(name)) return name;
	}
}

/** First unused default member line for the given kind on a classifier. */
export function nextMemberText(c: Classifier, kind: 'attribute' | 'operation' | 'literal'): string {
	const names = new Set(
		(kind === 'attribute' ? c.attributes : kind === 'operation' ? c.operations : c.literals).map(
			(m) => m.name
		)
	);
	for (let n = 1; ; n++) {
		const text = t(`model.defaultMember.${kind}`, { n });
		if (!names.has(text.replace(/^[+\-#~]\s*/, '').replace(/\(\)$/, ''))) return text;
	}
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export function findElement(project: Project, id: Id): Element | undefined {
	return project.elements.get(id);
}

export function getElement(project: Project, id: Id): Element {
	const el = project.elements.get(id);
	if (!el) throw new Error(`No element ${id}`);
	return el;
}

export function getClassifier(project: Project, id: Id): Classifier {
	const el = getElement(project, id);
	if (el.kind !== 'classifier') throw new Error(`Element ${id} is a ${el.kind}, not a classifier`);
	return el;
}

export function getDiagram(project: Project, id: Id): Diagram {
	const d = project.diagrams.find((d) => d.id === id);
	if (!d) throw new Error(`No diagram ${id}`);
	return d;
}

export function getNodeLayout(diagram: Diagram, id: Id): NodeLayout {
	const l = diagram.layout.get(id);
	if (!l || l.kind !== 'node') throw new Error(`No node layout for ${id} in ${diagram.id}`);
	return l;
}

export function elementName(el: Element): string {
	switch (el.kind) {
		case 'classifier':
		case 'package':
			return el.name;
		case 'relationship':
			return el.name ?? t(`rel.${el.relationshipKind}`);
		case 'note':
		case 'text':
			return el.text;
	}
}

export function classifiersOf(project: Project): Classifier[] {
	const out: Classifier[] = [];
	for (const el of project.elements.values()) if (el.kind === 'classifier') out.push(el);
	return out;
}
