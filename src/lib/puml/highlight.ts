/**
 * The Text view's colouring (owner's request, 2026-10-19): Shiki tokenises the text with a
 * TextMate grammar for Aster's PlantUML dialect, on its JavaScript regex engine (no WASM). Every
 * character is kept, line by line, so the coloured layer lines up with the text area above it.
 * The theme's colours are placeholders that map back to a few kinds; the Text view colours the
 * kinds from tokens, which hold 4.5:1 on the chrome in every theme (tokens.css).
 */
import {
	createHighlighterCoreSync,
	type LanguageRegistration,
	type ThemeRegistration
} from '@shikijs/core';
import { createJavaScriptRegexEngine } from '@shikijs/engine-javascript';

export type TokenKind =
	| 'keyword'
	| 'arrow'
	| 'stereotype'
	| 'string'
	| 'comment'
	| 'directive'
	| 'name'
	| 'type'
	| 'modifier'
	| 'text';
export interface Token {
	kind: TokenKind;
	text: string;
}

const keyword = { name: 'keyword.other.plantuml' };
const name = { name: 'entity.name.type.plantuml' };

const grammar: LanguageRegistration = {
	name: 'plantuml',
	scopeName: 'source.plantuml',
	patterns: [
		{ include: '#comment' },
		{ match: '^\\s*@\\w+.*$', name: 'meta.directive.plantuml' },
		{ include: '#note' },
		{ include: '#declaration' },
		{ include: '#body' },
		{ include: '#stereotype' },
		{ include: '#string' },
		{ match: '^\\s*(note|skinparam|hide|show)\\b', captures: { 1: keyword } },
		{ include: '#alias' },
		{ include: '#arrow' }
	],
	repository: {
		comment: {
			patterns: [
				{ match: "^\\s*'.*$", name: 'comment.line.quote.plantuml' },
				{ begin: "/'", end: "'/", name: 'comment.block.plantuml' }
			]
		},
		stereotype: { match: '<<[^<>]*>>', name: 'entity.other.stereotype.plantuml' },
		string: { match: '"[^"]*"', name: 'string.quoted.double.plantuml' },
		declaration: {
			match:
				'^\\s*(?:(abstract)\\s+)?(class|interface|enum|annotation|package|namespace)\\b\\s*("[^"]*"|[\\w.$]+)?',
			captures: { 1: keyword, 2: keyword, 3: name }
		},
		alias: { match: '\\b(as)\\s+([\\w.$]+)', captures: { 1: keyword, 2: name } },
		// The same arrow the parser reads: optional head, dashes or dots, a direction word, optional tail.
		arrow: {
			match:
				'(?:<\\|?|\\*|o)?(?:-+|\\.+)(?:(?:up|down|left|right|u|d|l|r)(?:-+|\\.+))?(?:\\|?>|\\*|o)?',
			name: 'keyword.operator.arrow.plantuml'
		},
		// `note as N1` or `note left of X` with no text on the line: a block up to `end note`.
		note: {
			begin: '^\\s*(note)\\b(?=[^":]*$)',
			beginCaptures: { 1: keyword },
			end: '^\\s*(end\\s*note)\\b',
			endCaptures: { 1: keyword },
			patterns: [
				{ match: '\\G\\s+(?:(left|right|top|bottom)\\s+)?(of)\\b', captures: { 2: keyword } },
				{ match: '\\G.*\\b(as)\\s+([\\w.$]+)', captures: { 1: keyword, 2: name } }
			]
		},
		// A class body: member lines, where `-` and `#` are visibility, not arrows.
		body: {
			begin: '\\{',
			end: '\\}',
			patterns: [
				{ include: '#comment' },
				{ match: '^\\s*([+\\-#~])', captures: { 1: { name: 'storage.modifier.plantuml' } } },
				{ match: '\\{[^{}\\n]*\\}', name: 'storage.modifier.plantuml' },
				{ include: '#stereotype' },
				{ include: '#string' },
				{ match: ':\\s*([\\w.$<>\\[\\]*]+)', captures: { 1: { name: 'support.type.plantuml' } } }
			]
		}
	}
};

// Placeholder colours, one per kind; the TextMate scope picks the kind, the Text view the colour.
const SCOPES: [TokenKind, string][] = [
	['keyword', 'keyword'],
	['arrow', 'keyword.operator.arrow'],
	['stereotype', 'entity.other.stereotype'],
	['string', 'string'],
	['comment', 'comment'],
	['directive', 'meta.directive'],
	['name', 'entity.name.type'],
	['type', 'support.type'],
	['modifier', 'storage.modifier']
];
const hex = (i: number) => `#0000${(i + 1).toString(16).padStart(2, '0')}`;
const KIND_OF = new Map(SCOPES.map(([kind], i) => [hex(i), kind]));
const theme: ThemeRegistration = {
	name: 'aster',
	type: 'dark',
	fg: '#000000',
	bg: '#ffffff',
	settings: [
		{ settings: { foreground: '#000000' } },
		...SCOPES.map(([, scope], i) => ({ scope, settings: { foreground: hex(i) } }))
	]
};

const shiki = createHighlighterCoreSync({
	themes: [theme],
	langs: [grammar],
	engine: createJavaScriptRegexEngine()
});

/** The text, line by line, as coloured tokens whose texts join back to each line. */
export function highlight(text: string): Token[][] {
	return shiki.codeToTokensBase(text, { lang: 'plantuml', theme: 'aster' }).map((line) =>
		line.map((t) => ({
			kind: KIND_OF.get(t.color?.toLowerCase() ?? '') ?? 'text',
			text: t.content
		}))
	);
}
