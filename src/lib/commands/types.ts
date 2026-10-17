// Authored by hand; do not modify without asking.
// Every user action is a Command. Applying one mutates the model/layout in place
// and returns the Command that undoes it. The undo stack is a list of those.

import type { Project } from '#lib/model/types.js';

export interface Command {
  /** Stable id for the command kind, e.g. "classifier.rename". Used by announcements and tests. */
  id: string;
  /** Human label for the undo toast and the aria-live region, already localised. */
  label: string;
  /** Elements this command touches, for coalescing and for "jump to" after undo. */
  touches: readonly string[];
  /**
   * Apply to the project in place and return the inverse.
   * Must be deterministic and must not read Svelte or DOM state.
   */
  apply(project: Project): Command;
}

/** Commands that may be merged with the previous one of the same id within `coalesceMs`. */
export interface CoalescingCommand extends Command {
  coalesceKey: string;
  coalesceMs: number;
}

export interface CommandStack {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undoLabel: string | null;
  readonly redoLabel: string | null;
  /** Apply and push. Returns the label for announcement. */
  run(command: Command): string;
  undo(): string | null;
  redo(): string | null;
  /** Serialisable snapshot for autosave; restored with `restore`. */
  snapshot(): CommandStackSnapshot;
  restore(snapshot: CommandStackSnapshot): void;
}

export interface CommandStackSnapshot {
  version: 1;
  undo: SerialisedCommand[];
  redo: SerialisedCommand[];
}

/** Commands are re-hydrated from their id and args; implementations register a factory per id. */
export interface SerialisedCommand {
  id: string;
  args: unknown;
}

export const UNDO_LIMIT = 500;
