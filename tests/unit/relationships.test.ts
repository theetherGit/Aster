import { describe, expect, it } from 'vitest';
import {
	Stack,
	addWaypoint,
	connect,
	deleteFromDiagram,
	deleteFromModel,
	moveWaypoint,
	removeWaypoint,
	setEnd,
	setLabelOffset,
	setLineStyle,
	setRelationshipKind,
	setRelationshipName,
	setRelationshipStereotype
} from '#lib/commands/index.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { getDiagram, getElement } from '#lib/model/project.ts';
import type { EdgeLayout, Relationship } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

function setup() {
	const project = sampleProject();
	const stack = new Stack(() => project);
	const d = getDiagram(project, 'd1');
	const rel = (id = 'r1') => getElement(project, id) as Relationship;
	const edge = (id = 'r1') => d.layout.get(id) as EdgeLayout;
	return { project, stack, d, rel, edge };
}

describe('connect', () => {
	it('creates the relationship, its view and a straight edge layout; undo removes all', () => {
		const { project, stack, d, rel, edge } = setup();
		const before = structural(project);
		const label = stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 'r1',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'association'
			})
		);
		expect(label).toBe('connect Customer to Account, association');
		expect(rel()).toMatchObject({
			kind: 'relationship',
			relationshipKind: 'association',
			sourceId: 'Customer',
			targetId: 'Account',
			sourceEnd: { navigable: 'unspecified', isDerived: false, ownsOther: false },
			targetEnd: { navigable: 'unspecified', isDerived: false, ownsOther: false }
		});
		expect(d.elementIds).toContain('r1');
		expect(edge()).toEqual({ kind: 'edge', waypoints: [], lineStyle: 'oblique', labelOffsets: {} });
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('gives ends only to association kinds; part-to-whole keeps the whole as target', () => {
		const { project, stack, rel } = setup();
		stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 'g',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'generalization'
			})
		);
		expect('sourceEnd' in rel('g')).toBe(false);
		stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 'c',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'composition'
			})
		);
		expect(rel('c')).toMatchObject({
			sourceId: 'Customer',
			targetId: 'Account',
			relationshipKind: 'composition'
		});
		expect(rel('c').targetEnd).toBeDefined();
	});

	it('allows self-associations and rejects unknown endpoints', () => {
		const { project, stack, rel } = setup();
		stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 's',
				sourceId: 'Account',
				targetId: 'Account',
				kind: 'association'
			})
		);
		expect(rel('s').sourceId).toBe(rel('s').targetId);
		expect(() =>
			connect(project, {
				diagramId: 'd1',
				id: 'x',
				sourceId: 'Account',
				targetId: 'ghost',
				kind: 'association'
			}).apply(project)
		).toThrow();
	});
});

describe('relationship edits', () => {
	function connected() {
		const s = setup();
		s.stack.run(
			connect(s.project, {
				diagramId: 'd1',
				id: 'r1',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'association'
			})
		);
		return s;
	}

	it('setRelationshipKind adds or drops ends and undo restores them exactly', () => {
		const { project, stack, rel } = connected();
		stack.run(
			setEnd(project, { id: 'r1', end: 'target', patch: { role: 'owner', multiplicity: '1' } })
		);
		const withEnds = structural(project);
		stack.run(setRelationshipKind(project, { id: 'r1', relationshipKind: 'dependency' }));
		expect(rel()).not.toHaveProperty('sourceEnd');
		expect(rel()).not.toHaveProperty('targetEnd');
		stack.run(setRelationshipKind(project, { id: 'r1', relationshipKind: 'aggregation' }));
		expect(rel().targetEnd).toMatchObject({ navigable: 'unspecified' });
		expect(rel().targetEnd?.role).toBeUndefined();
		stack.undo();
		stack.undo();
		expect(structural(project)).toEqual(withEnds);
	});

	it('setEnd patches one end; null clears optional fields; non-association kinds throw', () => {
		const { project, stack, rel } = connected();
		stack.run(
			setEnd(project, {
				id: 'r1',
				end: 'source',
				patch: {
					role: 'customer',
					multiplicity: '0..*',
					navigable: 'navigable',
					visibility: 'private',
					ownsOther: true
				}
			})
		);
		expect(rel().sourceEnd).toEqual({
			role: 'customer',
			multiplicity: '0..*',
			navigable: 'navigable',
			visibility: 'private',
			isDerived: false,
			ownsOther: true
		});
		stack.run(
			setEnd(project, { id: 'r1', end: 'source', patch: { role: null, visibility: null } })
		);
		expect(rel().sourceEnd).not.toHaveProperty('role');
		expect(rel().sourceEnd).not.toHaveProperty('visibility');
		stack.run(setRelationshipKind(project, { id: 'r1', relationshipKind: 'generalization' }));
		expect(() =>
			setEnd(project, { id: 'r1', end: 'source', patch: { role: 'x' } }).apply(project)
		).toThrow();
	});

	it('name and stereotype set and clear', () => {
		const { project, stack, rel } = connected();
		expect(stack.run(setRelationshipName(project, { id: 'r1', name: 'holds' }))).toBe(
			'rename relationship to holds'
		);
		stack.run(setRelationshipStereotype(project, { id: 'r1', stereotype: 'use' }));
		expect(rel()).toMatchObject({ name: 'holds', stereotype: 'use' });
		stack.run(setRelationshipName(project, { id: 'r1', name: null }));
		expect(rel()).not.toHaveProperty('name');
		stack.undo();
		expect(rel().name).toBe('holds');
	});

	it('line style, waypoints and label offsets edit the edge layout and invert', () => {
		const { project, stack, edge } = connected();
		const before = structural(project);
		stack.run(setLineStyle(project, { diagramId: 'd1', id: 'r1', lineStyle: 'rectilinear' }));
		stack.run(
			addWaypoint(project, { diagramId: 'd1', id: 'r1', index: 0, point: { x: 300, y: 40 } })
		);
		stack.run(
			addWaypoint(project, { diagramId: 'd1', id: 'r1', index: 1, point: { x: 350, y: 60 } })
		);
		stack.run(
			addWaypoint(project, { diagramId: 'd1', id: 'r1', index: 0, point: { x: 200, y: 20 } })
		);
		expect(edge().waypoints).toEqual([
			{ x: 200, y: 20 },
			{ x: 300, y: 40 },
			{ x: 350, y: 60 }
		]);
		stack.run(
			moveWaypoint(project, { diagramId: 'd1', id: 'r1', index: 1, point: { x: 310, y: 45 } })
		);
		stack.run(removeWaypoint(project, { diagramId: 'd1', id: 'r1', index: 0 }));
		expect(edge().waypoints).toEqual([
			{ x: 310, y: 45 },
			{ x: 350, y: 60 }
		]);
		stack.run(
			setLabelOffset(project, {
				diagramId: 'd1',
				id: 'r1',
				key: 'targetRole',
				offset: { alpha: 1, distance: 40 }
			})
		);
		expect(edge().labelOffsets.targetRole).toEqual({ alpha: 1, distance: 40 });
		stack.run(
			setLabelOffset(project, { diagramId: 'd1', id: 'r1', key: 'targetRole', offset: null })
		);
		expect(edge().labelOffsets).not.toHaveProperty('targetRole');
		expect(edge().lineStyle).toBe('rectilinear');
		while (stack.depth > 1) stack.undo();
		expect(structural(project)).toEqual(before);
		expect(() =>
			removeWaypoint(project, { diagramId: 'd1', id: 'r1', index: 5 }).apply(project)
		).toThrow();
	});
});

describe('relationship deletion', () => {
	it('removing a node from a diagram also removes its edges there; undo brings both back in order', () => {
		const { project, stack, d } = setup();
		stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 'r1',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'dependency'
			})
		);
		const before = structural(project);
		stack.run(deleteFromDiagram(project, { diagramId: 'd1', ids: ['Account'] }));
		expect(d.elementIds).toEqual(['Customer']);
		expect(project.elements.has('r1')).toBe(true);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('an edge can be removed from the diagram alone, or from the model', () => {
		const { project, stack, d } = setup();
		stack.run(
			connect(project, {
				diagramId: 'd1',
				id: 'r1',
				sourceId: 'Customer',
				targetId: 'Account',
				kind: 'realization'
			})
		);
		stack.run(deleteFromDiagram(project, { diagramId: 'd1', ids: ['r1'] }));
		expect(d.elementIds).toEqual(['Account', 'Customer']);
		expect(project.elements.has('r1')).toBe(true);
		stack.undo();
		stack.run(deleteFromModel(project, { ids: ['r1'] }));
		expect(project.elements.has('r1')).toBe(false);
		expect(d.layout.has('r1')).toBe(false);
		expect(d.elementIds).toEqual(['Account', 'Customer']);
	});
});
