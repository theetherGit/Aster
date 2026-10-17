import type { Project } from '#lib/model/types.ts';
import type { Command, SerialisedCommand } from './types.ts';

/** A Command that remembers how it was built, so the stack can snapshot it. */
export interface BuiltCommand<A = unknown> extends Command {
	args: A;
}

type Body = Pick<Command, 'label' | 'touches' | 'apply'> &
	Partial<
		Pick<Command & { coalesceKey: string; coalesceMs: number }, 'coalesceKey' | 'coalesceMs'>
	>;
type Build<A> = (project: Project, args: A) => Body;

/** What `define` returns: build a command for a project from serialisable args. */
export type Factory<A> = (project: Project, args: A) => BuiltCommand<A>;

const builders = new Map<string, Build<unknown>>();

/** Register a command kind once; returns its factory `(project, args) => Command`. */
export function define<A>(
	id: string,
	build: Build<A>
): (project: Project, args: A) => BuiltCommand<A> {
	if (builders.has(id)) throw new Error(`Command ${id} already defined`);
	builders.set(id, build as Build<unknown>);
	return (project, args) => ({ id, args, ...build(project, args) });
}

export function hydrate(project: Project, s: SerialisedCommand): BuiltCommand {
	const build = builders.get(s.id);
	if (!build) throw new Error(`Unknown command ${s.id}`);
	return { id: s.id, args: s.args, ...build(project, s.args) };
}

export function serialise(cmd: Command): SerialisedCommand {
	if (!('args' in cmd)) throw new Error(`Command ${cmd.id} was not built by a registered factory`);
	return { id: cmd.id, args: (cmd as BuiltCommand).args };
}
