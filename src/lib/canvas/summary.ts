import { t } from '#lib/i18n/index.ts';
import { isRaw, parseMember, type MemberKind } from '#lib/mdj/expression.ts';

/** One line describing how a member line parses, for the status chip under the node. */
export function summarise(kind: MemberKind, text: string): { ok: boolean; text: string } {
	const p = parseMember(kind, text);
	if (isRaw(p)) return { ok: false, text: t('member.summary.raw') };
	if (kind === 'literal') return { ok: true, text: t('member.summary.literal', { name: p.name }) };
	const flags: string[] = [];
	if ('isStatic' in p && p.isStatic) flags.push(t('member.flag.static'));
	if ('isAbstract' in p && p.isAbstract) flags.push(t('member.flag.abstract'));
	if ('isDerived' in p && p.isDerived) flags.push(t('member.flag.derived'));
	if ('isReadOnly' in p && p.isReadOnly) flags.push(t('member.flag.readOnly'));
	if ('isQuery' in p && p.isQuery) flags.push(t('member.flag.query'));
	const flagText = flags.length ? `, ${flags.join(', ')}` : '';
	const vis = t(`vis.${(p as { visibility: 'public' }).visibility}`);
	if (kind === 'attribute' && 'isReadOnly' in p) {
		const type = p.type ? t('member.summary.typed', { type: p.type }) : '';
		return {
			ok: true,
			text: t('member.summary.attribute', { vis, name: p.name, type, flags: flagText })
		};
	}
	if ('parameters' in p) {
		const type = p.returnType ? t('member.summary.returns', { type: p.returnType }) : '';
		const key =
			p.parameters.length === 1 ? 'member.summary.params.one' : 'member.summary.operation';
		return {
			ok: true,
			text: t(key, { vis, name: p.name, count: p.parameters.length, type, flags: flagText })
		};
	}
	return { ok: true, text };
}
