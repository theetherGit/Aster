import { describe, expect, it } from 'vitest';
import { Stack, flipRelationship } from '#lib/commands/index.ts';
import { validate, type RuleId } from '#lib/model/validate.ts';
import {
	createAttribute,
	createClassifier,
	createDiagram,
	createOperation,
	createProject,
	createRelationship,
	defaultEdgeLayout,
	defaultNodeLayout
} from '#lib/model/project.ts';
import type { Classifier, Project, Relationship, RelationshipKind } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

/**
 * features.md M2: StarUML's class-diagram rules UML001–012 (UML005 does not exist; UML012 holds
 * by construction, see DECISIONS.md) and Aster's ASTER001. Each rule: a fixture that triggers it
 * and one that does not.
 */
function project(
	classes: Classifier[],
	rels: [RelationshipKind, string, string, Partial<Relationship>?][] = []
) {
	const p = createProject({ id: 'p', name: 'P' });
	const d = createDiagram({ id: 'd', name: 'D' });
	p.diagrams.push(d);
	classes.forEach((c, i) => {
		p.elements.set(c.id, c);
		d.elementIds.push(c.id);
		d.layout.set(c.id, defaultNodeLayout(i * 200, 0));
	});
	rels.forEach(([relationshipKind, sourceId, targetId, extra], i) => {
		const r = createRelationship({ id: `r${i}`, relationshipKind, sourceId, targetId, ...extra });
		p.elements.set(r.id, r);
		d.elementIds.push(r.id);
		d.layout.set(r.id, defaultEdgeLayout());
	});
	return p;
}
const cls = (name: string, extra: Partial<Classifier> = {}) =>
	createClassifier({ id: name, name, ...extra });
const attr = (name: string, extra = {}) =>
	createAttribute({ id: `${name}-${Math.random()}`, name, ...extra });
const op = (name: string, types: string[] = [], extra = {}) =>
	createOperation({
		id: `${name}-${Math.random()}`,
		name,
		parameters: types.map((type, i) => ({ name: `p${i}`, type, direction: 'in' as const })),
		...extra
	});
const rules = (p: Project, rule: RuleId) => validate(p).filter((f) => f.rule === rule);

describe('UML001 Name expected', () => {
	it('flags an unnamed class, an unnamed operation and an unnamed untyped attribute', () => {
		const p = project([
			cls('A', { name: '' }),
			cls('B', { attributes: [attr('')], operations: [op('')] })
		]);
		expect(rules(p, 'UML001').map((f) => f.elementId)).toEqual(['A', 'B', 'B']);
	});
	it('lets an unnamed attribute pass when it has a type, as StarUML does', () => {
		const p = project([cls('B', { attributes: [attr('', { type: 'int' })] })]);
		expect(rules(p, 'UML001')).toEqual([]);
	});
});

describe('UML002 Name is already defined', () => {
	it('flags two classes of one name, and two attributes of one name in a class', () => {
		const p = project([
			createClassifier({ id: 'a1', name: 'Account' }),
			createClassifier({ id: 'a2', name: 'Account' }),
			cls('B', { attributes: [attr('x'), attr('x')] })
		]);
		expect(rules(p, 'UML002').map((f) => [f.elementId, f.subject])).toEqual([
			['a1', 'Account'],
			['a2', 'Account'],
			['B', 'x'],
			['B', 'x']
		]);
	});
	it('allows overloaded operations (StarUML exempts operations)', () => {
		const p = project([cls('B', { operations: [op('f'), op('f', ['int'])] })]);
		expect(rules(p, 'UML002')).toEqual([]);
	});
});

describe('UML003 Conflict with inherited attributes', () => {
	it('flags an attribute that repeats one from an ancestor, two levels up', () => {
		const p = project(
			[
				cls('Base', { attributes: [attr('id')] }),
				cls('Mid'),
				cls('Leaf', { attributes: [attr('id')] })
			],
			[
				['generalization', 'Mid', 'Base'],
				['generalization', 'Leaf', 'Mid']
			]
		);
		expect(rules(p, 'UML003').map((f) => [f.elementId, f.subject])).toEqual([['Leaf', 'id']]);
	});
	it('ignores the same name in an unrelated class', () => {
		const p = project([
			cls('A', { attributes: [attr('id')] }),
			cls('B', { attributes: [attr('id')] })
		]);
		expect(rules(p, 'UML003')).toEqual([]);
	});
});

describe('UML004 Signature conflict', () => {
	it('flags two operations with one name and the same parameter types', () => {
		const p = project([cls('A', { operations: [op('f', ['int']), op('f', ['int'])] })]);
		expect(rules(p, 'UML004')).toHaveLength(2);
	});
	it('allows an overload with other parameter types', () => {
		const p = project([cls('A', { operations: [op('f', ['int']), op('f', ['String'])] })]);
		expect(rules(p, 'UML004')).toEqual([]);
	});
});

describe('UML006 Final and leaf element must not have child', () => {
	it('flags a leaf class that something generalizes', () => {
		const p = project(
			[cls('Leaf', { isLeaf: true }), cls('Child')],
			[['generalization', 'Child', 'Leaf']]
		);
		expect(rules(p, 'UML006').map((f) => f.elementId)).toEqual(['Leaf']);
	});
	it('lets a leaf class without children pass', () => {
		const p = project(
			[cls('Leaf', { isLeaf: true }), cls('Child')],
			[['generalization', 'Leaf', 'Child']]
		);
		expect(rules(p, 'UML006')).toEqual([]);
	});
});

describe('UML007 Duplicated generalizations, UML009 Duplicated realizations', () => {
	it('flags the child once per duplicated pair', () => {
		const p = project(
			[cls('A'), cls('B'), cls('I', { classifierKind: 'interface' })],
			[
				['generalization', 'A', 'B'],
				['generalization', 'A', 'B'],
				['realization', 'A', 'I'],
				['realization', 'A', 'I']
			]
		);
		expect(rules(p, 'UML007').map((f) => f.elementId)).toEqual(['A']);
		expect(rules(p, 'UML009').map((f) => f.elementId)).toEqual(['A']);
	});
	it('lets one of each pass', () => {
		const p = project(
			[cls('A'), cls('B'), cls('I', { classifierKind: 'interface' })],
			[
				['generalization', 'A', 'B'],
				['realization', 'A', 'I']
			]
		);
		expect(rules(p, 'UML007')).toEqual([]);
		expect(rules(p, 'UML009')).toEqual([]);
	});
});

describe('UML008 Circular generalizations', () => {
	it('flags every class in the cycle', () => {
		const p = project(
			[cls('A'), cls('B'), cls('C'), cls('D')],
			[
				['generalization', 'A', 'B'],
				['generalization', 'B', 'C'],
				['generalization', 'C', 'A'],
				['generalization', 'D', 'A']
			]
		);
		expect(rules(p, 'UML008').map((f) => f.elementId)).toEqual(['A', 'B', 'C']);
	});
	it('lets a chain pass', () => {
		const p = project(
			[cls('A'), cls('B'), cls('C')],
			[
				['generalization', 'A', 'B'],
				['generalization', 'B', 'C']
			]
		);
		expect(rules(p, 'UML008')).toEqual([]);
	});
});

describe('UML010 Duplicated role names of associated classifiers', () => {
	const end = (role: string) => ({
		role,
		navigable: 'unspecified' as const,
		isDerived: false,
		isOrdered: false,
		isUnique: false,
		ownsOther: false
	});
	it('flags a class that sees two associated classes under one role', () => {
		const p = project(
			[cls('Loan'), cls('Book'), cls('Member')],
			[
				['association', 'Loan', 'Book', { targetEnd: end('item') }],
				['association', 'Member', 'Loan', { sourceEnd: end('item') }]
			]
		);
		expect(rules(p, 'UML010').map((f) => [f.elementId, f.subject])).toEqual([['Loan', 'item']]);
	});
	it('lets distinct roles pass', () => {
		const p = project(
			[cls('Loan'), cls('Book'), cls('Member')],
			[
				['association', 'Loan', 'Book', { targetEnd: end('book') }],
				['association', 'Member', 'Loan', { sourceEnd: end('borrower') }]
			]
		);
		expect(rules(p, 'UML010')).toEqual([]);
	});
});

describe('UML011 All attributes and operations of interface must be public', () => {
	it('flags a private attribute and a protected operation on an interface', () => {
		const p = project([
			cls('I', {
				classifierKind: 'interface',
				attributes: [attr('x', { visibility: 'private' })],
				operations: [op('f', [], { visibility: 'protected' })]
			})
		]);
		expect(rules(p, 'UML011').map((f) => f.subject)).toEqual(['x', 'f']);
	});
	it('lets public members pass, and private members of a class', () => {
		const p = project([
			cls('I', { classifierKind: 'interface', operations: [op('f')] }),
			cls('C', { attributes: [attr('x', { visibility: 'private' })] })
		]);
		expect(rules(p, 'UML011')).toEqual([]);
	});
});

describe('ASTER001 flipped generalization', () => {
	it('warns when an abstract class or an interface is drawn as the child of a concrete class', () => {
		const p = project(
			[
				cls('Person', { isAbstract: true }),
				cls('Member'),
				cls('Named', { classifierKind: 'interface' })
			],
			[
				['generalization', 'Person', 'Member'],
				['generalization', 'Named', 'Member']
			]
		);
		expect(rules(p, 'ASTER001').map((f) => [f.elementId, f.subject, f.detail])).toEqual([
			['r0', 'Person', 'abstract'],
			['r1', 'Named', 'interface']
		]);
	});
	it('never warns concrete over concrete, or abstract over abstract', () => {
		const p = project(
			[cls('A'), cls('B'), cls('X', { isAbstract: true }), cls('Y', { isAbstract: true })],
			[
				['generalization', 'A', 'B'],
				['generalization', 'X', 'Y'],
				['generalization', 'A', 'X']
			]
		);
		expect(rules(p, 'ASTER001')).toEqual([]);
	});
	it('Flip swaps the ends and clears it, as one undo step', () => {
		const p = project(
			[cls('Person', { isAbstract: true }), cls('Member')],
			[['generalization', 'Person', 'Member']]
		);
		p.diagrams[0].layout.set('r0', {
			...defaultEdgeLayout(),
			waypoints: [
				{ x: 1, y: 2 },
				{ x: 3, y: 4 }
			]
		});
		const before = structural(p);
		const stack = new Stack(() => p);
		expect(stack.run(flipRelationship(p, { id: 'r0' }))).toBe(
			'flip generalization Person to Member'
		);
		const r = p.elements.get('r0') as Relationship;
		expect([r.sourceId, r.targetId]).toEqual(['Member', 'Person']);
		// The line keeps its course: waypoints read from the new source.
		expect(p.diagrams[0].layout.get('r0')).toMatchObject({
			waypoints: [
				{ x: 3, y: 4 },
				{ x: 1, y: 2 }
			]
		});
		expect(rules(p, 'ASTER001')).toEqual([]);
		stack.undo();
		expect(structural(p)).toEqual(before);
	});
});
