import { describe, expect, it } from 'vitest';
import { labelsFor, markersFor } from '#lib/canvas/edges/notation.ts';
import { createRelationship } from '#lib/model/project.ts';
import { DEFAULT_DISPLAY_FLAGS, type RelationshipKind } from '#lib/model/types.ts';

const rel = (relationshipKind: RelationshipKind, extra = {}) =>
	createRelationship({ id: 'r', relationshipKind, sourceId: 'A', targetId: 'B', ...extra });

describe('UML 2.5 markers', () => {
	it('picks the marker and dash for each kind; diamonds and triangles sit at the target', () => {
		expect(markersFor(rel('generalization'))).toEqual({
			start: null,
			end: 'triangle',
			dashed: false,
			dots: []
		});
		expect(markersFor(rel('realization'))).toEqual({
			start: null,
			end: 'triangle',
			dashed: true,
			dots: []
		});
		expect(markersFor(rel('dependency'))).toEqual({
			start: null,
			end: 'arrow',
			dashed: true,
			dots: []
		});
		expect(markersFor(rel('aggregation')).end).toBe('diamond-hollow');
		expect(markersFor(rel('composition')).end).toBe('diamond-filled');
		expect(markersFor(rel('association'))).toEqual({
			start: null,
			end: null,
			dashed: false,
			dots: []
		});
	});

	it('draws an arrow at a navigable end only when the other end is not navigable', () => {
		const nav = (s: string, t: string) =>
			markersFor(
				rel('association', {
					sourceEnd: { navigable: s, isDerived: false, ownsOther: false },
					targetEnd: { navigable: t, isDerived: false, ownsOther: false }
				})
			);
		expect(nav('unspecified', 'navigable')).toMatchObject({ start: null, end: 'arrow' });
		expect(nav('navigable', 'notNavigable')).toMatchObject({ start: 'arrow', end: null });
		expect(nav('navigable', 'navigable')).toMatchObject({ start: null, end: null });
		// A diamond end keeps its diamond; the arrow can only go at the part end.
		const agg = markersFor(
			rel('composition', {
				sourceEnd: { navigable: 'navigable', isDerived: false, ownsOther: false },
				targetEnd: { navigable: 'unspecified', isDerived: false, ownsOther: false }
			})
		);
		expect(agg).toMatchObject({ start: 'arrow', end: 'diamond-filled' });
	});

	it('puts the ownership dot at the end opposite the owning class', () => {
		const m = markersFor(
			rel('association', {
				sourceEnd: { navigable: 'unspecified', isDerived: false, ownsOther: true },
				targetEnd: { navigable: 'unspecified', isDerived: false, ownsOther: false }
			})
		);
		expect(m.dots).toEqual(['target']);
	});
});

describe('edge labels', () => {
	it('name and stereotype at the middle; role and multiplicity at each association end', () => {
		const r = rel('association', {
			name: 'borrows',
			stereotype: 'use',
			sourceEnd: {
				role: 'member',
				multiplicity: '1',
				navigable: 'unspecified',
				visibility: 'private',
				isDerived: false,
				ownsOther: false
			},
			targetEnd: {
				role: 'loans',
				multiplicity: '0..*',
				navigable: 'navigable',
				isDerived: true,
				ownsOther: false
			}
		});
		expect(labelsFor(r, DEFAULT_DISPLAY_FLAGS)).toEqual([
			{ key: 'name', at: 'mid', lines: ['«use»', 'borrows'] },
			{ key: 'sourceRole', at: 'source', lines: ['-member'] },
			{ key: 'sourceMultiplicity', at: 'source', lines: ['1'] },
			{ key: 'targetRole', at: 'target', lines: ['/loans'] },
			{ key: 'targetMultiplicity', at: 'target', lines: ['0..*'] }
		]);
		const hidden = labelsFor(r, {
			...DEFAULT_DISPLAY_FLAGS,
			showVisibility: false,
			showMultiplicity: false
		});
		expect(hidden.map((l) => l.key)).toEqual(['name', 'sourceRole', 'targetRole']);
		expect(hidden[1].lines).toEqual(['member']);
	});

	it('a dependency with a stereotype shows it as the mid label', () => {
		expect(labelsFor(rel('dependency', { stereotype: 'use' }), DEFAULT_DISPLAY_FLAGS)).toEqual([
			{ key: 'name', at: 'mid', lines: ['«use»'] }
		]);
		expect(labelsFor(rel('generalization'), DEFAULT_DISPLAY_FLAGS)).toEqual([]);
	});
});
