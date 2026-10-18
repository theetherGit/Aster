import { SvelteSet } from 'svelte/reactivity';
import type { MemberKind } from '#lib/mdj/expression.ts';
import type { Id } from '#lib/model/types.ts';

/** What is being edited inline: the name, or a member line (index may equal the list length = a new line). */
export type EditTarget = { part: 'name' } | { part: 'text' } | { part: MemberKind; index: number };
export interface Editing {
	id: Id;
	target: EditTarget;
}

export const sameTarget = (a: EditTarget, b: EditTarget) =>
	a.part === b.part &&
	(a.part === 'name' || a.part === 'text' || a.index === (b as { index: number }).index);

class Selection {
	ids = new SvelteSet<Id>();
	editing: Editing | null = $state(null);

	get editingId(): Id | null {
		return this.editing?.id ?? null;
	}
	get size() {
		return this.ids.size;
	}
	get list(): Id[] {
		return [...this.ids];
	}
	has(id: Id) {
		return this.ids.has(id);
	}
	/** Replaces the selection; no-op when unchanged so feedback loops settle. */
	set(ids: Iterable<Id>) {
		const next = new Set(ids);
		if (next.size === this.ids.size && [...next].every((id) => this.ids.has(id))) return;
		this.ids.clear();
		for (const id of next) this.ids.add(id);
	}
	clear() {
		if (this.ids.size) this.ids.clear();
	}
}

export const selection = new Selection();
