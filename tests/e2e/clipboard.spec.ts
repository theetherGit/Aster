import { expect, test } from '@playwright/test';
import { canvasOf, node, position } from './helpers';

/** keyboard.md: ⌘C / ⌘X / ⌘V; "Paste creates views, or model+views across projects". */
test('copy, cut and paste by keyboard: duplicate in place, cut and put back, views on another diagram', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const live = page.getByTestId('live');
	const account = node(page, 'Account');
	const customer = node(page, 'Customer');

	// ⌘C ⌘V on the diagram that shows Account duplicates it, 20 px down and right, as one step.
	await page.keyboard.press('ArrowRight');
	await expect(account).toBeFocused();
	const at = await position(account);
	await page.keyboard.press('ControlOrMeta+c');
	await expect(live).toHaveText('Copied Account');
	await page.keyboard.press('ControlOrMeta+v');
	await expect(account).toHaveCount(2);
	await expect(live).toHaveText('Paste Account');
	expect(await position(account.nth(1))).toEqual({ x: at.x + 20, y: at.y + 20 });
	await expect(account.nth(1)).toHaveClass(/selected/);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(account).toHaveCount(1);
	// The copy that had focus is gone: the diagram keeps the keyboard, and arrows start over.
	await expect(canvasOf(page)).toBeFocused();

	// ⌘X removes from the diagram with the undo toast; ⌘V puts it back where it was.
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await expect(customer).toBeFocused();
	const was = await position(customer);
	await page.keyboard.press('ControlOrMeta+x');
	await expect(customer).toHaveCount(0);
	await expect(page.getByTestId('toast')).toContainText('Customer removed from this diagram');
	await page.keyboard.press('ControlOrMeta+v');
	await expect(customer).toHaveCount(1);
	expect(await position(customer)).toEqual(was);

	// On another diagram of the same project, paste makes views of the same elements.
	await customer.click();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.press('ControlOrMeta+c');
	await page.getByRole('button', { name: 'Add diagram' }).click();
	await expect(page.getByRole('tab', { name: 'Class diagram 2' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+v');
	await expect(account).toHaveCount(1);
	await expect(customer).toHaveCount(1);
	expect(await position(customer)).toEqual(was);
	// The Outline lists each class once: views, not copies.
	const outline = page.getByRole('tree');
	await expect(outline.getByRole('treeitem', { name: /^Customer/ })).toHaveCount(1);
});

test('paste in another project, another tab, creates the elements there', async ({
	page,
	context
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ControlOrMeta+c');
	await expect(page.getByTestId('live')).toHaveText('Copied Account');

	const other = await context.newPage();
	await other.goto('/design/new');
	await expect(canvasOf(other)).toBeFocused();
	await other.keyboard.press('ControlOrMeta+v');
	await expect(node(other, 'Account')).toHaveCount(1);
	await expect(node(other, 'Account').locator('[data-compartment="attribute"] li')).toHaveCount(10);
});

test('the context menu copies; the palette pastes', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const customer = node(page, 'Customer');
	await customer.click({ button: 'right' });
	await page.getByRole('menuitem', { name: /^Copy/ }).click();
	await expect(page.getByTestId('live')).toHaveText('Copied Customer');
	await page.keyboard.press('ControlOrMeta+k');
	await page.keyboard.type('Paste');
	await page.keyboard.press('Enter');
	await expect(customer).toHaveCount(2);
});
