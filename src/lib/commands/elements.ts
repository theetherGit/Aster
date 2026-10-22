import { t } from '#lib/i18n/index.ts';
import { elementName, getClassifier, getDiagram, getElement } from '#lib/model/project.ts';
import type {
	Classifier,
	Element,
	Id,
	Layout,
	NodeLayout,
	Point,
	Project,
	Visibility
} from '#lib/model/types.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

const nameOf = (project: Project, id: Id) => {
	const el = project.elements.get(id);
	return el ? elementName(el) : id;
};
const namesOf = (project: Project, ids: readonly Id[]) =>
	ids.length === 1 ? nameOf(project, ids[0]) : t('cmd.many', { count: ids.length });

// ---------------------------------------------------------------------------
// Model element lifecycle
// ---------------------------------------------------------------------------

interface View {
	diagramId: Id;
	index: number;
	layout: Layout;
}
interface RestoreItem {
	element: Element;
	views: View[];
}

/** Puts previously deleted elements back, with their views, at their old positions. */
export const restoreElements: Factory<{ items: RestoreItem[] }> = define<{ items: RestoreItem[] }>(
	'restoreElements',
	(project, { items }) => ({
		label: t('cmd.restore', {
			name:
				items.length === 1 ? elementName(items[0].element) : t('cmd.many', { count: items.length })
		}),
		touches: items.map((i) => i.element.id),
		apply(p): Command {
			for (const { element } of items) p.elements.set(element.id, structuredClone(element));
			// Lowest index first across every item, so each lands where it was before any went.
			const views = items.flatMap(({ element, views }) =>
				views.map((v) => ({ id: element.id, v }))
			);
			for (const { id, v } of views.sort((a, b) => a.v.index - b.v.index)) {
				const d = getDiagram(p, v.diagramId);
				d.elementIds.splice(Math.min(v.index, d.elementIds.length), 0, id);
				d.layout.set(id, structuredClone(v.layout));
			}
			return deleteFromModel(p, { ids: items.map((i) => i.element.id) });
		}
	})
);

/** Removes elements from the model and every diagram. Relationships touching them go too. */
export const deleteFromModel: Factory<{ ids: Id[] }> = define<{ ids: Id[] }>(
	'deleteFromModel',
	(project, { ids }) => ({
		label: t('cmd.deleteFromModel', { name: namesOf(project, ids) }),
		touches: ids,
		apply(p): Command {
			const doomed = new Set(ids);
			for (const el of p.elements.values()) {
				if (el.kind === 'relationship' && (doomed.has(el.sourceId) || doomed.has(el.targetId)))
					doomed.add(el.id);
			}
			// Every index is read before anything is removed: restore puts them back in that order.
			const items: RestoreItem[] = [];
			for (const id of doomed) {
				const element = p.elements.get(id);
				if (!element) continue;
				const views: View[] = [];
				for (const d of p.diagrams) {
					const index = d.elementIds.indexOf(id);
					const layout = d.layout.get(id);
					if (index >= 0 && layout)
						views.push({ diagramId: d.id, index, layout: structuredClone(layout) });
				}
				items.push({ element: structuredClone(element), views });
			}
			for (const id of doomed) {
				for (const d of p.diagrams) {
					const index = d.elementIds.indexOf(id);
					if (index >= 0) d.elementIds.splice(index, 1);
					d.layout.delete(id);
				}
				p.elements.delete(id);
			}
			return restoreElements(p, { items });
		}
	})
);

export const addClassifier: Factory<{ diagramId: Id; classifier: Classifier; at: Point }> = define<{
	diagramId: Id;
	classifier: Classifier;
	at: Point;
}>('addClassifier', (project, { diagramId, classifier, at }) => ({
	label: t('cmd.addClassifier', {
		kind: t(`kind.${classifier.classifierKind}`),
		name: classifier.name
	}),
	touches: [classifier.id],
	apply(p): Command {
		const d = getDiagram(p, diagramId);
		p.elements.set(classifier.id, structuredClone(classifier));
		d.elementIds.push(classifier.id);
		d.layout.set(classifier.id, { kind: 'node', x: at.x, y: at.y, w: 160, h: 80 });
		return deleteFromModel(p, { ids: [classifier.id] });
	}
}));

/** A type slot that names a classifier: an attribute's type, an operation's return or parameter type. */
export interface TypeRef {
	classifierId: Id;
	memberId: Id;
	slot: 'type' | 'return' | number;
}

/** Every parsed type slot equal to `name` (owner's ruling #8; raw lines are left alone). */
function typeRefs(p: Project, name: string): TypeRef[] {
	if (!name.trim()) return [];
	const out: TypeRef[] = [];
	for (const el of p.elements.values()) {
		if (el.kind !== 'classifier') continue;
		for (const a of el.attributes)
			if (a.raw === undefined && a.type === name)
				out.push({ classifierId: el.id, memberId: a.id, slot: 'type' });
		for (const o of el.operations) {
			if (o.raw !== undefined) continue;
			if (o.returnType === name) out.push({ classifierId: el.id, memberId: o.id, slot: 'return' });
			o.parameters.forEach((x, i) => {
				if (x.type === name) out.push({ classifierId: el.id, memberId: o.id, slot: i });
			});
		}
	}
	return out;
}
function setTypeRef(p: Project, r: TypeRef, name: string) {
	const c = getClassifier(p, r.classifierId);
	if (r.slot === 'type') {
		const a = c.attributes.find((m) => m.id === r.memberId);
		if (a) a.type = name;
		return;
	}
	const o = c.operations.find((m) => m.id === r.memberId);
	if (!o) return;
	if (r.slot === 'return') o.returnType = name;
	else if (o.parameters[r.slot]) o.parameters[r.slot].type = name;
}

/**
 * Renames a classifier and rewrites the parsed types that named it. The inverse carries the exact
 * slots it changed, so undo never touches a type that already said the new name.
 */
export const renameClassifier: Factory<{ id: Id; name: string; refs?: TypeRef[] }> = define<{
	id: Id;
	name: string;
	refs?: TypeRef[];
}>('renameClassifier', (project, { id, name, refs }) => ({
	label: t('cmd.renameClassifier', { from: nameOf(project, id), to: name }),
	touches: [id, ...new Set((refs ?? []).map((r) => r.classifierId))],
	apply(p): Command {
		const c = getClassifier(p, id);
		const previous = c.name;
		const changed = refs ?? typeRefs(p, previous);
		c.name = name;
		for (const r of changed) setTypeRef(p, r, name);
		return renameClassifier(p, { id, name: previous, refs: changed });
	}
}));

export interface ClassifierFlags {
	isAbstract?: boolean;
	isLeaf?: boolean;
	visibility?: Visibility;
	/** `null` clears the stereotype. */
	stereotype?: string | null;
}

export const setClassifierFlags: Factory<{ id: Id; flags: ClassifierFlags }> = define<{
	id: Id;
	flags: ClassifierFlags;
}>('setClassifierFlags', (project, { id, flags }) => ({
	label: t('cmd.setClassifierFlags', { name: nameOf(project, id) }),
	touches: [id],
	apply(p): Command {
		const c = getClassifier(p, id);
		const previous: ClassifierFlags = {};
		if (flags.isAbstract !== undefined) {
			previous.isAbstract = c.isAbstract;
			c.isAbstract = flags.isAbstract;
		}
		if (flags.isLeaf !== undefined) {
			previous.isLeaf = c.isLeaf;
			c.isLeaf = flags.isLeaf;
		}
		if (flags.visibility !== undefined) {
			previous.visibility = c.visibility;
			c.visibility = flags.visibility;
		}
		if (flags.stereotype !== undefined) {
			previous.stereotype = c.stereotype ?? null;
			if (flags.stereotype === null) delete c.stereotype;
			else c.stereotype = flags.stereotype;
		}
		return setClassifierFlags(p, { id, flags: previous });
	}
}));

// ---------------------------------------------------------------------------
// Views (diagram membership and layout)
// ---------------------------------------------------------------------------

interface Entry {
	id: Id;
	layout: Layout;
	/** Position in z-order; appended when omitted. */
	index?: number;
}

export const addToDiagram: Factory<{ diagramId: Id; entries: Entry[] }> = define<{
	diagramId: Id;
	entries: Entry[];
}>('addToDiagram', (project, { diagramId, entries }) => ({
	label: t('cmd.addToDiagram', {
		name: namesOf(
			project,
			entries.map((e) => e.id)
		)
	}),
	touches: entries.map((e) => e.id),
	apply(p): Command {
		const d = getDiagram(p, diagramId);
		const ordered = [...entries].sort((a, b) => (a.index ?? Infinity) - (b.index ?? Infinity));
		for (const { id, layout, index } of ordered) {
			getElement(p, id);
			if (d.elementIds.includes(id)) continue;
			d.elementIds.splice(Math.min(index ?? d.elementIds.length, d.elementIds.length), 0, id);
			d.layout.set(id, structuredClone(layout));
		}
		return deleteFromDiagram(p, { diagramId, ids: entries.map((e) => e.id) });
	}
}));

export const deleteFromDiagram: Factory<{ diagramId: Id; ids: Id[] }> = define<{
	diagramId: Id;
	ids: Id[];
}>('deleteFromDiagram', (project, { diagramId, ids }) => ({
	label: t('cmd.deleteFromDiagram', { name: namesOf(project, ids) }),
	touches: ids,
	apply(p): Command {
		const d = getDiagram(p, diagramId);
		// An edge cannot show without both of its nodes: take attached edges along.
		const gone = new Set(ids);
		for (const id of d.elementIds) {
			const el = p.elements.get(id);
			if (el?.kind === 'relationship' && (gone.has(el.sourceId) || gone.has(el.targetId)))
				gone.add(id);
		}
		const entries: Entry[] = [];
		for (const id of gone) {
			const index = d.elementIds.indexOf(id);
			const layout = d.layout.get(id);
			if (index < 0 || !layout) continue;
			entries.push({ id, index, layout: structuredClone(layout) });
		}
		for (const { id } of entries) {
			d.elementIds.splice(d.elementIds.indexOf(id), 1);
			d.layout.delete(id);
		}
		return addToDiagram(p, { diagramId, entries });
	}
}));

const node = (p: Project, diagramId: Id, id: Id): NodeLayout => {
	const l = getDiagram(p, diagramId).layout.get(id);
	if (!l || l.kind !== 'node') throw new Error(`No node layout for ${id}`);
	return l;
};

export const MOVE_COALESCE_MS = 300;

/** Moves one or more nodes by a delta; consecutive moves of the same set within 300 ms coalesce. */
export const moveNode: Factory<{ diagramId: Id; ids: Id[]; dx: number; dy: number }> = define<{
	diagramId: Id;
	ids: Id[];
	dx: number;
	dy: number;
}>('moveNode', (project, { diagramId, ids, dx, dy }) => ({
	label: t('cmd.moveNode', { name: namesOf(project, ids) }),
	touches: ids,
	coalesceKey: `move:${diagramId}:${[...ids].sort().join(',')}`,
	coalesceMs: MOVE_COALESCE_MS,
	apply(p): Command {
		const before = ids.map((id) => {
			const l = node(p, diagramId, id);
			const at = { id, x: l.x, y: l.y };
			l.x += dx;
			l.y += dy;
			return at;
		});
		// Absolute inverse: a coalesced drag keeps only its first inverse (stack.ts).
		return setNodePositions(p, { diagramId, positions: before });
	}
}));

/** Puts nodes at absolute positions; the inverse puts them back where they were. */
export const setNodePositions: Factory<{
	diagramId: Id;
	positions: { id: Id; x: number; y: number }[];
}> = define('setNodePositions', (project, { diagramId, positions }) => ({
	label: t('cmd.moveNode', {
		name: namesOf(
			project,
			positions.map((q) => q.id)
		)
	}),
	touches: positions.map((q) => q.id),
	apply(p): Command {
		const before = positions.map(({ id, x, y }) => {
			const l = node(p, diagramId, id);
			const at = { id, x: l.x, y: l.y };
			l.x = x;
			l.y = y;
			return at;
		});
		return setNodePositions(p, { diagramId, positions: before });
	}
}));

export const resizeNode: Factory<{ diagramId: Id; id: Id; w: number; h: number }> = define<{
	diagramId: Id;
	id: Id;
	w: number;
	h: number;
}>('resizeNode', (project, { diagramId, id, w, h }) => ({
	label: t('cmd.resizeNode', { name: nameOf(project, id) }),
	touches: [id],
	apply(p): Command {
		const l = node(p, diagramId, id);
		const previous = { w: l.w, h: l.h };
		l.w = w;
		l.h = h;
		return resizeNode(p, { diagramId, id, ...previous });
	}
}));

/** Bring to front / send to back: the views' z-order (Diagram.elementIds, back to front). */
export const restack: Factory<{ diagramId: Id; ids: Id[]; place: 'front' | 'back' }> = define(
	'restack',
	(project, { diagramId, ids, place }) => ({
		label: t(place === 'front' ? 'cmd.toFront' : 'cmd.toBack', { name: namesOf(project, ids) }),
		touches: ids,
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			const previous = d.elementIds;
			const moving = new Set(ids);
			const moved = previous.filter((id) => moving.has(id));
			const rest = previous.filter((id) => !moving.has(id));
			d.elementIds = place === 'front' ? [...rest, ...moved] : [...moved, ...rest];
			return setViewOrder(p, { diagramId, order: previous });
		}
	})
);

/** The inverse of restack: the z-order as it was. */
export const setViewOrder: Factory<{ diagramId: Id; order: Id[] }> = define(
	'setViewOrder',
	(project, { diagramId, order }) => ({
		label: t('cmd.viewOrder'),
		touches: [],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			const previous = d.elementIds;
			d.elementIds = [...order];
			return setViewOrder(p, { diagramId, order: previous });
		}
	})
);

/** Documentation of any element that carries it (classifier, relationship, package). */
export const setDocumentation: Factory<{ id: Id; documentation: string }> = define(
	'setDocumentation',
	(project, { id, documentation }) => ({
		label: t('cmd.setDocumentation', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			const el = getElement(p, id);
			if (!('documentation' in el)) throw new Error(`${id} has no documentation`);
			const previous = el.documentation;
			el.documentation = documentation;
			return setDocumentation(p, { id, documentation: previous });
		}
	})
);
