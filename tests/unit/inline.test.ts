import { beforeEach, describe, expect, it } from 'vitest';
import { addLineBelow, commitName, moveCompartment } from '#lib/canvas/inline.ts';
import { addMember, deleteMember, membersOf, setClassifierKind } from '#lib/commands/index.ts';
import { memberFromText } from '#lib/mdj/expression.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { getClassifier } from '#lib/model/project.ts';
import { live } from '#lib/stores/live.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';

const customer = () => getClassifier(projectStore.project, 'Customer');
const attrs = () => membersOf(customer(), 'attribute');

beforeEach(() => {
	projectStore.load(sampleProject());
	selection.editing = null;
});

describe('inline editing flow (docs/spec/keyboard.md)', () => {
	it('⌘↩ on a middle line inserts a blank member right below it and opens that line', () => {
		expect(attrs()).toHaveLength(2);
		addLineBelow('Customer', { part: 'attribute', index: 0 }, '+attribute0: String', 'attribute');
		expect(attrs()).toHaveLength(3);
		expect(attrs().map((a) => a.name)).toEqual(['attribute0', '', 'attribute1']);
		expect(selection.editing).toEqual({ id: 'Customer', target: { part: 'attribute', index: 1 } });
	});

	it('⌘↩ on the last line opens a new line without touching the model', () => {
		addLineBelow('Customer', { part: 'attribute', index: 1 }, '+attribute1: String', 'attribute');
		expect(attrs()).toHaveLength(2);
		expect(selection.editing).toEqual({ id: 'Customer', target: { part: 'attribute', index: 2 } });
	});

	it('⌘↩ on a line emptied by the commit opens at that same index', () => {
		addLineBelow('Customer', { part: 'attribute', index: 0 }, '', 'attribute');
		expect(attrs().map((a) => a.name)).toEqual(['', 'attribute1']);
		expect(selection.editing).toEqual({ id: 'Customer', target: { part: 'attribute', index: 0 } });
	});

	it('⌘⇧↩ from an attribute line opens a new operation line at the end', () => {
		addLineBelow('Customer', { part: 'attribute', index: 0 }, '+attribute0: String', 'operation');
		expect(selection.editing).toEqual({ id: 'Customer', target: { part: 'operation', index: 2 } });
	});

	it('Tab from an emptied last attribute of an enum still lands on the next compartment', () => {
		projectStore.run(setClassifierKind, { id: 'Customer', classifierKind: 'enum' });
		const c = customer();
		projectStore.run(addMember, {
			classifierId: 'Customer',
			kind: 'literal',
			member: memberFromText('literal', 'A', 'lit'),
			index: 0
		});
		// Keep one attribute only, so emptying it collapses the compartment.
		for (const a of membersOf(c, 'attribute').slice(1))
			projectStore.run(deleteMember, {
				classifierId: 'Customer',
				kind: 'attribute',
				memberId: a.id
			});
		moveCompartment('Customer', { part: 'attribute', index: 0 }, '', false);
		expect(membersOf(customer(), 'attribute')).toHaveLength(0);
		expect(selection.editing).toEqual({ id: 'Customer', target: { part: 'operation', index: 0 } });
	});

	it('an empty name is kept and said out loud, not committed', async () => {
		commitName('Customer', '   ');
		expect(customer().name).toBe('Customer');
		await new Promise((r) => setTimeout(r, 1));
		expect(live.alertText).toBe('A name cannot be empty; Customer kept');
	});
});
