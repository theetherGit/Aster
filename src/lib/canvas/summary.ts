import { t, type MessageKey } from '#lib/i18n/index.ts';
import { isRaw, parseMember, type MemberKind } from '#lib/mdj/expression.ts';
import { elementName } from '#lib/model/project.ts';
import type { Diagram, Id, Project } from '#lib/model/types.ts';

/**
 * Board 04: the chip under a node while a line is open. Short segments joined with " · "
 * (visibility, type, default, flags), green when the line parses and amber when it is kept
 * as text.
 */
export function summarise(kind: MemberKind, text: string): { ok: boolean; parts: string[] } {
	const p = parseMember(kind, text);
	if (isRaw(p)) return { ok: false, parts: [t('member.summary.raw')] };
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
export function elementSummary(
	project: Project,
	diagram: Diagram,
	id: Id,
	opts: { hint?: boolean } = {}
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
	if (el.kind !== 'classifier') return elementName(el); // packages: M3
	const kind = t(`kind.${el.classifierKind}`);
	const rels: string[] = [];
	for (const other of diagram.elementIds) {
		const r = project.elements.get(other);
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
