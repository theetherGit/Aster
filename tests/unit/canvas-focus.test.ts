import { describe, expect, it } from 'vitest';
import { firstElement, nearestInDirection } from '#lib/canvas/link.ts';
import { elementSummary, relationshipsByEnd } from '#lib/canvas/summary.ts';
import type { Rect } from '#lib/canvas/edges/geometry.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import {
	createAttribute,
	createClassifier,
	createOperation,
	createRelationship,
	defaultEdgeLayout
} from '#lib/model/project.ts';
import type { Classifier, RelationshipKind } from '#lib/model/types.ts';

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

describe('canvas focus: element summary (board 10)', () => {
	/** Board 10's library: Book realizes Searchable, is part of Library, and Loan refers to it. */
	function library() {
		const project = sampleProject();
		const diagram = project.diagrams[0];
		const add = (c: Classifier) => {
			project.elements.set(c.id, c);
			diagram.elementIds.push(c.id);
		};
		const attr = (name: string) => createAttribute({ name });
		add(createClassifier({ id: 'Person', name: 'Person', isAbstract: true }));
		add(createClassifier({ id: 'Member', name: 'Member' }));
		add(createClassifier({ id: 'Library', name: 'Library' }));
		add(createClassifier({ id: 'Searchable', name: 'Searchable', classifierKind: 'interface' }));
		add(
			createClassifier({
				id: 'Book',
				name: 'Book',
				attributes: [attr('isbn'), attr('title'), attr('author')],
				operations: [createOperation({ name: 'isAvailable' })]
			})
		);
		add(createClassifier({ id: 'Loan', name: 'Loan' }));
		add(
			createClassifier({
				id: 'LoanStatus',
				name: 'LoanStatus',
				classifierKind: 'enum',
				literals: ['ACTIVE', 'RETURNED', 'OVERDUE'].map((name) => ({
					id: name,
					name,
					documentation: ''
				}))
			})
		);
		const rel = (
			id: string,
			relationshipKind: RelationshipKind,
			sourceId: string,
			targetId: string
		) => {
			project.elements.set(id, createRelationship({ id, relationshipKind, sourceId, targetId }));
			diagram.elementIds.push(id);
			diagram.layout.set(id, defaultEdgeLayout());
		};
		rel('g', 'generalization', 'Member', 'Person');
		rel('r', 'realization', 'Book', 'Searchable');
		rel('c', 'composition', 'Book', 'Library');
		rel('a', 'association', 'Loan', 'Book');
		rel('d', 'dependency', 'Loan', 'LoanStatus');
		return { project, diagram };
	}

	it('says name and kind, member counts, then each relationship in words', () => {
		const { project, diagram } = library();
		const say = (id: string) => elementSummary(project, diagram, id);
		expect(say('Book')).toBe(
			'Book, class. 3 attributes, 1 operation. Realizes Searchable; part of Library; Loan refers to it.'
		);
		expect(say('Person')).toBe(
			'Person, abstract class. 0 attributes, 0 operations. Member extends it.'
		);
		expect(say('Member')).toBe('Member, class. 0 attributes, 0 operations. Extends Person.');
		expect(say('Library')).toBe('Library, class. 0 attributes, 0 operations. Has part Book.');
		expect(say('Searchable')).toBe(
			'Searchable, interface. 0 attributes, 0 operations. Book realizes it.'
		);
		expect(say('Loan')).toBe(
			'Loan, class. 0 attributes, 0 operations. Refers to Book; uses LoanStatus.'
		);
		expect(say('LoanStatus')).toBe('LoanStatus, enumeration. 3 literals. Loan uses it.');
		expect(say('Customer')).toBe('Customer, class. 2 attributes, 2 operations.');
		expect(say('a')).toBe('Loan to Book, association');
	});

	// Performance (M3): a 10 MB file has thousands of nodes, each with a summary; scanning the
	// diagram per node is quadratic, so the nodes share one index of relationships by end.
	it('reads the same with the shared relationship index, a self-association included', () => {
		const { project, diagram } = library();
		project.elements.set(
			'self',
			createRelationship({
				id: 'self',
				relationshipKind: 'association',
				sourceId: 'Loan',
				targetId: 'Loan'
			})
		);
		diagram.elementIds.push('self');
		diagram.layout.set('self', defaultEdgeLayout());
		const index = relationshipsByEnd(project, diagram);
		for (const id of diagram.elementIds)
			expect(elementSummary(project, diagram, id, { index })).toBe(
				elementSummary(project, diagram, id)
			);
		expect(elementSummary(project, diagram, 'Loan', { index })).toBe(
			'Loan, class. 0 attributes, 0 operations. Refers to Book; uses LoanStatus; refers to Loan.'
		);
	});

	it('adds the key hint when asked, for the first element focused on entering the diagram', () => {
		const { project, diagram } = library();
		expect(elementSummary(project, diagram, 'Book', { hint: true })).toMatch(
			/refers to it\. Arrow keys move, Enter edits, L links, Tab for members, Esc steps out\.$/
		);
	});
});
