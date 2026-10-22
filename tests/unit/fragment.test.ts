/**
 * features.md `.mdj` import / export, M3: "fragment import". StarUML's File › Import › Fragment
 * reads a `.mfj` (one element and everything it owns) as a child of the selected package; the
 * owner's ruling (2026-10-22) is StarUML's: model only, any diagrams inside come as new tabs.
 */
import { describe, expect, it } from 'vitest';
import { Stack, importFragment } from '#lib/commands/index.ts';
import { MdjError } from '#lib/mdj/parse.ts';
import { readFragment } from '#lib/mdj/fragment.ts';
import { serializeMdjText } from '#lib/mdj/serialize.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import type { Classifier, Package, Project, Relationship } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

const ref = (id: string) => ({ $ref: id });
const fragment = () => ({
	_type: 'UMLPackage',
	_id: 'FragPkg',
	_parent: ref('SomeoneElsesModel'),
	name: 'Payments',
	ownedElements: [
		{
			_type: 'UMLClassDiagram',
			_id: 'FragDia',
			_parent: ref('FragPkg'),
			name: 'Payments',
			ownedViews: [
				{
					_type: 'UMLClassView',
					_id: 'FragV1',
					_parent: ref('FragDia'),
					model: ref('FragInvoice'),
					left: 20,
					top: 20,
					width: 160,
					height: 80
				},
				{
					_type: 'UMLClassView',
					_id: 'FragV2',
					_parent: ref('FragDia'),
					model: ref('FragPayment'),
					left: 300,
					top: 20,
					width: 160,
					height: 80
				}
			]
		},
		{
			_type: 'UMLClass',
			_id: 'FragInvoice',
			_parent: ref('FragPkg'),
			name: 'Invoice',
			attributes: [
				{
					_type: 'UMLAttribute',
					_id: 'FragTotal',
					_parent: ref('FragInvoice'),
					name: 'total',
					type: 'Money'
				}
			],
			ownedElements: [
				{
					_type: 'UMLAssociation',
					_id: 'FragAssoc',
					_parent: ref('FragInvoice'),
					end1: {
						_type: 'UMLAssociationEnd',
						_id: 'FragEnd1',
						_parent: ref('FragAssoc'),
						reference: ref('FragInvoice')
					},
					end2: {
						_type: 'UMLAssociationEnd',
						_id: 'FragEnd2',
						_parent: ref('FragAssoc'),
						reference: ref('FragPayment'),
						multiplicity: '*'
					}
				}
			]
		},
		{ _type: 'UMLClass', _id: 'FragPayment', _parent: ref('FragPkg'), name: 'Payment' },
		{ _type: 'UMLUseCase', _id: 'FragPay', _parent: ref('FragPkg'), name: 'Pay' }
	]
});
const withShop = () => {
	const p = sampleProject();
	p.elements.set('Shop', {
		kind: 'package',
		id: 'Shop',
		name: 'Shop',
		memberIds: [],
		documentation: ''
	});
	return p;
};
const named = (p: Project, name: string) =>
	[...p.elements.values()].find((e) => 'name' in e && e.name === name)!;
/** Every object in a JSON tree, for finding what the serializer wrote. */
function* walk(o: unknown): Generator<Record<string, unknown>> {
	if (Array.isArray(o)) for (const v of o) yield* walk(v);
	else if (o && typeof o === 'object') {
		yield o as Record<string, unknown>;
		for (const [k, v] of Object.entries(o)) if (k !== '_parent') yield* walk(v);
	}
}

describe('fragment import', () => {
	it('adds the package, its classes, relationship and diagram as one undo step', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		const before = structural(project);
		const unknownBefore = project.unknown.length;
		const { payload, report } = readFragment(fragment(), project);
		expect(report.model.classifiers).toBe(2);
		expect(report.diagrams).toHaveLength(1);
		expect(stack.run(importFragment(project, payload))).toBe('import Payments');

		const pkg = project.elements.get('FragPkg') as Package;
		expect(pkg.kind).toBe('package');
		expect(pkg.parentId).toBeUndefined();
		expect((project.elements.get('FragInvoice') as Classifier).packageId).toBe('FragPkg');
		const assoc = project.elements.get('FragAssoc') as Relationship;
		expect([assoc.sourceId, assoc.targetId]).toEqual(['FragInvoice', 'FragPayment']);
		expect(project.diagrams.at(-1)?.name).toBe('Payments');
		expect(project.diagrams.at(-1)?.elementIds).toEqual(['FragInvoice', 'FragPayment']);
		expect(project.importedIds.has('FragInvoice')).toBe(true);

		stack.undo();
		expect(structural(project)).toEqual(before);
		expect(project.unknown).toHaveLength(unknownBefore);
	});

	it('goes under the chosen package and keeps what Aster does not model, through export', () => {
		const project = withShop();
		const stack = new Stack(() => project);
		stack.run(importFragment(project, readFragment(fragment(), project, 'Shop').payload));
		expect((project.elements.get('FragPkg') as Package).parentId).toBe('Shop');
		expect((project.elements.get('Shop') as Package).memberIds).toEqual(['FragPkg']);

		const json = JSON.parse(serializeMdjText(project));
		const shop = [...walk(json)].find((o) => o._id === 'Shop')!;
		const payments = (shop.ownedElements as Record<string, unknown>[]).find(
			(o) => o._id === 'FragPkg'
		)!;
		const kids = (payments.ownedElements as Record<string, unknown>[]).map((o) => o._type);
		expect(kids).toContain('UMLUseCase');
		expect(kids).toContain('UMLClass');

		stack.undo();
		expect((project.elements.get('Shop') as Package).memberIds).toEqual([]);
		expect([...walk(JSON.parse(serializeMdjText(project)))].some((o) => o._id === 'FragPay')).toBe(
			false
		);
	});

	it('mints fresh ids when the ids are taken, so importing twice gives two copies', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		stack.run(importFragment(project, readFragment(fragment(), project).payload));
		const second = readFragment(fragment(), project).payload;
		expect(second.elements.some((e) => e.id === 'FragInvoice')).toBe(false);
		stack.run(importFragment(project, second));
		const invoices = [...project.elements.values()].filter(
			(e) => e.kind === 'classifier' && e.name === 'Invoice'
		);
		expect(invoices).toHaveLength(2);
		const copy = second.elements.find((e) => e.kind === 'relationship') as Relationship;
		expect(copy.sourceId).toBe(
			second.elements.find((e) => 'name' in e && e.name === 'Invoice')!.id
		);
		expect(project.diagrams.filter((d) => d.name === 'Payments')).toHaveLength(2);
	});

	it('takes one class as a fragment, into the chosen package', () => {
		const project = withShop();
		const stack = new Stack(() => project);
		const one = { _type: 'UMLClass', _id: 'Lone', _parent: ref('x'), name: 'Receipt' };
		expect(stack.run(importFragment(project, readFragment(one, project, 'Shop').payload))).toBe(
			'import Receipt'
		);
		expect((named(project, 'Receipt') as Classifier).packageId).toBe('Shop');
		expect((project.elements.get('Shop') as Package).memberIds).toEqual(['Lone']);
	});

	it('refuses what is not a StarUML element', () => {
		const project = sampleProject();
		expect(() => readFragment({ name: 'nope' }, project)).toThrow(MdjError);
		expect(() => readFragment([1, 2], project)).toThrow(MdjError);
	});
});
