import { Stack } from '#lib/commands/index.ts';
import type { Command, CommandStackSnapshot } from '#lib/commands/types.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { getDiagram } from '#lib/model/project.ts';
import type { Diagram, Id, Project } from '#lib/model/types.ts';
import { selection } from './selection.svelte.ts';

type Factory<A> = (project: Project, args: A) => Command;

/**
 * Holds the one Project and its command stack. The model is a plain object
 * (no proxies, so commands can mutate Maps freely); `version` bumps after every
 * command so derived state re-reads it.
 */
class ProjectStore {
	#project: Project = $state.raw(sampleProject());
	#stack = new Stack(() => this.#project);
	version = $state(0);
	activeDiagramId: Id = $state('');

	constructor() {
		this.activeDiagramId = this.#project.diagrams[0]?.id ?? '';
	}

	get project(): Project {
		void this.version;
		return this.#project;
	}
	get diagram(): Diagram {
		return getDiagram(this.project, this.activeDiagramId);
	}
	get canUndo() {
		void this.version;
		return this.#stack.canUndo;
	}
	get canRedo() {
		void this.version;
		return this.#stack.canRedo;
	}
	get undoLabel() {
		void this.version;
		return this.#stack.undoLabel;
	}
	get redoLabel() {
		void this.version;
		return this.#stack.redoLabel;
	}

	/**
	 * Make `project` the open project, showing `diagramId` (or its first diagram), with its undo
	 * history when a snapshot comes along (autosave restore).
	 */
	load(project: Project, diagramId?: Id | null, history?: CommandStackSnapshot) {
		this.#project = project;
		this.#stack = new Stack(() => this.#project);
		if (history) this.#stack.restore(history);
		this.activeDiagramId =
			(diagramId && project.diagrams.some((d) => d.id === diagramId)
				? diagramId
				: project.diagrams[0]?.id) ?? '';
		this.version++;
	}
	/** The undo and redo stacks as data, for autosave. */
	snapshot(): CommandStackSnapshot {
		return this.#stack.snapshot();
	}

	/** The only way state changes: build a command from a factory and run it. */
	run<A>(factory: Factory<A>, args: A): string {
		const label = this.#stack.run(factory(this.#project, args));
		this.version++;
		return label;
	}
	undo(): string | null {
		return this.#afterHistory(this.#stack.undo());
	}
	redo(): string | null {
		return this.#afterHistory(this.#stack.redo());
	}
	/** After undo/redo: re-derive and jump the selection to what the step touched. */
	#afterHistory(label: string | null) {
		if (label === null) return null;
		this.version++;
		selection.editing = null;
		const onDiagram = new Set(this.diagram.elementIds);
		selection.set(this.#stack.lastTouched.filter((id) => onDiagram.has(id)));
		return label;
	}
}

export const projectStore = new ProjectStore();
