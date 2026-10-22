/**
 * features.md M3, "Mermaid export": `classDiagram` text from the model. Checked against
 * Mermaid 11's own parser and renderer (see the DECISIONS line); these pin the dialect rules.
 */
import { describe, expect, it } from 'vitest';
import { diagramToMermaid } from '#lib/export/mermaid.ts';
import { notationProject, sampleProject } from '#lib/model/fixtures.ts';
import { createClassifier, createAttribute, createOperation } from '#lib/model/project.ts';

describe('diagram → Mermaid classDiagram', () => {
	it('writes the notation fixture: classes, members, kinds and all six relationships', () => {
		const p = notationProject();
		expect(diagramToMermaid(p, p.diagrams[0])).toBe(
			[
				'---',
				'title: Library',
				'---',
				'classDiagram',
				'  class Person {',
				'    <<abstract>>',
				'    #name: String',
				'    +getName() String',
				'  }',
				'  class Member {',
				'    -memberId: String',
				'  }',
				'  class Library {',
				'    -libraryName: String',
				'  }',
				'  class Book {',
				'    -isbn: String',
				'    -title: String',
				'  }',
				'  class Searchable {',
				'    <<interface>>',
				'    +search(q: String) Book',
				'  }',
				'  class Loan {',
				'    -dueDate: Date',
				'    +isOverdue() boolean',
				'  }',
				'  class LoanStatus {',
				'    <<enumeration>>',
				'    ACTIVE',
				'    RETURNED',
				'    OVERDUE',
				'  }',
				'  class Category {',
				'    -label: String',
				'  }',
				'  Member --|> Person',
				'  Book ..|> Searchable',
				'  Book "0..* books" --* "1" Library',
				'  Member "* members" --o "0..1" Library',
				'  Member "1" --> "0..* -loans" Loan',
				'  Loan -- "1" Book : borrows',
				'  Loan ..> LoanStatus : «use»',
				'  Category "0..1 parent" -- "* children" Category',
				''
			].join('\n')
		);
	});

	it('escapes what Mermaid would read as syntax, and labels names it cannot take as ids', () => {
		const p = sampleProject();
		const d = p.diagrams[0];
		const c = createClassifier({
			id: 'odd',
			name: 'Order Item',
			attributes: [
				createAttribute({ name: 'id', type: 'int', isStatic: true, isReadOnly: true }),
				createAttribute({ name: 'tags', type: 'List<String>' })
			],
			operations: [createOperation({ name: 'area', returnType: 'double', isAbstract: true })]
		});
		p.elements.set(c.id, c);
		d.elementIds.push(c.id);
		d.layout.set(c.id, { kind: 'node', x: 0, y: 0, w: 160, h: 80 });
		const out = diagramToMermaid(p, d);
		expect(out).toContain('  class Order_Item["Order Item"]\n  class Order_Item {\n');
		expect(out).toContain('    -id: int #123;readOnly#125;$\n');
		expect(out).toContain('    -tags: List~String~\n');
		expect(out).toContain('    +area() double*\n');
	});

	it('keeps notes, one line per break, attached to the first class they annotate', () => {
		const p = sampleProject();
		const d = p.diagrams[0];
		const first = d.elementIds.find((id) => p.elements.get(id)?.kind === 'classifier')!;
		p.elements.set('n1', { kind: 'note', id: 'n1', text: 'Says "hi"\nTwice', linkedIds: [first] });
		p.elements.set('n2', { kind: 'note', id: 'n2', text: 'Loose', linkedIds: [] });
		for (const id of ['n1', 'n2']) {
			d.elementIds.push(id);
			d.layout.set(id, { kind: 'node', x: 0, y: 0, w: 120, h: 60 });
		}
		const out = diagramToMermaid(p, d);
		const name = (p.elements.get(first) as { name: string }).name;
		expect(out).toContain(`  note for ${name} "Says #quot;hi#quot;<br>Twice"\n`);
		expect(out).toContain('  note "Loose"\n');
	});
});
