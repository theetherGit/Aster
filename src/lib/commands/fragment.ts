/**
 * features.md `.mdj` import / export (M3): a fragment's elements, diagrams and kept JSON, added
 * as one undo step (mdj/fragment.ts reads it). The inverse takes away exactly what came in.
 */
import { t } from '#lib/i18n/index.ts';
import type { Fragment } from '#lib/mdj/fragment.ts';
import type { Package } from '#lib/model/types.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

/** The fragment's top-level classes and packages: the target package's new members. */
const tops = (f: Fragment) =>
	f.packageId
		? f.elements
				.filter(
					(e) =>
						(e.kind === 'classifier' && e.packageId === f.packageId) ||
						(e.kind === 'package' && e.parentId === f.packageId)
				)
				.map((e) => e.id)
		: [];

export const importFragment: Factory<Fragment> = define('importFragment', (project, f) => ({
	label: t('cmd.importFragment', { name: f.name }),
	touches: f.elements.map((e) => e.id),
	apply(p): Command {
		for (const e of f.elements) {
			p.elements.set(e.id, structuredClone(e));
			p.importedIds.add(e.id);
		}
		if (f.packageId) (p.elements.get(f.packageId) as Package).memberIds.push(...tops(f));
		for (const d of f.diagrams) {
			p.diagrams.push({ ...structuredClone(d), layout: new Map(structuredClone(d.layout)) });
			p.importedIds.add(d.id);
		}
		p.unknown.push(...structuredClone(f.unknown));
		return removeFragment(p, f);
	}
}));

/** The inverse of importFragment; not a user action. */
export const removeFragment: Factory<Fragment> = define('removeFragment', (project, f) => ({
	label: t('cmd.importFragment', { name: f.name }),
	touches: [],
	apply(p): Command {
		const own = new Set<string>([...f.elements.map((e) => e.id), ...f.diagrams.map((d) => d.id)]);
		for (const id of own) {
			p.elements.delete(id);
			p.importedIds.delete(id);
		}
		if (f.packageId) {
			const members = (p.elements.get(f.packageId) as Package).memberIds;
			const top = new Set(tops(f));
			members.splice(0, members.length, ...members.filter((id) => !top.has(id)));
		}
		for (let i = p.diagrams.length - 1; i >= 0; i--)
			if (own.has(p.diagrams[i].id)) p.diagrams.splice(i, 1);
		// Kept JSON: under one of the fragment's own elements, or moved to the top as an object of its own.
		const moved = new Set(
			f.unknown
				.filter((u) => !own.has(u.parentId ?? ''))
				.map((u) => (u.json as { _id?: string })._id)
		);
		for (let i = p.unknown.length - 1; i >= 0; i--) {
			const u = p.unknown[i];
			if (own.has(u.parentId ?? '') || moved.has((u.json as { _id?: string } | null)?._id))
				p.unknown.splice(i, 1);
		}
		return importFragment(p, f);
	}
}));
