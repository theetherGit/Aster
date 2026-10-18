/**
 * The inline-editing flow from docs/spec/keyboard.md: which line is open, what Enter, Tab,
 * ⌘↩, ⌘⇧↩, ⌘↑/↓ and Esc do. Components only call these; every change is a command.
 */
import {
	addMember,
	deleteMember,
	membersOf,
	renameClassifier,
	reorderMember,
	setMemberText
} from '#lib/commands/index.ts';
import { memberFromText, renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import { newId } from '#lib/model/ids.ts';
import { getClassifier } from '#lib/model/project.ts';
import type { Classifier, Id } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { selection, type EditTarget } from '#lib/stores/selection.svelte.ts';
import { canvasFocus } from './focus.ts';

/** Compartments a node shows, in order, per docs/spec/features.md. */
export function compartmentsFor(c: Classifier): MemberKind[] {
	const attrs = c.attributes.length > 0;
	const ops = c.operations.length > 0;
	switch (c.classifierKind) {
		case 'enum':
			return [
				'literal',
				...(attrs ? (['attribute'] as const) : []),
				...(ops ? (['operation'] as const) : [])
			];
		default:
			// Board 12: empty compartments collapse to an 8 px strip rather than disappearing.
			return ['attribute', 'operation'];
	}
}

/** Stereotype line a node shows: the keyword for non-class kinds, overridable by a stereotype. */
export function headerLabel(c: Classifier): string | undefined {
	if (c.classifierKind === 'class') return c.stereotype;
	if (c.stereotype) return c.stereotype;
	const KEYWORD = {
		interface: 'interface',
		enum: 'enumeration',
		dataType: 'dataType',
		primitiveType: 'primitive'
	};
	return KEYWORD[c.classifierKind];
}

const classifier = (id: Id) => getClassifier(projectStore.project, id);

export function edit(id: Id, target: EditTarget) {
	selection.set([id]);
	selection.editing = { id, target };
}

export function endEditing() {
	selection.editing = null;
	canvasFocus.focus();
}

export function commitName(id: Id, text: string) {
	const name = text.trim();
	if (name && name !== classifier(id).name) projectStore.run(renameClassifier, { id, name });
}

/**
 * Commits one member line. Existing line: empty text deletes it, changed text re-parses it.
 * New line (index past the end): non-empty text adds a member. Returns whether a member
 * exists at that index afterwards.
 */
export function commitLine(id: Id, kind: MemberKind, index: number, text: string): boolean {
	const list = membersOf(classifier(id), kind);
	const trimmed = text.trim();
	if (index < list.length) {
		const m = list[index];
		if (!trimmed) {
			projectStore.run(deleteMember, { classifierId: id, kind, memberId: m.id });
			return false;
		}
		if (trimmed !== renderMember(kind, m)) {
			projectStore.run(setMemberText, { classifierId: id, kind, memberId: m.id, text: trimmed });
		}
		return true;
	}
	if (!trimmed) return false;
	projectStore.run(addMember, {
		classifierId: id,
		kind,
		member: memberFromText(kind, trimmed, newId()),
		index
	});
	return true;
}

/** ↩ on a line: commit, then open the next line (a new one after the last). Empty new line ends editing. */
export function lineEnter(id: Id, kind: MemberKind, index: number, text: string) {
	const kept = commitLine(id, kind, index, text);
	if (!kept) return endEditing();
	edit(id, { part: kind, index: index + 1 });
}

/** ↩ on the name: commit, then open a new line in the first compartment. */
export function nameEnter(id: Id, text: string) {
	commitName(id, text);
	const c = classifier(id);
	// Interfaces are operations by default (features.md); the rest start with their first compartment.
	const first = c.classifierKind === 'interface' ? 'operation' : compartmentsFor(c)[0];
	edit(id, { part: first, index: membersOf(c, first).length });
}

/** Tab / ⇧Tab: commit, then move to the next / previous part (name, then each compartment). */
export function moveCompartment(id: Id, from: EditTarget, text: string, backwards: boolean) {
	if (from.part === 'name') commitName(id, text);
	else commitLine(id, from.part, from.index, text);
	const c = classifier(id);
	const parts: EditTarget['part'][] = ['name', ...compartmentsFor(c)];
	const pos = parts.indexOf(from.part);
	const next = parts[(pos + (backwards ? -1 : 1) + parts.length) % parts.length];
	edit(id, next === 'name' ? { part: 'name' } : { part: next, index: 0 });
}

/** ⌘↩ / ⌘⇧↩: commit, then open a new attribute / operation line below. */
export function addLineBelow(id: Id, from: EditTarget, text: string, kind: MemberKind) {
	if (from.part === 'name') commitName(id, text);
	else commitLine(id, from.part, from.index, text);
	const c = classifier(id);
	const index = from.part === kind ? from.index + 1 : membersOf(c, kind).length;
	edit(id, { part: kind, index });
}

/** ⌘↑ / ⌘↓: commit, then move the member one place and follow it. */
export function reorderLine(id: Id, kind: MemberKind, index: number, text: string, delta: -1 | 1) {
	if (!commitLine(id, kind, index, text)) return endEditing();
	const list = membersOf(classifier(id), kind);
	const to = Math.max(0, Math.min(index + delta, list.length - 1));
	if (to !== index)
		projectStore.run(reorderMember, { classifierId: id, kind, memberId: list[index].id, to });
	edit(id, { part: kind, index: to });
}
