import {
	createAttribute,
	createClassifier,
	createDiagram,
	createOperation,
	createProject,
	defaultNodeLayout
} from './project.ts';
import type { Classifier, Project } from './types.ts';

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
