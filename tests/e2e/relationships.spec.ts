import { expect, test, type Page } from '@playwright/test';
import { canvasOf, create, node } from './helpers';

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
	await expect(line('association')).toHaveCSS('stroke-width', '1.2px');

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
