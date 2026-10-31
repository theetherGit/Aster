import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasOf, node } from './helpers';

/**
 * keyboard.md § Mouse: "Resize handles appear on packages and notes, and on classes"; every drag
 * has a keyboard path (accessibility.md): ⇧+arrows, and the inspector's Size.
 */
test.beforeEach(async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
});

async function box(n: Locator) {
	return (await n.boundingBox())!;
}
/** Drag a node's corner handle by (dx, dy) screen pixels. */
async function dragCorner(page: Page, n: Locator, dx: number, dy: number) {
	await n.hover();
	const h = await box(n.locator('.resize'));
	const x = h.x + h.width / 2;
	const y = h.y + h.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y + dy, { steps: 8 });
	await page.mouse.up();
}
const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(3);

test('a class resizes from its corner, keeps the height, and ⌘Z takes it back', async ({
	page
}) => {
	const customer = node(page, 'Customer');
	await customer.click();
	const before = await box(customer);
	await dragCorner(page, customer, 80, 60);
	await expect.poll(async () => (await box(customer)).width).toBeGreaterThan(before.width + 70);
	const after = await box(customer);
	near(after.width, before.width + 80);
	near(after.height, before.height + 60);
	await page.keyboard.press('ControlOrMeta+z');
	await expect
		.poll(async () => Math.round((await box(customer)).width))
		.toBe(Math.round(before.width));
	near((await box(customer)).height, before.height);
});

test('⇧+arrows resize the selected class', async ({ page }) => {
	const customer = node(page, 'Customer');
	await customer.click();
	const before = await box(customer);
	const zoom = before.width / (await customer.evaluate((el) => (el as HTMLElement).offsetWidth));
	await page.keyboard.press('Shift+ArrowRight');
	await page.keyboard.press('Shift+ArrowDown');
	await expect.poll(async () => (await box(customer)).width).toBeGreaterThan(before.width);
	near((await box(customer)).width, before.width + 8 * zoom);
	near((await box(customer)).height, before.height + 8 * zoom);
});

test('the inspector sizes a class', async ({ page }) => {
	const customer = node(page, 'Customer');
	await customer.click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	const width = inspector.getByRole('spinbutton', { name: 'Width' });
	await width.fill('320');
	await width.press('Enter');
	await expect.poll(() => customer.evaluate((el) => (el as HTMLElement).offsetWidth)).toBe(320);
});

test('a note resizes from its corner', async ({ page }) => {
	await page.mouse.move(700, 520);
	await page.keyboard.press('n');
	await expect(canvasOf(page).getByRole('textbox', { name: 'Note text' })).toBeFocused();
	await page.keyboard.type('Due in 14 days');
	await page.keyboard.press('Escape');
	const note = page.locator('.note-node[data-kind="note"]');
	await note.click();
	const before = await box(note);
	await dragCorner(page, note, 60, 40);
	await expect.poll(async () => (await box(note)).width).toBeGreaterThan(before.width + 50);
	near((await box(note)).height, before.height + 40);
});
