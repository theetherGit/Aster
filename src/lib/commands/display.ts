/** Display toggles (features.md): per-diagram defaults and per-node overrides; diagram rename. */
import { t } from '#lib/i18n/index.ts';
import { getDiagram, getNodeLayout } from '#lib/model/project.ts';
import type { DisplayFlags, Id } from '#lib/model/types.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

export const FLAG_LABEL: Record<keyof DisplayFlags, string> = {
	showVisibility: 'flag.showVisibility',
	showType: 'flag.showType',
	showMultiplicity: 'flag.showMultiplicity',
	showOperationSignature: 'flag.showOperationSignature',
	showNamespace: 'flag.showNamespace',
	showProperty: 'flag.showProperty',
	suppressAttributes: 'flag.suppressAttributes',
	suppressOperations: 'flag.suppressOperations',
	suppressLiterals: 'flag.suppressLiterals',
	stereotypeDisplay: 'flag.stereotypeDisplay',
	wordWrap: 'flag.wordWrap',
	autoResize: 'flag.autoResize'
};

const describe = (patch: Partial<DisplayFlags>) =>
	(Object.keys(patch) as (keyof DisplayFlags)[]).map((k) => t(FLAG_LABEL[k] as never)).join(', ');

/** The diagram's defaults; every classifier without its own override follows them. */
export const setDiagramDefaults: Factory<{ diagramId: Id; patch: Partial<DisplayFlags> }> = define(
	'setDiagramDefaults',
	(project, { diagramId, patch }) => ({
		label: t('cmd.setDiagramDefaults', { what: describe(patch) }),
		touches: [],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			const previous: Partial<DisplayFlags> = {};
			for (const k of Object.keys(patch) as (keyof DisplayFlags)[]) {
				(previous as Record<string, unknown>)[k] = d.defaults[k];
				(d.defaults as unknown as Record<string, unknown>)[k] = patch[k];
			}
			return setDiagramDefaults(p, { diagramId, patch: previous });
		}
	})
);

/**
 * One node's overrides. A key set to `undefined` removes the override (the node follows the
 * diagram again); the inverse restores exactly what was there.
 */
export const setNodeFlags: Factory<{
	diagramId: Id;
	id: Id;
	patch: Partial<Record<keyof DisplayFlags, DisplayFlags[keyof DisplayFlags] | undefined>>;
}> = define('setNodeFlags', (project, { diagramId, id, patch }) => ({
	label: t('cmd.setNodeFlags', { what: describe(patch as Partial<DisplayFlags>) }),
	touches: [id],
	apply(p): Command {
		const l = getNodeLayout(getDiagram(p, diagramId), id);
		const flags: Record<string, unknown> = { ...l.flags };
		const previous: Record<string, unknown> = {};
		for (const k of Object.keys(patch)) {
			previous[k] = flags[k];
			if (patch[k as keyof DisplayFlags] === undefined) delete flags[k];
			else flags[k] = patch[k as keyof DisplayFlags];
		}
		if (Object.keys(flags).length) l.flags = flags as Partial<DisplayFlags>;
		else delete l.flags;
		return setNodeFlags(p, { diagramId, id, patch: previous as never });
	}
}));

export const renameDiagram: Factory<{ diagramId: Id; name: string }> = define(
	'renameDiagram',
	(project, { diagramId, name }) => ({
		label: t('cmd.renameDiagram', { name }),
		touches: [],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			const previous = d.name;
			d.name = name;
			return renameDiagram(p, { diagramId, name: previous });
		}
	})
);
