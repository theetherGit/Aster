import { expect, test, type Page } from '@playwright/test';
import { canvasOf, create } from './helpers';

/**
 * One key cap everywhere (owner's request, after shadcn-svelte's Kbd): every key the UI shows is
 * the Kbd atom, in one size, and hints draw their keys as caps rather than spelling them in copy.
 */
async function caps(page: Page) {
	return page.locator('kbd').evaluateAll((els) =>
		els
			.filter((el) => el.getClientRects().length && !el.closest('[aria-hidden="true"]'))
			.map((el) => ({
				slot: el.getAttribute('data-slot'),
				height: Math.round(el.getBoundingClientRect().height),
				text: el.textContent
			}))
	);
}

test('every key on screen is the Kbd atom, caps one height', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('button', { name: /New diagram/ })).toBeFocused();
	for (const where of ['welcome', 'empty canvas', 'sheet'] as const) {
		if (where === 'empty canvas') {
			await page.goto('/design/new');
			await expect(canvasOf(page)).toBeFocused();
		}
		if (where === 'sheet') await page.keyboard.press('Shift+Slash');
		const found = await caps(page);
		expect(found.length, where).toBeGreaterThan(0);
		for (const k of found) expect(k.slot, `${where}: ${k.text}`).toMatch(/^kbd(-group)?$/);
		const heights = new Set(found.filter((k) => k.slot === 'kbd').map((k) => k.height));
		expect([...heights], where).toHaveLength(1);
	}
});

test("the line editor's hint draws its keys as caps", async ({ page }) => {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(600, 400);
	await create(page, 'c', 'Book');
	const hint = page.locator('.chip-hint');
	await expect(hint.locator('kbd[data-slot="kbd"]')).toHaveCount(3);
	await expect(hint).toContainText('next line');
});
