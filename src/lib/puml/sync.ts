/**
 * Text view → model (features.md M2, Text view): what one parse of the text changes, as one batch
 * command, so a parse is one undo step. The text is a projection of one diagram: a class the text
 * drops leaves the diagram, not the model (as ⌫); facts PlantUML cannot say (roles, ownership dots,
 * documentation, layout) are kept from the model.
 */
import type { BatchArgs } from '#lib/commands/batch.ts';
import {
	addClassifier,
	addNote,
	addToDiagram,
	connect,
	deleteFromDiagram,
	linkNote,
	replaceElement,
	setElementText,
	unlinkNote
} from '#lib/commands/index.ts';
import { serialise } from '#lib/commands/registry.ts';
import type { SerialisedCommand } from '#lib/commands/types.ts';
import { t } from '#lib/i18n/index.ts';
import { memberFromText, renderMember, type Member, type MemberKind } from '#lib/mdj/expression.ts';
import { newId } from '#lib/model/ids.ts';
import { createClassifier, createRelationship, getDiagram } from '#lib/model/project.ts';
import type {
	Attribute,
	Classifier,
	End,
	Id,
	Literal,
	Note,
	Operation,
	Point,
	Project,
	Relationship
} from '#lib/model/types.ts';
import type { PClassifier, PEnd, PRelationship, PumlDoc } from './parse.ts';

export interface SyncOptions {
	mint?: () => Id;
	/** Where a class or note new to the diagram goes (the canvas finds free space). */
	place: (name: string) => Point;
}

/** Key-order-free equality for plain model objects. */
const stable = (v: unknown): string =>
	JSON.stringify(v, (_, x) =>
		x && typeof x === 'object' && !Array.isArray(x)
			? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
			: x
	);
const same = (a: unknown, b: unknown) => stable(a) === stable(b);
const canon = (kind: MemberKind, text: string) =>
	renderMember(kind, memberFromText(kind, text, 'x'));

/** The members the text lists, reusing the model's member (id, documentation) wherever it still fits. */
function members(existing: Classifier | null, pc: PClassifier, mint: () => Id) {
	const out: Record<MemberKind, Member[]> = { attribute: [], operation: [], literal: [] };
	const pool: Record<MemberKind, Member[]> = {
		attribute: [...(existing?.attributes ?? [])],
		operation: [...(existing?.operations ?? [])],
		literal: [...(existing?.literals ?? [])]
	};
	const used = new Set<Member>();
	for (const l of pc.lines) {
		const list = pool[l.kind];
		const text = canon(l.kind, l.text);
		const exact = list.find((m) => !used.has(m) && renderMember(l.kind, m) === text);
		if (exact) {
			used.add(exact);
			out[l.kind].push(exact);
			continue;
		}
		// Edited in place: the member at the same position keeps its id and documentation.
		const at = list[out[l.kind].length];
		const prev = at && !used.has(at) ? at : undefined;
		if (prev) used.add(prev);
		out[l.kind].push(memberFromText(l.kind, l.text, prev?.id ?? mint(), prev));
	}
	return {
		attributes: out.attribute as Attribute[],
		operations: out.operation as Operation[],
		literals: out.literal as Literal[]
	};
}

/** The classifier as the text has it, on top of the model's (null for a new one). */
function desired(existing: Classifier | null, pc: PClassifier, id: Id, mint: () => Id): Classifier {
	const base = existing ?? createClassifier({ id, name: pc.name });
	if (!pc.declared) return { ...base, name: pc.name };
	const c: Classifier = {
		...base,
		name: pc.name,
		classifierKind: pc.kind,
		// Only a class says abstract in the text; an imported abstract interface stays as it was.
		isAbstract: pc.kind === 'class' ? pc.isAbstract : base.isAbstract,
		...members(existing, pc, mint)
	};
	if (pc.stereotype) c.stereotype = pc.stereotype;
	else delete c.stereotype;
	return c;
}

function end(existing: End | undefined, p: PEnd): End {
	const e: End = {
		navigable: 'unspecified',
		isDerived: false,
		isOrdered: false,
		isUnique: false,
		ownsOther: false,
		...existing
	};
	if (p.multiplicity) e.multiplicity = p.multiplicity;
	else delete e.multiplicity;
	// An arrowhead says navigable; its absence says nothing more than "not shown as navigable".
	if (p.navigable) e.navigable = 'navigable';
	else if (e.navigable === 'navigable') e.navigable = 'unspecified';
	return e;
}
function merged(r: Relationship, p: PRelationship): Relationship {
	const out: Relationship = { ...r };
	if (p.name) out.name = p.name;
	else delete out.name;
	if (p.stereotype) out.stereotype = p.stereotype;
	else delete out.stereotype;
	if (r.sourceEnd || r.targetEnd) {
		out.sourceEnd = end(r.sourceEnd, p.sourceEnd);
		out.targetEnd = end(r.targetEnd, p.targetEnd);
	}
	return out;
}

export function planSync(
	project: Project,
	diagramId: Id,
	doc: PumlDoc,
	{ mint = newId, place }: SyncOptions
): BatchArgs | null {
	if (doc.errors.length) return null;
	const d = getDiagram(project, diagramId);
	const el = (id: Id) => project.elements.get(id);
	const shown = d.elementIds.map(el).filter((e): e is Classifier => e?.kind === 'classifier');
	const current = new Map<string, Classifier>();
	for (const c of shown) if (!current.has(c.name)) current.set(c.name, c);
	const named = new Set(doc.classifiers.map((c) => c.name));
	const added = doc.classifiers.filter((c) => !current.has(c.name));
	const removed = [...current.values()].filter((c) => !named.has(c.name));
	// One class gone and one new in the same edit is a rename: its place, links and id stay.
	const renamed = added.length === 1 && removed.length === 1 && added[0].declared;
	if (renamed) current.set(added[0].name, removed[0]);

	const commands: SerialisedCommand[] = [];
	const run = (c: Parameters<typeof serialise>[0]) => commands.push(serialise(c));
	const idOf = new Map<string, Id>([...current].map(([n, c]) => [n, c.id]));

	for (const pc of doc.classifiers) {
		const existing = current.get(pc.name);
		if (existing) {
			const next = desired(existing, pc, existing.id, mint);
			if (!same(next, existing)) run(replaceElement(project, { element: next }));
			continue;
		}
		// On another diagram already: this one gets a view of it, not a twin.
		const elsewhere = [...project.elements.values()].find(
			(e): e is Classifier => e.kind === 'classifier' && e.name === pc.name
		);
		const at = place(pc.name);
		if (elsewhere) {
			idOf.set(pc.name, elsewhere.id);
			run(
				addToDiagram(project, {
					diagramId,
					entries: [{ id: elsewhere.id, layout: { kind: 'node', ...at, w: 160, h: 80 } }]
				})
			);
			const next = desired(elsewhere, pc, elsewhere.id, mint);
			if (!same(next, elsewhere)) run(replaceElement(project, { element: next }));
			continue;
		}
		const id = mint();
		idOf.set(pc.name, id);
		run(addClassifier(project, { diagramId, classifier: desired(null, pc, id, mint), at }));
	}
	const gone = removed.filter((c) => !(renamed && c === removed[0])).map((c) => c.id);

	// Relationships: matched by kind and ends; what the text adds is connected, what it drops leaves.
	const ids = new Set(idOf.values());
	const existingRels = d.elementIds
		.map(el)
		.filter(
			(e): e is Relationship =>
				e?.kind === 'relationship' && ids.has(e.sourceId) && ids.has(e.targetId)
		);
	const used = new Set<Relationship>();
	for (const p of doc.relationships) {
		const sourceId = idOf.get(p.source)!;
		const targetId = idOf.get(p.target)!;
		const match = existingRels.find(
			(r) =>
				!used.has(r) &&
				r.relationshipKind === p.kind &&
				r.sourceId === sourceId &&
				r.targetId === targetId
		);
		if (match) {
			used.add(match);
			const next = merged(match, p);
			if (!same(next, match)) run(replaceElement(project, { element: next }));
			continue;
		}
		const id = mint();
		run(connect(project, { diagramId, id, sourceId, targetId, kind: p.kind }));
		const fresh = createRelationship({ id, relationshipKind: p.kind, sourceId, targetId });
		const next = merged(fresh, p);
		if (!same(next, fresh)) run(replaceElement(project, { element: next }));
	}
	const allRels = d.elementIds.map(el).filter((e): e is Relationship => e?.kind === 'relationship');
	gone.push(
		...allRels
			.filter(
				(r) =>
					!used.has(r) &&
					existingRels.includes(r) &&
					!gone.includes(r.sourceId) &&
					!gone.includes(r.targetId)
			)
			.map((r) => r.id)
	);

	// Notes: the k-th note in the text is the k-th on the diagram; links by alias.
	const notes = d.elementIds.map(el).filter((e): e is Note => e?.kind === 'note');
	const noteIds = new Map<string, Id>();
	doc.notes.forEach((pn, k) => {
		const n = notes[k];
		if (n) {
			noteIds.set(pn.alias, n.id);
			if (n.text !== pn.text) run(setElementText(project, { id: n.id, text: pn.text }));
		} else {
			const id = mint();
			noteIds.set(pn.alias, id);
			run(
				addNote(project, {
					diagramId,
					note: { kind: 'note', id, text: pn.text, linkedIds: [] },
					at: place(pn.alias)
				})
			);
		}
	});
	gone.push(...notes.slice(doc.notes.length).map((n) => n.id));
	for (const [alias, noteId] of noteIds) {
		const want = new Set(
			doc.links
				.filter((l) => l.alias === alias)
				.map((l) => idOf.get(l.target))
				.filter((x): x is Id => !!x)
		);
		const have = (notes.find((n) => n.id === noteId)?.linkedIds ?? []).filter((x) => ids.has(x));
		for (const target of want)
			if (!have.includes(target)) run(linkNote(project, { noteId, targetId: target }));
		for (const target of have)
			if (!want.has(target)) run(unlinkNote(project, { noteId, targetId: target }));
	}

	if (gone.length) run(deleteFromDiagram(project, { diagramId, ids: gone }));
	return commands.length ? { label: t('cmd.textEdit'), commands } : null;
}
