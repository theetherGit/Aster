/** Object diagrams (features.md M3.2): objects with slots, links between them. Edits go through replaceElement. */
import { t } from '#lib/i18n/index.ts';
import {
	createLink,
	defaultEdgeLayout,
	elementName,
	getDiagram,
	getElement,
	setOwner
} from '#lib/model/project.ts';
import type { Id, Instance, Point } from '#lib/model/types.ts';
import { deleteFromModel } from './elements.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

export const addInstance: Factory<{ diagramId: Id; instance: Instance; at: Point }> = define(
	'addInstance',
	(project, { diagramId, instance, at }) => ({
		label: t('cmd.addInstance', { name: elementName(instance) }),
		touches: [instance.id],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			const el = structuredClone(instance);
			p.elements.set(el.id, el);
			if (el.packageId) setOwner(p, el, el.packageId);
			d.elementIds.push(instance.id);
			d.layout.set(instance.id, { kind: 'node', x: at.x, y: at.y, w: 160, h: 60 });
			return deleteFromModel(p, { ids: [instance.id] });
		}
	})
);

/** A link from one object to another and its straight edge on the diagram. */
export const addLink: Factory<{ diagramId: Id; id: Id; sourceId: Id; targetId: Id }> = define(
	'addLink',
	(project, { diagramId, id, sourceId, targetId }) => ({
		label: t('cmd.addLink', {
			source: elementName(getElement(project, sourceId)),
			target: elementName(getElement(project, targetId))
		}),
		touches: [id, sourceId, targetId],
		apply(p): Command {
			for (const end of [sourceId, targetId])
				if (getElement(p, end).kind !== 'instance')
					throw new Error(`Cannot link ${end}: not an object`);
			const d = getDiagram(p, diagramId);
			p.elements.set(id, createLink({ id, sourceId, targetId }));
			d.elementIds.push(id);
			d.layout.set(id, defaultEdgeLayout());
			return deleteFromModel(p, { ids: [id] });
		}
	})
);
