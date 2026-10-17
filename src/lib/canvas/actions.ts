import {
	addClassifier,
	deleteFromDiagram,
	deleteFromModel,
	moveNode
} from '#lib/commands/index.ts';
import { createClassifier, nextClassName } from '#lib/model/project.ts';
import type { Point } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection } from '#lib/stores/selection.svelte.ts';
import { canvasFocus } from './focus.ts';

/** Creates a class at a paper position, selects it and opens its name for typing. */
export function createClassAt(at: Point) {
	const classifier = createClassifier({ name: nextClassName(projectStore.project) });
	projectStore.run(addClassifier, { diagramId: projectStore.activeDiagramId, classifier, at });
	selection.set([classifier.id]);
	selection.editingId = classifier.id;
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
	selection.editingId = null;
	selection.clear();
	if (fromModel) projectStore.run(deleteFromModel, { ids });
	else projectStore.run(deleteFromDiagram, { diagramId: projectStore.activeDiagramId, ids });
}

export function startEditing() {
	if (selection.size !== 1) return;
	const [id] = selection.list;
	if (projectStore.project.elements.get(id)?.kind === 'classifier') selection.editingId = id;
}

export function stopEditing() {
	selection.editingId = null;
	canvasFocus.focus();
}
