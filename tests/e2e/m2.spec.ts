import { expect, test } from '@playwright/test';
import { canvasOf, create, node } from './helpers';

/** features.md M2 rows: Pin a tool, Live announcements, High-contrast theme. */
test('pin a tool: three clicks after a pinned Class make three classes; Esc returns to Select', async ({
	page
}) => {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	const classTool = page.getByRole('radio', { name: /^Class/ });
	await classTool.dblclick();
	await expect(page.getByRole('radio', { name: 'Class (C), pinned' })).toHaveAttribute(
		'data-pinned'
	);
	for (const [x, y] of [
		[300, 200],
		[600, 200],
		[900, 200]
	]) {
		await page.mouse.click(x, y);
		await page.keyboard.press('Escape'); // closes the name editor; the tool stays pinned
	}
	await expect(page.locator('.classifier-node')).toHaveCount(3);
	await expect(page.getByRole('radio', { name: 'Class (C), pinned' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await canvasOf(page).focus();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('radio', { name: 'Select' })).toHaveAttribute('aria-checked', 'true');
	await expect(page.getByRole('radio', { name: 'Class (C), pinned' })).toHaveCount(0);
	// Not pinned: a single click places one and returns to Select.
	await classTool.click();
	await page.mouse.click(300, 450);
	await page.keyboard.press('Escape');
	await expect(page.locator('.classifier-node')).toHaveCount(4);
	await expect(page.getByRole('radio', { name: 'Select' })).toHaveAttribute('aria-checked', 'true');
});

test('live announcements: every command result and its undo are read from one polite region', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const live = page.getByTestId('live');
	await expect(live).toHaveAttribute('aria-live', 'polite');
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Book');
	await page.keyboard.press('Escape');
	await expect(live).toHaveText(/Book/);
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(live).toHaveText(/^Undone: /);
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(live).toHaveText(/^Redone: /);
	await expect(node(page, 'Book')).toBeVisible();
});

test('high contrast: white edges on black chrome, 2 px UML strokes, paper still white', async ({
	page
}) => {
	await page.addInitScript(() => localStorage.setItem('aster:theme', 'high-contrast'));
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('high-contrast');
	const style = await page.evaluate(() => {
		const root = getComputedStyle(document.documentElement);
		return {
			border: root.getPropertyValue('--chrome-border').trim(),
			stroke: root.getPropertyValue('--uml-stroke').trim(),
			paper: root.getPropertyValue('--paper-bg').trim(),
			body: getComputedStyle(document.body).backgroundColor
		};
	});
	expect(style.border).toMatch(/#fff(fff)?/i);
	expect(style.stroke).toBe('2px');
	expect(style.paper).toMatch(/#fff(fff)?/i);
	expect(style.body).toBe('rgb(0, 0, 0)');
	// The selection outline on paper is the blue paper accent, not the yellow chrome accent.
	await node(page, 'Account').click();
	const outline = await node(page, 'Account').evaluate((n) => getComputedStyle(n).outlineColor);
	expect(outline).toBe('rgb(26, 79, 214)');
});
