import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { canvasOf, edgeOf, node, pointOnEdge } from './helpers';

/**
 * features.md M3, "Fill and line colour": per-element colours from the inspector, written to
 * fillColor / lineColor. "Imported colours show." High contrast keeps black on white (owner's
 * ruling, 2026-10-22); the colours stay in the model.
 */
const fixture = (name: string) =>
	fileURLToPath(new URL(`../../fixtures/mdj/${name}`, import.meta.url));
async function drop(page: Page, name: string) {
	const text = readFileSync(fixture(name), 'utf8');
	const dt = await page.evaluateHandle(
		({ name, text }) => {
			const dt = new DataTransfer();
			dt.items.add(new File([text], name, { type: 'application/json' }));
			return dt;
		},
		{ name, text }
	);
	await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
	await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
	await expect(page.getByTestId('import-notice')).toContainText(`Opened ${name}`);
}
const background = (page: Page, name: string) =>
	node(page, name).evaluate((el) => getComputedStyle(el).backgroundColor);
const border = (page: Page, name: string) =>
	node(page, name).evaluate((el) => getComputedStyle(el).borderTopColor);
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspector' });

test('an imported fill shows; the Style section resets it, sets a line, and each is one undo step', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await drop(page, 'public-amigo-chatbot.mdj');
	await page.keyboard.press('Escape');
	await expect.poll(() => background(page, 'JobManager')).toBe('rgb(255, 255, 216)');

	await node(page, 'JobManager').click();
	const style = inspector(page);
	await expect(style.getByTestId('style-fill-value')).toHaveText('#ffffd8');
	await expect(style.getByTestId('style-line-value')).toHaveText('Default');
	await style.getByRole('button', { name: 'Reset the fill colour' }).click();
	await expect.poll(() => background(page, 'JobManager')).toBe('rgb(255, 255, 255)');
	await expect(style.getByTestId('style-fill-value')).toHaveText('Default');

	await style.getByLabel('Line', { exact: true }).fill('#1e3a8a');
	await expect.poll(() => border(page, 'JobManager')).toBe('rgb(30, 58, 138)');
	await expect(style.getByTestId('style-line-value')).toHaveText('#1e3a8a');

	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => border(page, 'JobManager')).not.toBe('rgb(30, 58, 138)');
	await page.keyboard.press('ControlOrMeta+z');
	await expect.poll(() => background(page, 'JobManager')).toBe('rgb(255, 255, 216)');
});

test('a fill that text cannot be read on is said, not refused', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await node(page, 'Customer').click();
	const style = inspector(page);
	await style.getByLabel('Fill', { exact: true }).fill('#1e3a8a');
	await expect.poll(() => background(page, 'Customer')).toBe('rgb(30, 58, 138)');
	await expect(style).toContainText('Text on this fill reads at 1.');
	await expect(style).toContainText('text needs 4.5:1');
});

test('a coloured relationship draws its line and its arrowhead in that colour', async ({
	page
}) => {
	await page.goto('/design/notation');
	await expect(canvasOf(page)).toBeFocused();
	const gen = edgeOf(page, 'gen');
	const p = await pointOnEdge(gen, 0.5);
	await page.mouse.click(p.x, p.y);
	await expect(gen).toHaveClass(/selected/);
	await inspector(page).getByLabel('Line', { exact: true }).fill('#b91c1c');
	await canvasOf(page).focus();
	await page.keyboard.press('Escape');
	await expect(gen).not.toHaveClass(/selected/);
	await page.mouse.move(1, 1); // off the edge: hovering tints it
	await expect
		.poll(() => gen.locator('.edge-line').evaluate((el) => getComputedStyle(el).stroke))
		.toBe('rgb(185, 28, 28)');
	await expect(gen.locator('.edge-line')).toHaveAttribute(
		'marker-end',
		'url(#aster-m-triangle-b91c1c)'
	);
	await expect
		.poll(() =>
			page.locator('#aster-m-triangle-b91c1c path').evaluate((el) => getComputedStyle(el).stroke)
		)
		.toBe('rgb(185, 28, 28)');
});

test('high contrast draws imported colours in black on white, and says why', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('aster:theme', 'high-contrast'));
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await drop(page, 'public-amigo-chatbot.mdj');
	await page.keyboard.press('Escape');
	await expect.poll(() => background(page, 'JobManager')).toBe('rgb(255, 255, 255)');
	await node(page, 'JobManager').click();
	await expect(inspector(page).getByTestId('style-fill-value')).toHaveText('#ffffd8');
	await expect(inspector(page)).toContainText('High contrast draws the paper in black and white');
});
