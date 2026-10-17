import type { Edge, Node } from '@xyflow/svelte';
import { t } from '#lib/i18n/index.ts';
import { elementName } from '#lib/model/project.ts';
import type {
	Classifier,
	ClassifierKind,
	DisplayFlags,
	EdgeLayout,
	Relationship
} from '#lib/model/types.ts';
import { projectStore } from './project.svelte.ts';
import { selection, type EditTarget } from './selection.svelte.ts';
import { ui } from './ui.svelte.ts';

export interface ClassifierNodeData extends Record<string, unknown> {
	classifier: Classifier;
	flags: DisplayFlags;
	minWidth: number;
	editing: EditTarget | null;
	/** Role in a keyboard link in progress. */
	link: 'source' | 'target' | 'both' | null;
}
export type ClassifierFlowNode = Node<ClassifierNodeData, ClassifierKind>;

export interface RelationshipEdgeData extends Record<string, unknown> {
	relationship: Relationship;
	layout: EdgeLayout;
	flags: DisplayFlags;
}
export type RelationshipFlowEdge = Edge<RelationshipEdgeData, 'uml'>;

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
					editing: null,
					link: null
				},
				focusable: false
			});
		}
		return out;
	});

	/** Svelte Flow edges, derived from project + layout only. An edge shows only with both its nodes. */
	edges: RelationshipFlowEdge[] = $derived.by(() => {
		const project = projectStore.project;
		const diagram = projectStore.diagram;
		const out: RelationshipFlowEdge[] = [];
		for (const id of diagram.elementIds) {
			const el = project.elements.get(id);
			const l = diagram.layout.get(id);
			if (!el || !l || el.kind !== 'relationship' || l.kind !== 'edge') continue;
			if (
				diagram.layout.get(el.sourceId)?.kind !== 'node' ||
				diagram.layout.get(el.targetId)?.kind !== 'node'
			)
				continue;
			const name = (nodeId: string) => {
				const n = project.elements.get(nodeId);
				return n ? elementName(n) : nodeId;
			};
			out.push({
				id,
				type: 'uml',
				source: el.sourceId,
				target: el.targetId,
				// Every node has these handles; the edge draws itself border to border regardless.
				sourceHandle: 'r',
				targetHandle: 'l',
				data: {
					relationship: structuredClone(el),
					layout: structuredClone(l),
					flags: { ...diagram.defaults }
				},
				ariaLabel: t('edge.label', {
					source: name(el.sourceId),
					target: name(el.targetId),
					kind: t(`rel.${el.relationshipKind}`)
				}),
				focusable: false,
				interactionWidth: 0
			});
		}
		return out;
	});

	canvasEdges: RelationshipFlowEdge[] = $derived(
		this.edges.map((e) => ({ ...e, selected: selection.has(e.id) }))
	);

	/** The nodes as the canvas shows them: selection and inline-editing state folded in. */
	canvasNodes: ClassifierFlowNode[] = $derived(
		this.nodes.map((n) => ({
			...n,
			selected: selection.has(n.id),
			data: {
				...n.data,
				editing: selection.editing?.id === n.id ? selection.editing.target : null,
				link: !ui.link
					? null
					: ui.link.sourceId === n.id && ui.link.targetId === n.id
						? 'both'
						: ui.link.sourceId === n.id
							? 'source'
							: ui.link.targetId === n.id
								? 'target'
								: null
			}
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
