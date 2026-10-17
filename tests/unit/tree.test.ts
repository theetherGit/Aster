import { describe, expect, it } from 'vitest';
import { sampleProject } from '#lib/model/fixtures.ts';
import { ROOT, buildRows, parentIndex, rowIdFor, typeAheadIndex } from '#lib/panels/tree.ts';

describe('explorer tree rows', () => {
	const project = sampleProject();

	it('collapses to the project row alone', () => {
		const rows = buildRows(project, new Set());
		expect(rows.map((r) => r.id)).toEqual([ROOT]);
		expect(rows[0]).toMatchObject({ level: 1, hasChildren: true, expanded: false });
	});

	it('lists diagrams then classifiers under an expanded project, with ARIA positions', () => {
		const rows = buildRows(project, new Set([ROOT]));
		expect(rows.map((r) => r.id)).toEqual([
			ROOT,
			'diagram:d1',
			rowIdFor('Account'),
			rowIdFor('Customer')
		]);
		expect(rows[2]).toMatchObject({
			level: 2,
			posinset: 2,
			setsize: 3,
			hasChildren: true,
			elementId: 'Account'
		});
	});

	it('interleaves members under an expanded classifier', () => {
		const rows = buildRows(project, new Set([ROOT, rowIdFor('Customer')]));
		const ids = rows.map((r) => r.id);
		expect(ids.slice(-5)).toEqual([
			rowIdFor('Customer'),
			'member:Customer:Customer-a0',
			'member:Customer:Customer-a1',
			'member:Customer:Customer-o0',
			'member:Customer:Customer-o1'
		]);
		expect(rows.at(-1)).toMatchObject({
			level: 3,
			posinset: 4,
			setsize: 4,
			label: '+operation1(value: int): void'
		});
		expect(parentIndex(rows, rows.length - 1)).toBe(ids.indexOf(rowIdFor('Customer')));
	});

	it('type-ahead finds the next match and cycles on a repeated character', () => {
		const rows = buildRows(project, new Set([ROOT]));
		expect(typeAheadIndex(rows, 0, 'c')).toBe(3);
		expect(typeAheadIndex(rows, 3, 'c')).toBe(3); // only one C row; cycles back to itself
		expect(typeAheadIndex(rows, 0, 'acc')).toBe(2);
		expect(typeAheadIndex(rows, 0, 'zzz')).toBe(-1);
	});
});
