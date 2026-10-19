import { t } from '#lib/i18n/index.ts';
import {
	createRelationship,
	defaultEdgeLayout,
	defaultEnds,
	elementName,
	getDiagram,
	getElement,
	isAssociationKind
} from '#lib/model/project.ts';
import type {
	EdgeLayout,
	Element,
	End,
	Id,
	LabelKey,
	LabelOffset,
	LineStyle,
	Point,
	Project,
	Relationship,
	RelationshipKind,
	Visibility
} from '#lib/model/types.ts';
import { deleteFromModel } from './elements.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

const relationship = (p: Project, id: Id): Relationship => {
	const el = getElement(p, id);
	if (el.kind !== 'relationship')
		throw new Error(`Element ${id} is a ${el.kind}, not a relationship`);
	return el;
};
const nameOf = (p: Project, id: Id) => {
	const el = p.elements.get(id);
	return el ? elementName(el) : id;
};
const edge = (p: Project, diagramId: Id, id: Id): EdgeLayout => {
	const l = getDiagram(p, diagramId).layout.get(id);
	if (!l || l.kind !== 'edge') throw new Error(`No edge layout for ${id} in ${diagramId}`);
	return l;
};

/** Swaps an element for a new version with the same id; the inverse swaps back. */
export const replaceElement: Factory<{ element: Element }> = define(
	'replaceElement',
	(project, { element }) => ({
		label: t('cmd.editElement', { name: elementName(element) }),
		touches: [element.id],
		apply(p): Command {
			const previous = getElement(p, element.id);
			p.elements.set(element.id, structuredClone(element));
			return replaceElement(p, { element: structuredClone(previous) });
		}
	})
);

/** Edits a relationship through a pure function of its current value; the inverse restores it whole. */
function editRelationship(p: Project, id: Id, edit: (r: Relationship) => Relationship): Command {
	const previous = relationship(p, id);
	p.elements.set(id, edit(structuredClone(previous)));
	return replaceElement(p, { element: structuredClone(previous) });
}

const END_LABELS = [
	['sourceMultiplicity', 'targetMultiplicity'],
	['sourceRole', 'targetRole'],
	['sourceProperty', 'targetProperty']
] as const;

/**
 * Swaps a relationship's ends (ASTER001's Flip): source and target, their ends, and on every
 * diagram the waypoints (read from the new source) and the end labels' offsets. Its own inverse.
 */
export const flipRelationship: Factory<{ id: Id }> = define(
	'flipRelationship',
	(project, { id }) => {
		const r = relationship(project, id);
		return {
			label: t('cmd.flip', {
				kind: t(`rel.${r.relationshipKind}`),
				source: nameOf(project, r.sourceId),
				target: nameOf(project, r.targetId)
			}),
			touches: [id, r.sourceId, r.targetId],
			apply(p): Command {
				const x = relationship(p, id);
				const flipped: Relationship = { ...x, sourceId: x.targetId, targetId: x.sourceId };
				if (x.sourceEnd && x.targetEnd)
					[flipped.sourceEnd, flipped.targetEnd] = [x.targetEnd, x.sourceEnd];
				p.elements.set(id, flipped);
				for (const d of p.diagrams) {
					const l = d.layout.get(id);
					if (l?.kind !== 'edge') continue;
					l.waypoints.reverse();
					for (const [a, b] of END_LABELS) {
						const [oa, ob] = [l.labelOffsets[a], l.labelOffsets[b]];
						delete l.labelOffsets[a];
						delete l.labelOffsets[b];
						if (ob) l.labelOffsets[a] = ob;
						if (oa) l.labelOffsets[b] = oa;
					}
				}
				return flipRelationship(p, { id });
			}
		};
	}
);

export interface ConnectArgs {
	diagramId: Id;
	/** Chosen by the caller so the command replays to the same id. */
	id: Id;
	sourceId: Id;
	targetId: Id;
	kind: RelationshipKind;
}

/** Creates a relationship and its straight edge on the diagram. For aggregation and composition, connect part (source) to whole (target). */
export const connect: Factory<ConnectArgs> = define(
	'connect',
	(project, { diagramId, id, sourceId, targetId, kind }) => ({
		label: t('cmd.connect', {
			source: nameOf(project, sourceId),
			target: nameOf(project, targetId),
			kind: t(`rel.${kind}`)
		}),
		touches: [id, sourceId, targetId],
		apply(p): Command {
			for (const end of [sourceId, targetId]) {
				if (getElement(p, end).kind !== 'classifier')
					throw new Error(`Cannot connect ${end}: not a classifier`);
			}
			const d = getDiagram(p, diagramId);
			p.elements.set(id, createRelationship({ id, relationshipKind: kind, sourceId, targetId }));
			d.elementIds.push(id);
			d.layout.set(id, defaultEdgeLayout());
			return deleteFromModel(p, { ids: [id] });
		}
	})
);

export const setRelationshipKind: Factory<{ id: Id; relationshipKind: RelationshipKind }> = define(
	'setRelationshipKind',
	(project, { id, relationshipKind }) => ({
		label: t('cmd.setRelationshipKind', {
			name: nameOf(project, id),
			kind: t(`rel.${relationshipKind}`)
		}),
		touches: [id],
		apply(p): Command {
			return editRelationship(p, id, (r) => {
				r.relationshipKind = relationshipKind;
				if (isAssociationKind(relationshipKind)) {
					const ends = defaultEnds(relationshipKind);
					r.sourceEnd ??= ends.sourceEnd;
					r.targetEnd ??= ends.targetEnd;
				} else {
					delete r.sourceEnd;
					delete r.targetEnd;
				}
				return r;
			});
		}
	})
);

/** Fields of an end; `null` clears an optional one. */
export interface EndPatch {
	role?: string | null;
	multiplicity?: string | null;
	visibility?: Visibility | null;
	navigable?: End['navigable'];
	isDerived?: boolean;
	ownsOther?: boolean;
}

export const setEnd: Factory<{ id: Id; end: 'source' | 'target'; patch: EndPatch }> = define(
	'setEnd',
	(project, { id, end, patch }) => ({
		label: t('cmd.setEnd', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			return editRelationship(p, id, (r) => {
				const e = end === 'source' ? r.sourceEnd : r.targetEnd;
				if (!e) throw new Error(`A ${r.relationshipKind} has no ends`);
				for (const [k, v] of Object.entries(patch) as [keyof EndPatch, unknown][]) {
					if (v === undefined) continue;
					if (v === null) delete e[k];
					else (e as unknown as Record<string, unknown>)[k] = v;
				}
				return r;
			});
		}
	})
);

export const setRelationshipName: Factory<{ id: Id; name: string | null }> = define(
	'setRelationshipName',
	(project, { id, name }) => ({
		label: name
			? t('cmd.setRelationshipName', { name })
			: t('cmd.clearRelationshipName', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			return editRelationship(p, id, (r) => {
				if (name) r.name = name;
				else delete r.name;
				return r;
			});
		}
	})
);

export const setRelationshipStereotype: Factory<{ id: Id; stereotype: string | null }> = define(
	'setRelationshipStereotype',
	(project, { id, stereotype }) => ({
		label: t('cmd.setRelationshipStereotype', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			return editRelationship(p, id, (r) => {
				if (stereotype) r.stereotype = stereotype;
				else delete r.stereotype;
				return r;
			});
		}
	})
);

// ---------------------------------------------------------------------------
// Edge layout
// ---------------------------------------------------------------------------

interface EdgeRef {
	diagramId: Id;
	id: Id;
}

export const setLineStyle: Factory<EdgeRef & { lineStyle: LineStyle }> = define(
	'setLineStyle',
	(project, { diagramId, id, lineStyle }) => ({
		label: t('cmd.setLineStyle', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			const l = edge(p, diagramId, id);
			const previous = l.lineStyle;
			l.lineStyle = lineStyle;
			return setLineStyle(p, { diagramId, id, lineStyle: previous });
		}
	})
);

const checkIndex = (l: EdgeLayout, index: number, max: number) => {
	if (!Number.isInteger(index) || index < 0 || index > max) throw new Error(`No waypoint ${index}`);
	return l;
};

export const addWaypoint: Factory<EdgeRef & { index: number; point: Point }> = define(
	'addWaypoint',
	(project, { diagramId, id, index, point }) => ({
		label: t('cmd.addWaypoint', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			const l = edge(p, diagramId, id);
			checkIndex(l, index, l.waypoints.length).waypoints.splice(index, 0, { ...point });
			return removeWaypoint(p, { diagramId, id, index });
		}
	})
);

export const moveWaypoint: Factory<EdgeRef & { index: number; point: Point }> = define(
	'moveWaypoint',
	(project, { diagramId, id, index, point }) => ({
		label: t('cmd.moveWaypoint', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			const l = edge(p, diagramId, id);
			checkIndex(l, index, l.waypoints.length - 1);
			const previous = l.waypoints[index];
			l.waypoints[index] = { ...point };
			return moveWaypoint(p, { diagramId, id, index, point: previous });
		}
	})
);

export const removeWaypoint: Factory<EdgeRef & { index: number }> = define(
	'removeWaypoint',
	(project, { diagramId, id, index }) => ({
		label: t('cmd.removeWaypoint', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			const l = edge(p, diagramId, id);
			const [point] = checkIndex(l, index, l.waypoints.length - 1).waypoints.splice(index, 1);
			return addWaypoint(p, { diagramId, id, index, point });
		}
	})
);

/** `null` returns the label to its default position. */
export const setLabelOffset: Factory<EdgeRef & { key: LabelKey; offset: LabelOffset | null }> =
	define('setLabelOffset', (project, { diagramId, id, key, offset }) => ({
		label: t('cmd.setLabelOffset', { name: nameOf(project, id) }),
		touches: [id],
		apply(p): Command {
			const l = edge(p, diagramId, id);
			const previous = l.labelOffsets[key] ?? null;
			if (offset) l.labelOffsets[key] = { ...offset };
			else delete l.labelOffsets[key];
			return setLabelOffset(p, { diagramId, id, key, offset: previous });
		}
	}));
