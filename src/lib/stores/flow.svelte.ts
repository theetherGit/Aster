import type { Edge, Node } from '@xyflow/svelte';
import type { Classifier, DisplayFlags } from '#lib/model/types.ts';
import { projectStore } from './project.svelte.ts';
import { selection } from './selection.svelte.ts';

export interface ClassNodeData extends Record<string, unknown> {
	classifier: Classifier;
	flags: DisplayFlags;
	minWidth: number;
	editing: boolean;
}
export type ClassFlowNode = Node<ClassNodeData, 'class'>;

class Flow {
	/** Svelte Flow nodes, derived from project + layout only. Never mutated. */
	nodes: ClassFlowNode[] = $derived.by(() => {
		const project = projectStore.project;
		const diagram = projectStore.diagram;
		const out: ClassFlowNode[] = [];
		for (const id of diagram.elementIds) {
			const el = project.elements.get(id);
			const l = diagram.layout.get(id);
			if (!el || !l || el.kind !== 'classifier' || l.kind !== 'node') continue;
			out.push({
				id,
				type: 'class',
				position: { x: l.x, y: l.y },
				data: {
					classifier: el,
					flags: { ...diagram.defaults, ...l.flags },
					minWidth: Math.max(160, l.w),
					editing: false
				},
				focusable: false
			});
		}
		return out;
	});

	// ponytail: relationships are day 3; until then there are no edges to derive
	edges: Edge[] = $derived([]);

	/** The nodes as the canvas shows them: selection and inline-editing state folded in. */
	canvasNodes: ClassFlowNode[] = $derived(
		this.nodes.map((n) => ({
			...n,
			selected: selection.has(n.id),
			data: { ...n.data, editing: selection.editingId === n.id }
		}))
	);
}

export const flow = new Flow();
