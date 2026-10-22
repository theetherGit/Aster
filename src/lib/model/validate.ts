/**
 * Model validation (features.md M2): StarUML's class-diagram rules UML001–012 as documented at
 * docs.staruml.io/user-guide/validation-rules (UML005 does not exist; UML012, "aggregation must
 * be one in an association", holds by construction since an Aster association carries one
 * diamond), and Aster's own ASTER001. Pure: findings carry ids and the subject's name; the panel
 * words them through i18n. Never blocks anything.
 */
import type { Classifier, Id, Project, Relationship } from './types.ts';

export type RuleId =
	| 'UML001'
	| 'UML002'
	| 'UML003'
	| 'UML004'
	| 'UML006'
	| 'UML007'
	| 'UML008'
	| 'UML009'
	| 'UML010'
	| 'UML011'
	| 'ASTER001';

export interface Finding {
	rule: RuleId;
	/** The classifier (or, for ASTER001, the relationship) to jump to. */
	elementId: Id;
	/** The member the finding is about, when it is one. */
	memberId?: Id;
	/** The name the message is about: the element's, the member's or the role's; may be empty. */
	subject: string;
	/** ASTER001: why the child should not be the child. */
	detail?: 'abstract' | 'interface';
}

/** Groups by key and returns the groups with more than one entry, in first-seen order. */
function duplicates<T>(items: T[], key: (x: T) => string | null): T[][] {
	const groups = new Map<string, T[]>();
	for (const x of items) {
		const k = key(x);
		if (k === null) continue;
		groups.set(k, [...(groups.get(k) ?? []), x]);
	}
	return [...groups.values()].filter((g) => g.length > 1);
}

export function validate(project: Project): Finding[] {
	const classifiers: Classifier[] = [];
	const rels: Relationship[] = [];
	for (const el of project.elements.values()) {
		if (el.kind === 'classifier') classifiers.push(el);
		else if (el.kind === 'relationship') rels.push(el);
	}
	const byId = new Map(classifiers.map((c) => [c.id, c]));
	const gens = rels.filter((r) => r.relationshipKind === 'generalization');
	const parents = new Map<Id, Id[]>();
	for (const g of gens) parents.set(g.sourceId, [...(parents.get(g.sourceId) ?? []), g.targetId]);
	/** Every ancestor through generalizations, cycle-safe; includes `id` itself only on a cycle. */
	const cache = new Map<Id, Set<Id>>();
	const ancestors = (id: Id): Set<Id> => {
		let seen = cache.get(id);
		if (seen) return seen;
		seen = new Set<Id>();
		const todo = [...(parents.get(id) ?? [])];
		while (todo.length) {
			const next = todo.pop()!;
			if (seen.has(next)) continue;
			seen.add(next);
			todo.push(...(parents.get(next) ?? []));
		}
		cache.set(id, seen);
		return seen;
	};
	const hasChild = new Set(gens.map((g) => g.targetId));

	const out: Finding[] = [];
	const add = (rule: RuleId, elementId: Id, subject: string, memberId?: Id) =>
		out.push({ rule, elementId, subject, ...(memberId && { memberId }) });

	// UML001 Name expected. An attribute may go unnamed when it has a type (StarUML's exception).
	for (const c of classifiers) {
		if (!c.name.trim()) add('UML001', c.id, '');
		for (const a of c.attributes) if (!a.name.trim() && !a.type) add('UML001', c.id, '', a.id);
		for (const o of c.operations) {
			if (!o.name.trim()) add('UML001', c.id, '', o.id);
			for (const p of o.parameters) if (!p.name.trim()) add('UML001', c.id, o.name, o.id);
		}
		for (const l of c.literals) if (!l.name.trim()) add('UML001', c.id, '', l.id);
	}

	// UML002 Name is already defined in the namespace (a package, or the model; a classifier for
	// its attributes and literals; an operation for its parameters). Operations are exempt.
	for (const g of duplicates(classifiers, (c) =>
		c.name.trim() ? `${c.packageId ?? ''}/${c.name}` : null
	))
		for (const c of g) add('UML002', c.id, c.name);
	for (const c of classifiers) {
		const named = [...c.attributes, ...c.literals];
		for (const g of duplicates(named, (m) => m.name.trim() || null))
			for (const m of g) add('UML002', c.id, m.name, m.id);
		for (const o of c.operations)
			for (const g of duplicates(o.parameters, (p) => p.name.trim() || null))
				add('UML002', c.id, g[0].name, o.id);
	}

	// UML003 Conflict with inherited attributes.
	for (const c of classifiers) {
		const inherited = new Set(
			[...ancestors(c.id)]
				.filter((id) => id !== c.id)
				.flatMap((id) => byId.get(id)?.attributes.map((a) => a.name) ?? [])
		);
		for (const a of c.attributes)
			if (a.name.trim() && inherited.has(a.name)) add('UML003', c.id, a.name, a.id);
	}

	// UML004 Signature conflict: one name, the same parameter types.
	for (const c of classifiers)
		for (const g of duplicates(
			c.operations,
			(o) => `${o.name}(${o.parameters.map((p) => p.type ?? '').join(',')})`
		))
			for (const o of g) add('UML004', c.id, o.name, o.id);

	// UML006 Final and leaf element must not have child.
	for (const c of classifiers) if (c.isLeaf && hasChild.has(c.id)) add('UML006', c.id, c.name);

	// UML007 / UML009 Duplicated generalizations / realizations, on the child, once per pair.
	for (const [rule, kind] of [
		['UML007', 'generalization'],
		['UML009', 'realization']
	] as const)
		for (const g of duplicates(
			rels.filter((r) => r.relationshipKind === kind),
			(r) => `${r.sourceId}>${r.targetId}`
		))
			add(rule, g[0].sourceId, byId.get(g[0].targetId)?.name ?? '');

	// UML008 Circular generalizations: every class that is its own ancestor.
	for (const c of classifiers) if (ancestors(c.id).has(c.id)) add('UML008', c.id, c.name);

	// UML010 Duplicated role names of associated classifiers: the roles a class sees at the far
	// end of its associations.
	// One pass over the associations, not one per class: a 10 MB file has thousands of each.
	const farRoles = new Map<Id, (string | undefined)[]>();
	const see = (id: Id, role: string | undefined) => {
		const list = farRoles.get(id);
		if (list) list.push(role);
		else farRoles.set(id, [role]);
	};
	for (const r of rels) {
		if (!r.sourceEnd && !r.targetEnd) continue;
		// A self-association gives its class both roles, as before.
		see(r.sourceId, r.targetEnd?.role);
		see(r.targetId, r.sourceEnd?.role);
	}
	for (const c of classifiers) {
		const roles = farRoles.get(c.id) ?? [];
		for (const g of duplicates(roles, (role) => role?.trim() || null)) add('UML010', c.id, g[0]!);
	}

	// UML011 All attributes and operations of an interface must be public.
	for (const c of classifiers) {
		if (c.classifierKind !== 'interface') continue;
		for (const m of [...c.attributes, ...c.operations])
			if (m.visibility !== 'public') add('UML011', c.id, m.name, m.id);
	}

	// ASTER001: an abstract class or an interface drawn as the child of a concrete class.
	for (const g of gens) {
		const child = byId.get(g.sourceId);
		const parent = byId.get(g.targetId);
		if (!child || !parent || parent.isAbstract || parent.classifierKind === 'interface') continue;
		const detail =
			child.classifierKind === 'interface' ? 'interface' : child.isAbstract ? 'abstract' : null;
		if (detail) out.push({ rule: 'ASTER001', elementId: g.id, subject: child.name, detail });
	}
	return out;
}
