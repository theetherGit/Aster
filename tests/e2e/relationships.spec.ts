import { expect, test, type Page } from '@playwright/test';
import { canvasOf, create, edgeOf, labelsOnTheirLine, node, pointOnEdge } from './helpers';

const KINDS = [
	'association',
	'aggregation',
	'composition',
	'generalization',
	'realization',
	'dependency'
] as const;
const LABELS = [
	'Association',
	'Aggregation',
	'Composition',
	'Generalization',
	'Realization',
	'Dependency'
];
const edgeKind = (page: Page, kind: string) => page.locator(`.uml-edge[data-kind="${kind}"]`);
const linkHint = (page: Page) => page.getByRole('status').filter({ hasText: 'Choose the target' });
const picker = (page: Page) => page.getByRole('menu', { name: 'Relationship kind' });

/** Create a class at a screen point, end editing, and leave it selected with the canvas focused. */
async function classAt(page: Page, name: string, x: number, y: number) {
	await page.mouse.move(x, y);
	await create(page, 'c', name);
	await expect(canvasOf(page).getByRole('combobox', { name: 'Attribute line' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(canvasOf(page)).toBeFocused();
}

test('keyboard only: L, arrows, Enter and 1–6 create all six kinds with their UML markers', async ({
	page
}) => {
	await page.goto('/');
	await expect(canvasOf(page)).toBeFocused();
	await classAt(page, 'Hub', 560, 600);
	const spots = [
		[360, 330],
		[560, 330],
		[760, 330],
		[360, 450],
		[560, 450],
		[760, 450]
	];
	const hubTargeted = () =>
		node(page, 'Hub').evaluate((el) => el.classList.contains('link-target'));

	for (const [i, kind] of KINDS.entries()) {
		await classAt(page, `S${i + 1}`, spots[i][0], spots[i][1]);
		await page.keyboard.press('l');
		await expect(linkHint(page)).toBeVisible();
		for (let k = 0; k < 6 && !(await hubTargeted()); k++) await page.keyboard.press('ArrowDown');
		expect(await hubTargeted()).toBe(true);
		await page.keyboard.press('Enter');
		await expect(picker(page)).toBeVisible();
		await expect(picker(page).getByRole('menuitem')).toHaveCount(6);
		// The picker opens on the kind chosen last.
		if (i > 0)
			await expect(
				picker(page).getByRole('menuitem', { name: new RegExp(LABELS[i - 1]) })
			).toBeFocused();
		await page.keyboard.press(String(i + 1));
		await expect(picker(page)).toHaveCount(0);
		await expect(linkHint(page)).toHaveCount(0);
		await expect(canvasOf(page)).toBeFocused();
		await expect(edgeKind(page, kind)).toHaveCount(1);
		await expect(edgeKind(page, kind)).toHaveClass(/selected/);
	}

	const line = (kind: string) => edgeKind(page, kind).locator('.edge-line');
	const markers = async (kind: string) => ({
		start: await line(kind).getAttribute('marker-start'),
		end: await line(kind).getAttribute('marker-end'),
		dash: await line(kind).getAttribute('stroke-dasharray')
	});
	expect(await markers('association')).toEqual({ start: null, end: null, dash: null });
	expect(await markers('aggregation')).toEqual({
		start: null,
		end: 'url(#aster-m-diamond-hollow)',
		dash: null
	});
	expect(await markers('composition')).toEqual({
		start: null,
		end: 'url(#aster-m-diamond-filled)',
		dash: null
	});
	expect(await markers('generalization')).toEqual({
		start: null,
		end: 'url(#aster-m-triangle)',
		dash: null
	});
	expect(await markers('realization')).toEqual({
		start: null,
		end: 'url(#aster-m-triangle)',
		dash: '6 4'
	});
	expect(await markers('dependency')).toEqual({
		start: null,
		end: 'url(#aster-m-arrow)',
		dash: '6 4'
	});
	// Markers are defined once, in user space, so they never scale with the stroke.
	await expect(page.locator('marker[id^="aster-m-"]')).toHaveCount(4);
	for (const m of await page.locator('marker[id^="aster-m-"]').all()) {
		await expect(m).toHaveAttribute('markerUnits', 'userSpaceOnUse');
	}
	// One stroke width for all UML ink (ui.md: 1 px), from one token.
	await expect(line('association')).toHaveCSS('stroke-width', '1px');
	await expect(node(page, 'Hub')).toHaveCSS('border-top-width', '1px');
	await expect(node(page, 'Hub').locator('[data-compartment]').first()).toHaveCSS(
		'border-top-width',
		'1px'
	);

	// Undo walks back through the edges one by one.
	await page.keyboard.press('ControlOrMeta+z');
	await expect(edgeKind(page, 'dependency')).toHaveCount(0);
	await expect(edgeKind(page, 'realization')).toHaveCount(1);
});

test('Esc cancels the keyboard link at every step', async ({ page }) => {
	await page.goto('/');
	await expect(canvasOf(page)).toBeFocused();
	await classAt(page, 'Solo', 600, 420);
	await page.keyboard.press('l');
	await expect(linkHint(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(linkHint(page)).toHaveCount(0);
	await expect(page.locator('.link-target')).toHaveCount(0);

	await page.keyboard.press('l');
	await page.keyboard.press('Enter');
	await expect(picker(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(picker(page)).toHaveCount(0);
	await expect(linkHint(page)).toHaveCount(0);
	await expect(canvasOf(page)).toBeFocused();
	await expect(page.locator('.uml-edge')).toHaveCount(0);
});

test('mouse: dropping a connection on a node opens the picker at the drop point', async ({
	page
}) => {
	await page.goto('/');
	const customer = node(page, 'Customer');
	await customer.hover();
	const handle = (await customer.locator('.svelte-flow__handle-left').boundingBox())!;
	const target = (await node(page, 'Account').boundingBox())!;
	const drop = { x: target.x + target.width / 2, y: target.y + 60 };
	await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
	await page.mouse.down();
	await page.mouse.move(drop.x, drop.y, { steps: 12 });
	await page.mouse.up();
	const menu = picker(page);
	await expect(menu).toBeVisible();
	const box = (await menu.boundingBox())!;
	expect(Math.abs(box.x - drop.x)).toBeLessThan(40);
	expect(Math.abs(box.y - drop.y)).toBeLessThan(40);
	await page.keyboard.press('4');
	await expect(edgeKind(page, 'generalization')).toHaveCount(1);
	// Customer specialises Account: the triangle sits at Account.
	await expect(
		page.locator('.svelte-flow__edge').filter({ has: edgeKind(page, 'generalization') })
	).toHaveAttribute('aria-label', 'Customer to Account, generalization');
});

test.describe('on the notation fixture', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/?fixture=notation');
		await expect(page.locator('.uml-edge')).toHaveCount(8);
	});

	test('inspector edits ends, name and kind; arrows follow navigability', async ({ page }) => {
		const borrows = edgeOf(page, 'borrows');
		const p = await pointOnEdge(borrows, 0.3);
		await page.mouse.click(p.x, p.y);
		await expect(borrows).toHaveClass(/selected/);
		const inspector = page.getByRole('complementary', { name: 'Inspector' });
		await expect(inspector.getByLabel('Kind')).toHaveText('Association');
		await expect(borrows.locator('.edge-line')).not.toHaveAttribute('marker-start', /./);

		// Only the source end navigable: the arrow appears at the source.
		await inspector.locator('#target-nav').click();
		await page.getByRole('option', { name: 'no', exact: true }).click();
		await expect(borrows.locator('.edge-line')).toHaveAttribute(
			'marker-start',
			'url(#aster-m-arrow)'
		);
		await expect(borrows.locator('.edge-line')).not.toHaveAttribute('marker-end', /./);

		await inspector.getByLabel('Name', { exact: true }).fill('lends');
		await inspector.getByLabel('Name', { exact: true }).press('Enter');
		await expect(borrows.locator('[data-label="name"] text')).toHaveText('lends');

		await inspector.locator('#source-role').fill('loan');
		await inspector.locator('#source-role').press('Enter');
		await expect(borrows.locator('[data-label="sourceRole"] text')).toHaveText('loan');

		// Multiplicity preset chips.
		await inspector.getByRole('button', { name: 'Multiplicity 1..* at the Book end' }).click();
		await expect(borrows.locator('[data-label="targetMultiplicity"] text')).toHaveText('1..*');
		await expect(
			inspector.getByRole('button', { name: 'Multiplicity 1..* at the Book end' })
		).toHaveAttribute('aria-pressed', 'true');

		await inspector.getByLabel('Kind').click();
		await page.getByRole('option', { name: 'Composition' }).click();
		await expect(borrows).toHaveAttribute('data-kind', 'composition');
		await expect(borrows.locator('.edge-line')).toHaveAttribute(
			'marker-end',
			'url(#aster-m-diamond-filled)'
		);
		expect((await labelsOnTheirLine(page)).filter((l) => l.endsWith('ON LINE'))).toEqual([]);
	});

	test('line style chords, waypoint drags and their panel equivalents', async ({ page }) => {
		const gen = edgeOf(page, 'gen');
		const mid = await pointOnEdge(gen, 0.5);
		await page.mouse.click(mid.x, mid.y);
		await expect(gen).toHaveClass(/selected/);

		await page.keyboard.press('ControlOrMeta+l');
		await expect(gen).toHaveAttribute('data-line-style', 'rectilinear');
		await page.keyboard.press('ControlOrMeta+Alt+l');
		await expect(gen).toHaveAttribute('data-line-style', 'roundrect');
		await page.keyboard.press('ControlOrMeta+Alt+b');
		await expect(gen).toHaveAttribute('data-line-style', 'curve');
		await page.keyboard.press('ControlOrMeta+Shift+b');
		await expect(gen).toHaveAttribute('data-line-style', 'oblique');

		// Drag the midpoint: a waypoint appears where it was dropped.
		const handle = (await gen.locator('.edge-handle.midpoint .hit').boundingBox())!;
		await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
		await page.mouse.down();
		await page.mouse.move(handle.x + handle.width / 2 + 90, handle.y + handle.height / 2, {
			steps: 8
		});
		await page.mouse.up();
		await expect(gen).toHaveAttribute('data-waypoints', '1');
		const inspector = page.getByRole('complementary', { name: 'Inspector' });
		await expect(inspector.getByLabel('Waypoint 1 x')).toHaveValue('270');

		// Drag the waypoint onto its neighbour (the source end): it goes.
		const wp = (await gen.locator('.edge-handle.waypoint .hit').boundingBox())!;
		const start = await pointOnEdge(gen, 0);
		await page.mouse.move(wp.x + wp.width / 2, wp.y + wp.height / 2);
		await page.mouse.down();
		await page.mouse.move(start.x, start.y + 2, { steps: 8 });
		await page.mouse.up();
		await expect(gen).toHaveAttribute('data-waypoints', '0');

		// The same through the panel, no dragging.
		await inspector.getByRole('button', { name: 'Add waypoint' }).click();
		await expect(gen).toHaveAttribute('data-waypoints', '1');
		await inspector.getByLabel('Waypoint 1 x').fill('60');
		await inspector.getByLabel('Waypoint 1 x').press('Enter');
		await expect(inspector.getByLabel('Waypoint 1 x')).toHaveValue('60');
		await inspector.getByRole('button', { name: 'Remove waypoint 1' }).click();
		await expect(gen).toHaveAttribute('data-waypoints', '0');
	});

	test('labels drag, store their offset, and never land on their own line', async ({ page }) => {
		const comp = edgeOf(page, 'comp');
		const label = comp.locator('[data-label="sourceRole"]');
		const before = (await label.boundingBox())!;
		await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
		await page.mouse.down();
		await page.mouse.move(before.x + before.width / 2 - 70, before.y + before.height / 2 - 20, {
			steps: 8
		});
		await page.mouse.up();
		const after = (await label.boundingBox())!;
		expect(after.x).toBeLessThan(before.x - 40);
		// Dragged onto the line: it is pushed clear.
		const onLine = await pointOnEdge(comp, 0.5);
		const now = (await label.boundingBox())!;
		await page.mouse.move(now.x + now.width / 2, now.y + now.height / 2);
		await page.mouse.down();
		await page.mouse.move(onLine.x, onLine.y, { steps: 8 });
		await page.mouse.up();
		expect((await labelsOnTheirLine(page)).filter((l) => l.endsWith('ON LINE'))).toEqual([]);
		await page.keyboard.press('ControlOrMeta+z');
		await page.keyboard.press('ControlOrMeta+z');
		const restored = (await label.boundingBox())!;
		expect(Math.abs(restored.x - before.x)).toBeLessThan(1);

		// Panel equivalent: distance and angle fields.
		await page.mouse.click((await pointOnEdge(comp, 0.5)).x, (await pointOnEdge(comp, 0.5)).y);
		const inspector = page.getByRole('complementary', { name: 'Inspector' });
		await inspector.getByLabel('role, Book end distance').fill('60');
		await inspector.getByLabel('role, Book end distance').press('Enter');
		const far = (await label.boundingBox())!;
		expect(far.y).toBeLessThan(before.y - 20);
	});

	test('hovering an edge highlights both of its end nodes', async ({ page }) => {
		const borrows = edgeOf(page, 'borrows');
		const p = await pointOnEdge(borrows, 0.35);
		await page.mouse.move(p.x, p.y);
		await expect(borrows).toHaveClass(/hovered/);
		await expect(node(page, 'Loan')).toHaveClass(/edge-hover/);
		await expect(node(page, 'Book')).toHaveClass(/edge-hover/);
		await page.mouse.move(20, 700);
		await expect(node(page, 'Loan')).not.toHaveClass(/edge-hover/);
		await expect(borrows).not.toHaveClass(/hovered/);
	});

	test('explorer lists relationships under their source; selecting one selects the edge', async ({
		page
	}) => {
		await expect(canvasOf(page)).toBeFocused();
		await page.keyboard.press('ControlOrMeta+b');
		const tree = page.getByRole('tree', { name: 'Model tree' });
		const member = tree.getByRole('treeitem', { name: /^Member/ });
		await member.click();
		await page.keyboard.press('ArrowRight');
		await expect(member).toHaveAttribute('aria-expanded', 'true');
		await expect(tree.getByRole('treeitem', { name: /generalization to Person/ })).toBeVisible();
		await expect(tree.getByRole('treeitem', { name: /aggregation to Library/ })).toBeVisible();
		await expect(tree.getByRole('treeitem', { name: /association to Loan/ })).toBeVisible();
		await tree.getByRole('treeitem', { name: /generalization to Person/ }).click();
		await expect(edgeOf(page, 'gen')).toHaveClass(/selected/);

		// Delete from the diagram with the keyboard, then undo.
		await page.keyboard.press('ControlOrMeta+d');
		await expect(canvasOf(page)).toBeFocused();
		await page.keyboard.press('Backspace');
		await expect(edgeOf(page, 'gen')).toHaveCount(0);
		await expect(tree.getByRole('treeitem', { name: /generalization to Person/ })).toBeVisible();
		await page.keyboard.press('ControlOrMeta+z');
		await expect(edgeOf(page, 'gen')).toHaveCount(1);
		await page.keyboard.press('ControlOrMeta+e');
		await expect(tree.getByRole('treeitem', { name: /generalization to Person/ })).toBeFocused();
	});
});
