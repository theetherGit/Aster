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

test('board 15: the Diagram tab holds defaults; a class overrides them in Properties and can follow again', async ({
	page
}) => {
	await page.goto('/design/notation');
	await expect(page.locator('.uml-edge')).toHaveCount(8);
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	// Diagram defaults: a tick means shown, so unticking Attributes hides every attribute compartment.
	await node(page, 'Person').click();
	await inspector.getByRole('tab', { name: 'Diagram' }).click();
	await expect(inspector.getByLabel('Diagram name')).toHaveValue('Library');
	const attrs = inspector.getByRole('checkbox', { name: 'Attributes' });
	await expect(attrs).toBeChecked();
	await attrs.uncheck();
	await expect(page.locator('.classifier-node [data-compartment="attribute"]')).toHaveCount(0);
	await attrs.check();
	await expect(node(page, 'Person').locator('[data-compartment="attribute"]')).toHaveCount(1);

	// One class of its own: Properties › Display, the override count, then back to the diagram.
	await inspector.getByRole('tab', { name: 'Properties' }).click();
	await expect(inspector).toContainText('Follows the diagram');
	await inspector.getByRole('button', { name: 'Display' }).click();
	await inspector.getByRole('checkbox', { name: 'Attributes' }).uncheck();
	await expect(node(page, 'Person').locator('[data-compartment="attribute"]')).toHaveCount(0);
	await expect(node(page, 'Member').locator('[data-compartment="attribute"]')).toHaveCount(1);
	await expect(inspector).toContainText('1 set here');
	await inspector.getByRole('button', { name: 'Follow diagram' }).click();
	await expect(node(page, 'Person').locator('[data-compartment="attribute"]')).toHaveCount(1);
	await expect(inspector).toContainText('Follows the diagram');
});

test('a file that will not open says so on the welcome too (board 22)', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /New diagram/ })).toBeFocused();
	const dt = await page.evaluateHandle(() => {
		const dt = new DataTransfer();
		dt.items.add(
			new File(['{"version":1,"project":{}}'], 'broken.aster', { type: 'application/json' })
		);
		return dt;
	});
	await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
	await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
	const notice = page.getByTestId('import-notice');
	await expect(notice).toContainText('Couldn’t open broken.aster');
	await expect(page).toHaveURL(/\/$/); // still on the welcome
});

test('captions: the palette toggle turns the status footer into the narration bar, remembered', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const bar = page.getByTestId('narration');
	await expect(bar).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Captions');
	await page.keyboard.press('Enter');
	await expect(bar).toBeVisible();
	await canvasOf(page).focus();
	await page.keyboard.press('ArrowRight');
	await expect(bar).toContainText('Announced');
	await expect(bar).toContainText('Account, abstract class.');
	// The live region already speaks it; the bar is for eyes only.
	await expect(bar).toHaveAttribute('aria-hidden', 'true');
	await page.reload();
	await expect(page.getByTestId('narration')).toBeVisible();
});

/** Owner's M2 ruling #30: tooltips on markers and visibility symbols; on by default, off in Classic. */
test('notation tooltips explain a visibility symbol and a marker; a toggle and Classic turn them off', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const tip = page.getByRole('tooltip');
	await node(page, 'Account').locator('[data-tip]').first().hover();
	await expect(tip).toHaveText('# protected: visible to this class and its subclasses');
	// WCAG 1.4.13: hoverable (the pointer can rest on it) and dismissible (Esc).
	await tip.hover();
	await expect(tip).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(tip).toHaveCount(0);
	await node(page, 'Account').locator('[data-tip]').first().hover();
	await expect(tip).toBeVisible();
	await page.mouse.move(5, 400);
	await expect(tip).toHaveCount(0);

	// A composition, made by keyboard: L, Enter, 3.
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('l');
	await page.keyboard.press('Enter');
	await page.keyboard.press('3');
	await page.locator('.uml-edge [data-tip]').first().hover();
	await expect(tip).toHaveText('Composition: Customer owns Account; the part goes with the whole');

	// The palette toggle turns them off, and Classic never shows them.
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Notation tooltips');
	await page.keyboard.press('Enter');
	await expect(page.locator('.uml-edge [data-tip], .classifier-node [data-tip]')).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Notation tooltips');
	await page.keyboard.press('Enter');
	await expect(page.locator('.classifier-node [data-tip]').first()).toBeAttached();
	await page.keyboard.press('ControlOrMeta+Shift+l');
	await expect(page.locator('.uml-edge [data-tip], .classifier-node [data-tip]')).toHaveCount(0);
});
