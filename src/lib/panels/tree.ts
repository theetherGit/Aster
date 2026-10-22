/** Pure helpers for the Explorer tree: rows from the model, and ARIA tree keyboard moves. */
import { t } from '#lib/i18n/index.ts';
import { renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import { instanceLabel, ownerOf } from '#lib/model/project.ts';
import type {
	Classifier,
	Id,
	Instance,
	Link,
	Package,
	Project,
	Relationship
} from '#lib/model/types.ts';

export interface TreeRow {
	/**
	 * Stable row id. Rows under a diagram are prefixed with it, so a classifier placed on two
	 * diagrams gets two rows: `project`, `diagram:<id>`, `diagram:<id>/element:<id>`,
	 * `…/package:<id>`, `…/member:<id>`; elements on no diagram sit under the project as
	 * `element:<id>`.
	 */
	id: string;
	label: string;
	/** What type-ahead matches when the label does not start with the element's name (members, relationships). */
	name?: string;
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
	/** Diagram whose subtree holds this row (or the diagram itself), when any. */
	diagramId?: Id;
	/** What the row stands for, so the Outline knows how to rename, add, reorder and delete (M2). */
	type:
		| 'project'
		| 'diagram'
		| 'package'
		| 'classifier'
		| 'member'
		| 'relationship'
		| 'instance'
		| 'link';
	/** Member rows: the classifier, the compartment, the place in it, the member's id. */
	owner?: Id;
	memberKind?: MemberKind;
	memberIndex?: number;
	memberId?: Id;
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
	const instances = [...project.elements.values()].filter(
		(e): e is Instance => e.kind === 'instance'
	);
	const outgoing = new Map<Id, Relationship[]>();
	const links = new Map<Id, Link[]>();
	for (const el of project.elements.values())
		if (el.kind === 'relationship')
			outgoing.set(el.sourceId, [...(outgoing.get(el.sourceId) ?? []), el]);
		else if (el.kind === 'link') links.set(el.sourceId, [...(links.get(el.sourceId) ?? []), el]);
	const nameOf = (id: Id) => {
		const el = project.elements.get(id);
		if (el?.kind === 'instance') return instanceLabel(el) || id;
		return el && 'name' in el && el.name ? el.name : id;
	};
	const placed = new Set(project.diagrams.flatMap((d) => d.elementIds));

	const memberRows = (c: Classifier, parentId: string, level: number, diagramId?: Id): Draft[] => {
		const kinds: MemberKind[] = ['attribute', 'operation', 'literal'];
		return kinds.flatMap((kind) =>
			(kind === 'attribute' ? c.attributes : kind === 'operation' ? c.operations : c.literals).map(
				(m, index) => ({
					id: `${parentId}/member:${m.id}`,
					type: 'member' as const,
					label: renderMember(kind, m, { guillemets: true }),
					name: m.name,
					hint: t(`member.${kind}`),
					level,
					hasChildren: false,
					expanded: false,
					owner: c.id,
					memberKind: kind,
					memberIndex: index,
					memberId: m.id,
					diagramId
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
				type: 'relationship' as const,
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
			type: 'classifier',
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
				...memberRows(c, id, level + 1, diagramId),
				...relationshipRows(c, level + 1, diagramId)
			]
		};
	};
	/** An object (M3.2) and, under it, the links it owns (it is their source, as in StarUML). */
	const instanceRow = (o: Instance, level: number, diagramId?: Id): Draft => {
		const id = rowIdFor(o.id, diagramId);
		const own = links.get(o.id) ?? [];
		return {
			id,
			type: 'instance',
			label: instanceLabel(o) || t('object.anonymous'),
			name: o.name,
			hint: t('explorer.hint.object'),
			level,
			hasChildren: own.length > 0,
			expanded: expanded.has(id),
			elementId: o.id,
			diagramId,
			children: () =>
				own.map((l) => ({
					id: rowIdFor(l.id, diagramId),
					type: 'link' as const,
					label: l.name
						? t('explorer.linkNamed', { name: l.name, target: nameOf(l.targetId) })
						: t('explorer.link', { target: nameOf(l.targetId) }),
					hint: t('explorer.hint.link'),
					level: level + 1,
					hasChildren: false,
					expanded: false,
					elementId: l.id,
					diagramId
				}))
		};
	};
	const packageRow = (p: Package, level: number, pool: Set<Id>, diagramId?: Id): Draft => {
		const id = diagramId ? `${diagramRowId(diagramId)}/package:${p.id}` : `package:${p.id}`;
		const inside = scope(pool, level + 1, diagramId, p.id);
		return {
			id,
			type: 'package',
			label: p.name,
			hint: t('explorer.hint.package'),
			level,
			hasChildren: inside.length > 0,
			expanded: expanded.has(id),
			elementId: p.id,
			diagramId,
			children: () => inside
		};
	};
	/**
	 * What `pool` holds directly under `parent` (the top when undefined): packages, classifiers,
	 * then objects. An element sits under the nearest package that holds it and is in the pool
	 * too, so nesting shows to any depth (M3.1).
	 */
	const scope = (pool: Set<Id>, level: number, diagramId?: Id, parent?: Id): Draft[] => {
		const shownParent = (el: Package | Classifier | Instance) => {
			const seen = new Set<Id>();
			for (let o = ownerOf(el); o && !seen.has(o);) {
				if (pool.has(o)) return o;
				seen.add(o);
				const up = project.elements.get(o);
				o = up && ownerOf(up);
			}
			return undefined;
		};
		const here = <T extends Package | Classifier | Instance>(list: T[]) =>
			list.filter((e) => pool.has(e.id) && shownParent(e) === parent);
		return [
			...here(packages).map((p) => packageRow(p, level, pool, diagramId)),
			...here(classifiers).map((c) => classifierRow(c, level, diagramId)),
			...here(instances).map((o) => instanceRow(o, level, diagramId))
		];
	};
	const diagramRow = (d: Project['diagrams'][number]): Draft => {
		const id = diagramRowId(d.id);
		const pool = new Set(d.elementIds);
		return {
			id,
			type: 'diagram',
			diagramId: d.id,
			label: d.name,
			level: 2,
			hasChildren: [...pool].some((x) => {
				const k = project.elements.get(x)?.kind;
				return k === 'classifier' || k === 'package' || k === 'instance';
			}),
			expanded: expanded.has(id),
			children: () => scope(pool, 3, d.id)
		};
	};
	const unplaced = new Set(
		[...classifiers, ...packages, ...instances].filter((e) => !placed.has(e.id)).map((e) => e.id)
	);
	const root: Draft = {
		id: ROOT,
		type: 'project',
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
	const matches = (r: TreeRow | undefined) =>
		!!r && (r.name ?? r.label).toLowerCase().startsWith(p);
	// A repeated single character cycles through matches instead of staying put.
	const start = p.length === 1 || !matches(rows[from]) ? from + 1 : from;
	for (let k = 0; k < n; k++) {
		const i = (start + k) % n;
		if (matches(rows[i])) return i;
	}
	return -1;
}

/**
 * The row that carries tabindex=0: the focused row when visible, else its nearest visible
 * ancestor (row ids are paths, so an ancestor's id is a prefix), else the first row.
 */
export function tabStopIndex(rows: TreeRow[], focusedId: string): number {
	let best = 0;
	let bestLen = -1;
	rows.forEach((r, i) => {
		const ok = r.id === focusedId || focusedId.startsWith(r.id + '/') || r.id === ROOT;
		if (ok && r.id.length > bestLen) {
			best = i;
			bestLen = r.id.length;
		}
	});
	return best;
}
