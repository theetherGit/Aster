import { describe, expect, it } from 'vitest';
import { highlight } from '#lib/puml/highlight.ts';

/** The Text view's colouring: keywords and arrows stand out, comments and directives recede. */
const kinds = (line: string) =>
	highlight(line)
		.filter((t) => t.kind !== 'text')
		.map((t) => [t.kind, t.text]);

describe('PlantUML highlighting', () => {
	it('marks declarations, stereotypes and the opening brace', () => {
		expect(kinds('abstract class Person <<entity>> {')).toEqual([
			['keyword', 'abstract'],
			['keyword', 'class'],
			['stereotype', '<<entity>>']
		]);
		expect(kinds('enum LoanStatus { ACTIVE; RETURNED }')).toEqual([['keyword', 'enum']]);
	});

	it('marks arrows, multiplicities and labels in a relationship line', () => {
		expect(kinds('Member "1" -- "0..*" Loan : loans')).toEqual([
			['string', '"1"'],
			['arrow', '--'],
			['string', '"0..*"']
		]);
		expect(kinds('Loan ..> LoanStatus : <<use>>')).toEqual([
			['arrow', '..>'],
			['stereotype', '<<use>>']
		]);
		expect(kinds('Order *-up- OL')).toEqual([['arrow', '*-up-']]);
	});

	it('marks comments and directives whole, and keeps every character', () => {
		expect(kinds("' kept as typed")).toEqual([['comment', "' kept as typed"]]);
		expect(kinds('@startuml')).toEqual([['directive', '@startuml']]);
		for (const line of ['  +search(q: String): Book[*]', 'note "x" as N1', 'class "A B" as AB {'])
			expect(
				highlight(line)
					.map((t) => t.text)
					.join('')
			).toBe(line);
	});

	it('does not read a member line as a relationship', () => {
		expect(kinds('  -dueDate: Date')).toEqual([]);
		expect(kinds('  +isOverdue(): boolean')).toEqual([]);
	});
});
