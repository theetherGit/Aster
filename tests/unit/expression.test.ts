import { describe, expect, it } from 'vitest';
import lines from '../../fixtures/grammar/lines.json';
import {
	isRaw,
	memberFromText,
	parseMember,
	parseParameter,
	renderAttribute,
	renderMember,
	renderOperation,
	withVisibility,
	type MemberKind
} from '#lib/mdj/expression.ts';

type Line = {
	kind: MemberKind | 'parameter';
	input: string;
	expected: unknown;
	canonical?: string;
};

const parseMdj_op = (line: string) => parseMember('operation', line) as never;
const parse = (kind: Line['kind'], input: string) =>
	kind === 'parameter' ? parseParameter(input) : parseMember(kind, input);

describe('expression grammar fixtures', () => {
	it.each((lines as Line[]).map((l) => [l.kind, l.input, l] as const))(
		'%s %j parses to the expected structure',
		(kind, input, line) => {
			// Owner's ruling #25: the reason sits beside `raw` and the fixtures keep their shape.
			const shape = { ...(parse(kind, input) as { reason?: unknown }) };
			delete shape.reason;
			expect(shape).toEqual(line.expected);
		}
	);

	it.each(
		(lines as Line[])
			.filter((l) => l.canonical !== undefined)
			.map((l) => [l.input, l.canonical!, l] as const)
	)('%j renders canonically as %j and the canonical form parses back', (input, canonical, line) => {
		const parsed = parse(line.kind, input);
		expect(isRaw(parsed)).toBe(false);
		const rendered =
			line.kind === 'parameter' ? canonical : renderMember(line.kind, parsed as never);
		expect(rendered).toBe(canonical);
		expect(parse(line.kind, canonical)).toEqual(line.expected);
	});

	it('has the 20 shipped lines plus the two unparseable ones', () => {
		expect(lines.length).toBeGreaterThanOrEqual(22);
	});
});

describe('expression edge cases', () => {
	it('never throws and keeps garbage verbatim', () => {
		for (const s of ['', '   ', '::', '+(', '{', '<<x', '+a: b = {', '+f(a,,b)', '+x: y {wat}']) {
			// The text verbatim; the reason beside it (ruling #25) is checked below.
			expect(parseMember('attribute', s)).toMatchObject({ raw: s });
			expect(parseMember('operation', s)).toMatchObject({ raw: s });
			expect(parseMember('literal', s)).toMatchObject({ raw: s });
		}
	});

	it('splits parameters on top-level commas only', () => {
		const op = parseMember(
			'operation',
			'+put(key: Map<String, List<Int>>, value: String = "a,b"): void'
		);
		expect(op).toMatchObject({
			parameters: [
				{ name: 'key', type: 'Map<String, List<Int>>', direction: 'in' },
				{ name: 'value', type: 'String', direction: 'in', defaultValue: '"a,b"' }
			]
		});
	});

	it('accepts flags in the property block and renders static+abstract losslessly', () => {
		expect(parseMember('attribute', 'x: int {static, readOnly}')).toMatchObject({
			isStatic: true,
			isReadOnly: true
		});
		const op = parseMember('operation', '+{static} f() {abstract, query}');
		expect(op).toMatchObject({ isStatic: true, isAbstract: true, isQuery: true });
		const text = renderOperation(op as never);
		expect(parseMember('operation', text)).toEqual(op);
	});

	it('honours display options', () => {
		const a = parseMember('attribute', '<<key>> -isbn: String[1] = "x" {readOnly}');
		expect(
			renderAttribute(a as never, {
				showVisibility: false,
				showType: false,
				showMultiplicity: false,
				showProperty: false,
				guillemets: true
			})
		).toBe('«key» isbn');
		const op = parseMember('operation', '+f(a: int): int {query}');
		expect(
			renderOperation(op as never, { showOperationSignature: false, showProperty: false })
		).toBe('+ f()');
		// On paper, static and abstract show as underline and italics, not as keywords.
		const sa = parseMdj_op('+ {static} f() {abstract, query}');
		expect(renderOperation(sa, { keywords: false })).toBe('+ f() {query}');
		expect(
			renderAttribute(parseMember('attribute', '+ {static} MAX: int') as never, { keywords: false })
		).toBe('+ MAX: int');
	});

	it('memberFromText keeps unparseable text under raw and the previous name', () => {
		const prev = memberFromText('attribute', '-count: int', 'a1');
		const broken = memberFromText('attribute', '+count: int[0..', 'a1', prev);
		expect(broken).toMatchObject({ id: 'a1', name: 'count', raw: '+count: int[0..' });
		expect(renderAttribute(broken as never)).toBe('+count: int[0..');
		expect(memberFromText('literal', 'not a literal!', 'l1')).toMatchObject({
			id: 'l1',
			name: 'not a literal!'
		});
		expect(
			memberFromText('operation', '+go()', 'o1', { ...prev, documentation: 'doc' })
		).toMatchObject({ documentation: 'doc', name: 'go' });
	});
});

/** Owner's ruling #25: an unparsed line says why; a missing closer comes with its fix. */
describe('why a line is kept as text', () => {
	const why = (kind: MemberKind, line: string) =>
		(parseMember(kind, line) as { reason?: unknown }).reason;
	it('names the missing closer, and offers the fix only when it parses', () => {
		expect(why('operation', '+ find(id: int')).toEqual({ code: 'paren', fix: '+ find(id: int)' });
		expect(why('attribute', 'x: int {readOnly')).toEqual({
			code: 'brace',
			fix: 'x: int {readOnly}'
		});
		expect(why('attribute', 'x: Customer [')).toEqual({ code: 'bracket' });
		expect(why('attribute', '<<entity x: int')).toEqual({ code: 'guillemet' });
	});
	it('names an unknown property and an unreadable parameter', () => {
		expect(why('attribute', 'x: int {final}')).toEqual({ code: 'property', detail: 'final' });
		expect(why('operation', 'f(1x: int)')).toEqual({ code: 'parameter', detail: '1x: int' });
		expect(why('attribute', '?? Customer')).toEqual({ code: 'syntax' });
	});
	it('says nothing for a line that parses', () => {
		expect(why('attribute', '- x: int')).toBeUndefined();
	});
});

/** Board 24: the inspector shows a line without its symbol; the row's visibility goes back in on commit. */
describe('withVisibility', () => {
	it('puts the symbol in front, after a stereotype', () => {
		expect(withVisibility('balance: double', 'private')).toBe('- balance: double');
		expect(withVisibility('<<id>> {static} id: UUID', 'protected')).toBe(
			'<<id>> # {static} id: UUID'
		);
	});
	it('keeps a symbol the user typed', () => {
		expect(withVisibility('+ kind: AccountKind', 'private')).toBe('+ kind: AccountKind');
		expect(withVisibility('<<id>> ~id: UUID', 'public')).toBe('<<id>> ~id: UUID');
	});
	it('round-trips with renderMember without the symbol', () => {
		const m = memberFromText('attribute', '<<x>> # {static} id: UUID[0..1]', 'a');
		const shown = renderMember('attribute', m, { showVisibility: false });
		expect(withVisibility(shown, 'protected')).toBe(renderMember('attribute', m));
	});
});
