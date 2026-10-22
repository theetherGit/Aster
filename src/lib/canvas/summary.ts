import { t, type MessageKey } from '#lib/i18n/index.ts';
import { isRaw, parseMember, type MemberKind, type RawReason } from '#lib/mdj/expression.ts';
import { descendantsOf, elementName, PRIMITIVE_TYPES } from '#lib/model/project.ts';
import type { Diagram, Id, Project, Relationship } from '#lib/model/types.ts';

/**
 * Board 04: the chip under a node while a line is open. Short segments joined with " · "
 * (visibility, type, default, flags), green when the line parses and amber when it is kept
 * as text.
 */
export function summarise(kind: MemberKind, text: string): { ok: boolean; parts: string[] } {
	const p = parseMember(kind, text);
	if (isRaw(p)) return { ok: false, parts: [t('member.summary.raw'), reasonText(p.reason)] };
	if (kind === 'literal') return { ok: true, parts: [t('member.summary.literal')] };
	const parts: string[] = [t(`vis.${(p as { visibility: 'public' }).visibility}`)];
	if ('parameters' in p) {
		if (p.returnType) parts.push(t('member.summary.returns', { type: p.returnType }));
		if (p.parameters.length)
			parts.push(
				t(p.parameters.length === 1 ? 'member.summary.params.one' : 'member.summary.params', {
					count: p.parameters.length
				})
			);
	} else if ('type' in p) {
		if (p.type) parts.push(p.type);
		if (p.defaultValue !== undefined)
			parts.push(t('member.summary.default', { value: p.defaultValue }));
	}
	if ('isStatic' in p && p.isStatic) parts.push(t('member.flag.static'));
	if ('isAbstract' in p && p.isAbstract) parts.push(t('member.flag.abstract'));
	if ('isDerived' in p && p.isDerived) parts.push(t('member.flag.derived'));
	if ('isReadOnly' in p && p.isReadOnly) parts.push(t('member.flag.readOnly'));
	if ('isQuery' in p && p.isQuery) parts.push(t('member.flag.query'));
	return { ok: true, parts };
}

const count = (key: 'attributes' | 'operations' | 'literals', n: number) =>
	t(n === 1 ? `summary.${key}.one` : (`summary.${key}` as MessageKey), { count: n });
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What the live region says when roving focus lands on an element (accessibility.md, board 10):
 * "Book, class. 3 attributes, 1 operation. Realizes Searchable; part of Library; Loan refers to
 * it." With `hint`, the keys follow, for the first element focused on entering the diagram.
 * Without it, also the node's accessible name.
 */
/** A diagram's relationships by the class at either end, in diagram order. */
export type RelIndex = Map<Id, Relationship[]>;

/**
 * Built once per diagram change and shared by every node's summary (flow.relIndex): without it each
 * summary scans the whole diagram, which is quadratic, and a 10 MB file has thousands of nodes.
 */
export function relationshipsByEnd(project: Project, diagram: Diagram): RelIndex {
	const index: RelIndex = new Map();
	const add = (id: Id, r: Relationship) => {
		const list = index.get(id);
		if (list) list.push(r);
		else index.set(id, [r]);
	};
	for (const id of diagram.elementIds) {
		const r = project.elements.get(id);
		if (r?.kind !== 'relationship') continue;
		add(r.sourceId, r);
		if (r.targetId !== r.sourceId) add(r.targetId, r);
	}
	return index;
}

export function elementSummary(
	project: Project,
	diagram: Diagram,
	id: Id,
	opts: { hint?: boolean; index?: RelIndex } = {}
): string {
	const el = project.elements.get(id);
	if (!el) return '';
	const name = (x: Id) => {
		const e = project.elements.get(x);
		return e ? elementName(e) : x;
	};
	if (el.kind === 'relationship')
		return t('edge.label', {
			source: name(el.sourceId),
			target: name(el.targetId),
			kind: t(`rel.${el.relationshipKind}`)
		});
	if (el.kind === 'note') return t('summary.note', { text: el.text });
	if (el.kind === 'text') return t('summary.text', { text: el.text });
	if (el.kind === 'package') {
		const count = descendantsOf(project, el.id).length;
		return t(count === 1 ? 'summary.package.one' : 'summary.package', { name: el.name, count });
	}
	if (el.kind === 'instance')
		return [
			t('summary.instance', { name: elementName(el) }),
			...(el.slots.length
				? [
						el.slots
							.map((s) => (s.value ? `${s.name} = ${s.value}` : s.name))
							.join(t('summary.join')) + '.'
					]
				: [])
		].join(' ');
	if (el.kind !== 'classifier') return elementName(el); // packages: M3
	const kind = t(`kind.${el.classifierKind}`);
	const rels: string[] = [];
	const mine = opts.index
		? (opts.index.get(id) ?? [])
		: diagram.elementIds.map((x) => project.elements.get(x));
	for (const r of mine) {
		if (r?.kind !== 'relationship') continue;
		// Aggregation and composition read the same: the source is the part, the target the whole.
		const k = r.relationshipKind === 'aggregation' ? 'composition' : r.relationshipKind;
		if (r.sourceId === id) rels.push(t(`summary.out.${k}`, { name: name(r.targetId) }));
		else if (r.targetId === id) rels.push(t(`summary.in.${k}`, { name: name(r.sourceId) }));
	}
	const members =
		el.classifierKind === 'enum'
			? [count('literals', el.literals.length)]
			: [count('attributes', el.attributes.length), count('operations', el.operations.length)];
	return [
		t(el.isAbstract ? 'summary.abstract' : 'summary.classifier', { name: el.name, kind }),
		sentence(members.join(t('summary.join'))) + '.',
		...(rels.length ? [sentence(rels.join(t('summary.relJoin'))) + '.'] : []),
		...(opts.hint ? [t('summary.hint')] : [])
	].join(' ');
}

/** What ⌥↩ (or a click on the chip) would do for the line being typed. */
export type Suggestion =
	| { kind: 'create'; name: string }
	| { kind: 'link'; targetId: Id; name: string }
	| { kind: 'fix'; text: string; closer: string };

const CLOSER = { paren: ')', bracket: ']', brace: '}', guillemet: '>>' } as const;
/** Why the line is kept as text, in words (owner's ruling #25). */
function reasonText(r: RawReason | undefined): string {
	switch (r?.code) {
		case 'paren':
		case 'bracket':
		case 'brace':
		case 'guillemet':
			return t('member.reason.missing', { closer: CLOSER[r.code] });
		case 'property':
			return t('member.reason.property', { name: `{${r.detail}}` });
		case 'parameter':
			return t('member.reason.parameter', { text: r.detail ?? '' });
		default:
			return t('member.reason.syntax');
	}
}

const PLAIN_TYPE = /^[A-Za-z_][\w]*$/;
/**
 * features.md, "Create unknown type from the chip": the first type on the line that names no
 * classifier and no primitive is offered as "Create class X"; a type naming a class on this
 * diagram that has no association with this one yet is offered as "Link with association".
 * Generics (`List<X>`) and unparsed lines offer nothing.
 */
export function suggestFor(
	project: Project,
	diagram: Diagram,
	classifierId: Id,
	kind: MemberKind,
	text: string
): Suggestion | null {
	const p = parseMember(kind, text);
	// keyboard.md ⌥↩: "fix a missing )", offered when adding the closer makes the line parse.
	if (isRaw(p)) {
		const fix = p.reason?.fix;
		return fix ? { kind: 'fix', text: fix, closer: fix.slice(text.trimEnd().length) } : null;
	}
	if (kind === 'literal') return null;
	const types =
		'parameters' in p
			? [p.returnType, ...p.parameters.map((x) => x.type)]
			: ['type' in p ? p.type : undefined];
	const names = new Map<string, Id>();
	for (const el of project.elements.values())
		if (el.kind === 'classifier' && el.name) names.set(el.name, el.id);
	for (const raw of types) {
		const type = raw?.trim();
		if (!type || !PLAIN_TYPE.test(type) || (PRIMITIVE_TYPES as readonly string[]).includes(type))
			continue;
		const id = names.get(type);
		if (!id) return { kind: 'create', name: type };
		if (id === classifierId || !diagram.elementIds.includes(id)) continue;
		const linked = [...project.elements.values()].some(
			(r) =>
				r.kind === 'relationship' &&
				(r.sourceEnd || r.targetEnd) &&
				((r.sourceId === classifierId && r.targetId === id) ||
					(r.sourceId === id && r.targetId === classifierId))
		);
		if (!linked) return { kind: 'link', targetId: id, name: type };
	}
	return null;
}
