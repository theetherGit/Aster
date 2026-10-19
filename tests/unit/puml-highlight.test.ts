import { describe, expect, it } from 'vitest';
import { highlight } from '#lib/puml/highlight.ts';

/** The Text view's colouring (Shiki, Aster's PlantUML grammar): what stands out, what recedes. */
const kinds = (text: string) =>
	highlight(text).map((line) =>
		line.filter((t) => t.kind !== 'text' && t.text.trim()).map((t) => [t.kind, t.text.trim()])
	);

describe('PlantUML highlighting', () => {
	it('marks declarations, their names, stereotypes and aliases', () => {
		expect(kinds('abstract class Person <<entity>> {\n}')[0]).toEqual([
			['keyword', 'abstract'],
			['keyword', 'class'],
			['name', 'Person'],
			['stereotype', '<<entity>>']
		]);
		expect(kinds('enum LoanStatus { ACTIVE; RETURNED }')[0]).toEqual([
			['keyword', 'enum'],
			['name', 'LoanStatus']
		]);
		expect(kinds('class "A B" as AB')[0]).toEqual([
			['keyword', 'class'],
			['name', '"A B"'],
			['keyword', 'as'],
			['name', 'AB']
		]);
	});

	it('reads member lines inside a body: visibility, modifiers and types, never arrows', () => {
		expect(
			kinds('class Book {\n  -isbn: String\n  +{static} search(q: String): Book[*]\n}').slice(1, 3)
		).toEqual([
			[
				['modifier', '-'],
				['type', 'String']
			],
			[
				['modifier', '+{static}'], // adjacent tokens of one kind arrive merged
				['type', 'String'],
				['type', 'Book[*]']
			]
		]);
	});

	it('marks arrows, multiplicities and labels in a relationship line', () => {
		expect(kinds('Member "1" -- "0..*" Loan : loans')[0]).toEqual([
			['string', '"1"'],
			['arrow', '--'],
			['string', '"0..*"']
		]);
		expect(kinds('Loan ..> LoanStatus : <<use>>')[0]).toEqual([
			['arrow', '..>'],
			['stereotype', '<<use>>']
		]);
		expect(kinds('Order *-up- OL')[0]).toEqual([['arrow', '*-up-']]);
	});

	it('marks comments, directives and note blocks', () => {
		expect(kinds("' kept as typed\n@startuml")).toEqual([
			[['comment', "' kept as typed"]],
			[['directive', '@startuml']]
		]);
		expect(kinds('note as N1\n  free -- text\nend note')).toEqual([
			[
				['keyword', 'note'],
				['keyword', 'as'],
				['name', 'N1']
			],
			[],
			[['keyword', 'end note']]
		]);
	});

	it('keeps every character of every line', () => {
		const text =
			'@startuml\n  +search(q: String): Book[*]\n\nnote "x" as N1\nclass "A B" as AB {\n}';
		expect(
			highlight(text)
				.map((line) => line.map((t) => t.text).join(''))
				.join('\n')
		).toBe(text);
	});
});
