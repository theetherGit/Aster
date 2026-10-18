import { expect, test } from '@playwright/test';

test('explorer tree: ARIA tree keyboard, type-ahead, bidirectional selection, ⌘E / ⌘D', async ({
	page
}) => {
	await page.goto('/');
	const canvas = page.getByRole('application', { name: 'Diagram canvas: Main' });
	await expect(canvas).toBeFocused();

	await page.keyboard.press('ControlOrMeta+b');
	const tree = page.getByRole('tree', { name: 'Model tree' });
	await expect(tree).toBeVisible();
	const items = tree.getByRole('treeitem');
	await expect(items).toHaveText([/Library/, /Main/, /Account/, /Customer/]);

	// Exactly one item is in the Tab order.
	expect(
		await items.evaluateAll((els) => els.filter((e) => e.getAttribute('tabindex') === '0').length)
	).toBe(1);
	await items.first().focus();
	await expect(items.first()).toBeFocused();
	await expect(items.first()).toHaveAttribute('aria-expanded', 'true');
	await expect(items.first()).toHaveAttribute('aria-level', '1');

	await page.keyboard.press('ArrowDown');
	await expect(items.nth(1)).toBeFocused();
	await page.keyboard.press('ArrowDown');
	const account = items.nth(2);
	await expect(account).toBeFocused();
	await expect(account).toHaveAttribute('aria-expanded', 'false');
	await expect(account).toHaveAttribute('aria-posinset', '2');
	await expect(account).toHaveAttribute('aria-setsize', '3');

	await page.keyboard.press('ArrowRight');
	await expect(account).toHaveAttribute('aria-expanded', 'true');
	await expect(account).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await expect(items.nth(3)).toBeFocused();
	await expect(items.nth(3)).toHaveAttribute('aria-level', '3');
	await expect(items.nth(3)).toHaveText(/#\{static\} attribute0: String/);
	await page.keyboard.press('ArrowLeft');
	await expect(account).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(account).toHaveAttribute('aria-expanded', 'false');

	await page.keyboard.press('End');
	await expect(items.last()).toBeFocused();
	await expect(items.last()).toHaveText(/Customer/);
	await page.keyboard.press('Home');
	await expect(items.first()).toBeFocused();

	await page.keyboard.type('cu');
	await expect(items.last()).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('.classifier-node[data-name="Customer"]')).toHaveClass(/selected/);
	await expect(items.last()).toHaveAttribute('aria-selected', 'true');

	await page.keyboard.press('ControlOrMeta+d');
	await expect(canvas).toBeFocused();

	await page.locator('.classifier-node[data-name="Account"]').click();
	await expect(items.nth(2)).toHaveAttribute('aria-selected', 'true');
	await expect(items.last()).toHaveAttribute('aria-selected', 'false');
	await page.keyboard.press('ControlOrMeta+e');
	await expect(items.nth(2)).toBeFocused();

	await page.keyboard.press('ControlOrMeta+b');
	await expect(tree).toHaveCount(0);
});
