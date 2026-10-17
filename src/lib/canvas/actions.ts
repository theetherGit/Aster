import {
	addClassifier,
	batch,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	setLineStyle
} from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import { t } from '#lib/i18n/index.ts';
import { createClassifier, nextClassName } from '#lib/model/project.ts';
import type { ClassifierKind, Id, LineStyle, Point } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import type { Rect } from './edges/geometry.ts';
import { edit, endEditing } from './inline.ts';
import { firstTarget } from './link.ts';

/** Creates a classifier at a paper position, selects it and opens its name for typing. */
export function createClassifierAt(kind: ClassifierKind, at: Point) {
	const classifier = createClassifier({
		classifierKind: kind,
		name: nextClassName(projectStore.project, kind)
	});
	projectStore.run(addClassifier, { diagramId: projectStore.activeDiagramId, classifier, at });
	edit(classifier.id, { part: 'name' });
}

const selectedWith = (kind: 'node' | 'edge') =>
	selection.list.filter((id) => projectStore.diagram.layout.get(id)?.kind === kind);

/** Arrows: nudge the selected nodes. Edges follow their nodes. */
export function nudgeSelection(dx: number, dy: number) {
	const ids = selectedWith('node');
	if (!ids.length) return;
	projectStore.run(moveNode, { diagramId: projectStore.activeDiagramId, ids, dx, dy });
}

export function deleteSelection(fromModel: boolean) {
	const ids = selection.list;
	if (!ids.length) return;
	selection.editing = null;
	selection.clear();
	if (fromModel) projectStore.run(deleteFromModel, { ids });
	else projectStore.run(deleteFromDiagram, { diagramId: projectStore.activeDiagramId, ids });
}

/** F2 / ↩ on a selected classifier: edit its name. */
export function startEditing() {
	if (selection.size !== 1) return;
	const [id] = selection.list;
	if (projectStore.project.elements.get(id)?.kind === 'classifier') edit(id, { part: 'name' });
}

/** L: start a keyboard link from the one selected node. */
export function startLink(rects: Map<Id, Rect>) {
	const nodes = selectedWith('node');
	if (nodes.length !== 1 || selection.size !== 1) return false;
	ui.link = { sourceId: nodes[0], targetId: firstTarget(rects, nodes[0]) };
	return true;
}

/** ⌘L, ⌘⇧B, ⌘⌥L, ⌘⌥B: line style of the selected edges, as one undo step. */
export function setLineStyleForSelection(lineStyle: LineStyle): boolean {
	const ids = selectedWith('edge');
	if (!ids.length) return false;
	const diagramId = projectStore.activeDiagramId;
	if (ids.length === 1) {
		projectStore.run(setLineStyle, { diagramId, id: ids[0], lineStyle });
	} else {
		const p = projectStore.project;
		projectStore.run(batch, {
			label: t('cmd.setLineStyle', { name: t('cmd.many', { count: ids.length }) }),
			commands: ids.map((id) => serialise(setLineStyle(p, { diagramId, id, lineStyle })))
		});
	}
	return true;
}

export { endEditing as stopEditing };
