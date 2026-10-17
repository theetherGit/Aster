import type { Project } from '#lib/model/types.ts';
import { compose } from './batch.ts';
import { hydrate, serialise } from './registry.ts';
import {
	UNDO_LIMIT,
	type CoalescingCommand,
	type Command,
	type CommandStack,
	type CommandStackSnapshot
} from './types.ts';

interface Entry {
	inverse: Command;
	label: string;
	key?: string;
	at: number;
}

const isCoalescing = (c: Command): c is CoalescingCommand =>
	'coalesceKey' in c && 'coalesceMs' in c;

export class Stack implements CommandStack {
	#undo: Entry[] = [];
	#redo: Entry[] = [];
	/** Elements the last run/undo/redo touched, so the UI can jump to them. */
	lastTouched: readonly string[] = [];

	constructor(
		private readonly project: () => Project,
		private readonly now: () => number = () => Date.now()
	) {}

	get canUndo() {
		return this.#undo.length > 0;
	}
	get canRedo() {
		return this.#redo.length > 0;
	}
	get undoLabel() {
		return this.#undo.at(-1)?.label ?? null;
	}
	get redoLabel() {
		return this.#redo.at(-1)?.label ?? null;
	}
	get depth() {
		return this.#undo.length;
	}

	run(command: Command): string {
		const p = this.project();
		const inverse = command.apply(p);
		this.lastTouched = command.touches;
		this.#redo = [];
		const top = this.#undo.at(-1);
		const at = this.now();
		if (
			isCoalescing(command) &&
			top &&
			top.key === command.coalesceKey &&
			at - top.at <= command.coalesceMs
		) {
			// Undo must apply the newest inverse first.
			top.inverse = compose(p, top.label, inverse, top.inverse);
			top.at = at;
		} else {
			this.#undo.push({
				inverse,
				label: command.label,
				key: isCoalescing(command) ? command.coalesceKey : undefined,
				at
			});
			if (this.#undo.length > UNDO_LIMIT) this.#undo.splice(0, this.#undo.length - UNDO_LIMIT);
		}
		return command.label;
	}

	undo(): string | null {
		const e = this.#undo.pop();
		if (!e) return null;
		this.lastTouched = e.inverse.touches;
		this.#redo.push({ inverse: e.inverse.apply(this.project()), label: e.label, at: 0 });
		return e.label;
	}

	redo(): string | null {
		const e = this.#redo.pop();
		if (!e) return null;
		this.lastTouched = e.inverse.touches;
		this.#undo.push({ inverse: e.inverse.apply(this.project()), label: e.label, at: 0 });
		return e.label;
	}

	snapshot(): CommandStackSnapshot {
		return {
			version: 1,
			undo: this.#undo.map((e) => serialise(e.inverse)),
			redo: this.#redo.map((e) => serialise(e.inverse))
		};
	}

	// ponytail: labels after restore are the inverse's own; wrap in a labelled batch if the toast must match pre-reload
	restore(snapshot: CommandStackSnapshot): void {
		const p = this.project();
		const entry = (s: CommandStackSnapshot['undo'][number]): Entry => {
			const inverse = hydrate(p, s);
			return { inverse, label: inverse.label, at: 0 };
		};
		this.#undo = snapshot.undo.map(entry);
		this.#redo = snapshot.redo.map(entry);
	}
}
