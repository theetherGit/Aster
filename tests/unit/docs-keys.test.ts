import { describe, expect, it } from 'vitest';
import { COMMANDS, type Group } from '#lib/app/commands.svelte.ts';
import { sheetRows } from '#lib/app/sheet.ts';
import { format, spoken, type Shortcut } from '#lib/app/shortcuts.ts';
import { t, type MessageKey } from '#lib/i18n/index.ts';

// The docs site's keyboard reference (docs-site/src/content/docs/reference/keyboard.mdx) is written from the
// command registry, as the in-app sheet is, with both platforms side by side. The file is a
// snapshot: `pnpm test -u` rewrites it, and the suite fails when the registry and the page drift.

const GROUPS: Group[] = ['create', 'edit', 'select', 'file', 'view', 'format', 'display'];

const rows = (group: Group) => sheetRows(COMMANDS.filter((c) => c.group === group));

/** Text that MDX and a Markdown table would read as syntax, as character references. */
const escape = (s: string) => s.replace(/[\\|{}<>[\]*_`]/g, (ch) => `&#${ch.charCodeAt(0)};`);
/** A cap; a macOS glyph cap says its name to a screen reader, as the app's Kbd atom does. */
function cap(k: Shortcut, mac: boolean) {
	const shown = format(k, mac);
	const said = spoken(k, mac);
	return !mac || shown === said
		? `<kbd>${escape(shown)}</kbd>`
		: `<kbd><span aria-hidden="true">${escape(shown)}</span><span class="sr-only">${escape(said)}</span></kbd>`;
}
const caps = (keys: Shortcut[], mac: boolean) => keys.map((k) => cap(k, mac)).join(' or ');

function page() {
	const lines = [
		'---',
		'title: Keyboard reference',
		'description: Every key in Aster on macOS and on Windows and Linux, and which ones are StarUML’s own.',
		'sidebar:',
		'  order: 1',
		'---',
		'',
		'{/* Written by tests/unit/docs-keys.test.ts from the app’s command registry. Do not edit by hand: change the registry, then run `pnpm test -u`. */}',
		'',
		'Press <kbd>?</kbd> in the app for this list, with a filter. Actions without a key, such as auto-layout and align, are in the command palette, <kbd>⌘K</kbd>. Keys follow your platform: <kbd>⌘</kbd> on macOS is <kbd>Ctrl</kbd> on Windows and Linux, and on macOS either one works.',
		'',
		'Where StarUML has a key for the same action, Aster uses it, so what you already know still works. Those rows say <span class="same">Same</span> in the StarUML column.',
		''
	];
	for (const group of GROUPS) {
		const items = rows(group);
		if (!items.length) continue;
		lines.push(`## ${escape(t(`group.${group}` as MessageKey))}`, '');
		lines.push('| Action | macOS | Windows and Linux | StarUML |', '| --- | --- | --- | --- |');
		for (const r of items)
			lines.push(
				`| ${escape(r.label)} | ${caps(r.keys, true)} | ${caps(r.keys, false)} | ${r.staruml ? '<span class="same">Same</span>' : ''} |`
			);
		lines.push('');
	}
	return lines.join('\n');
}

describe('docs site', () => {
	it('the keyboard reference is the registry, on both platforms', async () => {
		const mdx = page();
		expect(mdx).toContain('| Action | macOS | Windows and Linux | StarUML |');
		await expect(mdx).toMatchFileSnapshot(
			'../../docs-site/src/content/docs/reference/keyboard.mdx'
		);
	});
});
