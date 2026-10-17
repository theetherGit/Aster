/** Pure helpers for the Explorer tree: rows from the model, and ARIA tree keyboard moves. */
import { t } from '#lib/i18n/index.ts';
import { renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import type { Classifier, Id, Project } from '#lib/model/types.ts';

export interface TreeRow {
	/** Stable row id: `project`, `diagram:<id>`, `package:<id>`, `element:<id>`, `member:<cid>:<mid>`. */
	id: string;
	label: string;
	/** Secondary text (kind), not used for type-ahead. */
	hint?: string;
	level: number;
	posinset: number;
	setsize: number;
	hasChildren: boolean;
	expanded: boolean;
	/** Model element this row stands for, when any. */
	elementId?: Id;
}

export const ROOT = 'project';
export const rowIdFor = (elementId: Id) => `element:${elementId}`;

const memberRows = (c: Classifier, level: number): Omit<TreeRow, 'posinset' | 'setsize'>[] => {
	const kinds: MemberKind[] = ['attribute', 'operation', 'literal'];
	return kinds.flatMap((kind) =>
		(kind === 'attribute' ? c.attributes : kind === 'operation' ? c.operations : c.literals).map(
			(m) => ({
				id: `member:${c.id}:${m.id}`,
				label: renderMember(kind, m, { guillemets: true }),
				hint: t(`member.${kind}`),
				level,
				hasChildren: false,
				expanded: false
			})
		)
	);
};

/** Flattened visible rows: Project > diagrams, packages, classifiers > members. */
export function buildRows(project: Project, expanded: ReadonlySet<string>): TreeRow[] {
	const out: TreeRow[] = [];
	const push = (rows: Omit<TreeRow, 'posinset' | 'setsize'>[]) =>
		rows.forEach((r, i) => out.push({ ...r, posinset: i + 1, setsize: rows.length }));

	const rootOpen = expanded.has(ROOT);
	push([{ id: ROOT, label: project.name, level: 1, hasChildren: true, expanded: rootOpen }]);
	if (!rootOpen) return out;

	const level2: Omit<TreeRow, 'posinset' | 'setsize'>[] = [];
	for (const d of project.diagrams)
		level2.push({
			id: `diagram:${d.id}`,
			label: d.name,
			hint: t('ui.kind.diagram'),
			level: 2,
			hasChildren: false,
			expanded: false
		});
	const classifiers = [...project.elements.values()].filter(
		(e): e is Classifier => e.kind === 'classifier'
	);
	const classifierRow = (c: Classifier, level: number) => ({
		id: rowIdFor(c.id),
		label: c.name,
		hint: t(`ui.kind.${c.classifierKind}`),
		level,
		hasChildren: c.attributes.length + c.operations.length + c.literals.length > 0,
		expanded: expanded.has(rowIdFor(c.id)),
		elementId: c.id
	});
	for (const el of project.elements.values()) {
		if (el.kind !== 'package') continue;
		level2.push({
			id: `package:${el.id}`,
			label: el.name,
			hint: t('ui.kind.package'),
			level: 2,
			hasChildren: el.memberIds.length > 0,
			expanded: expanded.has(`package:${el.id}`),
			elementId: el.id
		});
	}
	for (const c of classifiers) if (!c.packageId) level2.push(classifierRow(c, 2));

	// Emit level-2 rows in order, interleaving each expanded row's children right after it.
	const emitWithChildren = (rows: Omit<TreeRow, 'posinset' | 'setsize'>[]) => {
		rows.forEach((r, i) => {
			out.push({ ...r, posinset: i + 1, setsize: rows.length });
			if (!r.expanded) return;
			if (r.id.startsWith('package:')) {
				const pkg = project.elements.get(r.id.slice('package:'.length));
				if (pkg?.kind !== 'package') return;
				emitWithChildren(
					pkg.memberIds
						.map((id) => project.elements.get(id))
						.filter((e): e is Classifier => e?.kind === 'classifier')
						.map((c) => classifierRow(c, r.level + 1))
				);
			} else if (r.elementId) {
				const c = project.elements.get(r.elementId);
				if (c?.kind === 'classifier') push(memberRows(c, r.level + 1));
			}
		});
	};
	emitWithChildren(level2);
	return out;
}

export function parentIndex(rows: TreeRow[], i: number): number {
	for (let j = i - 1; j >= 0; j--) if (rows[j].level < rows[i].level) return j;
	return -1;
}

/** Next row index for a type-ahead prefix, searching forward from `from` and wrapping. */
export function typeAheadIndex(rows: TreeRow[], from: number, prefix: string): number {
	const p = prefix.toLowerCase();
	const n = rows.length;
	// A repeated single character cycles through matches instead of staying put.
	const start = p.length === 1 || !rows[from]?.label.toLowerCase().startsWith(p) ? from + 1 : from;
	for (let k = 0; k < n; k++) {
		const i = (start + k) % n;
		if (rows[i].label.toLowerCase().startsWith(p)) return i;
	}
	return -1;
}
