/** Notes and free text (features.md): view-only elements with their own layout; note links. */
import { t } from '#lib/i18n/index.ts';
import { getDiagram, getElement } from '#lib/model/project.ts';
import type { Id, Note, Point, TextElement } from '#lib/model/types.ts';
import { deleteFromModel } from './elements.ts';
import { define, type Factory } from './registry.ts';
import type { Command } from './types.ts';

export const addNote: Factory<{ diagramId: Id; note: Note; at: Point }> = define(
	'addNote',
	(project, { diagramId, note, at }) => ({
		label: t('cmd.addNote'),
		touches: [note.id],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			p.elements.set(note.id, structuredClone(note));
			d.elementIds.push(note.id);
			d.layout.set(note.id, { kind: 'node', x: at.x, y: at.y, w: 160, h: 60 });
			return deleteFromModel(p, { ids: [note.id] });
		}
	})
);

export const addText: Factory<{ diagramId: Id; text: TextElement; at: Point }> = define(
	'addText',
	(project, { diagramId, text, at }) => ({
		label: t('cmd.addText'),
		touches: [text.id],
		apply(p): Command {
			const d = getDiagram(p, diagramId);
			p.elements.set(text.id, structuredClone(text));
			d.elementIds.push(text.id);
			d.layout.set(text.id, { kind: 'node', x: at.x, y: at.y, w: 120, h: 24 });
			return deleteFromModel(p, { ids: [text.id] });
		}
	})
);

/** The text of a note or text element. */
export const setElementText: Factory<{ id: Id; text: string }> = define(
	'setElementText',
	(project, { id, text }) => ({
		label: t('cmd.setElementText'),
		touches: [id],
		apply(p): Command {
			const el = getElement(p, id);
			if (el.kind !== 'note' && el.kind !== 'text') throw new Error(`${id} has no text`);
			const previous = el.text;
			el.text = text;
			return setElementText(p, { id, text: previous });
		}
	})
);

const note = (p: Parameters<typeof getElement>[0], id: Id): Note => {
	const el = getElement(p, id);
	if (el.kind !== 'note') throw new Error(`${id} is not a note`);
	return el;
};

export const linkNote: Factory<{ noteId: Id; targetId: Id }> = define(
	'linkNote',
	(project, { noteId, targetId }) => ({
		label: t('cmd.linkNote'),
		touches: [noteId, targetId],
		apply(p): Command {
			const n = note(p, noteId);
			if (!n.linkedIds.includes(targetId)) n.linkedIds.push(targetId);
			return unlinkNote(p, { noteId, targetId });
		}
	})
);

export const unlinkNote: Factory<{ noteId: Id; targetId: Id }> = define(
	'unlinkNote',
	(project, { noteId, targetId }) => ({
		label: t('cmd.unlinkNote'),
		touches: [noteId, targetId],
		apply(p): Command {
			const n = note(p, noteId);
			n.linkedIds = n.linkedIds.filter((x) => x !== targetId);
			return linkNote(p, { noteId, targetId });
		}
	})
);
