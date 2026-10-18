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
	if (e.code !== s.code) return false;
	const mod = e.metaKey || e.ctrlKey;
	return mod === !!s.mod && e.shiftKey === !!s.shift && e.altKey === !!s.alt;
}

const CODE_LABEL: Record<string, string> = {
	Enter: '↩',
	Tab: 'Tab',
	Escape: 'Esc',
	Backspace: '⌫',
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

/** "⌘⇧V" on macOS, "Ctrl+Shift+V" elsewhere. `?` shows as itself. */
/** The `aria-keyshortcuts` form: "Meta+Shift+V" on macOS, "Control+Shift+V" elsewhere. */
export function ariaKeys(s: Shortcut, mac = isMac()): string {
	const parts: string[] = [];
	if (s.mod) parts.push(mac ? 'Meta' : 'Control');
	if (s.alt) parts.push('Alt');
	if (s.shift) parts.push('Shift');
	parts.push(s.code.replace(/^(Key|Digit)/, ''));
	return parts.join('+');
}

export function format(s: Shortcut, mac = isMac()): string {
	let key = CODE_LABEL[s.code] ?? s.code.replace(/^Key|^Digit/, '');
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
