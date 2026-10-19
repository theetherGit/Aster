/**
 * The Classic menu bar (ui.md, board 03): File, Edit, Format, Model, View, Help, generated from
 * the command registry so every action is listed once and its shortcut is never retyped.
 */
import { byId, COMMANDS, type AppCommand, type Group } from './commands.svelte.ts';
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

/** keyboard.md: the context menu on a node or an edge lists the commands the palette has for it. */
const CONTEXT: Record<'node' | 'edge', string[]> = {
	node: [
		'edit.start',
		'link.start',
		'edit.copy',
		'edit.cut',
		'view.selectInOutline',
		'delete.view',
		'delete.model'
	],
	edge: [
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
export function contextItems(kind: 'node' | 'edge'): AppCommand[] {
	return CONTEXT[kind].map((id) => byId(id)).filter((c): c is AppCommand => !!c);
}
