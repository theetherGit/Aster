import { expect, test } from '@playwright/test';
import { labelsOnTheirLine } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/design/notation');
	await expect(page.locator('.uml-edge')).toHaveCount(8);
	// Sizes and label placement depend on the bundled paper font: wait for it.
	await page.evaluate(() => document.fonts.ready);
});

test('visual: the notation fixture matches its reviewed snapshot', async ({ page }) => {
	await page.mouse.move(1270, 700);
	await expect(page).toHaveScreenshot('notation.png', {
		animations: 'disabled',
		maxDiffPixelRatio: 0.002
	});
});

test('no label sits on its own line', async ({ page }) => {
	const all = await labelsOnTheirLine(page);
	expect(all.length).toBeGreaterThanOrEqual(15);
	expect(all.filter((l) => l.endsWith('ON LINE'))).toEqual([]);
});

test('labels stay legible at 50 % zoom and still clear their lines', async ({ page }) => {
	for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom out' }).click();
	await expect(page.getByTestId('zoom-level')).toHaveText(/^(4\d|50)%$/);
	await page.waitForTimeout(300);
	const heights = await page
		.locator('.edge-label text')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
	expect(heights.length).toBeGreaterThan(10);
	expect(Math.min(...heights)).toBeGreaterThanOrEqual(10);
	expect((await labelsOnTheirLine(page)).filter((l) => l.endsWith('ON LINE'))).toEqual([]);
});

/**
 * Layout metrics come from the bundled paper font, so they are the same on every platform.
 * This runs on CI on Linux too, where the macOS screenshot baseline is not compared.
 */
test('node sizes and label widths match the bundled font on every platform', async ({ page }) => {
	expect(await page.evaluate(() => document.fonts.check('12px "Source Sans 3"'))).toBe(true);
	const sizes = await page
		.locator('.svelte-flow__node')
		.evaluateAll((els) =>
			Object.fromEntries(
				els.map((e) => [
					e.getAttribute('data-id'),
					[e.getBoundingClientRect().width, e.getBoundingClientRect().height]
				])
			)
		);
	const expected: Record<string, [number, number]> = {
		Person: [160, 96],
		Member: [160, 71],
		Library: [160, 71],
		Book: [160, 91],
		Searchable: [160, 83],
		Loan: [160, 96],
		LoanStatus: [160, 115],
		Category: [160, 71]
	};
	for (const [id, [w, h]] of Object.entries(expected)) {
		expect(Math.abs(sizes[id][0] - w), `${id} width`).toBeLessThanOrEqual(1);
		expect(Math.abs(sizes[id][1] - h), `${id} height`).toBeLessThanOrEqual(1);
	}
	const labels = await page
		.locator('.edge-label')
		.evaluateAll((els) =>
			Object.fromEntries(
				els.map((e) => [
					`${e.closest('.uml-edge')!.getAttribute('data-rel-id')}/${e.getAttribute('data-label')}`,
					Number(e.querySelector('rect')!.getAttribute('width'))
				])
			)
		);
	const widths: Record<string, number> = {
		'comp/sourceRole': 36.6,
		'agg/sourceRole': 53.6,
		'assoc/targetRole': 36.8,
		'borrows/name': 47.5,
		'dep/name': 33.8,
		'tree/targetRole': 47.2,
		'tree/sourceMultiplicity': 23.9
	};
	// Hinting still nudges advances by a few percent between platforms; a fallback font would be
	// 10–20 % off, so 6 % separates "bundled font in use" from "not".
	for (const [key, w] of Object.entries(widths))
		expect(Math.abs(labels[key] - w), key).toBeLessThanOrEqual(Math.max(1, w * 0.06));
});
