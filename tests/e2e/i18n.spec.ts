import { expect, test } from '@playwright/test';

test('?locale=pseudo switches every chrome string to the bracketed pseudo-locale', async ({
	page
}) => {
	await page.goto('/?locale=pseudo');
	await expect(
		page.getByRole('application', { name: /^\[Diagram canvas: Main~+\]$/ })
	).toBeVisible();
	await expect(page.getByRole('toolbar', { name: /^\[Toolbox~+\]$/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /^\[Zoom in~+\]$/ })).toBeVisible();
	await page.goto('/');
	await expect(page.getByRole('application', { name: 'Diagram canvas: Main' })).toBeVisible();
});
