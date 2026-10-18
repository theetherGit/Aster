import { describe, expect, it } from 'vitest';
import {
	Stack,
	addNote,
	linkNote,
	renameDiagram,
	setDiagramDefaults,
	setElementText,
	setNodeFlags,
	unlinkNote
} from '#lib/commands/index.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { getDiagram, getNodeLayout } from '#lib/model/project.ts';
import { structural } from './helpers.ts';

describe('display defaults and overrides', () => {
	it('diagram defaults change and undo exactly', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		const before = structural(project);
		const label = stack.run(
			setDiagramDefaults(project, {
				diagramId: 'd1',
				patch: { showVisibility: false, suppressAttributes: true }
			})
		);
		expect(label).toBe('change diagram display: Show visibility, Hide attributes');
		expect(getDiagram(project, 'd1').defaults.showVisibility).toBe(false);
		expect(getDiagram(project, 'd1').defaults.suppressAttributes).toBe(true);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('node overrides are a sparse layer over the defaults; undefined removes an override', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		const before = structural(project);
		stack.run(
			setNodeFlags(project, { diagramId: 'd1', id: 'Account', patch: { showType: false } })
		);
		expect(getNodeLayout(getDiagram(project, 'd1'), 'Account').flags).toEqual({ showType: false });
		stack.run(
			setNodeFlags(project, {
				diagramId: 'd1',
				id: 'Account',
				patch: { stereotypeDisplay: 'none' }
			})
		);
		expect(getNodeLayout(getDiagram(project, 'd1'), 'Account').flags).toEqual({
			showType: false,
			stereotypeDisplay: 'none'
		});
		stack.run(
			setNodeFlags(project, { diagramId: 'd1', id: 'Account', patch: { showType: undefined } })
		);
		expect(getNodeLayout(getDiagram(project, 'd1'), 'Account').flags).toEqual({
			stereotypeDisplay: 'none'
		});
		stack.undo();
		stack.undo();
		stack.undo();
		expect(structural(project)).toEqual(before);
		expect('flags' in getNodeLayout(getDiagram(project, 'd1'), 'Account')).toBe(false);
	});

	it('renames the diagram with an inverse', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		stack.run(renameDiagram(project, { diagramId: 'd1', name: 'Class diagram' }));
		expect(getDiagram(project, 'd1').name).toBe('Class diagram');
		stack.undo();
		expect(getDiagram(project, 'd1').name).toBe('Main');
	});
});

describe('notes and text', () => {
	it('adds a note, edits its text, links and unlinks, all undoable', () => {
		const project = sampleProject();
		const stack = new Stack(() => project);
		const before = structural(project);
		stack.run(
			addNote(project, {
				diagramId: 'd1',
				note: { kind: 'note', id: 'n1', text: '', linkedIds: [] },
				at: { x: 10, y: 20 }
			})
		);
		expect(getDiagram(project, 'd1').elementIds).toContain('n1');
		stack.run(setElementText(project, { id: 'n1', text: 'Overdue after 14 days' }));
		stack.run(linkNote(project, { noteId: 'n1', targetId: 'Account' }));
		stack.run(linkNote(project, { noteId: 'n1', targetId: 'Account' })); // idempotent
		const n = project.elements.get('n1');
		expect(n?.kind === 'note' && n.linkedIds).toEqual(['Account']);
		stack.run(unlinkNote(project, { noteId: 'n1', targetId: 'Account' }));
		expect(n?.kind === 'note' && n.linkedIds).toEqual([]);
		while (stack.canUndo) stack.undo();
		expect(structural(project)).toEqual(before);
	});
});
