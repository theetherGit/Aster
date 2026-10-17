import { SvelteSet } from 'svelte/reactivity';
import type { Id } from '#lib/model/types.ts';

class Selection {
	ids = new SvelteSet<Id>();
	/** Element whose name is being edited inline, if any. */
	editingId: Id | null = $state(null);

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
