import { describe, expect, it } from 'vitest';
import { suggestFor, summarise } from '#lib/canvas/summary.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createClassifier, createRelationship, defaultEdgeLayout } from '#lib/model/project.ts';

/** features.md M2, "Create unknown type from the chip"; keyboard.md ⌥↩ applies the chip's suggestion. */
describe('the parse chip suggestion', () => {
	const setup = () => {
		const project = sampleProject();
		return { project, diagram: project.diagrams[0] };
	};

	it('offers to create a class for a type that names nothing', () => {
		const { project, diagram } = setup();
		const say = (kind: 'attribute' | 'operation', text: string) =>
			suggestFor(project, diagram, 'Account', kind, text);
		expect(say('attribute', '- owner: Client')).toEqual({ kind: 'create', name: 'Client' });
		expect(say('attribute', 'owners: Client[0..*]')).toEqual({ kind: 'create', name: 'Client' });
		expect(say('operation', '+ find(id: int): Client')).toEqual({ kind: 'create', name: 'Client' });
		expect(say('operation', '+ add(c: Client): void')).toEqual({ kind: 'create', name: 'Client' });
	});

	it('offers nothing for primitives, generics, untyped or unparsed lines, and names', () => {
		const { project, diagram } = setup();
		const say = (text: string) => suggestFor(project, diagram, 'Account', 'attribute', text);
		expect(say('owner: String')).toBeNull();
		expect(say('owners: List<Client>')).toBeNull();
		expect(say('owner')).toBeNull();
		expect(say('owner: (')).toBeNull();
		expect(suggestFor(project, diagram, 'Account', 'literal', 'Client')).toBeNull();
	});

	it('offers an association to a class on the diagram that has none with this one yet', () => {
		const { project, diagram } = setup();
		const say = () => suggestFor(project, diagram, 'Account', 'attribute', 'owner: Customer');
		expect(say()).toEqual({ kind: 'link', targetId: 'Customer', name: 'Customer' });
		const r = createRelationship({
			id: 'r',
			relationshipKind: 'aggregation',
			sourceId: 'Customer',
			targetId: 'Account'
		});
		project.elements.set(r.id, r);
		diagram.elementIds.push(r.id);
		diagram.layout.set(r.id, defaultEdgeLayout());
		expect(say()).toBeNull();
	});

	it('offers no link to itself, or to a class this diagram does not show', () => {
		const { project, diagram } = setup();
		expect(suggestFor(project, diagram, 'Account', 'attribute', 'next: Account')).toBeNull();
		const off = createClassifier({ id: 'Off', name: 'Offstage' });
		project.elements.set(off.id, off);
		expect(suggestFor(project, diagram, 'Account', 'attribute', 'x: Offstage')).toBeNull();
	});

	it('offers the missing closer when adding it makes the line parse (keyboard.md ⌥↩)', () => {
		const { project, diagram } = setup();
		expect(suggestFor(project, diagram, 'Account', 'operation', '+ find(id: int')).toEqual({
			kind: 'fix',
			text: '+ find(id: int)',
			closer: ')'
		});
		expect(suggestFor(project, diagram, 'Account', 'attribute', 'x: Customer [')).toBeNull();
	});
});

describe('the parse chip says why a line is kept as text (ruling #25)', () => {
	it('adds the reason after "kept as text"', () => {
		expect(summarise('operation', '+ find(id: int')).toEqual({
			ok: false,
			parts: ['Not parsed; kept as text', 'Missing )']
		});
		expect(summarise('attribute', 'x: int {final}').parts[1]).toBe('Unknown property {final}');
	});
});
