import { describe, expect, it } from 'vitest';
import { addClassifier, moveNode } from '#lib/commands/index.ts';
import { createClassifier } from '#lib/model/project.ts';
import { flow, type ClassifierFlowNode } from '#lib/stores/flow.svelte.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';

describe('stores', () => {
	it('derives flow nodes from project + layout and re-derives after commands', () => {
		const before = flow.nodes.map((n) => n.id);
		expect(before).toEqual(['Account', 'Customer']);
		expect(flow.nodes[0].position).toEqual({ x: 120, y: 80 });
		expect((flow.nodes[0] as ClassifierFlowNode).data.classifier.name).toBe('Account');

		projectStore.run(addClassifier, {
			diagramId: 'd1',
			classifier: createClassifier({ id: 'Book', name: 'Book' }),
			at: { x: 1, y: 2 }
		});
		expect(flow.nodes.map((n) => n.id)).toEqual(['Account', 'Customer', 'Book']);
		projectStore.run(moveNode, { diagramId: 'd1', ids: ['Book'], dx: 10, dy: 0 });
		expect(flow.nodes[2].position).toEqual({ x: 11, y: 2 });
		projectStore.undo();
		projectStore.undo();
		expect(flow.nodes.map((n) => n.id)).toEqual(before);
		expect(projectStore.canUndo).toBe(false);
	});

	it('folds selection and editing into canvas nodes without touching the derived nodes', () => {
		selection.set(['Customer']);
		selection.editing = { id: 'Customer', target: { part: 'name' } };
		expect(flow.nodes.every((n) => !n.selected && n.data.editing === null)).toBe(true);
		const customer = flow.canvasNodes.find((n) => n.id === 'Customer')!;
		expect(customer.selected).toBe(true);
		expect(customer.data.editing).toEqual({ part: 'name' });
		selection.clear();
		selection.editing = null;
		expect(flow.canvasNodes.every((n) => !n.selected)).toBe(true);
	});
});
