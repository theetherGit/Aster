import { describe, expect, it } from 'vitest';
import {
	Stack,
	addClassifier,
	addMember,
	addToDiagram,
	addWaypoint,
	connect,
	deleteMember,
	moveWaypoint,
	removeWaypoint,
	setEnd,
	setLabelOffset,
	setLineStyle,
	setRelationshipKind,
	setRelationshipName,
	setRelationshipStereotype,
	reorderMember,
	setClassifierKind,
	setLiterals,
	setMemberText,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	renameClassifier,
	resizeNode,
	setClassifierFlags
} from '#lib/commands/index.ts';
import type { Command } from '#lib/commands/types.ts';
import { memberFromText, type MemberKind } from '#lib/mdj/expression.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { classifiersOf, createClassifier, getClassifier, getDiagram } from '#lib/model/project.ts';
import type {
	EdgeLayout,
	LabelKey,
	LineStyle,
	Project,
	Relationship,
	RelationshipKind,
	Visibility
} from '#lib/model/types.ts';
import { rng, structural } from './helpers.ts';

const VIS: Visibility[] = ['public', 'protected', 'private', 'package'];
const KINDS: MemberKind[] = ['attribute', 'operation', 'literal'];
const REL_KINDS: RelationshipKind[] = [
	'association',
	'aggregation',
	'composition',
	'generalization',
	'realization',
	'dependency'
];
const STYLES: LineStyle[] = ['rectilinear', 'oblique', 'roundrect', 'curve'];
const LABEL_KEYS: LabelKey[] = [
	'name',
	'sourceRole',
	'targetRole',
	'sourceMultiplicity',
	'targetMultiplicity'
];

/** Relationship commands, valid for the current state; null when none applies. */
function randomRelationshipCommand(
	project: Project,
	r: ReturnType<typeof rng>,
	n: number
): Command | null {
	const d = getDiagram(project, 'd1');
	const nodes = d.elementIds.filter((id) => project.elements.get(id)?.kind === 'classifier');
	const rels = [...project.elements.values()].filter(
		(e): e is Relationship => e.kind === 'relationship'
	);
	const shown = rels.filter((e) => d.elementIds.includes(e.id));
	const hidden = rels.filter(
		(e) =>
			!d.elementIds.includes(e.id) &&
			d.elementIds.includes(e.sourceId) &&
			d.elementIds.includes(e.targetId)
	);
	const roll = r.int(12);
	if ((roll < 3 || rels.length === 0) && nodes.length)
		return connect(project, {
			diagramId: 'd1',
			id: `rel${n}`,
			sourceId: r.pick(nodes),
			targetId: r.pick(nodes),
			kind: r.pick(REL_KINDS)
		});
	if (rels.length === 0) return null;
	const rel = r.pick(rels);
	if (roll === 3)
		return setRelationshipKind(project, { id: rel.id, relationshipKind: r.pick(REL_KINDS) });
	if (roll === 4 && rel.sourceEnd)
		return setEnd(project, {
			id: rel.id,
			end: r.pick(['source', 'target'] as const),
			patch: {
				role: r.int(3) ? `role${n}` : null,
				multiplicity: r.pick(['1', '0..*', null]),
				navigable: r.pick(['unspecified', 'navigable', 'notNavigable'] as const),
				ownsOther: r.int(2) === 0
			}
		});
	if (roll === 5)
		return r.int(2)
			? setRelationshipName(project, { id: rel.id, name: r.int(3) ? `n${n}` : null })
			: setRelationshipStereotype(project, { id: rel.id, stereotype: r.int(3) ? 'use' : null });
	if (roll === 9)
		return r.int(2)
			? deleteFromModel(project, { ids: [rel.id] })
			: shown.length
				? deleteFromDiagram(project, { diagramId: 'd1', ids: [r.pick(shown).id] })
				: null;
	if (roll === 10 && hidden.length)
		return addToDiagram(project, {
			diagramId: 'd1',
			entries: [
				{
					id: r.pick(hidden).id,
					layout: { kind: 'edge', waypoints: [], lineStyle: 'oblique', labelOffsets: {} }
				}
			]
		});
	if (!shown.length) return null;
	const e = r.pick(shown);
	const layout = d.layout.get(e.id) as EdgeLayout;
	if (roll === 6)
		return setLineStyle(project, { diagramId: 'd1', id: e.id, lineStyle: r.pick(STYLES) });
	if (roll === 7 || layout.waypoints.length === 0)
		return addWaypoint(project, {
			diagramId: 'd1',
			id: e.id,
			index: r.int(layout.waypoints.length + 1),
			point: { x: r.int(800), y: r.int(600) }
		});
	if (roll === 8)
		return r.int(2)
			? moveWaypoint(project, {
					diagramId: 'd1',
					id: e.id,
					index: r.int(layout.waypoints.length),
					point: { x: r.int(800), y: r.int(600) }
				})
			: removeWaypoint(project, {
					diagramId: 'd1',
					id: e.id,
					index: r.int(layout.waypoints.length)
				});
	return setLabelOffset(project, {
		diagramId: 'd1',
		id: e.id,
		key: r.pick(LABEL_KEYS),
		offset: r.int(4) ? { alpha: r.next() * 3, distance: r.int(60) } : null
	});
}
const LINES: Record<MemberKind, string[]> = {
	attribute: [
		'-x: int',
		'+{static} MAX: int = 5',
		'<<key>> #id: UUID {readOnly}',
		'broken[0..',
		'plain'
	],
	operation: [
		'+go()',
		'-f(a: int, b: String = "x"): void {query}',
		'+{abstract} area(): double',
		'broken(',
		'+h(out e: E)'
	],
	literal: ['ACTIVE', '<<default>> IDLE', 'not valid!']
};

/** Picks a random valid command for the current project state. */
function randomCommand(project: Project, r: ReturnType<typeof rng>, n: number): Command {
	const d = getDiagram(project, 'd1');
	const all = classifiersOf(project).map((c) => c.id);
	const onDiagram = all.filter((id) => d.elementIds.includes(id));
	const offDiagram = all.filter((id) => !d.elementIds.includes(id));
	if (r.int(3) === 0) {
		const c = randomRelationshipCommand(project, r, n);
		if (c) return c;
	}
	const roll = r.int(16);
	if (roll >= 10 && all.length) {
		const id = r.pick(all);
		const kind = r.pick(KINDS);
		const list =
			kind === 'attribute'
				? getClassifier(project, id).attributes
				: kind === 'operation'
					? getClassifier(project, id).operations
					: getClassifier(project, id).literals;
		if (roll === 10 || list.length === 0)
			return addMember(project, {
				classifierId: id,
				kind,
				member: memberFromText(kind, r.pick(LINES[kind]), `m${n}`),
				index: r.int(list.length + 1)
			});
		const memberId = r.pick(list).id;
		if (roll === 11)
			return setMemberText(project, {
				classifierId: id,
				kind,
				memberId,
				text: r.pick(LINES[kind])
			});
		if (roll === 12)
			return reorderMember(project, {
				classifierId: id,
				kind,
				memberId,
				to: r.int(list.length + 1)
			});
		if (roll === 13) return deleteMember(project, { classifierId: id, kind, memberId });
		if (roll === 14)
			return setClassifierKind(project, {
				id,
				classifierKind: r.pick(['class', 'interface', 'enum', 'dataType'] as const)
			});
		return setLiterals(project, {
			id,
			literals: Array.from({ length: r.int(3) }, (_, i) => ({
				id: `l${n}-${i}`,
				name: `L${i}`,
				documentation: ''
			}))
		});
	}
	if (roll === 0 || all.length === 0) {
		const name = `C${n}`;
		return addClassifier(project, {
			diagramId: 'd1',
			classifier: createClassifier({ id: name, name }),
			at: { x: r.int(800), y: r.int(600) }
		});
	}
	if (roll === 1) return renameClassifier(project, { id: r.pick(all), name: `R${n}` });
	if (roll === 2)
		return setClassifierFlags(project, {
			id: r.pick(all),
			flags: {
				isAbstract: r.next() < 0.5,
				visibility: r.pick(VIS),
				stereotype: r.next() < 0.3 ? null : `s${n}`
			}
		});
	if (roll === 3 && onDiagram.length)
		return deleteFromDiagram(project, { diagramId: 'd1', ids: [r.pick(onDiagram)] });
	if (roll === 4 && offDiagram.length)
		return addToDiagram(project, {
			diagramId: 'd1',
			entries: [
				{
					id: r.pick(offDiagram),
					layout: { kind: 'node', x: r.int(800), y: r.int(600), w: 160, h: 80 }
				}
			]
		});
	if (roll === 5) return deleteFromModel(project, { ids: [r.pick(all)] });
	if (roll === 6 && onDiagram.length)
		return resizeNode(project, {
			diagramId: 'd1',
			id: r.pick(onDiagram),
			w: 160 + r.int(200),
			h: 40 + r.int(300)
		});
	if (onDiagram.length) {
		const count = 1 + r.int(Math.min(2, onDiagram.length));
		const ids = [...new Set(Array.from({ length: count }, () => r.pick(onDiagram)))];
		return moveNode(project, { diagramId: 'd1', ids, dx: r.int(41) - 20, dy: r.int(41) - 20 });
	}
	return renameClassifier(project, { id: r.pick(all), name: `R${n}` });
}

describe('undo property', () => {
	it.each(Array.from({ length: 25 }, (_, i) => i + 1))(
		'seed %i: 50 random commands then undo all restores model and layout; redo all restores the end state',
		(seed) => {
			const r = rng(seed);
			const project = sampleProject();
			let clock = 0;
			const stack = new Stack(
				() => project,
				() => clock
			);
			const start = structural(project);
			for (let n = 0; n < 50; n++) {
				stack.run(randomCommand(project, r, n));
				clock += r.int(2) ? 10 : 500; // mix of coalesced and separate steps
			}
			const end = structural(project);
			while (stack.canUndo) stack.undo();
			expect(structural(project)).toEqual(start);
			while (stack.canRedo) stack.redo();
			expect(structural(project)).toEqual(end);
			while (stack.canUndo) stack.undo();
			expect(structural(project)).toEqual(start);
		}
	);
});
