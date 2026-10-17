import { t } from '#lib/i18n/index.ts';
import { memberFromText, type Member, type MemberKind } from '#lib/mdj/expression.ts';
import { getClassifier } from '#lib/model/project.ts';
import type { Classifier, ClassifierKind, Id, Literal } from '#lib/model/types.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

export type { Member, MemberKind };

export function membersOf(c: Classifier, kind: MemberKind): Member[] {
	return kind === 'attribute' ? c.attributes : kind === 'operation' ? c.operations : c.literals;
}

const ownerName = (project: Parameters<Factory<unknown>>[0], id: Id) => {
	const el = project.elements.get(id);
	return el && el.kind === 'classifier' ? el.name : id;
};
const memberName = (
	project: Parameters<Factory<unknown>>[0],
	classifierId: Id,
	kind: MemberKind,
	memberId: Id
) => {
	const el = project.elements.get(classifierId);
	const m =
		el?.kind === 'classifier' ? membersOf(el, kind).find((m) => m.id === memberId) : undefined;
	return m?.name ?? memberId;
};

interface MemberRef {
	classifierId: Id;
	kind: MemberKind;
}

export const addMember: Factory<MemberRef & { member: Member; index?: number }> = define(
	'addMember',
	(project, { classifierId, kind, member, index }) => ({
		label: t('cmd.addMember', { name: member.name, owner: ownerName(project, classifierId) }),
		touches: [classifierId],
		apply(p): Command {
			const list = membersOf(getClassifier(p, classifierId), kind);
			list.splice(Math.min(index ?? list.length, list.length), 0, structuredClone(member));
			return deleteMember(p, { classifierId, kind, memberId: member.id });
		}
	})
);

export const deleteMember: Factory<MemberRef & { memberId: Id }> = define(
	'deleteMember',
	(project, { classifierId, kind, memberId }) => ({
		label: t('cmd.deleteMember', {
			name: memberName(project, classifierId, kind, memberId),
			owner: ownerName(project, classifierId)
		}),
		touches: [classifierId],
		apply(p): Command {
			const list = membersOf(getClassifier(p, classifierId), kind);
			const index = list.findIndex((m) => m.id === memberId);
			if (index < 0) throw new Error(`No ${kind} ${memberId}`);
			const [member] = list.splice(index, 1);
			return addMember(p, { classifierId, kind, member: structuredClone(member), index });
		}
	})
);

/** Swaps a member for a new version with the same id; the inverse swaps back. */
export const replaceMember: Factory<MemberRef & { member: Member }> = define(
	'replaceMember',
	(project, { classifierId, kind, member }) => ({
		label: t('cmd.editMember', { name: member.name }),
		touches: [classifierId],
		apply(p): Command {
			const list = membersOf(getClassifier(p, classifierId), kind);
			const index = list.findIndex((m) => m.id === member.id);
			if (index < 0) throw new Error(`No ${kind} ${member.id}`);
			const previous = list[index];
			list[index] = structuredClone(member);
			return replaceMember(p, { classifierId, kind, member: structuredClone(previous) });
		}
	})
);

/** Parses a line on commit. Lines that do not parse still commit, verbatim, under `raw`. */
export const setMemberText: Factory<MemberRef & { memberId: Id; text: string }> = define(
	'setMemberText',
	(project, { classifierId, kind, memberId, text }) => ({
		label: t('cmd.editMember', { name: memberName(project, classifierId, kind, memberId) }),
		touches: [classifierId],
		apply(p): Command {
			const list = membersOf(getClassifier(p, classifierId), kind);
			const index = list.findIndex((m) => m.id === memberId);
			if (index < 0) throw new Error(`No ${kind} ${memberId}`);
			const previous = list[index];
			list[index] = memberFromText(kind, text, memberId, previous);
			return replaceMember(p, { classifierId, kind, member: structuredClone(previous) });
		}
	})
);

export const reorderMember: Factory<MemberRef & { memberId: Id; to: number }> = define(
	'reorderMember',
	(project, { classifierId, kind, memberId, to }) => ({
		label: t('cmd.reorderMember', { name: memberName(project, classifierId, kind, memberId) }),
		touches: [classifierId],
		apply(p): Command {
			const list = membersOf(getClassifier(p, classifierId), kind);
			const from = list.findIndex((m) => m.id === memberId);
			if (from < 0) throw new Error(`No ${kind} ${memberId}`);
			const target = Math.max(0, Math.min(to, list.length - 1));
			const [m] = list.splice(from, 1);
			list.splice(target, 0, m);
			return reorderMember(p, { classifierId, kind, memberId, to: from });
		}
	})
);

export const setClassifierKind: Factory<{ id: Id; classifierKind: ClassifierKind }> = define(
	'setClassifierKind',
	(project, { id, classifierKind }) => ({
		label: t('cmd.setClassifierKind', {
			name: ownerName(project, id),
			kind: t(`kind.${classifierKind}`)
		}),
		touches: [id],
		apply(p): Command {
			const c = getClassifier(p, id);
			const previous = c.classifierKind;
			c.classifierKind = classifierKind;
			return setClassifierKind(p, { id, classifierKind: previous });
		}
	})
);

export const setLiterals: Factory<{ id: Id; literals: Literal[] }> = define(
	'setLiterals',
	(project, { id, literals }) => ({
		label: t('cmd.setLiterals', { name: ownerName(project, id) }),
		touches: [id],
		apply(p): Command {
			const c = getClassifier(p, id);
			const previous = c.literals;
			c.literals = structuredClone(literals);
			return setLiterals(p, { id, literals: structuredClone(previous) });
		}
	})
);
