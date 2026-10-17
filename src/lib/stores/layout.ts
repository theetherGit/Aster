import { getNodeLayout } from '#lib/model/project.ts';
import type { Id, Layout, NodeLayout } from '#lib/model/types.ts';
import { projectStore } from './project.svelte.ts';

/** Layout of the active diagram, keyed by element id. Read-only; commands write. */
export const layout = {
	get map(): ReadonlyMap<Id, Layout> {
		return projectStore.diagram.layout;
	},
	node(id: Id): NodeLayout {
		return getNodeLayout(projectStore.diagram, id);
	}
};
