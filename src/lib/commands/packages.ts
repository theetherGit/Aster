/** Packages with containment (features.md M3.1). Renaming goes through replaceElement. */
import { t } from '#lib/i18n/index.ts';
import {
	descendantsOf,
	elementName,
	getDiagram,
	getElement,
	ownerOf,
	setOwner
} from '#lib/model/project.ts';
import type { Id, Package, Point } from '#lib/model/types.ts';
import { deleteFromModel } from './elements.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

/** ui.md: a package is at least 240 × 160. */
export const PACKAGE_MIN = { w: 240, h: 160 };

/** A package at the back of the diagram, so it never covers what it holds (in StarUML too). */
export const addPackage: Factory<{ diagramId: Id; pkg: Package; at: Point }> = define(
	'addPackage',
	(project, { diagramId, pkg, at }) => ({
		label: t('cmd.addPackage', { name: pkg.name }),
		touches: [pkg.id],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			const el = structuredClone(pkg);
			p.elements.set(el.id, el);
			if (el.parentId) setOwner(p, el, el.parentId);
			d.elementIds.unshift(el.id);
			d.layout.set(el.id, { kind: 'node', x: at.x, y: at.y, ...PACKAGE_MIN });
			return deleteFromModel(p, { ids: [el.id] });
		}
	})
);

/**
 * Moves elements into a package (`to`), or to the top of the model (`null`). A package cannot go
 * into itself or anything it holds. The inverse moves each back where it was.
 */
export const moveToPackage: Factory<{ moves: { id: Id; to: Id | null }[] }> = define(
	'moveToPackage',
	(project, { moves }) => {
		const to = moves[0]?.to;
		const target = to ? project.elements.get(to) : undefined;
		return {
			label: t('cmd.moveToPackage', {
				name:
					moves.length === 1
						? elementName(getElement(project, moves[0].id))
						: t('cmd.many', { count: moves.length }),
				package: target ? elementName(target) : t('cmd.topLevel')
			}),
			touches: moves.map((m) => m.id),
			apply(p): Command {
				const back = moves.map(({ id, to }) => {
					const el = getElement(p, id);
					if (to && (to === id || descendantsOf(p, id).includes(to)))
						throw new Error(`Cannot move ${id} into itself`);
					if (to && getElement(p, to).kind !== 'package') throw new Error(`${to} is not a package`);
					const from = ownerOf(el) ?? null;
					setOwner(p, el, to);
					return { id, to: from };
				});
				return moveToPackage(p, { moves: back.reverse() });
			}
		};
	}
);
