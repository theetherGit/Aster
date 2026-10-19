import { describe, expect, it } from 'vitest';
import {
	Stack,
	addClassifier,
	addDiagram,
	addToDiagram,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	renameClassifier,
	resizeNode,
	setClassifierFlags,
	setDocumentation
} from '#lib/commands/index.ts';
import { UNDO_LIMIT } from '#lib/commands/types.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createClassifier, getClassifier, getDiagram, getNodeLayout } from '#lib/model/project.ts';
import { structural } from './helpers.ts';

function setup() {
	const project = sampleProject();
	let clock = 0;
	const stack = new Stack(
		() => project,
		() => clock
	);
	const d = getDiagram(project, 'd1');
	return { project, stack, d, tick: (ms: number) => (clock += ms) };
}

describe('commands', () => {
	it('addClassifier adds model element, view and layout; undo removes all three', () => {
		const { project, stack, d } = setup();
		const before = structural(project);
		const c = createClassifier({ id: 'Book', name: 'Book' });
		const label = stack.run(
			addClassifier(project, { diagramId: 'd1', classifier: c, at: { x: 10, y: 20 } })
		);
		expect(label).toBe('create class Book');
		expect(getClassifier(project, 'Book').name).toBe('Book');
		expect(d.elementIds).toContain('Book');
		expect(getNodeLayout(d, 'Book')).toMatchObject({ x: 10, y: 20 });
		expect(stack.undo()).toBe('create class Book');
		expect(structural(project)).toEqual(before);
		stack.redo();
		expect(getClassifier(project, 'Book').name).toBe('Book');
	});

	it('renameClassifier and setClassifierFlags invert exactly, including clearing a stereotype', () => {
		const { project, stack } = setup();
		stack.run(renameClassifier(project, { id: 'Customer', name: 'Member' }));
		expect(getClassifier(project, 'Customer').name).toBe('Member');
		expect(stack.undoLabel).toBe('rename Customer to Member');
		stack.run(
			setClassifierFlags(project, {
				id: 'Account',
				flags: { isAbstract: false, visibility: 'private', stereotype: null }
			})
		);
		const a = getClassifier(project, 'Account');
		expect(a.isAbstract).toBe(false);
		expect(a.visibility).toBe('private');
		expect('stereotype' in a).toBe(false);
		stack.undo();
		expect(a).toMatchObject({ isAbstract: true, visibility: 'public', stereotype: 'entity' });
		stack.undo();
		expect(getClassifier(project, 'Customer').name).toBe('Customer');
	});

	it('deleteFromDiagram keeps the element in the model; undo restores z-order', () => {
		const { project, stack, d } = setup();
		stack.run(deleteFromDiagram(project, { diagramId: 'd1', ids: ['Account'] }));
		expect(d.elementIds).toEqual(['Customer']);
		expect(d.layout.has('Account')).toBe(false);
		expect(project.elements.has('Account')).toBe(true);
		stack.undo();
		expect(d.elementIds).toEqual(['Account', 'Customer']);
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 120, y: 80 });
	});

	it('deleteFromModel removes element and every view; undo brings both back', () => {
		const { project, stack, d } = setup();
		const before = structural(project);
		stack.run(deleteFromModel(project, { ids: ['Account'] }));
		expect(project.elements.has('Account')).toBe(false);
		expect(d.elementIds).toEqual(['Customer']);
		expect(stack.undoLabel).toBe('delete Account');
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('addToDiagram places a model-only element on a diagram', () => {
		const { project, stack, d } = setup();
		stack.run(deleteFromDiagram(project, { diagramId: 'd1', ids: ['Customer'] }));
		stack.run(
			addToDiagram(project, {
				diagramId: 'd1',
				entries: [{ id: 'Customer', layout: { kind: 'node', x: 1, y: 2, w: 160, h: 80 } }]
			})
		);
		expect(d.elementIds).toEqual(['Account', 'Customer']);
		expect(getNodeLayout(d, 'Customer')).toMatchObject({ x: 1, y: 2 });
		expect(() =>
			addToDiagram(project, {
				diagramId: 'd1',
				entries: [{ id: 'ghost', layout: { kind: 'node', x: 0, y: 0, w: 1, h: 1 } }]
			}).apply(project)
		).toThrow();
	});

	it('moveNode and resizeNode invert', () => {
		const { project, stack, d } = setup();
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account', 'Customer'], dx: 5, dy: -3 }));
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 125, y: 77 });
		expect(getNodeLayout(d, 'Customer')).toMatchObject({ x: 485, y: 117 });
		expect(stack.undoLabel).toBe('move 2 elements');
		stack.run(resizeNode(project, { diagramId: 'd1', id: 'Account', w: 300, h: 400 }));
		expect(getNodeLayout(d, 'Account')).toMatchObject({ w: 300, h: 400 });
		stack.undo();
		stack.undo();
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 120, y: 80, w: 160, h: 80 });
	});
});

describe('command stack', () => {
	it('coalesces consecutive moves of the same element within 300 ms into one step', () => {
		const { project, stack, d, tick } = setup();
		for (let i = 0; i < 10; i++) {
			stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 1, dy: 1 }));
			tick(50);
		}
		expect(stack.depth).toBe(1);
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 130, y: 90 });
		expect(stack.undo()).toBe('move Account');
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 120, y: 80 });
		expect(stack.redo()).toBe('move Account');
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 130, y: 90 });
	});

	it('does not coalesce across a 300 ms gap, a different element, or a non-move command', () => {
		const { project, stack, tick } = setup();
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 1, dy: 0 }));
		tick(301);
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 1, dy: 0 }));
		expect(stack.depth).toBe(2);
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Customer'], dx: 1, dy: 0 }));
		expect(stack.depth).toBe(3);
		stack.run(renameClassifier(project, { id: 'Customer', name: 'X' }));
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Customer'], dx: 1, dy: 0 }));
		expect(stack.depth).toBe(5);
	});

	it('caps the undo history at 500 steps, dropping the oldest', () => {
		const { project, stack, tick, d } = setup();
		for (let i = 0; i < UNDO_LIMIT + 20; i++) {
			stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 1, dy: 0 }));
			tick(1000);
		}
		expect(stack.depth).toBe(UNDO_LIMIT);
		while (stack.canUndo) stack.undo();
		expect(getNodeLayout(d, 'Account').x).toBe(120 + 20);
	});

	it('exposes labels and clears redo on a new command', () => {
		const { project, stack } = setup();
		expect(stack.canUndo).toBe(false);
		expect(stack.undoLabel).toBeNull();
		stack.run(renameClassifier(project, { id: 'Customer', name: 'A' }));
		stack.undo();
		expect(stack.redoLabel).toBe('rename Customer to A');
		stack.run(renameClassifier(project, { id: 'Customer', name: 'B' }));
		expect(stack.canRedo).toBe(false);
	});

	it('snapshot and restore survive a round trip through JSON', () => {
		const { project, stack, tick } = setup();
		stack.run(renameClassifier(project, { id: 'Customer', name: 'A' }));
		tick(1000);
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 3, dy: 4 }));
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 3, dy: 4 }));
		stack.undo();
		const snap = JSON.parse(JSON.stringify(stack.snapshot()));
		const fresh = new Stack(() => project);
		fresh.restore(snap);
		expect(fresh.canUndo && fresh.canRedo).toBe(true);
		fresh.undo();
		expect(getClassifier(project, 'Customer').name).toBe('Customer');
		fresh.redo();
		fresh.redo();
		expect(getNodeLayout(getDiagram(project, 'd1'), 'Account')).toMatchObject({ x: 126, y: 88 });
	});
});

describe('touches', () => {
	it('reports what the last step touched, including through coalesced batches', () => {
		const { project, stack } = setup();
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 1, dy: 0 }));
		stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account'], dx: 1, dy: 0 }));
		expect(stack.lastTouched).toEqual(['Account']);
		stack.run(deleteFromModel(project, { ids: ['Customer'] }));
		stack.undo();
		expect(stack.lastTouched).toEqual(['Customer']);
		stack.undo();
		expect(stack.lastTouched).toEqual(['Account']);
	});
});

describe('coalesced moves stay small', () => {
	it('a long drag keeps one absolute inverse, so the undo history does not grow with it', () => {
		const { project, stack, d, tick } = setup();
		for (let i = 0; i < 300; i++) {
			stack.run(moveNode(project, { diagramId: 'd1', ids: ['Account', 'Customer'], dx: 1, dy: 2 }));
			tick(16);
		}
		const snap = stack.snapshot();
		expect(snap.undo).toEqual([
			{
				id: 'setNodePositions',
				args: {
					diagramId: 'd1',
					positions: [
						{ id: 'Account', x: 120, y: 80 },
						{ id: 'Customer', x: 480, y: 120 }
					]
				}
			}
		]);
		expect(JSON.stringify(snap).length).toBeLessThan(200);
		stack.undo();
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 120, y: 80 });
		stack.redo();
		expect(getNodeLayout(d, 'Account')).toMatchObject({ x: 420, y: 680 });
	});
});

describe('setDocumentation', () => {
	it('sets and restores documentation on any element that has it', () => {
		const { project, stack } = setup();
		stack.run(setDocumentation(project, { id: 'Customer', documentation: 'A library member.' }));
		expect(getClassifier(project, 'Customer').documentation).toBe('A library member.');
		stack.undo();
		expect(getClassifier(project, 'Customer').documentation).toBe('');
	});
});

describe('addDiagram', () => {
	it('appends an empty class diagram and its inverse removes exactly it', () => {
		const { project, stack } = setup();
		const before = structural(project);
		stack.run(addDiagram(project, { diagramId: 'd2', name: 'Class diagram 2' }));
		expect(project.diagrams.map((d) => d.name)).toEqual(['Main', 'Class diagram 2']);
		expect(getDiagram(project, 'd2').elementIds).toEqual([]);
		stack.undo();
		expect(structural(project)).toEqual(before);
		stack.redo();
		expect(project.diagrams[1].id).toBe('d2');
	});
	it('restores the diagram at its old place', () => {
		const { project, stack } = setup();
		stack.run(addDiagram(project, { diagramId: 'd0', name: 'First', index: 0 }));
		expect(project.diagrams.map((d) => d.id)).toEqual(['d0', 'd1']);
		stack.undo();
		expect(project.diagrams.map((d) => d.id)).toEqual(['d1']);
		stack.redo();
		expect(project.diagrams.map((d) => d.id)).toEqual(['d0', 'd1']);
	});
});
