import { describe, expect, it } from 'vitest';
import { COMMANDS } from '#lib/app/commands.svelte.ts';
import { MENUS, contextItems, menuItems } from '#lib/app/menus.ts';

describe('the Classic menu bar is the registry', () => {
	it('has the six StarUML menus, none empty', () => {
		expect(MENUS.map((m) => m.id)).toEqual(['file', 'edit', 'format', 'model', 'view', 'help']);
		for (const m of MENUS) expect(menuItems(m).length, m.id).toBeGreaterThan(0);
	});

	it('lists every command that is not sheet-only exactly once', () => {
		const listed = MENUS.flatMap((m) => menuItems(m).map((c) => c.id));
		expect(new Set(listed).size).toBe(listed.length);
		const expected = COMMANDS.filter((c) => !c.sheetOnly).map((c) => c.id);
		expect(listed.sort()).toEqual(expected.sort());
	});

	it('puts the shortcut sheet and the palette under Help, not View', () => {
		const help = menuItems(MENUS[5]).map((c) => c.id);
		const view = menuItems(MENUS[4]).map((c) => c.id);
		expect(help).toEqual(['view.palette', 'view.shortcuts']);
		expect(view).not.toContain('view.shortcuts');
		expect(view).toContain('view.layout');
	});
});

/** keyboard.md: right-click or ⇧F10 lists, for the element, the commands the palette has for it. */
describe('the element context menu', () => {
	it('offers edit, link, outline and both deletes on a node', () => {
		expect(contextItems('node').map((c) => c.id)).toEqual([
			'edit.start',
			'link.start',
			'view.selectInOutline',
			'delete.view',
			'delete.model'
		]);
	});
	it('offers the four line styles, outline and both deletes on an edge', () => {
		expect(contextItems('edge').map((c) => c.id)).toEqual([
			'format.rectilinear',
			'format.oblique',
			'format.roundrect',
			'format.curve',
			'view.selectInOutline',
			'delete.view',
			'delete.model'
		]);
	});
});
