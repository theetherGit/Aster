/**
 * The Text view's colouring (owner's request, 2026-10-19): one line at a time, every character
 * kept, so the coloured layer lines up with the text area above it. Few kinds on purpose: the
 * colours must hold 4.5:1 on the chrome in every theme (tokens.css).
 */
export type TokenKind =
	'keyword' | 'arrow' | 'stereotype' | 'string' | 'comment' | 'directive' | 'text';
export interface Token {
	kind: TokenKind;
	text: string;
}

const KEYWORDS = new Set([
	'abstract',
	'class',
	'interface',
	'enum',
	'package',
	'namespace',
	'note',
	'as',
	'end',
	'of',
	'skinparam',
	'hide',
	'show'
]);
// Same shape as the parser's arrow: optional head, dashes or dots, a direction word, optional tail.
const ARROW = /^(?:<\|?|\*|o)?[-.]+(?:(?:up|down|left|right|u|d|l|r)[-.]*)?(?:\|?>|\*|o)?/;

export function highlight(line: string): Token[] {
	const trimmed = line.trimStart();
	if (trimmed.startsWith("'")) return [{ kind: 'comment', text: line }];
	if (trimmed.startsWith('@')) return [{ kind: 'directive', text: line }];
	const out: Token[] = [];
	const push = (kind: TokenKind, text: string) => {
		const last = out.at(-1);
		if (last && last.kind === kind && kind === 'text') last.text += text;
		else out.push({ kind, text });
	};
	// A member line (indented, or starting with a visibility symbol) has no arrows or keywords.
	const member = /^\s+\S/.test(line) || /^[+\-#~]/.test(trimmed);
	let i = 0;
	let first = true;
	while (i < line.length) {
		const rest = line.slice(i);
		const st = /^<<[^>]*>>/.exec(rest);
		const str = /^"[^"]*"/.exec(rest);
		const word = /^[A-Za-z_$][\w$]*/.exec(rest);
		const arrow = member ? null : ARROW.exec(rest);
		if (st) {
			push('stereotype', st[0]);
			i += st[0].length;
		} else if (str) {
			push('string', str[0]);
			i += str[0].length;
		} else if (word) {
			// Keywords only where a declaration can start: the line's leading words.
			push(!member && first && KEYWORDS.has(word[0]) ? 'keyword' : 'text', word[0]);
			if (!KEYWORDS.has(word[0])) first = false;
			i += word[0].length;
		} else if (arrow && arrow[0].length >= 2 && /[-.]/.test(arrow[0])) {
			push('arrow', arrow[0]);
			first = false;
			i += arrow[0].length;
		} else {
			push('text', line[i]);
			if (!/\s/.test(line[i])) first = false;
			i++;
		}
	}
	return out;
}
