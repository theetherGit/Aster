import { expect, test } from '@playwright/test';

test('properties panel edits dispatch the same commands as inline editing', async ({ page }) => {
	await page.goto('/design/sample');
	const customer = page.locator('.classifier-node[data-name="Customer"]');
	await customer.click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	await expect(inspector).toBeVisible();
	await expect(inspector.getByLabel('Name', { exact: true })).toHaveValue('Customer');

	// Member text: change visibility in the panel, compartment text follows.
	const first = inspector.getByRole('textbox', { name: 'Attribute line' }).first();
	await expect(first).toHaveValue('{static} attribute0: String');
	// A symbol typed in front wins over the row's visibility column.
	await first.fill('- {static} attribute0: String');
	await first.press('Enter');
	// ↩ moved on to the next line; Esc ends that edit so hover shows the row's actions.
	await page.keyboard.press('Escape');
	await expect(customer.locator('[data-compartment="attribute"] li').first()).toHaveText(
		'- attribute0: String'
	);

	// Member visibility from the panel: the compartment text changes within one frame.
	await inspector.getByRole('textbox', { name: 'Attribute line' }).nth(1).hover();
	await inspector.getByRole('button', { name: 'Visibility of attribute1' }).click();
	await page.getByRole('menuitemradio', { name: 'protected' }).click();
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
	expect(nextFrame).toBe('# attribute1: int');

	// Reorder (⌘↓ on the line) and remove; focus stays in the panel after a remove.
	await inspector.getByRole('textbox', { name: 'Attribute line' }).first().focus();
	await page.keyboard.press('ControlOrMeta+ArrowDown');
	await page.keyboard.press('Escape');
	await expect(customer.locator('[data-compartment="attribute"] li').nth(1)).toHaveText(
		'- attribute0: String'
	);
	await inspector.getByRole('textbox', { name: 'Attribute line' }).first().hover();
	await inspector.getByRole('button', { name: 'Delete attribute1 from Customer' }).click();
	await expect(customer.locator('[data-compartment="attribute"] li')).toHaveCount(1);
	// Focus lands on the neighbouring row's field, not on "+ Add".
	await expect(inspector.getByRole('textbox', { name: 'Attribute line' }).first()).toBeFocused();
	await inspector.getByRole('button', { name: 'Add attribute' }).click();
	await expect(customer.locator('[data-compartment="attribute"] li')).toHaveCount(2);

	// Flags and kind.
	await inspector.getByLabel('Abstract').check();
	await expect(customer.locator('.name')).toHaveCSS('font-style', 'italic');
	await inspector.getByLabel('Stereotype', { exact: true }).fill('entity');
	await inspector.getByLabel('Stereotype', { exact: true }).press('Enter');
	await expect(customer.locator('.stereotype')).toHaveText('«entity»');

	await inspector.getByLabel('Kind').click();
	await page.getByRole('option', { name: 'Enumeration' }).click();
	await expect(customer).toHaveAttribute('data-kind', 'enum');
	await expect(inspector.getByRole('button', { name: 'Add literal' })).toBeVisible();
	await inspector.getByRole('button', { name: 'Add literal' }).click();
	await expect(customer.locator('[data-compartment="literal"] li')).toHaveText(['LITERAL1']);

	await inspector.getByLabel('Name', { exact: true }).fill('Member');
	await inspector.getByLabel('Name', { exact: true }).press('Enter');
	await expect(page.locator('.classifier-node[data-name="Member"]')).toBeVisible();

	// Everything above is on the undo stack.
	const undo = page.getByRole('button', { name: /^Undo: / });
	for (let i = 0; i < 10; i++) await undo.click();
	await expect(
		page.locator('.classifier-node[data-name="Customer"] [data-compartment="attribute"] li').first()
	).toHaveText('# attribute0: String');
});

test('member-row buttons are not hit-testable until the row is hovered or focused', async ({
	page
}) => {
	await page.goto('/design/sample');
	const customer = page.locator('.classifier-node[data-name="Customer"]');
	await customer.click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	const line = inspector.getByRole('textbox', { name: 'Attribute line' }).first();
	await expect(line).toBeVisible();
	// The panel slides in over 160 ms; the hit test below needs its final place.
	await expect.poll(async () => (await page.locator('.inspector').boundingBox())?.width).toBe(300);
	await page.mouse.move(0, 0); // nothing hovered, nothing in the row focused
	const box = (await line.boundingBox())!;
	const at = { x: box.x + box.width - 8, y: box.y + box.height / 2 };
	// Hit-test at the right end of the field without hovering: the field itself, not a hidden button.
	const hit = await page.evaluate(({ x, y }) => {
		const el = document.elementFromPoint(x, y) as HTMLElement;
		el.click();
		return el.tagName;
	}, at);
	expect(hit).toBe('INPUT');
	await expect(customer.locator('[data-compartment="attribute"] li')).toHaveCount(2);
	// Tab from the line reaches the row's buttons, which then show at full size.
	await line.focus();
	await page.keyboard.press('Tab');
	const vis = inspector.getByRole('button', { name: /^Visibility of attribute0/ });
	await expect(vis).toBeFocused();
	expect((await vis.boundingBox())!.width).toBe(24);
	await page.keyboard.press('Tab');
	await expect(
		inspector.getByRole('button', { name: 'Delete attribute0 from Customer' })
	).toBeFocused();
});

test('blank names and member lines revert instead of committing', async ({ page }) => {
	await page.goto('/design/sample');
	await page.locator('.classifier-node[data-name="Customer"]').click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	const name = inspector.getByLabel('Name', { exact: true });
	await name.fill('   ');
	await name.press('Enter');
	await expect(name).toHaveValue('Customer');
	const line = inspector.getByRole('textbox', { name: 'Attribute line' }).first();
	await line.fill('');
	await line.press('Enter');
	await expect(line).toHaveValue('{static} attribute0: String');
	// Nothing reached the undo stack.
	await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveAttribute(
		'aria-disabled',
		'true'
	);
});

test('the tab row stays put while the panel scrolls; scrollbars are thin and themed', async ({
	page
}) => {
	await page.setViewportSize({ width: 1280, height: 600 });
	await page.goto('/design/sample');
	await page.locator('.classifier-node[data-name="Account"]').click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	await expect.poll(async () => (await page.locator('.inspector').boundingBox())?.width).toBe(300);
	const tabs = inspector.getByRole('tablist');
	const top = (await tabs.boundingBox())!.y;
	await inspector.evaluate((el) => (el.scrollTop = 400));
	expect(await inspector.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	expect((await tabs.boundingBox())!.y).toBe(top);
	await expect(inspector).toHaveCSS('scrollbar-width', 'thin');
});
