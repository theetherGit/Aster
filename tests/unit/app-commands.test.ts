import { describe, expect, it } from 'vitest';
import { COMMANDS } from '#lib/app/commands.svelte.ts';
import { format, matches, parse } from '#lib/app/shortcuts.ts';

const ev = (init: Partial<KeyboardEvent> & { code: string }) => init as KeyboardEvent;

describe('shortcuts as data', () => {
	it('parses the spec notation and formats it per platform', () => {
		expect(parse('⌘⇧V')).toEqual({ code: 'KeyV', mod: true, shift: true });
		expect(parse('⌘⌥L')).toEqual({ code: 'KeyL', mod: true, alt: true });
		expect(parse('⌘⇧9')).toEqual({ code: 'Digit9', mod: true, shift: true });
		expect(parse('⌘\\')).toEqual({ code: 'Backslash', mod: true });
		expect(parse('?')).toEqual({ code: 'Slash', shift: true });
		expect(parse('⌥↩')).toEqual({ code: 'Enter', alt: true });
		expect(format(parse('⌘⇧V'), true)).toBe('⌘⇧V');
		expect(format(parse('⌘⇧V'), false)).toBe('Ctrl+Shift+V');
		expect(format(parse('⌘⌥T'), true)).toBe('⌘⌥T');
		expect(format(parse('⌘⇧]'), true)).toBe('⌘⇧]');
		expect(format(parse('⌫'), true)).toBe('⌫');
		expect(format(parse('?'), false)).toBe('?');
	});

	it('matches on the physical key with exact modifiers', () => {
		const s = parse('⌘⇧V');
		expect(
			matches(ev({ code: 'KeyV', metaKey: true, shiftKey: true, altKey: false, ctrlKey: false }), s)
		).toBe(true);
		expect(
			matches(ev({ code: 'KeyV', ctrlKey: true, shiftKey: true, altKey: false, metaKey: false }), s)
		).toBe(true);
		expect(
			matches(
				ev({ code: 'KeyV', metaKey: true, shiftKey: false, altKey: false, ctrlKey: false }),
				s
			)
		).toBe(false);
		expect(
			matches(ev({ code: 'KeyV', metaKey: true, shiftKey: true, altKey: true, ctrlKey: false }), s)
		).toBe(false);
	});
});

describe('the command registry (docs/spec/keyboard.md, M1 rows)', () => {
	const bound = new Set(COMMANDS.flatMap((c) => c.keys.map((k) => format(k, true))));

	it.each([
		'C',
		'I',
		'E',
		'D',
		'N',
		'L',
		'F2',
		'↩',
		'⌘↩',
		'⌘⇧↩',
		'Tab',
		'⇧Tab',
		'⌘↑',
		'⌘↓',
		'Esc',
		'⌘A',
		'⌫',
		'⌘⌫',
		'⌘E',
		'⌘D',
		'⌘⇧C',
		'←',
		'→',
		'↑',
		'↓',
		'⇧←',
		'⇧→',
		'⇧↑',
		'⇧↓',
		'⌘Z',
		'⌘⇧Z',
		'⌘Y',
		'⌘N',
		'⌘O',
		'⌘S',
		'⌘⇧S',
		'⌘⇧E',
		'⌘K',
		'⌘⇧P',
		'⌘\\',
		'⌘B',
		'⌘=',
		'⌘−',
		'⌘0',
		'⌘9',
		'⌘1',
		'⌘⇧9',
		'⌘⇧]',
		'⌘⇧[',
		'⌘L',
		'⌘⇧B',
		'⌘⌥L',
		'⌘⌥B',
		'⌘⇧V',
		'⌘⇧Y',
		'⌘⇧M',
		'⌘⇧J',
		'⌘⇧N',
		'⌘⇧A',
		'⌘⇧O',
		'⌘⇧T',
		'⌘⇧0',
		'⌘⇧1',
		'⌘⇧R',
		'⌘⌥T',
		'?'
	])('binds %s', (key) => {
		expect(bound.has(key)).toBe(true);
	});

	it('has unique ids and no two commands on one key in one context', () => {
		const ids = COMMANDS.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		const seen = new Map<string, string>();
		for (const c of COMMANDS)
			for (const k of c.keys) {
				const sig = `${c.context}:${format(k, true)}`;
				expect(seen.get(sig), `${sig} bound by ${seen.get(sig)} and ${c.id}`).toBeUndefined();
				seen.set(sig, c.id);
			}
	});

	it('every palette command has a label; sheet rows are the only no-ops', () => {
		for (const c of COMMANDS) expect(c.label().length).toBeGreaterThan(0);
		expect(COMMANDS.filter((c) => !c.sheetOnly).every((c) => c.run !== undefined)).toBe(true);
	});
});
