/**
 * Object diagrams (features.md M3.2): objects and links are commands with inverses; deleting an
 * object takes its links along; renaming a class renames it in its objects; the editor's text form
 * reads back as the same object.
 */
import { describe, expect, it } from 'vitest';
import { copyPayload, parsePayload, planPaste } from '#lib/canvas/clipboard.ts';
import {
	Stack,
	addDiagram,
	batch,
	addInstance,
	addLink,
	deleteFromDiagram,
	deleteFromModel,
	renameClassifier
} from '#lib/commands/index.ts';
import {
	createClassifier,
	createInstance,
	createProject,
	createSlot,
	instanceFromText,
	instanceText
} from '#lib/model/project.ts';
import type { Instance, Link } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

function setup() {
	const project = createProject({ id: 'p', name: 'Bank' });
	const stack = new Stack(() => project);
	stack.run(addDiagram(project, { diagramId: 'od', name: 'Objects', diagramKind: 'object' }));
	const account = createClassifier({ id: 'Account', name: 'Account' });
	project.elements.set(account.id, account);
	const a = createInstance({ id: 'a', name: 'acc', classifier: 'Account' });
	const b = createInstance({ id: 'b', name: 'ann', classifier: 'Customer' });
	stack.run(addInstance(project, { diagramId: 'od', instance: a, at: { x: 40, y: 40 } }));
	stack.run(addInstance(project, { diagramId: 'od', instance: b, at: { x: 320, y: 40 } }));
	stack.run(addLink(project, { diagramId: 'od', id: 'l', sourceId: 'b', targetId: 'a' }));
	return { project, stack, diagram: project.diagrams[0] };
}

describe('object commands', () => {
	it('adds an object diagram, objects and a link, and undoes back to empty', () => {
		const { project, stack, diagram } = setup();
		expect(diagram.diagramKind).toBe('object');
		expect(diagram.elementIds).toEqual(['a', 'b', 'l']);
		expect(diagram.layout.get('l')?.kind).toBe('edge');
		for (let i = 0; i < 4; i++) stack.undo();
		expect(project.diagrams).toHaveLength(0);
		expect(project.elements.size).toBe(1);
		for (let i = 0; i < 4; i++) stack.redo();
		expect(project.diagrams[0].diagramKind).toBe('object');
	});

	it('refuses a link to something that is not an object', () => {
		const { project } = setup();
		expect(() =>
			addLink(project, { diagramId: 'od', id: 'x', sourceId: 'a', targetId: 'Account' }).apply(
				project
			)
		).toThrow(/not an object/);
	});

	it('takes the links along when an object goes, from the diagram or the model', () => {
		const { project, stack, diagram } = setup();
		const before = structural(project);
		stack.run(deleteFromDiagram(project, { diagramId: 'od', ids: ['a'] }));
		expect(diagram.elementIds).toEqual(['b']);
		stack.undo();
		stack.run(deleteFromModel(project, { ids: ['b'] }));
		expect(project.elements.has('l')).toBe(false);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('renames the class in the objects of it, and undo puts the old name back', () => {
		const { project, stack } = setup();
		const obj = (id: string) => project.elements.get(id) as Instance;
		stack.run(renameClassifier(project, { id: 'Account', name: 'Savings' }));
		expect(obj('a').classifier).toBe('Savings');
		expect(obj('b').classifier).toBe('Customer');
		stack.undo();
		expect(obj('a').classifier).toBe('Account');
	});
});

describe('the object text form', () => {
	const acc = createInstance({
		id: 'a',
		name: 'acc',
		classifier: 'Account',
		slots: [createSlot('balance', '100', 's1'), createSlot('owner', '"Ann"', 's2')]
	});

	it('reads back as the same object', () => {
		expect(instanceText(acc)).toBe('acc: Account\nbalance = 100\nowner = "Ann"');
		expect(instanceFromText(acc, instanceText(acc))).toEqual(acc);
	});

	it('keeps a slot id by name, drops blank lines, and reads anonymous and classless heads', () => {
		const next = instanceFromText(acc, ': Account\n\nowner = "Bo"\n+limit = 5\nflag');
		expect(next.name).toBe('');
		expect(next.classifier).toBe('Account');
		expect(next.slots.map((s) => [s.name, s.value])).toEqual([
			['owner', '"Bo"'],
			['limit', '5'],
			['flag', '']
		]);
		expect(next.slots[0].id).toBe('s2');
		const bare = instanceFromText(acc, 'acc');
		expect(bare.classifier).toBeUndefined();
		expect(bare.slots).toEqual([]);
	});
});

describe('objects on the clipboard', () => {
	it('copies objects with the links between them, and pastes them into another project', () => {
		const { project } = setup();
		const payload = copyPayload(project, 'od', ['a', 'b'])!;
		expect(payload.elements.map((e) => e.kind)).toEqual(['instance', 'instance', 'link']);
		const back = parsePayload(JSON.stringify(payload))!;
		expect(back.elements).toEqual(payload.elements);
		const other = createProject({ id: 'q', name: 'Other' });
		const stack = new Stack(() => other);
		stack.run(addDiagram(other, { diagramId: 'd', name: 'D', diagramKind: 'object' }));
		let n = 0;
		const plan = planPaste(other, 'd', back, () => `n${++n}`)!;
		stack.run(batch(other, plan.args));
		const pasted = [...other.elements.values()];
		expect(pasted.map((e) => e.kind)).toEqual(['instance', 'instance', 'link']);
		const link = pasted[2] as Link;
		expect([link.sourceId, link.targetId]).toEqual([pasted[1].id, pasted[0].id]);
	});
});
