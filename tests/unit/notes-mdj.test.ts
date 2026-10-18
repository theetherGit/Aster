/** Notes and note links through the codec: new ones get views, removed ones lose them. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Stack, addNote, linkNote, setElementText, unlinkNote } from '#lib/commands/index.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { serializeMdj } from '#lib/mdj/serialize.ts';
import type { Classifier } from '#lib/model/types.ts';

type J = Record<string, unknown>;
const collect = (o: unknown, type: string, out: J[] = []): J[] => {
	if (Array.isArray(o)) o.forEach((x) => collect(x, type, out));
	else if (o && typeof o === 'object') {
		const j = o as J;
		if (j._type === type) out.push(j);
		for (const [k, v] of Object.entries(j)) if (k !== '_parent') collect(v, type, out);
	}
	return out;
};

describe('notes in .mdj', () => {
	const source = readFileSync(
		new URL('../../fixtures/mdj/public-barcode-manager.mdj', import.meta.url),
		'utf8'
	);

	it('a new note with a link gets UMLNoteView and UMLNoteLinkView; unlinking drops the link view', () => {
		const { project } = parseMdjText(source);
		const before = {
			notes: collect(JSON.parse(source), 'UMLNoteView').length,
			links: collect(JSON.parse(source), 'UMLNoteLinkView').length
		};
		const d = project.diagrams.find((x) =>
			x.elementIds.some((id) => project.elements.get(id)?.kind === 'classifier')
		)!;
		const cls = d.elementIds.find((id) => project.elements.get(id)?.kind === 'classifier')!;
		const stack = new Stack(() => project);
		stack.run(
			addNote(project, {
				diagramId: d.id,
				note: { kind: 'note', id: 'n-new', text: '', linkedIds: [] },
				at: { x: 40, y: 40 }
			})
		);
		stack.run(setElementText(project, { id: 'n-new', text: 'Overdue after 14 days' }));
		stack.run(linkNote(project, { noteId: 'n-new', targetId: cls }));

		const out = serializeMdj(project);
		const notes = collect(out, 'UMLNoteView');
		const links = collect(out, 'UMLNoteLinkView');
		expect(notes.length).toBe(before.notes + 1);
		expect(links.length).toBe(before.links + 1);
		const mine = notes.find((v) => v._id === 'n-new')!;
		expect(mine.text).toBe('Overdue after 14 days');
		expect(mine.left).toBe(40);
		const link = links.find((v) => (v.head as J).$ref === 'n-new')!;
		expect(link).toBeDefined();
		expect(typeof link.points).toBe('string');

		// Parsed again, the note and its link are the model's.
		const again = parseMdjText(JSON.stringify(out)).project;
		const n = again.elements.get('n-new');
		expect(n?.kind === 'note' && n.linkedIds).toEqual([cls]);
		expect((again.elements.get(cls) as Classifier).name).toBe(
			(project.elements.get(cls) as Classifier).name
		);

		// Saved twice: the link view keeps its id.
		const out2 = serializeMdj(project);
		expect(collect(out2, 'UMLNoteLinkView').find((v) => (v.head as J).$ref === 'n-new')?._id).toBe(
			link._id
		);

		stack.run(unlinkNote(project, { noteId: 'n-new', targetId: cls }));
		expect(collect(serializeMdj(project), 'UMLNoteLinkView').length).toBe(before.links);
	});
});
