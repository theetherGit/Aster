import { describe, expect, it } from 'vitest';
import { COMMANDS, type AppCommand, type Group } from '#lib/app/commands.svelte.ts';
import { format, spoken, type Shortcut } from '#lib/app/shortcuts.ts';
import { t, type MessageKey } from '#lib/i18n/index.ts';

// The docs site's keyboard reference (docs-site/src/content/docs/reference/keyboard.mdx) is written from the
// command registry, as the in-app sheet is, with both platforms side by side. The file is a
// snapshot: `pnpm test -u` rewrites it, and the suite fails when the registry and the page drift.

const GROUPS: Group[] = ['create', 'edit', 'select', 'file', 'view', 'format', 'display'];

// ponytail: the sheet's row merge (ShortcutSheet.svelte), copied while the app is frozen for the
// 2026-10-24 lab; move both into one module after it.
const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const mods = (k: Shortcut) => `${!!k.mod}/${!!k.shift}/${!!k.alt}`;
const bare = (k: Shortcut) => !k.mod && !k.shift && !k.alt;
function collapse(keys: Shortcut[]): Shortcut[] {
	const codes = new Set(keys.map((k) => k.code));
	const same = new Set(keys.map(mods)).size === 1;
	if (same && codes.size === 4 && ARROWS.every((c) => codes.has(c)))
		return [{ ...keys[0], code: 'Arrows' }];
	const digits = keys.map((k) => /^Digit(\d)$/.exec(k.code)?.[1]);
	if (keys.length === 2 && keys.every(bare) && digits.every(Boolean))
		return [{ code: `${digits[0]}–${digits[1]}` }];
	return keys;
}
function rows(group: Group) {
	const out: { label: string; staruml: boolean; keys: Shortcut[] }[] = [];
	for (const c of COMMANDS.filter((c: AppCommand) => c.group === group && c.keys.length)) {
		const label = c.label();
		const row = out.find((r) => r.label === label);
		if (row) row.keys.push(...c.keys);
		else out.push({ label, staruml: !!c.staruml, keys: [...c.keys] });
	}
	for (const r of out) r.keys = collapse(r.keys);
	return out;
}

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
