import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import lines from '../../fixtures/grammar/lines.json';
import { summarise } from '#lib/canvas/summary.ts';
import type { MemberKind } from '#lib/mdj/expression.ts';
import { explain } from '../../docs-site/src/lib/explain.ts';

// The docs' member line playground (docs-site/src/lib/explain.ts) must say what the app's chip says,
// for every line of the grammar fixtures and a few the fixtures do not cover.
const cases: [MemberKind, string][] = [
	...(lines as { kind: string; input: string }[])
		.filter((l): l is { kind: MemberKind; input: string } => l.kind !== 'parameter')
		.map((l): [MemberKind, string] => [l.kind, l.input]),
	['attribute', '-x: int {abstract}'],
	['operation', '+f(: int)'],
	['attribute', ': String'],
	['literal', 'ON_LOAN'],
	['operation', '<<create>> +Book(isbn: String, title: String)']
];

describe('docs: member line playground', () => {
	it.each(cases)('%s %j reads as the chip does', (kind, line) => {
		const chip = summarise(kind, line);
		const docs = explain(kind, line);
		expect({ ok: docs.ok, parts: docs.parts }).toEqual(chip);
	});
});

describe('docs: the playground examples', () => {
	const source = readFileSync(
		new URL('../../docs-site/src/components/MemberPlayground.astro', import.meta.url),
		'utf8'
	);
	const block = source.slice(source.indexOf('const EXAMPLES'), source.indexOf('];'));
	const examples = [
		...block.matchAll(/\["(attribute|operation|literal)", "((?:[^"\\]|\\.)*)"\]/g)
	].map(([, kind, line]) => [kind as MemberKind, JSON.parse(`"${line}"`) as string] as const);
	it('offers lines that read and one that does not, to show the fix', () => {
		expect(examples.length).toBeGreaterThan(4);
		const verdicts = examples.map(([kind, line]) => explain(kind, line).ok);
		expect(verdicts.slice(0, -1).every(Boolean)).toBe(true);
		expect(verdicts.at(-1)).toBe(false);
		expect(explain(...examples.at(-1)!).fix).toBeDefined();
	});
});
