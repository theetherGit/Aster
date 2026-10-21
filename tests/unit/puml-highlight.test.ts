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

	it('reads a relationship line: both class names, multiplicities, arrow, label, direction', () => {
		expect(kinds('Member "1" -- "0..*" Loan : loans >')[0]).toEqual([
			['name', 'Member'],
			['string', '"1"'],
			['arrow', '--'],
			['string', '"0..*"'],
			['name', 'Loan'],
			['modifier', '>']
		]);
		expect(kinds('Loan ..> LoanStatus : <<use>>')[0]).toEqual([
			['name', 'Loan'],
			['arrow', '..>'],
			['name', 'LoanStatus'],
			['stereotype', '<<use>>']
		]);
		expect(kinds('Order *-up- OL')[0]).toEqual([
			['name', 'Order'],
			['arrow', '*-up-'],
			['name', 'OL']
		]);
	});

	it('reads arrow variants: colour and style brackets, x, # and + heads', () => {
		for (const arrow of [
			'-[#red]->',
			'-[hidden]-',
			'.[#blue,dashed].>',
			'x--',
			'#--',
			'+--',
			'--x'
		])
			expect(kinds(`A ${arrow} B`)[0]).toEqual([
				['name', 'A'],
				['arrow', arrow],
				['name', 'B']
			]);
	});

	it('marks extends, implements and a colour on a declaration', () => {
		expect(kinds('class Member extends Person implements Searchable, Comparable {\n}')[0]).toEqual([
			['keyword', 'class'],
			['name', 'Member'],
			['keyword', 'extends'],
			['name', 'Person'],
			['keyword', 'implements'],
			['name', 'Searchable'],
			['name', 'Comparable']
		]);
		expect(kinds('class Book #FFF8E1 {\n}')[0]).toEqual([
			['keyword', 'class'],
			['name', 'Book'],
			['modifier', '#FFF8E1']
		]);
	});

	it('marks the layout keywords and preprocessor lines', () => {
		expect(
			kinds('title Library\nleft to right direction\n!include common.puml\nhide empty members')
		).toEqual([
			[['keyword', 'title']],
			[['keyword', 'left to right direction']],
			[['directive', '!include common.puml']],
			[['keyword', 'hide']]
		]);
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
