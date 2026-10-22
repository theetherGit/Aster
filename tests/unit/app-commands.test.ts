import { describe, expect, it } from 'vitest';
import { COMMANDS } from '#lib/app/commands.svelte.ts';
import { ariaKeys, format, matches, parse, spoken } from '#lib/app/shortcuts.ts';

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

	it('names Enter and Backspace as each platform prints them on the key (Kbd audit)', () => {
		expect(format(parse('↩'), true)).toBe('↩');
		expect(format(parse('↩'), false)).toBe('Enter');
		expect(format(parse('⌘↩'), false)).toBe('Ctrl+Enter');
		expect(format(parse('⌫'), false)).toBe('Backspace');
		expect(format(parse('Esc'), true)).toBe('Esc');
	});

	it('says a key in words for a screen reader, where the cap is a glyph', () => {
		expect(spoken(parse('↩'), true)).toBe('Enter');
		expect(spoken(parse('⌘⇧E'), true)).toBe('Command Shift E');
		expect(spoken(parse('⌥↩'), false)).toBe('Alt Enter');
		expect(spoken(parse('↑'), true)).toBe('Up arrow');
		expect(spoken(parse('Tab'), false)).toBe('Tab');
		// Glyph caps say their names: ⌘\ (inspector), ⌘⇧[ / ⌘⇧] (diagrams).
		expect(spoken(parse('⌘\\'), true)).toBe('Command Backslash');
		expect(spoken(parse('⌘⇧['), false)).toBe('Control Shift Left bracket');
		expect(spoken(parse('⌘⇧]'), true)).toBe('Command Shift Right bracket');
	});

	it('spells shortcuts for aria-keyshortcuts', () => {
		expect(ariaKeys(parse('⌘⇧V'), true)).toBe('Meta+Shift+V');
		expect(ariaKeys(parse('⌘⇧V'), false)).toBe('Control+Shift+V');
		expect(ariaKeys(parse('⌘⌥T'), true)).toBe('Meta+Alt+T');
		expect(ariaKeys(parse('⌘⇧0'), false)).toBe('Control+Shift+0');
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
		'⌘C',
		'⌘X',
		'⌘V',
		'⌘⇧C',
		// Bare arrows rove focus (keyboard.md § Canvas keyboard model), handled by the canvas router, not a command.
		'⌘←',
		'⌘→',
		'⌘⇧←',
		'⌘⇧→',
		'⌘⇧↑',
		'⌘⇧↓',
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

	// The owner's keyboard.md (2026-10-21) has no row for these; their commands stay in the palette.
	it.each(['⌘⇧9', '⌘⇧D'])('leaves %s unbound', (key) => {
		expect(bound.has(key)).toBe(false);
	});

	it('has unique ids and no two commands on one key in one context, unless one is layout-scoped', () => {
		const ids = COMMANDS.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
		const seen = new Map<string, (typeof COMMANDS)[number]>();
		for (const c of COMMANDS)
			for (const k of c.keys) {
				const sig = `${c.context}:${format(k, true)}`;
				const other = seen.get(sig);
				// Classic's ⌘1 (Sidebar) shadows the fit alias there: a `when` on one of them says so.
				if (other && !other.when && !c.when) expect.fail(`${sig} bound by ${other.id} and ${c.id}`);
				seen.set(sig, c);
			}
	});

	it("Classic's ⌘1 comes before the fit alias, so the router reaches it first", () => {
		const ids = COMMANDS.map((c) => c.id);
		expect(ids.indexOf('classic.sidebar')).toBeLessThan(ids.indexOf('zoom.fit'));
		expect(COMMANDS.find((c) => c.id === 'classic.sidebar')?.when).toBeDefined();
	});

	it('every palette command has a label; sheet rows are the only no-ops', () => {
		for (const c of COMMANDS) expect(c.label().length).toBeGreaterThan(0);
		expect(COMMANDS.filter((c) => !c.sheetOnly).every((c) => c.run !== undefined)).toBe(true);
	});
});
