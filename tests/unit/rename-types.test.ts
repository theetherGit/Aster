import { describe, expect, it } from 'vitest';
import { Stack, renameClassifier } from '#lib/commands/index.ts';
import { rawMentions } from '#lib/model/project.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createAttribute, createClassifier, createOperation } from '#lib/model/project.ts';
import type { Classifier } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

/** Owner's M2 ruling #8: a rename rewrites the types that name the class; raw lines are left and counted. */
describe('renaming a class rewrites the types that name it', () => {
	function setup() {
		const project = sampleProject();
		const loan = createClassifier({
			id: 'Loan',
			name: 'Loan',
			attributes: [
				createAttribute({ id: 'a1', name: 'customer', type: 'Customer' }),
				createAttribute({ id: 'a2', name: 'others', type: 'List<Customer>' }),
				createAttribute({
					id: 'a3',
					name: 'kept',
					raw: '- customer: Customer = ?',
					type: undefined
				})
			],
			operations: [
				createOperation({
					id: 'o1',
					name: 'swap',
					returnType: 'Customer',
					parameters: [
						{ name: 'a', type: 'Customer', direction: 'in' },
						{ name: 'b', type: 'Client', direction: 'in' }
					]
				})
			]
		});
		project.elements.set(loan.id, loan);
		return {
			project,
			stack: new Stack(() => project),
			loan: () => project.elements.get('Loan') as Classifier
		};
	}

	it('rewrites attribute types, return types and parameter types equal to the old name', () => {
		const { project, stack, loan } = setup();
		stack.run(renameClassifier(project, { id: 'Customer', name: 'Client' }));
		const l = loan();
		expect(l.attributes.map((a) => a.type)).toEqual(['Client', 'List<Customer>', undefined]);
		expect(l.operations[0].returnType).toBe('Client');
		expect(l.operations[0].parameters.map((p) => p.type)).toEqual(['Client', 'Client']);
	});

	it('undoes exactly: a type that already said the new name stays', () => {
		const { project, stack } = setup();
		const before = structural(project);
		stack.run(renameClassifier(project, { id: 'Customer', name: 'Client' }));
		stack.undo();
		expect(structural(project)).toEqual(before);
		stack.redo();
		expect((project.elements.get('Loan') as Classifier).operations[0].parameters[1].type).toBe(
			'Client'
		);
	});

	it('counts the unparsed lines that still mention the old name, as whole words', () => {
		const { project } = setup();
		expect(rawMentions(project, 'Customer')).toBe(1);
		expect(rawMentions(project, 'Cust')).toBe(0);
	});
});
