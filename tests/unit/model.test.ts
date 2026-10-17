import { describe, expect, it } from 'vitest';
import {
	classifiersOf,
	createAttribute,
	createClassifier,
	createDiagram,
	createOperation,
	createProject,
	elementName,
	getClassifier,
	getDiagram,
	getElement,
	getNodeLayout,
	nextClassName
} from '#lib/model/project.ts';
import { fixtureClassifier, sampleProject } from '#lib/model/fixtures.ts';
import { DEFAULT_DISPLAY_FLAGS } from '#lib/model/types.ts';

describe('model factories', () => {
	it('creates a project with id-keyed element map and no diagrams', () => {
		const p = createProject({ name: 'X' });
		expect(p.id).toHaveLength(22);
		expect(p.name).toBe('X');
		expect(p.elements.size).toBe(0);
		expect(p.diagrams).toEqual([]);
	});

	it('creates a diagram with a copy of the default display flags', () => {
		const d = createDiagram();
		expect(d.defaults).toEqual(DEFAULT_DISPLAY_FLAGS);
		expect(d.defaults).not.toBe(DEFAULT_DISPLAY_FLAGS);
		expect(d.layout.size).toBe(0);
	});

	it('creates a class with sensible defaults and omits unset optionals', () => {
		const c = createClassifier({ name: 'Book' });
		expect(c).toMatchObject({ kind: 'classifier', classifierKind: 'class', isAbstract: false });
		expect('stereotype' in c).toBe(false);
		expect(createAttribute({ name: 'a' }).visibility).toBe('private');
		expect(createOperation({ name: 'o' }).visibility).toBe('public');
	});

	it('picks the first free default class name', () => {
		const p = createProject();
		expect(nextClassName(p)).toBe('Class1');
		p.elements.set('x', createClassifier({ id: 'x', name: 'Class1' }));
		expect(nextClassName(p)).toBe('Class2');
		expect(nextClassName(p, 'enum')).toBe('Enum1');
	});
});

describe('model readers', () => {
	const p = sampleProject();

	it('reads elements, classifiers, diagrams and layouts by id', () => {
		expect(getElement(p, 'Account').kind).toBe('classifier');
		expect(getClassifier(p, 'Account').attributes).toHaveLength(10);
		expect(getDiagram(p, 'd1').elementIds).toEqual(['Account', 'Customer']);
		expect(getNodeLayout(getDiagram(p, 'd1'), 'Account')).toMatchObject({ x: 120, y: 80 });
		expect(classifiersOf(p).map((c) => c.name)).toEqual(['Account', 'Customer']);
	});

	it('throws on missing ids and wrong kinds', () => {
		expect(() => getElement(p, 'nope')).toThrow();
		expect(() => getDiagram(p, 'nope')).toThrow();
		expect(() => getNodeLayout(getDiagram(p, 'd1'), 'nope')).toThrow();
	});

	it('names every element kind', () => {
		expect(elementName(getElement(p, 'Account'))).toBe('Account');
		expect(elementName({ kind: 'note', id: 'n', text: 'hi', linkedIds: [] })).toBe('hi');
	});
});

describe('fixtures', () => {
	it('fixture classifier has n attributes and n operations with statics', () => {
		const c = fixtureClassifier('C', 10);
		expect(c.attributes).toHaveLength(10);
		expect(c.operations).toHaveLength(10);
		expect(c.attributes.filter((a) => a.isStatic)).toHaveLength(4);
	});
});
