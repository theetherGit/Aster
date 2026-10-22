import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRaw, parseMember, type MemberKind } from '#lib/mdj/expression.ts';

// The docs' member syntax page (docs-site/src/content/docs/reference/member-syntax.mdx) shows
// lines Aster reads and lines it keeps as text. Each is run through the app's parser here, so the
// page cannot promise a line the app does not read.

const page = readFileSync(
	new URL('../../docs-site/src/content/docs/reference/member-syntax.mdx', import.meta.url),
	'utf8'
);
/** Rows `| \`line\` | kind | … |` of the section under `heading`. */
function rows(heading: string) {
	const start = page.indexOf(`## ${heading}`);
	const end = page.indexOf('\n## ', start + 1);
	const section = page.slice(start, end < 0 ? undefined : end);
	return [...section.matchAll(/^\| `(.+?)` \| (attribute|operation|literal) \| (.+?) \|$/gm)].map(
		([, line, kind, note]) => ({ line, kind: kind as MemberKind, note })
	);
}
/** The chip's words for each reason the parser gives. */
const REASON: Record<string, RegExp> = {
	bracket: /^Missing/,
	paren: /^Missing/,
	brace: /^Missing/,
	guillemet: /^Missing/,
	property: /^Unknown property/,
	parameter: /^Cannot read the parameter/,
	syntax: /^Not a member line/
};

describe('docs: member syntax page', () => {
	const read = rows('Examples');
	const kept = rows('Lines Aster cannot read');
	it('has examples of both', () => {
		expect(read.length).toBeGreaterThan(10);
		expect(kept.length).toBeGreaterThan(2);
	});
	it.each(read)('reads $kind `$line`', ({ kind, line }) => {
		expect(isRaw(parseMember(kind, line))).toBe(false);
	});
	it.each(kept)(
		'keeps $kind `$line` as text, for the reason the page gives',
		({ kind, line, note }) => {
			const parsed = parseMember(kind, line);
			expect(isRaw(parsed)).toBe(true);
			const code = isRaw(parsed) ? (parsed.reason?.code ?? 'syntax') : '';
			expect(note).toMatch(REASON[code]);
		}
	);
});
