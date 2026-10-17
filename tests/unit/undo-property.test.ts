import { describe, expect, it } from 'vitest';
import {
	Stack,
	addClassifier,
	addMember,
	addToDiagram,
	deleteMember,
	reorderMember,
	setClassifierKind,
	setLiterals,
	setMemberText,
	deleteFromDiagram,
	deleteFromModel,
	moveNode,
	renameClassifier,
	resizeNode,
	setClassifierFlags
} from '#lib/commands/index.ts';
import type { Command } from '#lib/commands/types.ts';
import { memberFromText, type MemberKind } from '#lib/mdj/expression.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { classifiersOf, createClassifier, getClassifier, getDiagram } from '#lib/model/project.ts';
import type { Project, Visibility } from '#lib/model/types.ts';
import { rng, structural } from './helpers.ts';

const VIS: Visibility[] = ['public', 'protected', 'private', 'package'];
const KINDS: MemberKind[] = ['attribute', 'operation', 'literal'];
const LINES: Record<MemberKind, string[]> = {
	attribute: [
		'-x: int',
		'+{static} MAX: int = 5',
		'<<key>> #id: UUID {readOnly}',
		'broken[0..',
		'plain'
	],
	operation: [
		'+go()',
		'-f(a: int, b: String = "x"): void {query}',
		'+{abstract} area(): double',
		'broken(',
		'+h(out e: E)'
	],
	literal: ['ACTIVE', '<<default>> IDLE', 'not valid!']
};

/** Picks a random valid command for the current project state. */
function randomCommand(project: Project, r: ReturnType<typeof rng>, n: number): Command {
	const d = getDiagram(project, 'd1');
	const all = classifiersOf(project).map((c) => c.id);
	const onDiagram = all.filter((id) => d.elementIds.includes(id));
	const offDiagram = all.filter((id) => !d.elementIds.includes(id));
	const roll = r.int(16);
	if (roll >= 10 && all.length) {
		const id = r.pick(all);
		const kind = r.pick(KINDS);
		const list =
			kind === 'attribute'
				? getClassifier(project, id).attributes
				: kind === 'operation'
					? getClassifier(project, id).operations
					: getClassifier(project, id).literals;
		if (roll === 10 || list.length === 0)
			return addMember(project, {
				classifierId: id,
				kind,
				member: memberFromText(kind, r.pick(LINES[kind]), `m${n}`),
				index: r.int(list.length + 1)
			});
		const memberId = r.pick(list).id;
		if (roll === 11)
			return setMemberText(project, {
				classifierId: id,
				kind,
				memberId,
				text: r.pick(LINES[kind])
			});
		if (roll === 12)
			return reorderMember(project, {
				classifierId: id,
				kind,
				memberId,
				to: r.int(list.length + 1)
			});
		if (roll === 13) return deleteMember(project, { classifierId: id, kind, memberId });
		if (roll === 14)
			return setClassifierKind(project, {
				id,
				classifierKind: r.pick(['class', 'interface', 'enum', 'dataType'] as const)
			});
		return setLiterals(project, {
			id,
			literals: Array.from({ length: r.int(3) }, (_, i) => ({
				id: `l${n}-${i}`,
				name: `L${i}`,
				documentation: ''
			}))
		});
	}
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
