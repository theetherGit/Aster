import { describe, expect, it } from 'vitest';
import {
	Stack,
	addMember,
	deleteMember,
	reorderMember,
	setClassifierFlags,
	setClassifierKind,
	setLiterals,
	setMemberText
} from '#lib/commands/index.ts';
import { memberFromText, renderAttribute } from '#lib/mdj/expression.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { getClassifier } from '#lib/model/project.ts';
import type { Attribute } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

function setup() {
	const project = sampleProject();
	const stack = new Stack(() => project);
	return { project, stack, customer: () => getClassifier(project, 'Customer') };
}

describe('member commands', () => {
	it('addMember inserts at an index and undo removes it', () => {
		const { project, stack, customer } = setup();
		const before = structural(project);
		const member = memberFromText('attribute', '-isbn: String', 'new');
		expect(
			stack.run(
				addMember(project, { classifierId: 'Customer', kind: 'attribute', member, index: 1 })
			)
		).toBe('add isbn to Customer');
		expect(customer().attributes.map((a) => a.id)).toEqual(['Customer-a0', 'new', 'Customer-a1']);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('setMemberText parses on commit and keeps unparseable text verbatim with raw', () => {
		const { project, stack, customer } = setup();
		stack.run(
			setMemberText(project, {
				classifierId: 'Customer',
				kind: 'attribute',
				memberId: 'Customer-a0',
				text: '#{static} total: Money = 0'
			})
		);
		const a = customer().attributes[0];
		expect(a).toMatchObject({
			id: 'Customer-a0',
			name: 'total',
			type: 'Money',
			visibility: 'protected',
			isStatic: true,
			defaultValue: '0'
		});
		expect(a.raw).toBeUndefined();

		stack.run(
			setMemberText(project, {
				classifierId: 'Customer',
				kind: 'attribute',
				memberId: 'Customer-a0',
				text: '+total: Money[0..'
			})
		);
		const broken = customer().attributes[0];
		expect(broken.raw).toBe('+total: Money[0..');
		expect(broken.name).toBe('total');
		expect(renderAttribute(broken)).toBe('+total: Money[0..');

		stack.undo();
		expect(customer().attributes[0].raw).toBeUndefined();
		stack.undo();
		expect(customer().attributes[0].name).toBe('attribute0');
	});

	it('setMemberText on an operation keeps documentation and id', () => {
		const { project, stack, customer } = setup();
		customer().operations[0].documentation = 'kept';
		stack.run(
			setMemberText(project, {
				classifierId: 'Customer',
				kind: 'operation',
				memberId: 'Customer-o0',
				text: '-run(x: int): void {query}'
			})
		);
		expect(customer().operations[0]).toMatchObject({
			id: 'Customer-o0',
			documentation: 'kept',
			name: 'run',
			isQuery: true,
			visibility: 'private'
		});
	});

	it('reorderMember moves within the list, clamps, and inverts', () => {
		const { project, stack, customer } = setup();
		stack.run(
			reorderMember(project, {
				classifierId: 'Customer',
				kind: 'operation',
				memberId: 'Customer-o0',
				to: 5
			})
		);
		expect(customer().operations.map((o) => o.id)).toEqual(['Customer-o1', 'Customer-o0']);
		stack.undo();
		expect(customer().operations.map((o) => o.id)).toEqual(['Customer-o0', 'Customer-o1']);
	});

	it('deleteMember restores at the same index on undo', () => {
		const { project, stack, customer } = setup();
		stack.run(
			deleteMember(project, {
				classifierId: 'Customer',
				kind: 'attribute',
				memberId: 'Customer-a0'
			})
		);
		expect(customer().attributes.map((a) => a.id)).toEqual(['Customer-a1']);
		expect(() =>
			deleteMember(project, {
				classifierId: 'Customer',
				kind: 'attribute',
				memberId: 'ghost'
			}).apply(project)
		).toThrow();
		stack.undo();
		expect(customer().attributes.map((a) => a.id)).toEqual(['Customer-a0', 'Customer-a1']);
	});

	it('setClassifierKind round-trips all four kinds and setLiterals replaces the list', () => {
		const { project, stack, customer } = setup();
		const before = structural(project);
		for (const kind of ['interface', 'enum', 'dataType', 'class'] as const) {
			stack.run(setClassifierKind(project, { id: 'Customer', classifierKind: kind }));
			expect(customer().classifierKind).toBe(kind);
		}
		expect(stack.undoLabel).toBe('make Customer class');
		stack.run(
			setLiterals(project, {
				id: 'Customer',
				literals: [{ id: 'l1', name: 'A', documentation: '' }]
			})
		);
		expect(customer().literals).toHaveLength(1);
		while (stack.canUndo) stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('setClassifierFlags handles isLeaf', () => {
		const { project, stack, customer } = setup();
		stack.run(setClassifierFlags(project, { id: 'Customer', flags: { isLeaf: true } }));
		expect(customer().isLeaf).toBe(true);
		stack.undo();
		expect(customer().isLeaf).toBe(false);
	});

	it('warning flag is simply the presence of raw', () => {
		const a = memberFromText('attribute', 'nope nope', 'x') as Attribute;
		expect(a.raw).toBeDefined();
	});
});
