import { describe, expect, it } from 'vitest';
import { batch, Stack } from '#lib/commands/index.ts';
import { hydrate } from '#lib/commands/registry.ts';
import { resizeView } from '#lib/canvas/resize.ts';
import { sampleProject } from '#lib/model/fixtures.ts';
import { createInstance, createPackage, getDiagram, getNodeLayout } from '#lib/model/project.ts';

/** keyboard.md § Mouse: classes, notes, objects and packages resize; one undo step each. */
function setup() {
	const project = sampleProject();
	const d = getDiagram(project, 'd1');
	const account = [...project.elements.values()].find((e) => e.kind === 'classifier')!.id;
	const pkg = createPackage({ name: 'shop' });
	const obj = createInstance({ name: 'acc' });
	for (const el of [pkg, obj]) {
		project.elements.set(el.id, el);
		d.elementIds.push(el.id);
		d.layout.set(el.id, { kind: 'node', x: 0, y: 400, w: 240, h: 160 });
	}
	const stack = new Stack(() => project);
	const run = (id: string, w: number, h: number) =>
		stack.run(
			batch(project, { label: 'Resize', commands: resizeView(project, 'd1', id, { w, h }) })
		);
	return { project, d, account, pkg: pkg.id, obj: obj.id, stack, run };
}

describe('resizeView', () => {
	it('sizes a class and turns its autoResize off, so the height holds; undo puts both back', () => {
		const { d, account, stack, run } = setup();
		run(account, 300, 260);
		expect(getNodeLayout(d, account)).toMatchObject({
			w: 300,
			h: 260,
			flags: { autoResize: false }
		});
		stack.undo();
		const l = getNodeLayout(d, account);
		expect([l.w, l.h, l.flags?.autoResize]).toEqual([160, 80, undefined]);
	});

	it('leaves the flag alone when the class already keeps its size', () => {
		const { project, d, account } = setup();
		getNodeLayout(d, account).flags = { autoResize: false };
		const commands = resizeView(project, 'd1', account, { w: 200, h: 90 });
		expect(commands.map((c) => hydrate(project, c).label)).toHaveLength(1);
	});

	it('an object keeps its height the same way', () => {
		const { d, obj, run } = setup();
		run(obj, 180, 120);
		expect(getNodeLayout(d, obj)).toMatchObject({ w: 180, h: 120, flags: { autoResize: false } });
	});

	it('clamps to the least size of each kind, and a package needs no flag', () => {
		const { project, d, account, pkg, run } = setup();
		run(account, 40, 10);
		expect(getNodeLayout(d, account)).toMatchObject({ w: 160 });
		expect(resizeView(project, 'd1', pkg, { w: 400, h: 300 })).toHaveLength(1);
		run(pkg, 400, 300);
		run(pkg, 10, 10);
		expect(getNodeLayout(d, pkg)).toMatchObject({ w: 240, h: 160 });
		expect(getNodeLayout(d, pkg).flags).toBeUndefined();
	});

	it('a width alone leaves the height following the content', () => {
		const { project, d, account, stack } = setup();
		const commands = resizeView(project, 'd1', account, { w: 260 });
		stack.run(batch(project, { label: 'Resize', commands }));
		expect(getNodeLayout(d, account)).toMatchObject({ w: 260, h: 80 });
		expect(getNodeLayout(d, account).flags).toBeUndefined();
	});

	it('returns nothing when the size is unchanged', () => {
		const { project, account } = setup();
		expect(resizeView(project, 'd1', account, { w: 160, h: 80 })).toEqual([]);
	});
});
