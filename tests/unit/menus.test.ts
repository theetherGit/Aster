import { describe, expect, it } from 'vitest';
import { COMMANDS } from '#lib/app/commands.svelte.ts';
import {
	MENUS,
	contextEntries,
	contextItems,
	entries,
	menuItems,
	type Entry
} from '#lib/app/menus.ts';

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

	it('gathers the Format menu layout and tidy rows into submenus', () => {
		const format = entries(menuItems(MENUS[2]));
		const subs = format.flatMap((e) => (e.kind === 'sub' ? [e.sub] : []));
		expect(subs).toEqual(['layout', 'align', 'distribute', 'size', 'order']);
		const layout = format.find((e) => e.kind === 'sub' && e.sub === 'layout');
		expect(layout?.kind === 'sub' && layout.commands.length).toBe(8);
		expect(format.length).toBeLessThan(menuItems(MENUS[2]).length - 15);
	});

	it("gathers File's imports into StarUML's Import submenu", () => {
		const file = entries(menuItems(MENUS[0]));
		const imports = file.find((e) => e.kind === 'sub' && e.sub === 'import');
		expect(imports?.kind === 'sub' && imports.commands.map((c) => c.id)).toEqual([
			'file.importPuml',
			'file.importFragment'
		]);
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
	const row = (e: Entry) =>
		e.kind === 'sub' ? `${e.sub} ▸` : e.kind === 'separator' ? '—' : e.command.id;
	it('offers edit, link, copy, cut, outline and both deletes on a node, then the arrange tools', () => {
		expect(
			contextItems('node')
				.map((c) => c.id)
				.slice(0, 7)
		).toEqual([
			'edit.start',
			'link.start',
			'edit.copy',
			'edit.cut',
			'view.selectInOutline',
			'delete.view',
			'delete.model'
		]);
		// Owner's review: the layout and tidy tools sit in submenus, not as twenty flat rows.
		expect(contextEntries('node').map(row).slice(7)).toEqual([
			'—',
			'layout.auto',
			'layout ▸',
			'align ▸',
			'distribute ▸',
			'size ▸',
			'order ▸'
		]);
	});
	it('offers auto-layout, grid and snap on empty paper', () => {
		expect(contextEntries('pane').map(row)).toEqual([
			'layout.auto',
			'layout ▸',
			'—',
			'view.grid',
			'view.snap'
		]);
	});
	it('offers the four line styles, copy, cut, outline and both deletes on an edge', () => {
		expect(contextItems('edge').map((c) => c.id)).toEqual([
			'format.rectilinear',
			'format.oblique',
			'format.roundrect',
			'format.curve',
			'edit.copy',
			'edit.cut',
			'view.selectInOutline',
			'delete.view',
			'delete.model'
		]);
	});
});
