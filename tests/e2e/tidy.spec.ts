import { expect, test, type Page } from '@playwright/test';
import { canvasOf, fromPalette, node, position } from './helpers';

/**
 * features.md M3, "Auto-layout and tidy" (M3.3 prompt): ELK layouts and the tidy tools from the
 * palette (so from the keyboard), each one undo step; grid and snap on StarUML's ⌘G / ⌘⇧G.
 */
const positions = (page: Page) =>
	page.locator('.classifier-node').evaluateAll((els) =>
		els.map((el) => {
			const t = (el.closest('.svelte-flow__node') as HTMLElement).style.transform;
			return `${el.getAttribute('data-name')} ${t}`;
		})
	);

test('align top moves the selection to one line, one undo step', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await node(page, 'Account').click();
	await node(page, 'Customer').click({ modifiers: ['Shift'] });
	const before = await position(node(page, 'Customer'));
	await fromPalette(page, 'Align top');
	await expect
		.poll(async () => (await position(node(page, 'Customer'))).y)
		.toBe((await position(node(page, 'Account'))).y);
	await expect(page.getByTestId('live')).toHaveText('Align 2 elements');
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => position(node(page, 'Customer'))).toEqual(before);
});

test('auto-layout lays the diagram out without overlaps, and one undo puts it back', async ({
	page
}) => {
	await page.goto('/design/notation');
	await expect(canvasOf(page)).toBeFocused();
	const before = await positions(page);
	await fromPalette(page, 'Auto-layout: Orthogonal, top to bottom');
	await expect.poll(() => positions(page)).not.toEqual(before);
	const boxes = await page
		.locator('.classifier-node')
		.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
	for (let i = 0; i < boxes.length; i++)
		for (let j = i + 1; j < boxes.length; j++) {
			const [a, b] = [boxes[i], boxes[j]];
			const apart =
				a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
			expect(apart, `${i} and ${j} overlap`).toBe(true);
		}
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => positions(page)).toEqual(before);
});

test('⌘G hides and shows the grid, ⌘⇧G snaps a drag to it; both remembered', async ({ page }) => {
	await page.goto('/design/sample');
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();
	const stored = (key: string) => page.evaluate((k) => localStorage.getItem(k), key);
	await page.keyboard.press('ControlOrMeta+g');
	await expect.poll(() => stored('aster:grid')).toBe('0');
	await page.keyboard.press('ControlOrMeta+g');
	await expect.poll(() => stored('aster:grid')).toBe('1');

	await page.keyboard.press('ControlOrMeta+Shift+g');
	await expect.poll(() => stored('aster:snap')).toBe('1');
	const customer = node(page, 'Customer');
	const box = (await customer.locator('.name').boundingBox())!;
	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await page.mouse.move(box.x + box.width / 2 + 37, box.y + box.height / 2 + 13, { steps: 5 });
	await page.mouse.up();
	const at = await position(customer);
	expect(at.x % 20).toBe(0);
	expect(at.y % 20).toBe(0);
	expect(at).not.toEqual({ x: 480, y: 120 });
});

/** Owner's review, 2026-10-21: the layout and tidy tools live in right-click and Format submenus. */
test('right-click on a selection keeps it and aligns through the Align submenu', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await node(page, 'Account').click();
	await node(page, 'Customer').click({ modifiers: ['Shift'] });
	await node(page, 'Customer').locator('.name').click({ button: 'right' });
	const menu = page.getByRole('menu', { name: 'Element commands' });
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', { name: 'Align' }).hover();
	await page.getByRole('menuitem', { name: 'Top', exact: true }).click();
	await expect
		.poll(async () => (await position(node(page, 'Customer'))).y)
		.toBe((await position(node(page, 'Account'))).y);
});

test('empty paper offers auto-layout, which frames the result and offers undo', async ({
	page
}) => {
	await page.goto('/design/notation');
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();
	const before = await positions(page);
	// The paper's menu, from the keyboard: ⇧F10 with no element focused.
	await page.keyboard.press('Shift+F10');
	const menu = page.getByRole('menu', { name: 'Diagram commands' });
	await expect(menu).toBeVisible();
	await expect(menu.getByRole('menuitemcheckbox', { name: /Show grid/ })).toBeVisible();
	await menu.getByRole('menuitem', { name: 'Auto-layout (Orthogonal, top to bottom)' }).click();
	await expect(page.getByTestId('toast')).toContainText('Laid out Library.');
	await expect.poll(() => positions(page)).not.toEqual(before);
	// Framed: every class ends inside the canvas once the view has fitted.
	await expect
		.poll(async () => {
			const frame = (await canvas.boundingBox())!;
			const boxes = await page
				.locator('.classifier-node')
				.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
			return boxes.every(
				(b) =>
					b.left >= frame.x - 1 &&
					b.top >= frame.y - 1 &&
					b.right <= frame.x + frame.width + 1 &&
					b.bottom <= frame.y + frame.height + 1
			);
		})
		.toBe(true);
	await page.getByTestId('toast').getByRole('button', { name: /^Undo/ }).click();
	await expect.poll(() => positions(page)).toEqual(before);
});

test('Classic Format menu nests the tools: Layout, Align, Distribute, Same size, Order', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('aster:layout', 'classic'));
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.getByRole('menuitem', { name: 'Format' }).click();
	for (const name of ['Layout', 'Align', 'Distribute', 'Same size', 'Order'])
		await expect(page.getByRole('menuitem', { name, exact: true })).toBeVisible();
	await expect(page.getByRole('menuitem', { name: 'Align left' })).toHaveCount(0);
	await page.getByRole('menuitem', { name: 'Layout', exact: true }).hover();
	await expect(page.getByRole('menuitem', { name: 'Layered, left to right' })).toBeVisible();
});
