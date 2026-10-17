import { expect, test } from '@playwright/test';
import { labelsOnTheirLine } from './helpers';

test.beforeEach(async ({ page }) => {
	await page.goto('/?fixture=notation');
	await expect(page.locator('.uml-edge')).toHaveCount(8);
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
	await expect(page.getByRole('button', { name: 'Zoom to 100%' })).toHaveText(/^(4\d|50)%$/);
	await page.waitForTimeout(300);
	const heights = await page
		.locator('.edge-label text')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
	expect(heights.length).toBeGreaterThan(10);
	expect(Math.min(...heights)).toBeGreaterThanOrEqual(10);
	expect((await labelsOnTheirLine(page)).filter((l) => l.endsWith('ON LINE'))).toEqual([]);
});
