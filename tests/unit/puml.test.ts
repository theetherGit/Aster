import { describe, expect, it } from 'vitest';
import { Stack, batch } from '#lib/commands/index.ts';
import { createDiagram, createProject } from '#lib/model/project.ts';
import type { Classifier, Project, Relationship } from '#lib/model/types.ts';
import { parsePuml } from '#lib/puml/parse.ts';
import { printDiagram } from '#lib/puml/print.ts';
import { planSync } from '#lib/puml/sync.ts';
import { structural } from './helpers.ts';

/** accessibility.md, Text view dialect: the example the spec gives, as @startuml … @enduml. */
const SPEC = `@startuml
abstract class Person {
  #name: String
  +getName(): String
}
class Loan {
  -dueDate: Date
  -status: LoanStatus
  +isOverdue(): boolean
}
interface Searchable {
  +search(q: String): Book[*]
}
enum LoanStatus { ACTIVE; RETURNED; OVERDUE }
class Member
class Library
class Book

Member --|> Person
Library *-- Book
Book ..|> Searchable
Member "1" -- "0..*" Loan : loans
Loan --> "1" Book : book
Loan ..> LoanStatus : <<use>>
@enduml
`;

function empty() {
	const project = createProject({ id: 'p', name: 'P' });
	project.diagrams.push(createDiagram({ id: 'd', name: 'D' }));
	return { project, stack: new Stack(() => project) };
}
let n = 0;
const mint = () => `id${++n}`;
const place = () => ({ x: 0, y: 0 });
function sync(project: Project, stack: Stack, text: string) {
	const doc = parsePuml(text);
	expect(doc.errors).toEqual([]);
	const plan = planSync(project, 'd', doc, { mint, place });
	if (plan) stack.run(batch(project, plan));
	return plan;
}
const byName = (p: Project, name: string) =>
	[...p.elements.values()].find((e) => e.kind === 'classifier' && e.name === name) as Classifier;
const rels = (p: Project) =>
	[...p.elements.values()].filter((e): e is Relationship => e.kind === 'relationship');

describe('Text view: the spec example round-trips', () => {
	it('builds the model from the text and prints the same text back', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		expect(byName(project, 'Person').isAbstract).toBe(true);
		expect(byName(project, 'Searchable').classifierKind).toBe('interface');
		expect(byName(project, 'LoanStatus').literals.map((l) => l.name)).toEqual([
			'ACTIVE',
			'RETURNED',
			'OVERDUE'
		]);
		expect(printDiagram(project, project.diagrams[0])).toBe(SPEC);
	});

	it('maps arrows to the model: child to parent, part to whole, ends and names', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		const r = (kind: string) => rels(project).filter((x) => x.relationshipKind === kind);
		const id = (name: string) => byName(project, name).id;
		expect(r('generalization')[0]).toMatchObject({
			sourceId: id('Member'),
			targetId: id('Person')
		});
		expect(r('composition')[0]).toMatchObject({ sourceId: id('Book'), targetId: id('Library') });
		expect(r('realization')[0]).toMatchObject({ sourceId: id('Book'), targetId: id('Searchable') });
		const [loans, book] = r('association');
		expect(loans).toMatchObject({ name: 'loans', sourceEnd: { multiplicity: '1' } });
		expect(loans.targetEnd).toMatchObject({ multiplicity: '0..*' });
		expect(book.targetEnd).toMatchObject({ multiplicity: '1', navigable: 'navigable' });
		expect(r('dependency')[0]).toMatchObject({ stereotype: 'use', sourceId: id('Loan') });
	});

	it('plans nothing when the text already says what the model holds', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		expect(planSync(project, 'd', parsePuml(SPEC), { mint, place })).toBeNull();
	});
});

describe('Text view: edits apply as one undo step and keep what text cannot say', () => {
	it('adds a class and a member, edits a line, and undoes as one step', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		const before = structural(project);
		const loanBefore = byName(project, 'Loan');
		const edited = SPEC.replace(
			'-status: LoanStatus',
			'-status: LoanStatus\n  -renewals: int'
		).replace('class Member\n', 'class Member\nclass Shelf {\n  -code: String\n}\n');
		const plan = sync(project, stack, edited)!;
		expect(plan.label).toBe('edit the text view');
		expect(byName(project, 'Shelf').attributes.map((a) => a.name)).toEqual(['code']);
		const loan = byName(project, 'Loan');
		expect(loan.attributes.map((a) => a.name)).toEqual(['dueDate', 'status', 'renewals']);
		// Unchanged members keep their ids (and so their documentation).
		expect(loan.attributes[0].id).toBe(loanBefore.attributes[0].id);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('keeps roles and documentation the text cannot express', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		const loans = rels(project).find((r) => r.name === 'loans')!;
		loans.sourceEnd!.role = 'borrower';
		loans.documentation = 'kept';
		sync(project, stack, SPEC.replace('"0..*" Loan : loans', '"1..*" Loan : loans'));
		const after = project.elements.get(loans.id) as Relationship;
		expect(after.targetEnd?.multiplicity).toBe('1..*');
		expect(after.sourceEnd?.role).toBe('borrower');
		expect(after.documentation).toBe('kept');
	});

	it('reads one class gone and one new as a rename, so its place and links stay', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		const id = byName(project, 'Loan').id;
		sync(
			project,
			stack,
			SPEC.replaceAll('Loan', 'Lending').replaceAll('LendingStatus', 'LoanStatus')
		);
		expect(byName(project, 'Lending').id).toBe(id);
		expect(rels(project).filter((r) => r.sourceId === id || r.targetId === id)).toHaveLength(3);
	});

	it('removes from the diagram what the text no longer has; the model keeps it', () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		const id = byName(project, 'Member').id;
		sync(project, stack, SPEC.replace('class Member\n', '').replace(/^Member .*\n/gm, ''));
		expect(project.diagrams[0].elementIds).not.toContain(id);
		expect(project.elements.has(id)).toBe(true);
	});
});

describe('Text view: the PlantUML it reads', () => {
	it('reads arrow variants, direction hints, quoted names, stereotypes and {static}', () => {
		const doc = parsePuml(`
' a comment is kept
skinparam classAttributeIconSize 0
class "Order Line" as OL
class Order <<entity>> {
  {static} +count: int
  +total(): Money
}
Order *-up- OL
Order -right-> Customer
Customer <|.. Person
A <|-- B
C o-- "many" D
`);
		expect(doc.errors).toEqual([]);
		expect(doc.classifiers.map((c) => c.name)).toEqual([
			'Order Line',
			'Order',
			'Customer',
			'Person',
			'A',
			'B',
			'C',
			'D'
		]);
		expect(doc.classifiers[1]).toMatchObject({ stereotype: 'entity' });
		expect(doc.classifiers[1].lines[0]).toMatchObject({
			kind: 'attribute',
			text: '+{static} count: int'
		});
		expect(doc.relationships.map((r) => [r.kind, r.source, r.target])).toEqual([
			['composition', 'Order Line', 'Order'],
			['association', 'Order', 'Customer'],
			['realization', 'Person', 'Customer'],
			['generalization', 'B', 'A'],
			['aggregation', 'D', 'C']
		]);
		expect(doc.kept).toEqual(["' a comment is kept", 'skinparam classAttributeIconSize 0']);
	});

	it('reads extends, implements and a #colour on a class line (owner review, 2026-10-21)', () => {
		const doc = parsePuml(
			'@startuml\nclass Member extends Person implements Searchable, Comparable {\n  -memberId: String\n}\nclass Book <<entity>> #FFF8E1 {\n  -isbn: String\n}\ninterface Sorted extends Comparable\n@enduml\n'
		);
		expect(doc.errors).toEqual([]);
		const member = doc.classifiers.find((c) => c.name === 'Member')!;
		expect(member.lines.map((l) => l.text)).toEqual(['-memberId: String']);
		const book = doc.classifiers.find((c) => c.name === 'Book')!;
		expect(book.stereotype).toBe('entity');
		expect(book.lines.map((l) => l.text)).toEqual(['-isbn: String']);
		expect(doc.relationships.map((r) => `${r.source} ${r.kind} ${r.target}`)).toEqual([
			'Member generalization Person',
			'Member realization Searchable',
			'Member realization Comparable',
			'Sorted generalization Comparable'
		]);
	});

	it('says where a brace is missing or stray, and plans nothing then', () => {
		expect(parsePuml('class A {\n  +x: int\n').errors).toEqual([
			{ line: 1, message: 'missingBrace', name: 'A' }
		]);
		expect(parsePuml('class A\n}\n').errors).toEqual([{ line: 2, message: 'strayBrace' }]);
	});

	it('reads notes and their links', () => {
		const doc = parsePuml('class A\nnote "Lent for 14 days" as N1\nN1 .. A\n');
		expect(doc.notes).toEqual([{ alias: 'N1', text: 'Lent for 14 days', line: 2 }]);
		expect(doc.links).toEqual([{ alias: 'N1', target: 'A', line: 3 }]);
	});
});

/** M2.4 prompt: "a corpus of PlantUML class snippets from the PlantUML docs round-trips". */
const CORPUS = [
	`class Car
Driver - Car : drives >
Car *- Wheel : have 4 >
Car -- Person : < owns`,
	`Class01 <|-- Class02
Class03 *-- Class04
Class05 o-- Class06
Class07 .. Class08
Class09 -- Class10`,
	`Class11 <|.. Class12
Class13 --> Class14
Class15 ..> Class16
Class17 ..|> Class18
Class19 <--* Class20`,
	`class Dummy {
  -field1
  #field2
  ~method1()
  +method2()
}`,
	`abstract class AbstractList
abstract AbstractCollection
interface List
interface Collection
List <|-- AbstractList
Collection <|-- AbstractCollection
Collection <|- List
AbstractCollection <|- AbstractList
AbstractList <|-- ArrayList
class ArrayList {
  Object[] elementData
  size()
}
enum TimeUnit {
  DAYS
  HOURS
  MINUTES
}`,
	`Class01 "1" *-- "many" Class02 : contains
Class03 o-- Class04 : aggregation
Class05 --> "1" Class06`,
	`class Foo <<Serializable>> {
  {static} +counter: int
  {abstract} +run(): void
}
package net.dummy {
  class Person
}
Foo ..> Person : <<use>>`
];

describe('Text view: PlantUML documentation snippets round-trip', () => {
	it.each(CORPUS.map((s, i) => [i + 1, s] as const))('snippet %i', (_, source) => {
		const doc = parsePuml(source);
		expect(doc.errors).toEqual([]);
		const one = empty();
		sync(one.project, one.stack, source);
		const printed = printDiagram(one.project, one.project.diagrams[0]);
		// Every class and relationship the snippet names is in the model and in the text.
		expect(
			parsePuml(printed)
				.classifiers.map((c) => c.name)
				.sort()
		).toEqual(doc.classifiers.map((c) => c.name).sort());
		expect(parsePuml(printed).relationships).toHaveLength(doc.relationships.length);
		// And the printed text is a fixed point: read again, it prints the same.
		const two = empty();
		sync(two.project, two.stack, printed);
		expect(printDiagram(two.project, two.project.diagrams[0])).toBe(printed);
	});
});

describe('Text view: canvas commands show in the text', () => {
	it('reflects a rename, a new member, a new link and a removal', async () => {
		const { project, stack } = empty();
		sync(project, stack, SPEC);
		const { renameClassifier, addMember, connect, deleteFromDiagram } =
			await import('#lib/commands/index.ts');
		const { memberFromText } = await import('#lib/mdj/expression.ts');
		const id = (name: string) => byName(project, name).id;
		stack.run(renameClassifier(project, { id: id('Library'), name: 'Branch' }));
		stack.run(
			addMember(project, {
				classifierId: id('Book'),
				kind: 'attribute',
				member: memberFromText('attribute', '- isbn: String', 'm1')
			})
		);
		stack.run(
			connect(project, {
				diagramId: 'd',
				id: 'r9',
				sourceId: id('Member'),
				targetId: id('Book'),
				kind: 'dependency'
			})
		);
		stack.run(deleteFromDiagram(project, { diagramId: 'd', ids: [id('Searchable')] }));
		const text = printDiagram(project, project.diagrams[0]);
		expect(text).toContain('class Branch');
		expect(text).toContain('Branch *-- Book');
		expect(text).toContain('class Book {\n  -isbn: String\n}');
		expect(text).toContain('Member ..> Book');
		expect(text).not.toContain('Searchable');
	});
});
