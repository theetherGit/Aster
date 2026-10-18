import { expect, test } from '@playwright/test';
import { canvasOf, create, node, position } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/');
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
	await expect(canvas).toBeFocused();
	await expect(book).toHaveClass(/selected/);

	const start = await position(book);
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('Shift+ArrowDown');
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

	// Esc while editing keeps the old name; Enter from the canvas reopens the editor.
	await page.keyboard.press('Enter');
	await expect(input).toBeFocused();
	await page.keyboard.type('Nope');
	await page.keyboard.press('Escape');
	await expect(node(page, 'Book')).toBeVisible();
	await expect(canvas).toBeFocused();

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
