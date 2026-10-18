import { t } from '#lib/i18n/index.ts';
import { isRaw, parseMember, type MemberKind } from '#lib/mdj/expression.ts';

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
