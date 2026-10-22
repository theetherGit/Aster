/**
 * features.md M3, "Fill and line colour". StarUML writes `#ffffff` fill and `#000000` line on
 * every view, so those read as no colour: the paper draws the element in its own fill and ink,
 * which is what high contrast and the themes expect. Anything not `#rrggbb` is ignored the same way.
 */
const hex = (c: string | undefined) =>
	c && /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : undefined;

export const fillOf = (l: { fill?: string } | undefined) => {
	const c = hex(l?.fill);
	return c === '#ffffff' ? undefined : c;
};
export const lineOf = (l: { line?: string } | undefined) => {
	const c = hex(l?.line);
	return c === '#000000' ? undefined : c;
};

/** The paper's ink and fill as hex (tokens.css `--paper-ink`, `--paper-fill`), for exports and contrast. */
export const INK = '#1b1b1b';
export const PAPER = '#ffffff';

const lum = (c: string) => {
	const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
	const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
/** WCAG 2 contrast ratio of two `#rrggbb` colours. */
export const contrast = (a: string, b: string) => {
	const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
};
