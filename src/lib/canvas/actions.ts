import {
	addClassifier,
	deleteFromDiagram,
	deleteFromModel,
	moveNode
} from '#lib/commands/index.ts';
import { createClassifier, nextClassName } from '#lib/model/project.ts';
import type { ClassifierKind, Point } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { edit, endEditing } from './inline.ts';

/** Creates a classifier at a paper position, selects it and opens its name for typing. */
export function createClassifierAt(kind: ClassifierKind, at: Point) {
	const classifier = createClassifier({
		classifierKind: kind,
		name: nextClassName(projectStore.project, kind)
	});
	projectStore.run(addClassifier, { diagramId: projectStore.activeDiagramId, classifier, at });
	edit(classifier.id, { part: 'name' });
}

export function nudgeSelection(dx: number, dy: number) {
	if (!selection.size) return;
	projectStore.run(moveNode, {
		diagramId: projectStore.activeDiagramId,
		ids: selection.list,
		dx,
		dy
	});
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

export { endEditing as stopEditing };
