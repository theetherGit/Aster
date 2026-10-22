/**
 * Packages with containment (features.md M3.1): "Nested packages; moving a package moves members;
 * `::` qualified names; `.mdj` ownedElements nesting" — "A class inside two levels of package
 * round-trips".
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	Stack,
	addClassifier,
	addDiagram,
	addPackage,
	deleteFromModel,
	moveToPackage
} from '#lib/commands/index.ts';
import { parseMdjText } from '#lib/mdj/parse.ts';
import { serializeMdj } from '#lib/mdj/serialize.ts';
import {
	createClassifier,
	createPackage,
	createProject,
	descendantsOf,
	namespaceOf,
	qualifiedName
} from '#lib/model/project.ts';
import type { Classifier, Element, Package, Project } from '#lib/model/types.ts';
import { jsonDiff, structural } from './helpers.ts';

type J = Record<string, unknown>;
const pkg = (p: Project, id: string) => p.elements.get(id) as Package;
const cls = (p: Project, id: string) => p.elements.get(id) as Classifier;

/** com ⊃ company ⊃ Account, all on one diagram. */
function setup() {
	const project = createProject({ id: 'p', name: 'Bank' });
	const stack = new Stack(() => project);
	stack.run(addDiagram(project, { diagramId: 'd', name: 'Main' }));
	const at = { x: 0, y: 0 };
	stack.run(
		addPackage(project, { diagramId: 'd', pkg: createPackage({ id: 'com', name: 'com' }), at })
	);
	stack.run(
		addPackage(project, {
			diagramId: 'd',
			pkg: createPackage({ id: 'company', name: 'company', parentId: 'com' }),
			at
		})
	);
	const account = createClassifier({ id: 'Account', name: 'Account', packageId: 'company' });
	stack.run(addClassifier(project, { diagramId: 'd', classifier: account, at: { x: 40, y: 60 } }));
	return { project, stack, d: project.diagrams[0] };
}

describe('package commands', () => {
	it('nests, names with ::, and keeps memberIds in step', () => {
		const { project, d } = setup();
		expect(pkg(project, 'com').memberIds).toEqual(['company']);
		expect(pkg(project, 'company').memberIds).toEqual(['Account']);
		expect(qualifiedName(project, cls(project, 'Account'))).toBe('com::company::Account');
		expect(namespaceOf(project, cls(project, 'Account'))).toBe('com::company');
		expect(descendantsOf(project, 'com')).toEqual(['company', 'Account']);
		// Packages go to the back, so they never cover what they hold.
		expect(d.elementIds).toEqual(['company', 'com', 'Account']);
	});

	it('moves an element between packages and back with undo', () => {
		const { project, stack } = setup();
		const before = structural(project);
		stack.run(moveToPackage(project, { moves: [{ id: 'Account', to: 'com' }] }));
		expect(cls(project, 'Account').packageId).toBe('com');
		expect(pkg(project, 'com').memberIds).toEqual(['company', 'Account']);
		expect(pkg(project, 'company').memberIds).toEqual([]);
		stack.run(moveToPackage(project, { moves: [{ id: 'Account', to: null }] }));
		expect(cls(project, 'Account').packageId).toBeUndefined();
		stack.undo();
		stack.undo();
		expect(structural(project)).toEqual(before);
	});

	it('refuses to put a package inside itself or inside what it holds', () => {
		const { project } = setup();
		const into = (to: string) => () =>
			moveToPackage(project, { moves: [{ id: 'com', to }] }).apply(project);
		expect(into('com')).toThrow(/itself/);
		expect(into('company')).toThrow(/itself/);
	});

	it('deletes a package with everything in it, and undo puts it all back', () => {
		const { project, stack } = setup();
		const before = structural(project);
		stack.run(deleteFromModel(project, { ids: ['com'] }));
		expect(project.elements.size).toBe(0);
		stack.undo();
		expect(structural(project)).toEqual(before);
	});
});

describe('packages in .mdj', () => {
	const ownedPath = (json: unknown, id: string): string[] => {
		const walk = (o: unknown, path: string[]): string[] | null => {
			if (Array.isArray(o)) {
				for (const x of o) {
					const r = walk(x, path);
					if (r) return r;
				}
				return null;
			}
			if (!o || typeof o !== 'object') return null;
			const j = o as J;
			if (j._id === id) return path;
			const next = j._type === 'UMLPackage' ? [...path, j.name as string] : path;
			return walk(j.ownedElements, next);
		};
		return walk(json, []) ?? [];
	};

	it('writes a class two packages deep under both, and reads it back there', () => {
		const { project } = setup();
		const out = serializeMdj(project);
		expect(ownedPath(out, 'Account')).toEqual(['com', 'company']);
		const back = parseMdjText(JSON.stringify(out)).project;
		expect(qualifiedName(back, back.elements.get('Account') as Element)).toBe(
			'com::company::Account'
		);
		// Drawn inside their packages: containerView, and the package views' containedViews.
		const views = (out.ownedElements as J[])
			.flatMap((m) => (m.ownedElements as J[]) ?? [])
			.filter((e) => e._type === 'UMLClassDiagram')
			.flatMap((dg) => dg.ownedViews as J[]);
		const viewOf = (id: string) => views.find((v) => (v.model as J)?.$ref === id)!;
		expect(viewOf('Account').containerView).toEqual({ $ref: viewOf('company')._id });
		expect(viewOf('company').containedViews).toEqual([{ $ref: viewOf('Account')._id }]);
	});

	it('the StarUML fixture with classes three packages deep round-trips, and a move changes only the move', () => {
		const text = readFileSync(
			new URL('../../fixtures/mdj/public-staruml-codegen.mdj', import.meta.url),
			'utf8'
		);
		const json = JSON.parse(text);
		const { project } = parseMdjText(text);
		const id = 'AAAAAAFF8IY3RWzik2A='; // com::company::package1::Class1
		expect(qualifiedName(project, project.elements.get(id)!)).toBe(
			'com::company::package1::Class1'
		);
		expect(jsonDiff(json, serializeMdj(project))).toEqual([]);
		const company =
			cls(project, id).packageId && pkg(project, cls(project, id).packageId!).parentId;
		new Stack(() => project).run(moveToPackage(project, { moves: [{ id, to: company! }] }));
		const out = serializeMdj(project);
		expect(ownedPath(out, id)).toEqual(['com', 'company']);
		const diff = jsonDiff(json, out);
		// The class leaves package1's ownedElements and joins company's, with its new _parent.
		expect(diff.every((d) => /ownedElements|_parent/.test(d))).toBe(true);
	});
});
