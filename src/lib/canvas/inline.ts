/**
 * The inline-editing flow from docs/spec/keyboard.md: which line is open, what Enter, Tab,
 * ⌘↩, ⌘⇧↩, ⌘↑/↓ and Esc do. Components only call these; every change is a command.
 */
import {
	addClassifier,
	addMember,
	connect,
	deleteMember,
	membersOf,
	renameClassifier,
	reorderMember,
	setMemberText
} from '#lib/commands/index.ts';
import { t } from '#lib/i18n/index.ts';
import { memberFromText, renderMember, type MemberKind } from '#lib/mdj/expression.ts';
import { newId } from '#lib/model/ids.ts';
import { createClassifier, getClassifier, rawMentions } from '#lib/model/project.ts';
import type { Classifier, Id } from '#lib/model/types.ts';
import { projectStore } from '#lib/stores/project.svelte.ts';
import { announceAssertive } from '#lib/stores/live.svelte.ts';
import { selection, type EditTarget } from '#lib/stores/selection.svelte.ts';
import { ui } from '#lib/stores/ui.svelte.ts';
import { canvasApi } from './api.ts';
import { canvasFocus } from './focus.ts';
import { freePosition, rightOf } from './place.ts';
import { suggestFor } from './summary.ts';

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

/**
 * Rename a class everywhere it is a type (owner's ruling #8). Unparsed lines keep the old name;
 * when any still say it, a toast counts them, with undo.
 */
export function renameClass(id: Id, name: string) {
	const from = classifier(id).name;
	projectStore.run(renameClassifier, { id, name });
	const kept = rawMentions(projectStore.project, from);
	if (kept)
		ui.toast = {
			text: t(kept === 1 ? 'toast.rawKeptOne' : 'toast.rawKept', { from, to: name, count: kept }),
			undo: true,
			at: Date.now()
		};
}

export function commitName(id: Id, text: string) {
	const name = text.trim();
	const current = classifier(id).name;
	if (!name) return announceAssertive(t('live.nameKept', { name: current }));
	if (name !== current) renameClass(id, name);
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
	if (from.part === 'text') return; // notes and text have one field
	// The parts as they were: emptying an enum's last attribute removes that compartment,
	// and the move is still "the one after it".
	const parts: EditTarget['part'][] = ['name', ...compartmentsFor(classifier(id))];
	if (from.part === 'name') commitName(id, text);
	else commitLine(id, from.part, from.index, text);
	const pos = parts.indexOf(from.part);
	const next = parts[(pos + (backwards ? -1 : 1) + parts.length) % parts.length];
	edit(id, next === 'name' ? { part: 'name' } : { part: next, index: 0 });
}

/**
 * ⌘↩ / ⌘⇧↩: commit, then open a new attribute / operation line below. In the middle of a
 * compartment a blank member is inserted there (keyboard.md: "add below", not "open the next");
 * Esc or an empty commit removes it again.
 */
export function addLineBelow(id: Id, from: EditTarget, text: string, kind: MemberKind) {
	if (from.part === 'text') return;
	let index: number;
	if (from.part === 'name') {
		commitName(id, text);
		index = membersOf(classifier(id), kind).length;
	} else {
		const kept = commitLine(id, from.part, from.index, text);
		const list = membersOf(classifier(id), kind);
		index = from.part === kind ? (kept ? from.index + 1 : from.index) : list.length;
		if (index < list.length) {
			projectStore.run(addMember, {
				classifierId: id,
				kind,
				member: memberFromText(kind, '', newId()),
				index
			});
		}
	}
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

/**
 * ⌥↩ or a click on the chip (features.md, "Create unknown type from the chip"): create the class
 * the line's type names, in free space right of this one, or link this class to it with an
 * association. One undo step each; the line stays open. False when there is nothing to apply.
 */
export function applySuggestion(id: Id, kind: MemberKind, text: string): string | boolean {
	const diagramId = projectStore.activeDiagramId;
	const s = suggestFor(projectStore.project, projectStore.diagram, id, kind, text);
	if (!s) return false;
	// A fix changes the line being typed, not the model: the editor puts the text in.
	if (s.kind === 'fix') return s.text;
	if (s.kind === 'create') {
		const r = canvasApi.rects();
		const here = r.get(id);
		const at = (here && rightOf([here])) ?? { x: 0, y: 0 };
		projectStore.run(addClassifier, {
			diagramId,
			classifier: createClassifier({ name: s.name }),
			at: freePosition(at, r.values())
		});
	} else
		projectStore.run(connect, {
			diagramId,
			id: newId(),
			sourceId: id,
			targetId: s.targetId,
			kind: 'association'
		});
	return true;
}
