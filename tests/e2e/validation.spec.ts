import { expect, test } from '@playwright/test';
import { canvasOf, create, node } from './helpers';

/**
 * features.md M2: the validation panel (UML001–012, live, jump-to-element, never blocks saving)
 * and ASTER001, the flipped generalization, with its one-button Flip.
 */
test('ASTER001 warns on an abstract child of a concrete class; Flip clears it, undo brings it back', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const count = page.getByRole('button', { name: /^\d+ warnings?$/ });
	await expect(count).toHaveCount(0);

	// Abstract Account drawn as the child of concrete Customer: L, Enter, 4 = generalization.
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('l');
	await page.keyboard.press('Enter');
	await page.keyboard.press('4');
	await expect(page.locator('.uml-edge[data-kind="generalization"]')).toHaveCount(1);
	// Plus UML003 twice: both sample classes have attribute0 and attribute1.
	await expect(count).toHaveText('3 warnings');
	await count.click();
	const panel = page.getByRole('region', { name: 'Validation' });
	await expect(panel).toBeVisible();
	await expect(panel).toContainText('ASTER001');
	await expect(panel).toContainText('Account is abstract but is drawn as the child. Flip?');

	await expect(panel.getByRole('button', { name: /^UML003/ })).toHaveCount(2);

	await panel.getByRole('button', { name: 'Flip', exact: true }).click();
	await expect(panel).not.toContainText('ASTER001');
	await expect(count).toHaveText('2 warnings');
	await expect(panel).toBeFocused();
	await expect(page.getByTestId('live')).toHaveText('Flip generalization Account to Customer');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(panel).toContainText('ASTER001');
});

test('UML002 lists a duplicate name with jump-to-element; renaming clears it without reload', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(700, 520);
	await create(page, 'c', 'Customer');
	await page.keyboard.press('Escape');
	await expect(node(page, 'Customer')).toHaveCount(2);

	// The panel opens from the palette too, and F6 reaches it.
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Validation');
	await page.keyboard.press('Enter');
	const panel = page.getByRole('region', { name: 'Validation' });
	await expect(panel).toBeVisible();
	const rows = panel.getByRole('button', { name: /^UML002/ });
	await expect(rows).toHaveCount(2);
	await expect(rows.first()).toContainText('Name is already defined.');

	// Jump: the class takes focus on the canvas.
	await rows.nth(1).click();
	const second = node(page, 'Customer').nth(1);
	await expect(second).toBeFocused();
	await expect(second).toHaveClass(/selected/);

	await page.keyboard.press('Enter');
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('Client');
	await page.keyboard.press('Enter');
	await page.keyboard.press('Escape');
	await expect(panel.getByRole('button', { name: /^UML002/ })).toHaveCount(0);
	await expect(panel).toContainText('No warnings');
});
