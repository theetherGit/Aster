import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The docs site's theme (docs-site/src/styles/globals.css) is Aster's chrome under Nimbus's names,
// with the brand's colours as its accent. A value tagged `/* --token */` (or `/* dark --token */`)
// must equal that token in the app's tokens.css, light or dark; one tagged `/* brand petal */` (or
// `/* dark brand petal */`) must use that colour from docs/brand/README.md. Neither can drift.

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../../src/lib/ui/tokens.css').replace(/\/\*[\s\S]*?\*\//g, '');
const docs = read('../../docs-site/src/styles/globals.css');
const brandDoc = read('../../docs/brand/README.md');

/** `--name: value;` pairs of every block whose selector matches. */
function tokens(css: string, selector: RegExp): Map<string, string> {
	const out = new Map<string, string>();
	for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!selector.test(sel.trim())) continue;
		for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g))
			out.set(name, value.replace(/\s+/g, ' ').trim());
	}
	return out;
}
const light = tokens(app, /^:root$/);
const dark = new Map([...light, ...tokens(app, /^:root\[data-theme='dark'\]$/)]);

const tagged = [
	...docs.matchAll(/(--nb-[\w-]+):\s*([^;]+);\s*\/\*\s*(dark )?(--[\w-]+)\s*\*\//g)
].map(([, nb, value, isDark, token]) => ({
	nb,
	value: value.trim(),
	theme: isDark ? dark : light,
	token
}));

/** The brand table: `| Petal | \`#5A4BD6\` | \`#8B7FF5\` |` → petal: [light, dark]. */
const brand = new Map(
	[
		...brandDoc.matchAll(/^\| (\w+)[^|]*\| `(#[0-9A-Fa-f]{6})`[^|]*\| `(#[0-9A-Fa-f]{6})` \|/gm)
	].map(([, name, l, d]) => [name.toLowerCase(), [l.toLowerCase(), d.toLowerCase()]] as const)
);
const branded = [
	...docs.matchAll(/(--nb-[\w-]+):\s*([^;]+);\s*\/\*\s*(dark )?brand (\w+)\s*\*\//g)
].map(([, nb, value, isDark, name]) => ({ nb, value: value.trim().toLowerCase(), isDark, name }));

describe('docs site theme', () => {
	it('tags most of its colours and faces with an app token', () => {
		expect(tagged.length).toBeGreaterThan(20);
	});
	// A tint names its source colour: `color-mix(in srgb, #2f6fe4 8%, transparent)` is the accent's.
	it.each(tagged)('$nb is $token', ({ value, theme, token }) => {
		const expected = theme.get(token);
		expect(expected).toBeDefined();
		if (value.startsWith('color-mix(')) expect(value).toContain(`${expected} `);
		else expect(value).toBe(expected);
	});
	it('takes its accent from the brand', () => {
		expect(branded.length).toBeGreaterThan(8);
	});
	// A tint or a hover names the brand colour it is mixed from.
	it.each(branded)('$nb is the brand $name', ({ value, isDark, name }) => {
		const colours = brand.get(name);
		expect(colours).toBeDefined();
		expect(value).toContain(colours![isDark ? 1 : 0]);
	});
});
