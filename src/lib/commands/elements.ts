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
			for (const { element, views } of items) {
				p.elements.set(element.id, structuredClone(element));
				for (const v of [...views].sort((a, b) => a.index - b.index)) {
					const d = getDiagram(p, v.diagramId);
					d.elementIds.splice(Math.min(v.index, d.elementIds.length), 0, element.id);
					d.layout.set(element.id, structuredClone(v.layout));
				}
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
					if (index >= 0) d.elementIds.splice(index, 1);
					d.layout.delete(id);
				}
				items.push({ element: structuredClone(element), views });
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

export const renameClassifier: Factory<{ id: Id; name: string }> = define<{ id: Id; name: string }>(
	'renameClassifier',
	(project, { id, name }) => ({
		label: t('cmd.renameClassifier', { from: nameOf(project, id), to: name }),
		touches: [id],
		apply(p): Command {
			const c = getClassifier(p, id);
			const previous = c.name;
			c.name = name;
			return renameClassifier(p, { id, name: previous });
		}
	})
);

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
		const entries: Entry[] = [];
		for (const id of ids) {
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
		for (const id of ids) {
			const l = node(p, diagramId, id);
			l.x += dx;
			l.y += dy;
		}
		return moveNode(p, { diagramId, ids, dx: -dx, dy: -dy });
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
