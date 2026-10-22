/**
 * The Classic menu bar (ui.md, board 03): File, Edit, Format, Model, View, Help, generated from
 * the command registry so every action is listed once and its shortcut is never retyped.
 */
import { byId, COMMANDS, type AppCommand, type Group, type Sub } from './commands.svelte.ts';
import type { MessageKey } from '#lib/i18n/index.ts';

export interface Menu {
	id: 'file' | 'edit' | 'format' | 'model' | 'view' | 'help';
	label: MessageKey;
	/** Command groups the menu lists, in registry order. */
	groups: Group[];
	/** Command ids pulled out of their group into this menu. */
	ids?: string[];
}

export const MENUS: Menu[] = [
	{ id: 'file', label: 'classic.menu.file', groups: ['file'] },
	{ id: 'edit', label: 'classic.menu.edit', groups: ['edit', 'select'] },
	{ id: 'format', label: 'classic.menu.format', groups: ['format', 'display'] },
	{ id: 'model', label: 'classic.menu.model', groups: ['create'] },
	{ id: 'view', label: 'classic.menu.view', groups: ['view'] },
	{ id: 'help', label: 'classic.menu.help', groups: [], ids: ['view.shortcuts', 'view.palette'] }
];

const pulled = new Set(MENUS.flatMap((m) => m.ids ?? []));

/** The commands a menu lists: its groups minus rows the sheet alone shows and ids another menu pulled. */
export function menuItems(menu: Menu, commands: readonly AppCommand[] = COMMANDS): AppCommand[] {
	return commands.filter(
		(c) =>
			!c.sheetOnly &&
			(menu.ids?.includes(c.id) || (menu.groups.includes(c.group) && !pulled.has(c.id)))
	);
}

/** The submenus commands with a `sub` gather into, and their titles. */
const SUBS: Record<Sub, MessageKey> = {
	import: 'menu.sub.import',
	layout: 'menu.sub.layout',
	align: 'menu.sub.align',
	distribute: 'menu.sub.distribute',
	size: 'menu.sub.size',
	order: 'menu.sub.order'
};
export type Entry =
	| { kind: 'command'; command: AppCommand }
	| { kind: 'sub'; sub: Sub; label: MessageKey; commands: AppCommand[] }
	| { kind: 'separator'; id: string };

/**
 * A menu's rows: commands as they come, except that those sharing a `sub` gather into one
 * submenu where the first of them stood (owner's review: twenty layout and tidy rows were one
 * flat list).
 */
export function entries(commands: readonly AppCommand[]): Entry[] {
	const out: Entry[] = [];
	const subs = new Map<Sub, AppCommand[]>();
	for (const c of commands) {
		if (!c.sub) out.push({ kind: 'command', command: c });
		else if (subs.has(c.sub)) subs.get(c.sub)!.push(c);
		else {
			const list = [c];
			subs.set(c.sub, list);
			out.push({ kind: 'sub', sub: c.sub, label: SUBS[c.sub], commands: list });
		}
	}
	return out;
}

/** A rule between groups in a context menu. */
const SEPARATOR = '|';
const arrange = () => COMMANDS.filter((c) => c.sub && c.group === 'format').map((c) => c.id);
const layouts = () => COMMANDS.filter((c) => c.sub === 'layout').map((c) => c.id);

/**
 * keyboard.md: the context menu on a node or an edge lists the commands the palette has for it;
 * on a node the arrange tools follow, and empty paper offers the layout, grid and snap.
 */
const CONTEXT: Record<'node' | 'edge' | 'pane', () => string[]> = {
	node: () => [
		'edit.start',
		'link.start',
		'edit.copy',
		'edit.cut',
		'view.selectInOutline',
		'delete.view',
		'delete.model',
		SEPARATOR,
		'layout.auto',
		...arrange()
	],
	pane: () => ['layout.auto', ...layouts(), SEPARATOR, 'view.grid', 'view.snap'],
	edge: () => [
		'format.rectilinear',
		'format.oblique',
		'format.roundrect',
		'format.curve',
		'edit.copy',
		'edit.cut',
		'view.selectInOutline',
		'delete.view',
		'delete.model'
	]
};
export type ContextKind = 'node' | 'edge' | 'pane';
export function contextItems(kind: ContextKind): AppCommand[] {
	return CONTEXT[kind]()
		.filter((id) => id !== SEPARATOR)
		.map((id) => byId(id))
		.filter((c): c is AppCommand => !!c);
}
/** A stable key for a row in an `{#each}`. */
export const entryKey = (e: Entry) =>
	e.kind === 'sub' ? `sub:${e.sub}` : e.kind === 'separator' ? e.id : e.command.id;

/** The context menu's rows, with its submenus and the rules between groups. */
export function contextEntries(kind: ContextKind): Entry[] {
	const groups: string[][] = [[]];
	for (const id of CONTEXT[kind]()) {
		if (id === SEPARATOR) groups.push([]);
		else groups.at(-1)!.push(id);
	}
	return groups.flatMap((ids, i): Entry[] => {
		const rows = entries(ids.map((id) => byId(id)).filter((c): c is AppCommand => !!c));
		return i === 0 ? rows : [{ kind: 'separator', id: `separator-${i}` }, ...rows];
	});
}
