import { expect, test } from '@playwright/test';

test('properties panel edits dispatch the same commands as inline editing', async ({ page }) => {
	await page.goto('/');
	const customer = page.locator('.classifier-node[data-name="Customer"]');
	await customer.click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	await expect(inspector).toBeVisible();
	await expect(inspector.getByLabel('Name')).toHaveValue('Customer');

	// Member text: change visibility in the panel, compartment text follows.
	const first = inspector.getByRole('textbox', { name: 'Attribute line' }).first();
	await expect(first).toHaveValue('#{static} attribute0: String');
	await first.fill('-{static} attribute0: String');
	await first.press('Enter');
	await expect(customer.locator('[data-compartment="attribute"] li').first()).toHaveText(
		'-{static} attribute0: String'
	);

	// Member visibility from the panel: the compartment text changes within one frame.
	await inspector.getByRole('button', { name: 'Visibility of attribute1' }).click();
	await page.getByRole('option', { name: 'protected (#)' }).click();
	const nextFrame = await page.evaluate(
		() =>
			new Promise<string | null>((r) =>
				requestAnimationFrame(() =>
					r(
						document.querySelectorAll(
							'.classifier-node[data-name="Customer"] [data-compartment="attribute"] li'
						)[1].textContent
					)
				)
			)
	);
	expect(nextFrame).toBe('#attribute1: int');

	// Reorder and remove; focus stays in the panel after a remove.
	await inspector.getByRole('button', { name: 'Move attribute0 down' }).click();
	await expect(customer.locator('[data-compartment="attribute"] li').nth(1)).toHaveText(
		'-{static} attribute0: String'
	);
	await inspector.getByRole('button', { name: 'Remove attribute1' }).click();
	await expect(customer.locator('[data-compartment="attribute"] li')).toHaveCount(1);
	await expect(inspector.getByRole('button', { name: 'Add attribute' })).toBeFocused();
	await inspector.getByRole('button', { name: 'Add attribute' }).click();
	await expect(customer.locator('[data-compartment="attribute"] li')).toHaveCount(2);

	// Flags and kind.
	await inspector.getByLabel('Abstract').check();
	await expect(customer.locator('.name')).toHaveCSS('font-style', 'italic');
	await inspector.getByLabel('Stereotype').fill('entity');
	await inspector.getByLabel('Stereotype').press('Enter');
	await expect(customer.locator('.stereotype')).toHaveText('«entity»');

	await inspector.getByLabel('Kind').click();
	await page.getByRole('option', { name: 'Enumeration' }).click();
	await expect(customer).toHaveAttribute('data-kind', 'enum');
	await expect(inspector.getByRole('button', { name: 'Add literal' })).toBeVisible();
	await inspector.getByRole('button', { name: 'Add literal' }).click();
	await expect(customer.locator('[data-compartment="literal"] li')).toHaveText(['LITERAL1']);

	await inspector.getByLabel('Name').fill('Member');
	await inspector.getByLabel('Name').press('Enter');
	await expect(page.locator('.classifier-node[data-name="Member"]')).toBeVisible();

	// Everything above is on the undo stack.
	const undo = page.getByRole('button', { name: /^Undo: / });
	for (let i = 0; i < 10; i++) await undo.click();
	await expect(
		page.locator('.classifier-node[data-name="Customer"] [data-compartment="attribute"] li').first()
	).toHaveText('#{static} attribute0: String');
});
