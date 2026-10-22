import type { Edge, Node } from '@xyflow/svelte';
import { t } from '#lib/i18n/index.ts';
import { fillOf, lineOf } from '#lib/canvas/paint.ts';
import { elementName, PRIMITIVE_TYPES } from '#lib/model/project.ts';
import type {
	Classifier,
	ClassifierKind,
	DisplayFlags,
	EdgeLayout,
	Note,
	Relationship,
	TextElement
} from '#lib/model/types.ts';
import { projectStore } from './project.svelte.ts';
import { selection, type EditTarget, type FocusPart } from './selection.svelte.ts';
import { ui } from './ui.svelte.ts';

export interface ClassifierNodeData extends Record<string, unknown> {
	classifier: Classifier;
	flags: DisplayFlags;
	minWidth: number;
	/** StarUML's autoResize off: the stored height is the least the node takes. */
	minHeight: number;
	editing: EditTarget | null;
	/** Role in a keyboard link in progress. */
	link: 'source' | 'target' | 'both' | null;
	/** An end of the edge under the pointer. */
	hovered: boolean;
	/** Which part of this node owns roving focus, or null. */
	focus: FocusPart | null;
	/** The view's own colours (paint.ts); undefined draws the paper's. */
	fill?: string;
	line?: string;
}
export type ClassifierFlowNode = Node<ClassifierNodeData, ClassifierKind>;

/** Notes and free text: view-only elements with their own layout (features.md). */
export interface NoteNodeData extends Record<string, unknown> {
	element: Note | TextElement;
	width: number;
	height: number;
	editing: boolean;
	link: 'source' | 'target' | 'both' | null;
	hovered: boolean;
	focus: FocusPart | null;
	fill?: string;
	line?: string;
}
export type NoteFlowNode = Node<NoteNodeData, 'note' | 'text'>;
export type FlowNode = ClassifierFlowNode | NoteFlowNode;

export interface RelationshipEdgeData extends Record<string, unknown> {
	relationship: Relationship;
	layout: EdgeLayout;
	flags: DisplayFlags;
	/** Roving focus sits on this edge (as an element, or as a part of one of its nodes). */
	focused: boolean;
}
export type RelationshipFlowEdge = Edge<RelationshipEdgeData, 'uml'>;
/** A note link: dashed, no arrowhead, derived from `Note.linkedIds`. */
export type NoteLinkFlowEdge = Edge<{ noteId: string; targetId: string }, 'noteLink'>;
export type FlowEdge = RelationshipFlowEdge | NoteLinkFlowEdge;

const linkRole = (id: string): 'source' | 'target' | 'both' | null =>
	!ui.link
		? null
		: ui.link.sourceId === id && ui.link.targetId === id
			? 'both'
			: ui.link.sourceId === id
				? 'source'
				: ui.link.targetId === id
					? 'target'
					: null;

class Flow {
	/** Svelte Flow nodes, derived from project + layout only. Never mutated. */
	nodes: FlowNode[] = $derived.by(() => {
		const project = projectStore.project;
		const diagram = projectStore.diagram;
		const out: FlowNode[] = [];
		for (const id of diagram.elementIds) {
			const el = project.elements.get(id);
			const l = diagram.layout.get(id);
			if (!el || !l || l.kind !== 'node') continue;
			if (el.kind === 'classifier') {
				const flags = { ...diagram.defaults, ...l.flags };
				out.push({
					id,
					type: el.classifierKind,
					position: { x: l.x, y: l.y },
					data: {
						// Commands mutate the model in place; a per-version snapshot gives the node
						// new references to react to.
						// ponytail: clones every classifier per command; per-element version stamps if 500-node perf needs it
						classifier: structuredClone(el),
						flags,
						minWidth: Math.max(160, l.w),
						minHeight: flags.autoResize === false ? l.h : 0,
						editing: null,
						link: null,
						hovered: false,
						focus: null,
						fill: fillOf(l),
						line: lineOf(l)
					},
					focusable: false
				});
			} else if (el.kind === 'note' || el.kind === 'text') {
				out.push({
					id,
					type: el.kind,
					position: { x: l.x, y: l.y },
					data: {
						element: structuredClone(el),
						width: l.w,
						height: l.h,
						editing: false,
						link: null,
						hovered: false,
						focus: null,
						fill: fillOf(l),
						line: lineOf(l)
					},
					focusable: false
				});
			}
		}
		return out;
	});

	/** Svelte Flow edges, derived from project + layout only. An edge shows only with both its nodes. */
	edges: FlowEdge[] = $derived.by(() => {
		const project = projectStore.project;
		const diagram = projectStore.diagram;
		const out: FlowEdge[] = [];
		const drawn = (nodeId: string) => {
			const k = project.elements.get(nodeId)?.kind;
			return (
				diagram.layout.get(nodeId)?.kind === 'node' &&
				(k === 'classifier' || k === 'note' || k === 'text')
			);
		};
		const name = (nodeId: string) => {
			const n = project.elements.get(nodeId);
			return n ? elementName(n) : nodeId;
		};
		for (const id of diagram.elementIds) {
			const el = project.elements.get(id);
			const l = diagram.layout.get(id);
			if (!el || !l) continue;
			if (el.kind === 'relationship' && l.kind === 'edge') {
				// Drawn only between drawn classifiers (package frames come later).
				const cls = (x: string) => project.elements.get(x)?.kind === 'classifier' && drawn(x);
				if (!cls(el.sourceId) || !cls(el.targetId)) continue;
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
						flags: { ...diagram.defaults },
						focused: false
					},
					ariaLabel: t('edge.label', {
						source: name(el.sourceId),
						target: name(el.targetId),
						kind: t(`rel.${el.relationshipKind}`)
					}),
					focusable: false,
					interactionWidth: 0
				});
			} else if (el.kind === 'note' && l.kind === 'node') {
				for (const targetId of el.linkedIds) {
					if (!drawn(targetId)) continue;
					out.push({
						id: `${id}~${targetId}`,
						type: 'noteLink',
						source: id,
						target: targetId,
						sourceHandle: 'r',
						targetHandle: 'l',
						data: { noteId: id, targetId },
						ariaLabel: t('edge.noteLink', { target: name(targetId) }),
						focusable: false,
						selectable: false,
						interactionWidth: 0
					});
				}
			}
		}
		return out;
	});

	canvasEdges: FlowEdge[] = $derived(
		this.edges.map((e): FlowEdge => {
			const selected = selection.has(e.id);
			if (e.type !== 'uml') return { ...e, selected };
			const f = selection.focus;
			const focused = !!f && ((f.id === e.id && f.part === 'self') || f.part === `edge:${e.id}`);
			return { ...e, selected, data: { ...e.data!, focused } };
		})
	);

	/** The nodes as the canvas shows them: selection, inline editing and link state folded in. */
	canvasNodes: FlowNode[] = $derived.by(() => {
		const h = ui.hoveredEdge ? projectStore.project.elements.get(ui.hoveredEdge) : undefined;
		const hoveredEnds = h?.kind === 'relationship' ? [h.sourceId, h.targetId] : [];
		return this.nodes.map((n): FlowNode => {
			const f = selection.focus;
			const common = {
				selected: selection.has(n.id),
				hovered: hoveredEnds.includes(n.id),
				link: linkRole(n.id),
				focus: f?.id === n.id ? f.part : null
			};
			if (n.type === 'note' || n.type === 'text') {
				const node = n as NoteFlowNode;
				return {
					...node,
					selected: common.selected,
					data: {
						...node.data,
						hovered: common.hovered,
						link: common.link,
						focus: common.focus,
						editing: selection.editing?.id === n.id && selection.editing.target.part === 'text'
					}
				};
			}
			const node = n as ClassifierFlowNode;
			return {
				...node,
				selected: common.selected,
				data: {
					...node.data,
					hovered: common.hovered,
					link: common.link,
					focus: common.focus,
					editing: selection.editing?.id === n.id ? selection.editing.target : null
				}
			};
		});
	});

	/** Names offered by type completion: every classifier plus the usual primitives. */
	typeNames: string[] = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- local scratch set, never observed
		const names = new Set<string>(PRIMITIVE_TYPES);
		for (const el of projectStore.project.elements.values())
			if (el.kind === 'classifier' && el.name) names.add(el.name);
		return [...names].sort((a, b) => a.localeCompare(b));
	});
}

export const flow = new Flow();
