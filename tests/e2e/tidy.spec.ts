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
	await fromPalette(page, 'Auto-layout: orthogonal, top to bottom');
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
