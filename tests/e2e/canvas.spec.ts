import { expect, test, type Locator, type Page } from '@playwright/test';

const node = (page: Page, name: string) => page.locator(`.class-node[data-name="${name}"]`);

async function position(n: Locator) {
	const transform = await n.evaluate(
		(el) => (el.closest('.svelte-flow__node') as HTMLElement).style.transform
	);
	const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(transform)!;
	return { x: Number(m[1]), y: Number(m[2]) };
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1, name: 'Library' })).toBeVisible();
	await expect(node(page, 'Account')).toBeVisible();
});

test('class node: 10 + 10 members without clipping, abstract italic, static underlined', async ({
	page
}) => {
	const account = node(page, 'Account');
	await expect(account.locator('[data-compartment="attributes"] li')).toHaveCount(10);
	await expect(account.locator('[data-compartment="operations"] li')).toHaveCount(10);
	await expect(account.locator('.stereotype')).toHaveText('«entity»');

	const clipped = await account.evaluate((el) =>
		[el, ...el.querySelectorAll('ul')].some(
			(e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1
		)
	);
	expect(clipped).toBe(false);
	const box = (await account.boundingBox())!;
	expect(box.width).toBeGreaterThanOrEqual(160);
	// name row 40 (stereotype) + 2 compartments of 10 × 20 + 2 × 12 padding + borders
	expect(box.height).toBeGreaterThanOrEqual(40 + 2 * (200 + 12));

	await expect(account.locator('.name')).toHaveCSS('font-style', 'italic');
	await expect(node(page, 'Customer').locator('.name')).toHaveCSS('font-style', 'normal');
	await expect(account.locator('[data-compartment="attributes"] li').first()).toHaveCSS(
		'text-decoration-line',
		'underline'
	);
	await expect(account.locator('[data-compartment="attributes"] li').nth(1)).toHaveCSS(
		'text-decoration-line',
		'none'
	);
});

test('keyboard only: create, name, nudge, delete from diagram and model, undo, redo', async ({
	page
}) => {
	const canvas = page.getByRole('application', { name: 'Diagram canvas' });
	await expect(canvas).toBeFocused();

	await page.mouse.move(600, 400);
	await page.keyboard.press('c');
	const input = page.getByRole('textbox', { name: 'Class name' });
	await expect(input).toBeFocused();
	await expect(input).toHaveValue('Class1');
	await page.keyboard.type('Book');
	await page.keyboard.press('Enter');
	const book = node(page, 'Book');
	await expect(book).toBeVisible();
	await expect(input).toHaveCount(0);
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
	await expect(await position(book)).toEqual({ x: start.x + 2, y: start.y + 8 });
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
	await expect(page.getByRole('button', { name: 'Undo: delete Book' })).toBeVisible();
	await page.getByRole('button', { name: 'Undo: delete Book' }).click();
	await expect(book).toBeVisible();
});

test('typing in a panel never spawns classes; the toolbox Class tool creates on click', async ({
	page
}) => {
	await page.getByRole('button', { name: 'Zoom in' }).focus();
	await page.keyboard.press('c');
	await expect(page.locator('.class-node')).toHaveCount(2);

	await page.getByRole('radio', { name: 'Class (C)' }).click();
	await page.mouse.click(700, 500);
	await expect(page.locator('.class-node')).toHaveCount(3);
	await expect(page.getByRole('textbox', { name: 'Class name' })).toBeFocused();
});
