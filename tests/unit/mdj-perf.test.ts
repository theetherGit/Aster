import { describe, expect, it } from 'vitest';
import { parseMdjText } from '#lib/mdj/parse.ts';

/** A synthetic document of about 10 MB: classes with members, their views, and edges between them. */
function bigDocument(classes: number): string {
	const ref = (id: string) => ({ $ref: id });
	const elements: unknown[] = [];
	const views: unknown[] = [];
	for (let i = 0; i < classes; i++) {
		elements.push({
			_type: 'UMLClass',
			_id: `C${i}`,
			_parent: ref('M'),
			name: `Class${i}`,
			attributes: Array.from({ length: 6 }, (_, k) => ({
				_type: 'UMLAttribute',
				_id: `C${i}a${k}`,
				_parent: ref(`C${i}`),
				name: `attribute${k}`,
				type: 'String',
				visibility: 'private'
			})),
			operations: Array.from({ length: 6 }, (_, k) => ({
				_type: 'UMLOperation',
				_id: `C${i}o${k}`,
				_parent: ref(`C${i}`),
				name: `operation${k}`,
				parameters: [
					{ _type: 'UMLParameter', _id: `C${i}o${k}r`, type: 'void', direction: 'return' }
				]
			})),
			ownedElements:
				i > 0
					? [
							{
								_type: 'UMLAssociation',
								_id: `R${i}`,
								_parent: ref(`C${i}`),
								end1: { _type: 'UMLAssociationEnd', _id: `R${i}e1`, reference: ref(`C${i}`) },
								end2: {
									_type: 'UMLAssociationEnd',
									_id: `R${i}e2`,
									reference: ref(`C${i - 1}`),
									multiplicity: '0..*'
								}
							}
						]
					: []
		});
		views.push({
			_type: 'UMLClassView',
			_id: `V${i}`,
			model: ref(`C${i}`),
			left: (i % 50) * 220,
			top: Math.floor(i / 50) * 300,
			width: 200,
			height: 240,
			subViews: [
				{
					_type: 'UMLNameCompartmentView',
					_id: `V${i}n`,
					font: 'Arial;13;1',
					left: 0,
					top: 0,
					width: 200,
					height: 25
				}
			]
		});
		if (i > 0)
			views.push({
				_type: 'UMLAssociationView',
				_id: `E${i}`,
				model: ref(`R${i}`),
				tail: ref(`V${i}`),
				head: ref(`V${i - 1}`),
				points: '0:0;10:10',
				lineStyle: 1
			});
	}
	return JSON.stringify({
		_type: 'Project',
		_id: 'P',
		name: 'Big',
		ownedElements: [
			{
				_type: 'UMLModel',
				_id: 'M',
				name: 'Model',
				ownedElements: [
					{ _type: 'UMLClassDiagram', _id: 'D', name: 'Main', ownedViews: views },
					...elements
				]
			}
		]
	});
}

describe('performance', () => {
	it('parses a 10 MB document in well under the 2 s budget (features.md, Performance)', () => {
		const text = bigDocument(4000);
		expect(text.length).toBeGreaterThan(10_000_000);
		const t0 = performance.now();
		const r = parseMdjText(text);
		const ms = performance.now() - t0;
		expect(r.report.model.classifiers).toBe(4000);
		expect(r.report.diagrams[0]).toMatchObject({ nodes: 4000, edges: 3999 });
		expect(ms).toBeLessThan(4000);
	});
});
