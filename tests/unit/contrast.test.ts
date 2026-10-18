/**
 * Every text pair in the token table passes WCAG AA 4.5:1 (CLAUDE.md rule 4, features.md
 * "Modern layout, light and dark"). Read from layout.css so the test follows the tokens.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/routes/layout.css', import.meta.url), 'utf8');

function tokens(selector: string): Record<string, string> {
	const start = css.indexOf(selector);
	const block = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
	const out: Record<string, string> = {};
	for (const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) out[m[1]] = m[2];
	return out;
}
const light = tokens(':root {');
const dark = { ...light, ...tokens(":root[data-theme='dark']") };

const lum = (hex: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
	const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
export const contrast = (a: string, b: string) => {
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};

/** Text colour on a background, as the chrome uses them. */
const TEXT_PAIRS: [string, string][] = [
	['chrome-text', 'chrome-bg'],
	['chrome-text', 'chrome-surface'],
	['chrome-muted', 'chrome-bg'],
	['chrome-muted', 'chrome-surface'],
	['on-accent', 'accent-fill'],
	['danger', 'chrome-surface'],
	['danger', 'chrome-bg'],
	['paper-ink', 'paper-bg']
];
/** Non-text: UI edges and the accent as an outline, 3:1 (CLAUDE.md rule 4). */
const EDGE_PAIRS: [string, string][] = [
	['accent', 'chrome-bg'],
	['accent', 'chrome-surface'],
	['accent', 'paper-bg']
];

describe.each([
	['light', light],
	['dark', dark]
] as const)('%s theme tokens', (_name, t) => {
	it.each(TEXT_PAIRS)('%s on %s reads at 4.5:1', (fg, bg) => {
		expect(t[fg], fg).toBeDefined();
		expect(t[bg], bg).toBeDefined();
		expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(4.5);
	});
	it.each(EDGE_PAIRS)('%s against %s stands out at 3:1', (fg, bg) => {
		expect(contrast(t[fg], t[bg])).toBeGreaterThanOrEqual(3);
	});
	it('paper is white', () => {
		expect(t['paper-bg']).toBe('#ffffff');
	});
});
