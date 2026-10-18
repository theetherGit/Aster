import { define, hydrate, serialise, type Factory } from './registry.ts';
import type { Command, SerialisedCommand } from './types.ts';

export interface BatchArgs {
	label: string;
	commands: SerialisedCommand[];
}

/** Applies several commands in order; the inverse applies their inverses in reverse. */
export const batch: Factory<BatchArgs> = define<BatchArgs>(
	'batch',
	(project, { label, commands }) => ({
		label,
		touches: [...new Set(commands.flatMap((s) => hydrate(project, s).touches))],
		apply(p): Command {
			const inverses: SerialisedCommand[] = [];
			for (const s of commands) inverses.unshift(serialise(hydrate(p, s).apply(p)));
			return batch(p, { label, commands: inverses });
		}
	})
);
