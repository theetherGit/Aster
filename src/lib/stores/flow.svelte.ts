import type { Edge, Node } from '@xyflow/svelte';
import type { Classifier, ClassifierKind, DisplayFlags } from '#lib/model/types.ts';
import { projectStore } from './project.svelte.ts';
import { selection, type EditTarget } from './selection.svelte.ts';

export interface ClassifierNodeData extends Record<string, unknown> {
	classifier: Classifier;
	flags: DisplayFlags;
	minWidth: number;
	editing: EditTarget | null;
}
export type ClassifierFlowNode = Node<ClassifierNodeData, ClassifierKind>;

class Flow {
	/** Svelte Flow nodes, derived from project + layout only. Never mutated. */
	nodes: ClassifierFlowNode[] = $derived.by(() => {
		const project = projectStore.project;
		const diagram = projectStore.diagram;
		const out: ClassifierFlowNode[] = [];
		for (const id of diagram.elementIds) {
			const el = project.elements.get(id);
			const l = diagram.layout.get(id);
			if (!el || !l || el.kind !== 'classifier' || l.kind !== 'node') continue;
			out.push({
				id,
				type: el.classifierKind,
				position: { x: l.x, y: l.y },
				data: {
					// Commands mutate the model in place; a per-version snapshot gives the node
					// new references to react to.
					// ponytail: clones every classifier per command; per-element version stamps if 500-node perf needs it
					classifier: structuredClone(el),
					flags: { ...diagram.defaults, ...l.flags },
					minWidth: Math.max(160, l.w),
					editing: null
				},
				focusable: false
			});
		}
		return out;
	});

	// ponytail: relationships are day 3; until then there are no edges to derive
	edges: Edge[] = $derived([]);

	/** The nodes as the canvas shows them: selection and inline-editing state folded in. */
	canvasNodes: ClassifierFlowNode[] = $derived(
		this.nodes.map((n) => ({
			...n,
			selected: selection.has(n.id),
			data: { ...n.data, editing: selection.editing?.id === n.id ? selection.editing.target : null }
		}))
	);

	/** Names offered by type completion: every classifier plus the usual primitives. */
	typeNames: string[] = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch set, never observed
		const names = new Set([
			'String',
			'int',
			'long',
			'double',
			'float',
			'boolean',
			'char',
			'void',
			'Date'
		]);
		for (const el of projectStore.project.elements.values())
			if (el.kind === 'classifier' && el.name) names.add(el.name);
		return [...names].sort((a, b) => a.localeCompare(b));
	});
}

export const flow = new Flow();
