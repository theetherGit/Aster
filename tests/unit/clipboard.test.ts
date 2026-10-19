import { describe, expect, it } from 'vitest';
import { copyPayload, parsePayload, planPaste } from '#lib/canvas/clipboard.ts';
import { Stack, addDiagram, addNote, batch, connect } from '#lib/commands/index.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createProject, createDiagram, getClassifier, getDiagram } from '#lib/model/project.ts';
import type { Classifier, Note, Project, Relationship } from '#lib/model/types.ts';
import { structural } from './helpers.ts';

/** keyboard.md: ⌘C / ⌘X / ⌘V; "Paste creates views, or model+views across projects". */
function setup() {
	const project = sampleProject();
	const stack = new Stack(() => project);
	stack.run(
		connect(project, {
			diagramId: 'd1',
			id: 'r1',
			sourceId: 'Account',
			targetId: 'Customer',
			kind: 'association'
		})
	);
	return { project, stack };
}
let n = 0;
const mint = () => `new${++n}`;
const paste = (
	project: Project,
	stack: Stack,
	diagramId: string,
	ids: string[],
	from = project
) => {
	const payload = copyPayload(from, 'd1', ids)!;
	const plan = planPaste(project, diagramId, payload, mint)!;
	const label = stack.run(batch(project, plan.args));
	return { plan, label };
};

describe('clipboard: copy', () => {
	it('takes the selected nodes with their views and the relationships between them', () => {
		const { project } = setup();
		const p = copyPayload(project, 'd1', ['Account', 'Customer'])!;
		expect(p.projectId).toBe('sample');
		expect(p.elements.map((e) => e.id).sort()).toEqual(['Account', 'Customer', 'r1']);
		expect(p.layouts.Account).toMatchObject({ kind: 'node', x: 120, y: 80 });
		expect(p.layouts.r1).toMatchObject({ kind: 'edge' });
	});

	it('leaves out a relationship whose other end is not copied', () => {
		const { project } = setup();
		const p = copyPayload(project, 'd1', ['Account'])!;
		expect(p.elements.map((e) => e.id)).toEqual(['Account']);
		expect(copyPayload(project, 'd1', [])).toBeNull();
	});
});

describe('clipboard: paste in the same project creates views', () => {
	it('adds views at the copied positions on another diagram, as one undo step', () => {
		const { project, stack } = setup();
		stack.run(addDiagram(project, { diagramId: 'd2', name: 'Second' }));
		const before = structural(project);
		const elements = project.elements.size;
		const { plan, label } = paste(project, stack, 'd2', ['Account', 'Customer']);
		expect(label).toBe('paste 3 elements');
		expect(project.elements.size).toBe(elements);
		const d2 = getDiagram(project, 'd2');
		expect([...d2.elementIds].sort()).toEqual(['Account', 'Customer', 'r1']);
		expect(d2.layout.get('Account')).toMatchObject({ x: 120, y: 80 });
		expect(plan.ids.sort()).toEqual(['Account', 'Customer', 'r1']);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('brings back a cut element on its own diagram at its old position', () => {
		const { project, stack } = setup();
		const payload = copyPayload(project, 'd1', ['Customer'])!;
		const d1 = getDiagram(project, 'd1');
		d1.elementIds = d1.elementIds.filter((id) => id !== 'Customer' && id !== 'r1');
		d1.layout.delete('Customer');
		d1.layout.delete('r1');
		const plan = planPaste(project, 'd1', payload, mint)!;
		stack.run(batch(project, plan.args));
		expect(d1.elementIds).toContain('Customer');
		expect(d1.layout.get('Customer')).toMatchObject({ x: 480, y: 120 });
		// The relationship was not copied, but both its ends are back: it is not drawn until added.
		expect(d1.elementIds).not.toContain('r1');
	});

	it('duplicates as new model elements when everything copied is already on the diagram', () => {
		const { project, stack } = setup();
		const before = structural(project);
		const { plan, label } = paste(project, stack, 'd1', ['Account', 'Customer']);
		expect(label).toBe('paste 3 elements');
		expect(plan.ids).toHaveLength(3);
		const [a, c, r] = plan.ids.map((id) => project.elements.get(id)!);
		const account = a as Classifier;
		expect(account.name).toBe('Account');
		expect(account.id).not.toBe('Account');
		// Member ids are fresh too: a .mdj needs every _id once.
		const old = getClassifier(project, 'Account');
		expect(account.attributes).toHaveLength(10);
		expect(account.attributes[0].id).not.toBe(old.attributes[0].id);
		expect(account.attributes[0].name).toBe(old.attributes[0].name);
		expect((r as Relationship).sourceId).toBe(account.id);
		expect((r as Relationship).targetId).toBe(c.id);
		expect(getDiagram(project, 'd1').layout.get(account.id)).toMatchObject({ x: 140, y: 100 });
		stack.undo();
		expect(structural(project)).toEqual(before);
	});
});

describe('clipboard: paste across projects creates model and views', () => {
	it('clones with fresh ids, remaps ends and note links, drops what has no end', () => {
		const { project: from, stack: fromStack } = setup();
		fromStack.run(
			addNote(from, {
				diagramId: 'd1',
				note: { kind: 'note', id: 'n1', text: 'Remember', linkedIds: ['Account', 'Customer'] },
				at: { x: 10, y: 10 }
			})
		);
		const to = createProject({ id: 'other', name: 'Other' });
		to.diagrams.push(createDiagram({ id: 'x1', name: 'Main' }));
		const stack = new Stack(() => to);
		const { plan, label } = paste(to, stack, 'x1', ['Account', 'n1'], from);
		expect(label).toBe('paste 2 elements');
		const els = plan.ids.map((id) => to.elements.get(id)!);
		expect(els.map((e) => e.kind)).toEqual(['classifier', 'note']);
		const account = els[0] as Classifier;
		expect(account.name).toBe('Account');
		expect(from.elements.has(account.id)).toBe(false);
		// Customer was not copied: the note keeps its link to the clone only; r1 never came along.
		expect((els[1] as Note).linkedIds).toEqual([account.id]);
		expect(getDiagram(to, 'x1').layout.get(account.id)).toMatchObject({ x: 120, y: 80 });
		stack.undo();
		expect(to.elements.size).toBe(0);
	});
});

describe('clipboard: what comes off the system clipboard is checked', () => {
	it('reads back what copy wrote', () => {
		const { project } = setup();
		const p = copyPayload(project, 'd1', ['Account', 'Customer'])!;
		expect(parsePayload(JSON.stringify(p))).toEqual(p);
	});

	it('refuses anything that is not a well-formed payload', () => {
		const { project } = setup();
		const good = copyPayload(project, 'd1', ['Account'])!;
		const bad = (patch: (p: typeof good) => unknown) =>
			parsePayload(JSON.stringify(patch(structuredClone(good))));
		expect(parsePayload('not json')).toBeNull();
		expect(parsePayload('{"format":"something-else"}')).toBeNull();
		expect(bad((p) => ({ ...p, version: 99 }))).toBeNull();
		expect(bad((p) => (((p.elements[0] as Classifier).name = 42 as never), p))).toBeNull();
		expect(bad((p) => (((p.elements[0] as Classifier).attributes = 'x' as never), p))).toBeNull();
		expect(bad((p) => (((p.layouts.Account as { x: unknown }).x = 'left'), p))).toBeNull();
		expect(bad((p) => (((p.elements[0] as { kind: string }).kind = 'script'), p))).toBeNull();
		// A view without its element, or an element without its view, is not pasted.
		expect(bad((p) => (delete p.layouts.Account, p))).toBeNull();
	});
});
