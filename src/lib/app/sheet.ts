/**
 * The shortcut sheet's rows (board 17), shared with the docs' keyboard reference
 * (tests/unit/docs-keys.test.ts): one row per label, keys merged.
 */
import type { AppCommand } from './commands.svelte.ts';
import type { Shortcut } from './shortcuts.ts';

const ARROWS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
const mods = (k: Shortcut) => `${!!k.mod}/${!!k.shift}/${!!k.alt}`;
const bare = (k: Shortcut) => !k.mod && !k.shift && !k.alt;

/**
 * The registry has one command per arrow (each nudges its own way): their four keys are one
 * "Arrows" key; two bare digits are the ends of a range (the picker's 1–6), one key.
 */
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

/** Commands with keys as sheet rows: those sharing a label become one row, their keys merged. */
export function sheetRows(items: AppCommand[]) {
	const out: { id: string; label: string; staruml: boolean; keys: Shortcut[] }[] = [];
	for (const c of items) {
		if (!c.keys.length) continue;
		const label = c.label();
		const row = out.find((r) => r.label === label);
		if (row) row.keys.push(...c.keys);
		else out.push({ id: c.id, label, staruml: !!c.staruml, keys: [...c.keys] });
	}
	for (const r of out) r.keys = collapse(r.keys);
	return out;
}
