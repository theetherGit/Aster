import { describe, expect, it } from 'vitest';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createClassifier, createRelationship } from '#lib/model/project.ts';
import {
	ROOT,
	buildRows,
	diagramRowId,
	parentIndex,
	rowIdFor,
	typeAheadIndex
} from '#lib/panels/tree.ts';

const D1 = diagramRowId('d1');

describe('explorer tree rows', () => {
	const project = sampleProject();

	it('collapses to the project row alone', () => {
		const rows = buildRows(project, new Set());
		expect(rows.map((r) => r.id)).toEqual([ROOT]);
		expect(rows[0]).toMatchObject({ level: 1, hasChildren: true, expanded: false });
	});

	it('lists diagrams under the project and classifiers under their diagram, with ARIA positions', () => {
		expect(buildRows(project, new Set([ROOT])).map((r) => r.id)).toEqual([ROOT, D1]);
		const rows = buildRows(project, new Set([ROOT, D1]));
		expect(rows.map((r) => r.id)).toEqual([
			ROOT,
			D1,
			rowIdFor('Account', 'd1'),
			rowIdFor('Customer', 'd1')
		]);
		expect(rows[1]).toMatchObject({ level: 2, hasChildren: true, expanded: true });
		expect(rows[1].hint).toBeUndefined();
		expect(rows[2]).toMatchObject({
			level: 3,
			posinset: 1,
			setsize: 2,
			hasChildren: true,
			elementId: 'Account',
			diagramId: 'd1',
			italic: true,
			hint: 'abstract'
		});
		expect(rows[3]).toMatchObject({ italic: false });
		expect(rows[3].hint).toBeUndefined();
	});

	it('hints only what the name does not say', () => {
		const p = sampleProject();
		p.elements.set(
			'I',
			createClassifier({ id: 'I', name: 'Searchable', classifierKind: 'interface' })
		);
		p.elements.set('E', createClassifier({ id: 'E', name: 'Status', classifierKind: 'enum' }));
		const rows = buildRows(p, new Set([ROOT]));
		// Not on any diagram: directly under the project.
		expect(rows.slice(-2).map((r) => [r.id, r.level, r.hint])).toEqual([
			[rowIdFor('I'), 2, 'interface'],
			[rowIdFor('E'), 2, 'enum']
		]);
	});

	it('interleaves members under an expanded classifier', () => {
		const cust = rowIdFor('Customer', 'd1');
		const rows = buildRows(project, new Set([ROOT, D1, cust]));
		const ids = rows.map((r) => r.id);
		expect(ids.slice(-5)).toEqual([
			cust,
			`${cust}/member:Customer-a0`,
			`${cust}/member:Customer-a1`,
			`${cust}/member:Customer-o0`,
			`${cust}/member:Customer-o1`
		]);
		expect(rows.at(-1)).toMatchObject({
			level: 4,
			posinset: 4,
			setsize: 4,
			label: '+ operation1(value: int): void'
		});
		expect(parentIndex(rows, rows.length - 1)).toBe(ids.indexOf(cust));
	});

	it('gives a classifier on two diagrams a row under each', () => {
		const p = sampleProject();
		p.diagrams.push({ ...p.diagrams[0], id: 'd2', name: 'Second', elementIds: ['Account'] });
		const rows = buildRows(p, new Set([ROOT, D1, diagramRowId('d2')]));
		expect(rows.filter((r) => r.elementId === 'Account').map((r) => r.id)).toEqual([
			rowIdFor('Account', 'd1'),
			rowIdFor('Account', 'd2')
		]);
	});

	it('type-ahead finds the next match and cycles on a repeated character', () => {
		const rows = buildRows(project, new Set([ROOT, D1]));
		expect(typeAheadIndex(rows, 0, 'c')).toBe(3);
		expect(typeAheadIndex(rows, 3, 'c')).toBe(3); // only one C row; cycles back to itself
		expect(typeAheadIndex(rows, 0, 'acc')).toBe(2);
		expect(typeAheadIndex(rows, 0, 'zzz')).toBe(-1);
	});

	it('lists relationships under their source classifier, after its members', () => {
		const p = sampleProject();
		p.elements.set(
			'r1',
			createRelationship({
				id: 'r1',
				relationshipKind: 'generalization',
				sourceId: 'Customer',
				targetId: 'Account'
			})
		);
		p.elements.set(
			'r2',
			createRelationship({
				id: 'r2',
				relationshipKind: 'association',
				sourceId: 'Account',
				targetId: 'Customer',
				name: 'serves'
			})
		);
		const cust = rowIdFor('Customer', 'd1');
		const collapsed = buildRows(p, new Set([ROOT, D1]));
		expect(collapsed.find((r) => r.id === cust)?.hasChildren).toBe(true);
		const rows = buildRows(p, new Set([ROOT, D1, cust]));
		const last = rows.at(-1)!;
		expect(last).toMatchObject({
			id: rowIdFor('r1', 'd1'),
			elementId: 'r1',
			level: 4,
			label: 'generalization to Account'
		});
		expect(rows.some((r) => r.elementId === 'r2')).toBe(false);
		const acc = buildRows(p, new Set([ROOT, D1, rowIdFor('Account', 'd1')]));
		expect(acc.find((r) => r.elementId === 'r2')?.label).toBe('serves: association to Customer');
	});
});
