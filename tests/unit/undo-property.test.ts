import { describe, expect, it } from 'vitest';
import {
	Stack,
	addClassifier,
	addToDiagram,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	renameClassifier,
	resizeNode,
	setClassifierFlags
} from '#lib/commands/index.ts';
import type { Command } from '#lib/commands/types.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { classifiersOf, createClassifier, getDiagram } from '#lib/model/project.ts';
import type { Project, Visibility } from '#lib/model/types.ts';
import { rng, structural } from './helpers.ts';

const VIS: Visibility[] = ['public', 'protected', 'private', 'package'];

/** Picks a random valid command for the current project state. */
function randomCommand(project: Project, r: ReturnType<typeof rng>, n: number): Command {
	const d = getDiagram(project, 'd1');
	const all = classifiersOf(project).map((c) => c.id);
	const onDiagram = all.filter((id) => d.elementIds.includes(id));
	const offDiagram = all.filter((id) => !d.elementIds.includes(id));
	const roll = r.int(10);
	if (roll === 0 || all.length === 0) {
		const name = `C${n}`;
		return addClassifier(project, {
			diagramId: 'd1',
			classifier: createClassifier({ id: name, name }),
			at: { x: r.int(800), y: r.int(600) }
		});
	}
	if (roll === 1) return renameClassifier(project, { id: r.pick(all), name: `R${n}` });
	if (roll === 2)
		return setClassifierFlags(project, {
			id: r.pick(all),
			flags: {
				isAbstract: r.next() < 0.5,
				visibility: r.pick(VIS),
				stereotype: r.next() < 0.3 ? null : `s${n}`
			}
		});
	if (roll === 3 && onDiagram.length)
		return deleteFromDiagram(project, { diagramId: 'd1', ids: [r.pick(onDiagram)] });
	if (roll === 4 && offDiagram.length)
		return addToDiagram(project, {
			diagramId: 'd1',
			entries: [
				{
					id: r.pick(offDiagram),
					layout: { kind: 'node', x: r.int(800), y: r.int(600), w: 160, h: 80 }
				}
			]
		});
	if (roll === 5) return deleteFromModel(project, { ids: [r.pick(all)] });
	if (roll === 6 && onDiagram.length)
		return resizeNode(project, {
			diagramId: 'd1',
			id: r.pick(onDiagram),
			w: 160 + r.int(200),
			h: 40 + r.int(300)
		});
	if (onDiagram.length) {
		const count = 1 + r.int(Math.min(2, onDiagram.length));
		const ids = [...new Set(Array.from({ length: count }, () => r.pick(onDiagram)))];
		return moveNode(project, { diagramId: 'd1', ids, dx: r.int(41) - 20, dy: r.int(41) - 20 });
	}
	return renameClassifier(project, { id: r.pick(all), name: `R${n}` });
}

describe('undo property', () => {
	it.each(Array.from({ length: 25 }, (_, i) => i + 1))(
		'seed %i: 50 random commands then undo all restores model and layout; redo all restores the end state',
		(seed) => {
			const r = rng(seed);
			const project = sampleProject();
			let clock = 0;
			const stack = new Stack(
				() => project,
				() => clock
			);
			const start = structural(project);
			for (let n = 0; n < 50; n++) {
				stack.run(randomCommand(project, r, n));
				clock += r.int(2) ? 10 : 500; // mix of coalesced and separate steps
			}
			const end = structural(project);
			while (stack.canUndo) stack.undo();
			expect(structural(project)).toEqual(start);
			while (stack.canRedo) stack.redo();
			expect(structural(project)).toEqual(end);
			while (stack.canUndo) stack.undo();
			expect(structural(project)).toEqual(start);
		}
	);
});
