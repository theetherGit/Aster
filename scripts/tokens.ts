// Reads src/lib/ui/tokens.css and writes src/lib/ui/tokens.json in the DTCG shape: one group per
// theme block plus the shared scales. Run `pnpm tokens` after editing tokens.css; the unit test
// tests/unit/tokens.test.ts fails when the two drift. Values stay as written (hex, px, ms).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Token = { $type: string; $value: string };
type Group = Record<string, Token>;
export type Tokens = { $schema: string; aster: Record<string, Group> };

const root = new URL('../', import.meta.url);
const css = readFileSync(new URL('src/lib/ui/tokens.css', root), 'utf8');

const GROUPS: [string, RegExp][] = [
	['light', /^:root \{/m],
	['dark', /^:root\[data-theme='dark'\] \{/m],
	['high-contrast', /^:root\[data-theme='high-contrast'\] \{/m],
	['classic', /^:root\[data-layout='classic'\] \{/m]
];

function typeOf(name: string, value: string): string {
	if (/^#|^color-mix|^var\(--(chrome|accent|paper|warning|danger)/.test(value)) return 'color';
	if (
		/^(chrome|accent|on-accent|warning|danger|paper|control-border|selection|hairline)/.test(name)
	)
		return 'color';
	if (/ms$/.test(value)) return 'duration';
	if (/^cubic-bezier/.test(value)) return 'cubicBezier';
	if (/^z-/.test(name)) return 'number';
	if (/^font/.test(name)) return 'fontFamily';
	if (/^shadow/.test(name)) return 'shadow';
	if (/px$/.test(value)) return 'dimension';
	return 'string';
}

function block(re: RegExp, from = 0): { body: string; end: number } | null {
	const m = re.exec(css.slice(from));
	if (!m) return null;
	const start = from + m.index + m[0].length;
	const end = css.indexOf('\n}', start);
	return { body: css.slice(start, end), end };
}

function tokensOf(body: string): Group {
	const out: Group = {};
	for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
		out[m[1]] = { $type: typeOf(m[1], m[2]), $value: m[2].trim() };
	return out;
}

export function build(): Tokens {
	const json: Tokens = { $schema: 'https://tr.designtokens.org/format/', aster: {} };
	let cursor = 0;
	for (const [name, re] of GROUPS) {
		const b = block(re, cursor);
		if (!b) continue;
		json.aster[name] = tokensOf(b.body);
		cursor = b.end;
	}
	// The second plain :root holds the scales.
	const scales = block(/^:root \{/m, cursor);
	if (scales) json.aster.scales = tokensOf(scales.body);
	return json;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	writeFileSync(
		new URL('src/lib/ui/tokens.json', root),
		JSON.stringify(build(), null, '\t') + '\n'
	);
	console.log('wrote src/lib/ui/tokens.json');
}
