import { expect, test } from '@playwright/test';
import { canvasOf, create, node, position } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/design/sample');
	await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
	await expect(node(page, 'Account')).toBeVisible();
});

test('class node: 10 + 10 members without clipping, abstract italic, static underlined', async ({
	page
}) => {
	const account = node(page, 'Account');
	await expect(account.locator('[data-compartment="attribute"] li')).toHaveCount(10);
	await expect(account.locator('[data-compartment="operation"] li')).toHaveCount(10);
	await expect(account.locator('.stereotype')).toHaveText('«entity»');

	// Content only: the connection handles sit outside the node on purpose.
	const clipped = await account.evaluate((el) => {
		const box = el.getBoundingClientRect();
		return [...el.querySelectorAll('.name-row, ul, li')].some((e) => {
			const r = e.getBoundingClientRect();
			return (
				e.scrollWidth > e.clientWidth + 1 ||
				e.scrollHeight > e.clientHeight + 1 ||
				r.right > box.right + 0.5 ||
				r.bottom > box.bottom + 0.5
			);
		});
	});
	expect(clipped).toBe(false);
	const box = (await account.boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(160);
	expect(box.height).toBeGreaterThanOrEqual(40 + 2 * (200 + 12));

	await expect(account.locator('.name')).toHaveCSS('font-style', 'italic');
	await expect(node(page, 'Customer').locator('.name')).toHaveCSS('font-style', 'normal');
	await expect(account.locator('[data-compartment="attribute"] li').first()).toHaveCSS(
		'text-decoration-line',
		'underline'
	);
	await expect(account.locator('[data-compartment="attribute"] li').nth(1)).toHaveCSS(
		'text-decoration-line',
		'none'
	);
});

test('keyboard only: create, name, nudge, delete from diagram and model, undo, redo', async ({
	page
}) => {
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();

	await page.mouse.move(600, 400);
	await page.keyboard.press('c');
	const input = canvas.getByRole('textbox', { name: 'Name' });
	await expect(input).toBeFocused();
	await expect(input).toHaveValue('Class1');
	await page.keyboard.type('Book');
	await page.keyboard.press('Enter');
	const book = node(page, 'Book');
	await expect(book).toBeVisible();
	await expect(input).toHaveCount(0);
	// ↩ on the name opens a new attribute line; Esc ends editing and focus returns to the canvas.
	await expect(canvas.getByRole('combobox', { name: 'Attribute line' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(book).toBeFocused(); // roving focus: the element, inside the canvas
	await expect(book).toHaveClass(/selected/);

	const start = await position(book);
	await page.keyboard.press('ControlOrMeta+ArrowRight');
	await page.keyboard.press('ControlOrMeta+ArrowRight');
	await page.keyboard.press('ControlOrMeta+Shift+ArrowDown');
	await expect.poll(() => position(book)).toEqual({ x: start.x + 2, y: start.y + 8 });

	await page.keyboard.press('Backspace');
	await expect(book).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(book).toBeVisible();
	expect(await position(book)).toEqual({ x: start.x + 2, y: start.y + 8 });
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(book).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+y');
	await expect(book).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(book).toBeVisible();

	// Enter from the canvas reopens the editor; Esc keeps what was typed and ⌘Z takes it back.
	await page.keyboard.press('Enter');
	await expect(input).toBeFocused();
	await page.keyboard.type('Nope');
	await page.keyboard.press('Escape');
	await expect(node(page, 'Nope')).toBeVisible();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(book).toBeVisible();
	await expect(book).toBeFocused();

	await page.keyboard.press('ControlOrMeta+Backspace');
	await expect(book).toHaveCount(0);
	await page.getByRole('button', { name: 'Undo: delete Book' }).click();
	await expect(book).toBeVisible();
});

test('typing in a panel never spawns classes; the toolbox Class tool creates on click', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Zoom in' }).focus();
	await page.keyboard.press('c');
	await expect(page.locator('.classifier-node')).toHaveCount(2);

	await page.getByRole('radio', { name: 'Class (C)' }).click();
	await page.mouse.click(700, 500);
	await expect(page.locator('.classifier-node')).toHaveCount(3);
	await expect(canvasOf(page).getByRole('textbox', { name: 'Name' })).toBeFocused();
});

test('new classes land in free space, never on top of each other', async ({ page }) => {
	await page.mouse.move(600, 400);
	await create(page, 'c', 'One');
	await page.keyboard.press('Escape');
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Two');
	await page.keyboard.press('Escape');
	const a = (await node(page, 'One').boundingBox())!;
	const b = (await node(page, 'Two').boundingBox())!;
	const apart =
		a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
	expect(apart).toBe(true);
	expect(Math.abs(b.x - a.x) + Math.abs(b.y - a.y)).toBeLessThan(400); // near, not flung away
});

/** UX audit 2026-10-23: the inspector sliding in must not throw the diagram across the screen. */
test('a class under the inspector is panned into view by the least distance, not centred', async ({
	page
}) => {
	await page.goto('/design/new');
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();
	const box = (await canvas.boundingBox())!;
	await page.mouse.move(box.x + 360, box.y + 200);
	await create(page, 'c', 'Wallet');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	// The inspector folds away with the selection; wait for the paper to be whole again.
	await expect.poll(async () => (await canvas.boundingBox())!.width).toBe(box.width);
	const before = (await node(page, 'Wallet').boundingBox())!;

	// Near the right edge: the inspector that opens with the new class covers it.
	await page.mouse.click(box.x + box.width - 180, box.y + 420);
	await create(page, 'c', 'Coin');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');
	await expect(node(page, 'Coin')).toBeVisible();
	// Any pan animates: wait until the view stops moving.
	let last = '';
	await expect
		.poll(
			async () => {
				const now = await page.locator('.svelte-flow__viewport').getAttribute('style');
				const still = now === last;
				last = now ?? '';
				return still;
			},
			{ intervals: [150] }
		)
		.toBe(true);
	// Centring it shoved Wallet under the toolbox; the least pan leaves it in view.
	const after = (await node(page, 'Wallet').boundingBox())!;
	const tools = (await page.getByRole('toolbar', { name: 'Toolbox' }).boundingBox())!;
	expect(after.x).toBeGreaterThan(tools.x + tools.width);
	expect(Math.abs(after.y - before.y)).toBeLessThan(1);
});

test('a diagram opens fitted beside the toolbox and under the strip, not beneath them', async ({
	page
}) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto('/design/demo');
	const frame = page.locator('.svelte-flow__node').filter({ hasText: 'model' }).first();
	await expect(frame).toBeVisible();
	const tools = (await page.getByRole('toolbar', { name: 'Toolbox' }).boundingBox())!;
	expect((await frame.boundingBox())!.x).toBeGreaterThan(tools.x + tools.width);

	// ⌘9 fits the same way.
	await page.keyboard.press('ControlOrMeta+=');
	await page.keyboard.press('ControlOrMeta+9');
	await expect
		.poll(async () => (await frame.boundingBox())!.x - (tools.x + tools.width))
		.toBeGreaterThan(0);
});
