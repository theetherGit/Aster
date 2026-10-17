import {
	createAttribute,
	createClassifier,
	createDiagram,
	createOperation,
	createProject,
	createRelationship,
	defaultEdgeLayout,
	defaultNodeLayout
} from './project.ts';
import type { Classifier, End, LineStyle, Point, Project, Relationship } from './types.ts';

/** A classifier with `n` attributes and `n` operations; every third member static. */
export function fixtureClassifier(
	name: string,
	n = 0,
	extra: Partial<Omit<Classifier, 'kind'>> = {}
): Classifier {
	const attributes = Array.from({ length: n }, (_, i) =>
		createAttribute({
			id: `${name}-a${i}`,
			name: `attribute${i}`,
			type: i % 2 ? 'int' : 'String',
			visibility: i % 2 ? 'private' : 'protected',
			isStatic: i % 3 === 0
		})
	);
	const operations = Array.from({ length: n }, (_, i) =>
		createOperation({
			id: `${name}-o${i}`,
			name: `operation${i}`,
			returnType: i % 2 ? 'void' : 'boolean',
			parameters: i % 2 ? [{ name: 'value', type: 'int', direction: 'in' }] : [],
			isStatic: i % 3 === 0
		})
	);
	return createClassifier({ id: name, name, attributes, operations, ...extra });
}

/** One diagram, two classes. `Account` is abstract with 10 + 10 members. */
export function sampleProject(): Project {
	const project = createProject({ id: 'sample', name: 'Library' });
	const diagram = createDiagram({ id: 'd1', name: 'Main' });
	const account = fixtureClassifier('Account', 10, { isAbstract: true, stereotype: 'entity' });
	const customer = fixtureClassifier('Customer', 2);
	project.diagrams.push(diagram);
	for (const c of [account, customer]) {
		project.elements.set(c.id, c);
		diagram.elementIds.push(c.id);
	}
	diagram.layout.set(account.id, defaultNodeLayout(120, 80));
	diagram.layout.set(customer.id, defaultNodeLayout(480, 120));
	return project;
}

const end = (e: Partial<End> = {}): End => ({
	navigable: 'unspecified',
	isDerived: false,
	ownsOther: false,
	...e
});

/**
 * Every notation the canvas draws, laid out for a 1280 × 720 window: the six relationship
 * kinds, navigability arrows, the ownership dot, end labels, a «use» dependency, all four
 * line styles and a self-association. Loaded with `?fixture=notation`.
 */
export function notationProject(): Project {
	const project = createProject({ id: 'notation', name: 'UML notation' });
	const diagram = createDiagram({ id: 'd1', name: 'Library' });
	project.diagrams.push(diagram);
	const place = (c: Classifier, x: number, y: number) => {
		project.elements.set(c.id, c);
		diagram.elementIds.push(c.id);
		diagram.layout.set(c.id, defaultNodeLayout(x, y));
	};
	const attr = (name: string, type: string, visibility: 'private' | 'protected' = 'private') =>
		createAttribute({ id: `${name}`, name, type, visibility });
	const op = (
		name: string,
		returnType: string,
		parameters: { name: string; type: string }[] = []
	) =>
		createOperation({
			id: `${name}()`,
			name,
			returnType,
			parameters: parameters.map((p) => ({ ...p, direction: 'in' as const }))
		});

	place(
		createClassifier({
			id: 'Person',
			name: 'Person',
			isAbstract: true,
			attributes: [attr('name', 'String', 'protected')],
			operations: [op('getName', 'String')]
		}),
		100,
		30
	);
	place(
		createClassifier({ id: 'Member', name: 'Member', attributes: [attr('memberId', 'String')] }),
		100,
		290
	);
	place(
		createClassifier({
			id: 'Library',
			name: 'Library',
			attributes: [attr('libraryName', 'String')]
		}),
		520,
		30
	);
	place(
		createClassifier({
			id: 'Book',
			name: 'Book',
			attributes: [attr('isbn', 'String'), attr('title', 'String')]
		}),
		520,
		290
	);
	place(
		createClassifier({
			id: 'Searchable',
			name: 'Searchable',
			classifierKind: 'interface',
			operations: [op('search', 'Book', [{ name: 'q', type: 'String' }])]
		}),
		920,
		290
	);
	place(
		createClassifier({
			id: 'Loan',
			name: 'Loan',
			attributes: [attr('dueDate', 'Date')],
			operations: [op('isOverdue', 'boolean')]
		}),
		300,
		480
	);
	place(
		createClassifier({
			id: 'LoanStatus',
			name: 'LoanStatus',
			classifierKind: 'enum',
			literals: ['ACTIVE', 'RETURNED', 'OVERDUE'].map((n) => ({
				id: n,
				name: n,
				documentation: ''
			}))
		}),
		740,
		470
	);
	place(
		createClassifier({ id: 'Category', name: 'Category', attributes: [attr('label', 'String')] }),
		920,
		60
	);

	const link = (r: Relationship, lineStyle: LineStyle = 'oblique', waypoints: Point[] = []) => {
		project.elements.set(r.id, r);
		diagram.elementIds.push(r.id);
		diagram.layout.set(r.id, { ...defaultEdgeLayout(), lineStyle, waypoints });
	};
	link(
		createRelationship({
			id: 'gen',
			relationshipKind: 'generalization',
			sourceId: 'Member',
			targetId: 'Person'
		})
	);
	link(
		createRelationship({
			id: 'real',
			relationshipKind: 'realization',
			sourceId: 'Book',
			targetId: 'Searchable'
		})
	);
	link(
		createRelationship({
			id: 'comp',
			relationshipKind: 'composition',
			sourceId: 'Book',
			targetId: 'Library',
			sourceEnd: end({ role: 'books', multiplicity: '0..*' }),
			targetEnd: end({ multiplicity: '1' })
		})
	);
	link(
		createRelationship({
			id: 'agg',
			relationshipKind: 'aggregation',
			sourceId: 'Member',
			targetId: 'Library',
			sourceEnd: end({ role: 'members', multiplicity: '*' }),
			targetEnd: end({ multiplicity: '0..1' })
		}),
		'rectilinear'
	);
	link(
		createRelationship({
			id: 'assoc',
			relationshipKind: 'association',
			sourceId: 'Member',
			targetId: 'Loan',
			sourceEnd: end({ multiplicity: '1', navigable: 'notNavigable', ownsOther: true }),
			targetEnd: end({
				role: 'loans',
				multiplicity: '0..*',
				navigable: 'navigable',
				visibility: 'private'
			})
		}),
		'roundrect'
	);
	link(
		createRelationship({
			id: 'borrows',
			relationshipKind: 'association',
			name: 'borrows',
			sourceId: 'Loan',
			targetId: 'Book',
			sourceEnd: end({ navigable: 'navigable' }),
			targetEnd: end({ navigable: 'navigable', multiplicity: '1' })
		}),
		'curve',
		[{ x: 560, y: 450 }]
	);
	link(
		createRelationship({
			id: 'dep',
			relationshipKind: 'dependency',
			stereotype: 'use',
			sourceId: 'Loan',
			targetId: 'LoanStatus'
		})
	);
	link(
		createRelationship({
			id: 'tree',
			relationshipKind: 'association',
			sourceId: 'Category',
			targetId: 'Category',
			sourceEnd: end({ role: 'parent', multiplicity: '0..1' }),
			targetEnd: end({ role: 'children', multiplicity: '*' })
		})
	);
	return project;
}
