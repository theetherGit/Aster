/** Pure helpers for the Explorer tree: rows from the model, and ARIA tree keyboard moves. */
import { t } from '#lib/i18n/index.ts';
import { renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import type { Classifier, Id, Package, Project, Relationship } from '#lib/model/types.ts';

export interface TreeRow {
	/**
	 * Stable row id. Rows under a diagram are prefixed with it, so a classifier placed on two
	 * diagrams gets two rows: `project`, `diagram:<id>`, `diagram:<id>/element:<id>`,
	 * `…/package:<id>`, `…/member:<id>`; elements on no diagram sit under the project as
	 * `element:<id>`.
	 */
	id: string;
	label: string;
	/** Secondary text (kind), not used for type-ahead. Board 01: only when it says something. */
	hint?: string;
	/** Abstract classifiers read in italics, as on paper. */
	italic?: boolean;
	level: number;
	posinset: number;
	setsize: number;
	hasChildren: boolean;
	expanded: boolean;
	/** Model element this row stands for, when any. */
	elementId?: Id;
	/** Diagram whose subtree holds this row, when any. */
	diagramId?: Id;
}

type Draft = Omit<TreeRow, 'posinset' | 'setsize'> & { children?: () => Draft[] };

export const ROOT = 'project';
export const diagramRowId = (diagramId: Id) => `diagram:${diagramId}`;
export const rowIdFor = (elementId: Id, diagramId?: Id) =>
	diagramId ? `${diagramRowId(diagramId)}/element:${elementId}` : `element:${elementId}`;

const HINT: Partial<Record<Classifier['classifierKind'], string>> = {
	interface: 'explorer.hint.interface',
	enum: 'explorer.hint.enum',
	dataType: 'explorer.hint.dataType',
	primitiveType: 'explorer.hint.primitiveType'
};
const hintFor = (c: Classifier) => {
	const key = HINT[c.classifierKind] ?? (c.isAbstract ? 'explorer.hint.abstract' : undefined);
	return key ? t(key as Parameters<typeof t>[0]) : undefined;
};

/** Flattened visible rows: Project > diagrams > packages > classifiers > members, relationships. */
export function buildRows(project: Project, expanded: ReadonlySet<string>): TreeRow[] {
	const classifiers = [...project.elements.values()].filter(
		(e): e is Classifier => e.kind === 'classifier'
	);
	const packages = [...project.elements.values()].filter((e): e is Package => e.kind === 'package');
	const outgoing = new Map<Id, Relationship[]>();
	for (const el of project.elements.values())
		if (el.kind === 'relationship')
			outgoing.set(el.sourceId, [...(outgoing.get(el.sourceId) ?? []), el]);
	const nameOf = (id: Id) => {
		const el = project.elements.get(id);
		return el && 'name' in el && el.name ? el.name : id;
	};
	const placed = new Set(project.diagrams.flatMap((d) => d.elementIds));

	const memberRows = (c: Classifier, parentId: string, level: number): Draft[] => {
		const kinds: MemberKind[] = ['attribute', 'operation', 'literal'];
		return kinds.flatMap((kind) =>
			(kind === 'attribute' ? c.attributes : kind === 'operation' ? c.operations : c.literals).map(
				(m) => ({
					id: `${parentId}/member:${m.id}`,
					label: renderMember(kind, m, { guillemets: true }),
					hint: t(`member.${kind}`),
					level,
					hasChildren: false,
					expanded: false
				})
			)
		);
	};
	const relationshipRows = (c: Classifier, level: number, diagramId?: Id): Draft[] =>
		(outgoing.get(c.id) ?? []).map((r) => {
			const kind = t(`rel.${r.relationshipKind}`);
			const target = nameOf(r.targetId);
			return {
				id: rowIdFor(r.id, diagramId),
				label: r.name
					? t('explorer.relationshipNamed', { name: r.name, kind, target })
					: t('explorer.relationship', { kind, target }),
				hint: t('explorer.hint.relationship'),
				level,
				hasChildren: false,
				expanded: false,
				elementId: r.id,
				diagramId
			};
		});
	const classifierRow = (c: Classifier, level: number, diagramId?: Id): Draft => {
		const id = rowIdFor(c.id, diagramId);
		return {
			id,
			label: c.name,
			hint: hintFor(c),
			italic: c.isAbstract,
			level,
			hasChildren:
				c.attributes.length +
					c.operations.length +
					c.literals.length +
					(outgoing.get(c.id)?.length ?? 0) >
				0,
			expanded: expanded.has(id),
			elementId: c.id,
			diagramId,
			children: () => [
				...memberRows(c, id, level + 1),
				...relationshipRows(c, level + 1, diagramId)
			]
		};
	};
	const packageRow = (p: Package, level: number, members: Classifier[], diagramId?: Id): Draft => {
		const id = diagramId ? `${diagramRowId(diagramId)}/package:${p.id}` : `package:${p.id}`;
		return {
			id,
			label: p.name,
			hint: t('explorer.hint.package'),
			level,
			hasChildren: members.length > 0,
			expanded: expanded.has(id),
			elementId: p.id,
			diagramId,
			children: () => members.map((c) => classifierRow(c, level + 1, diagramId))
		};
	};
	/** Packages then classifiers from `pool`, nesting a classifier under its package when both are in the pool. */
	const scope = (pool: Set<Id>, level: number, diagramId?: Id): Draft[] => {
		const pkgs = packages.filter((p) => pool.has(p.id));
		const inPackage = (c: Classifier) => !!c.packageId && pool.has(c.packageId);
		return [
			...pkgs.map((p) =>
				packageRow(
					p,
					level,
					classifiers.filter((c) => c.packageId === p.id && pool.has(c.id)),
					diagramId
				)
			),
			...classifiers
				.filter((c) => pool.has(c.id) && !inPackage(c))
				.map((c) => classifierRow(c, level, diagramId))
		];
	};
	const diagramRow = (d: Project['diagrams'][number]): Draft => {
		const id = diagramRowId(d.id);
		const pool = new Set(d.elementIds);
		return {
			id,
			label: d.name,
			level: 2,
			hasChildren: [...pool].some((x) => {
				const k = project.elements.get(x)?.kind;
				return k === 'classifier' || k === 'package';
			}),
			expanded: expanded.has(id),
			children: () => scope(pool, 3, d.id)
		};
	};
	const unplaced = new Set(
		[...classifiers, ...packages].filter((e) => !placed.has(e.id)).map((e) => e.id)
	);
	const root: Draft = {
		id: ROOT,
		label: project.name,
		level: 1,
		hasChildren: true,
		expanded: expanded.has(ROOT),
		children: () => [...project.diagrams.map(diagramRow), ...scope(unplaced, 2)]
	};

	const out: TreeRow[] = [];
	const emit = (rows: Draft[]) =>
		rows.forEach(({ children, ...r }, i) => {
			out.push({ ...r, posinset: i + 1, setsize: rows.length });
			if (r.expanded && children) emit(children());
		});
	emit([root]);
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
