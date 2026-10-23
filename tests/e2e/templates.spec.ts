import { expect, test } from '@playwright/test';
import { canvasOf, node } from './helpers';

/**
 * features.md M3, template gallery (owner's choice: the owner's own GitHub projects): the welcome and the
 * palette open it; a template opens as a saved project of its own, in Recent and at its address.
 */
test('the gallery lists the templates, and one opens as a project of your own', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: /Start from a template/ }).click();
	const gallery = page.getByRole('dialog', { name: 'Start from a template' });
	await expect(gallery.getByRole('listitem')).toHaveCount(6);
	for (const name of [
		'Doota',
		'LMRS Shop',
		'SvelteKit OG 4',
		'SvelteKit OG 5 (next)',
		'SvelteKit Redis Session',
		'un-jinja'
	])
		await expect(gallery.getByRole('button', { name: `Use the ${name} template` })).toBeVisible();
	// Each card says where it comes from, and its picture is named.
	await expect(gallery.getByRole('link', { name: /ethercorps\/doota/ })).toHaveAttribute(
		'href',
		'https://github.com/ethercorps/doota'
	);
	await expect(
		gallery.getByRole('img', { name: /^Doota: the Mail data model diagram$/ })
	).toBeVisible();

	await gallery.getByRole('button', { name: 'Use the Doota template' }).click();
	await expect(page).toHaveURL(/\/design\/doota$/);
	await expect(canvasOf(page)).toBeVisible();
	await expect(node(page, 'mailbox')).toBeAttached();
	await expect(page.getByRole('tab', { name: 'Inbound mail flow' })).toBeVisible();

	// Saved at once: in Recent, and its address opens it after a reload.
	await page.reload();
	await expect(node(page, 'mailbox')).toBeAttached();
	await page.goto('/');
	await expect(page.locator('.recent .row').filter({ hasText: 'Doota' })).toHaveCount(1);
});

test('the palette opens the gallery from the editor', async ({ page }) => {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+k');
	await page
		.getByRole('dialog', { name: 'Command palette' })
		.getByRole('combobox', { name: 'Search commands' })
		.fill('New from template');
	await page.keyboard.press('Enter');
	const gallery = page.getByRole('dialog', { name: 'Start from a template' });
	await expect(gallery).toBeVisible();
	await gallery.getByRole('button', { name: 'Use the un-jinja template' }).click();
	await expect(gallery).toHaveCount(0);
	await expect(node(page, 'engine')).toBeAttached();
	await expect(page).toHaveURL(/\/design\/un-jinja$/);
});
