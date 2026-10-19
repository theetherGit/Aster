import { describe, expect, it } from 'vitest';
import { firstElement, nearestInDirection } from '#lib/canvas/link.ts';
import { elementSummary } from '#lib/canvas/summary.ts';
import type { Rect } from '#lib/canvas/edges/geometry.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createRelationship, defaultEdgeLayout } from '#lib/model/project.ts';

const r = (x: number, y: number): Rect => ({ x, y, w: 100, h: 50 });

/** accessibility.md § Canvas keyboard model: arrows pick by centre distance weighted toward the axis. */
describe('canvas focus: spatial picker', () => {
	it('prefers a nearer element slightly off the axis over a far one on it', () => {
		const rects = new Map<string, Rect>([
			['from', r(0, 0)],
			['near', r(200, 60)],
			['far', r(700, 0)]
		]);
		expect(nearestInDirection(rects, 'from', 'right')).toBe('near');
	});

	it('weights the cross axis double, so a wide sidestep loses to a longer straight run', () => {
		const rects = new Map<string, Rect>([
			['from', r(0, 0)],
			['side', r(100, 300)],
			['straight', r(500, 0)]
		]);
		// side: primary 100 + 2 × 300 = 700; straight: 500
		expect(nearestInDirection(rects, 'from', 'right')).toBe('straight');
	});

	it('starts at the top-left element when nothing has focus yet', () => {
		const rects = new Map<string, Rect>([
			['low', r(0, 400)],
			['topRight', r(300, 20)],
			['topLeft', r(40, 30)]
		]);
		expect(firstElement(rects)).toBe('topLeft');
		expect(firstElement(new Map())).toBeNull();
	});
});

describe('canvas focus: element summary', () => {
	it('says kind, name, member counts and attached relationships in plain language', () => {
		const project = sampleProject();
		const diagram = project.diagrams[0];
		const rel = createRelationship({
			relationshipKind: 'association',
			sourceId: 'Account',
			targetId: 'Customer'
		});
		project.elements.set(rel.id, rel);
		diagram.elementIds.push(rel.id);
		diagram.layout.set(rel.id, defaultEdgeLayout());

		expect(elementSummary(project, diagram, 'Account')).toBe(
			'Abstract class Account, 10 attributes, 10 operations, 1 relationship: association to Customer'
		);
		expect(elementSummary(project, diagram, 'Customer')).toBe(
			'Class Customer, 2 attributes, 2 operations, 1 relationship: association from Account'
		);
		expect(elementSummary(project, diagram, rel.id)).toBe('Account to Customer, association');
	});
});
