/**
 * Shortcuts as data (docs/spec/keyboard.md): matched on the physical key (`e.code`) so ⇧ and
 * ⌥ do not change what we compare, formatted for the platform (⌘ on macOS, Ctrl elsewhere).
 */
export interface Shortcut {
	/** KeyboardEvent.code: KeyV, Digit9, Enter, BracketRight, Backslash, Slash …; arrows as a group. */
	code: string;
	/** ⌘ on macOS, Ctrl elsewhere. */
	mod?: boolean;
	shift?: boolean;
	alt?: boolean;
}

export const isMac = () =>
	typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function matches(e: KeyboardEvent, s: Shortcut): boolean {
	// A bare letter (C, I, E, D, N, L) is the printed key, so Dvorak and Colemak hands get the letter
	// on the cap; chords keep the physical key so ⇧ and ⌥ cannot change what is compared.
	const bare = !s.mod && !s.alt && !s.shift && /^Key[A-Z]$/.test(s.code);
	if (bare ? (e.key ?? '').toUpperCase() !== s.code.slice(3) : e.code !== s.code) return false;
	const mod = e.metaKey || e.ctrlKey;
	return mod === !!s.mod && e.shiftKey === !!s.shift && e.altKey === !!s.alt;
}

const CODE_LABEL: Record<string, string> = {
	Enter: 'Enter',
	Tab: 'Tab',
	Escape: 'Esc',
	Backspace: 'Backspace',
	Delete: 'Del',
	Space: 'Space',
	Equal: '=',
	Minus: '−',
	BracketLeft: '[',
	BracketRight: ']',
	Backslash: '\\',
	Slash: '/',
	ArrowLeft: '←',
	ArrowUp: '↑',
	ArrowRight: '→',
	ArrowDown: '↓',
	Arrows: '←↑↓→'
};

const SPOKEN: Record<string, string> = {
	Escape: 'Escape',
	ArrowLeft: 'Left arrow',
	ArrowUp: 'Up arrow',
	ArrowRight: 'Right arrow',
	ArrowDown: 'Down arrow',
	Arrows: 'Arrow keys',
	Minus: 'Minus',
	Equal: 'Equals',
	Slash: 'Slash'
};
/** A shortcut in words, for a screen reader where the cap is a glyph: "Command Shift E", "Enter". */
export function spoken(s: Shortcut, mac = isMac()): string {
	const parts: string[] = [];
	if (s.mod) parts.push(mac ? 'Command' : 'Control');
	if (s.alt) parts.push(mac ? 'Option' : 'Alt');
	if (s.shift) parts.push('Shift');
	parts.push(SPOKEN[s.code] ?? CODE_LABEL[s.code] ?? s.code.replace(/^Key|^Digit/, ''));
	return parts.join(' ');
}

/** The `aria-keyshortcuts` form: "Meta+Shift+V" on macOS, "Control+Shift+V" elsewhere. */
export function ariaKeys(s: Shortcut, mac = isMac()): string {
	const parts: string[] = [];
	if (s.mod) parts.push(mac ? 'Meta' : 'Control');
	if (s.alt) parts.push('Alt');
	if (s.shift) parts.push('Shift');
	parts.push(s.code.replace(/^(Key|Digit)/, ''));
	return parts.join('+');
}

/** What macOS prints on these keys; elsewhere the key says its name (Kbd audit, 2026-10-22). */
const MAC_GLYPH: Record<string, string> = { Enter: '↩', Backspace: '⌫' };

/** "⌘⇧V" on macOS, "Ctrl+Shift+V" elsewhere. `?` shows as itself. */
export function format(s: Shortcut, mac = isMac()): string {
	let key = (mac && MAC_GLYPH[s.code]) || CODE_LABEL[s.code] || s.code.replace(/^Key|^Digit/, '');
	if (s.code === 'Slash' && s.shift) return mac ? '?' : '?';
	if (s.code === 'Equal' && s.mod) key = '=';
	if (mac) return `${s.mod ? '⌘' : ''}${s.alt ? '⌥' : ''}${s.shift ? '⇧' : ''}${key}`;
	return [s.mod && 'Ctrl', s.alt && 'Alt', s.shift && 'Shift', key].filter(Boolean).join('+');
}

/** Build a shortcut from the spec's notation: "⌘⇧V", "⌥↩", "F2", "⌫", "?". */
export function parse(spec: string): Shortcut {
	const mod = spec.includes('⌘');
	const shift = spec.includes('⇧');
	const alt = spec.includes('⌥');
	const key = spec.replace(/[⌘⇧⌥]/g, '');
	const CODES: Record<string, string> = {
		'↩': 'Enter',
		Tab: 'Tab',
		Esc: 'Escape',
		'⌫': 'Backspace',
		'=': 'Equal',
		'-': 'Minus',
		'−': 'Minus',
		'[': 'BracketLeft',
		']': 'BracketRight',
		'\\': 'Backslash',
		'?': 'Slash',
		'←': 'ArrowLeft',
		'↑': 'ArrowUp',
		'→': 'ArrowRight',
		'↓': 'ArrowDown'
	};
	if (key === '?') return { code: 'Slash', shift: true };
	const code =
		CODES[key] ??
		(/^[A-Z]$/i.test(key) ? `Key${key.toUpperCase()}` : /^\d$/.test(key) ? `Digit${key}` : key);
	return {
		code,
		...(mod && { mod: true }),
		...(shift && { shift: true }),
		...(alt && { alt: true })
	};
}

/**
 * A key for a hint (KeyHint molecule): the cap as this platform prints it, and words for a screen
 * reader when the cap is a glyph.
 */
export function hintKey(spec: string, mac = isMac()): { cap: string; label?: string } {
	if (spec === 'Arrows') return { cap: CODE_LABEL.Arrows, label: SPOKEN.Arrows };
	if (spec === '⇧') return mac ? { cap: '⇧', label: 'Shift' } : { cap: 'Shift' };
	const s = parse(spec);
	const cap = format(s, mac);
	const words = spoken(s, mac);
	return words === cap ? { cap } : { cap, label: words };
}
