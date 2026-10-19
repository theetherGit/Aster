import { expect, test } from '@playwright/test';
import { canvasOf, lines, node, position } from './helpers';

/**
 * features.md M2 "Canvas keyboard navigation"; keyboard.md and accessibility.md § Canvas keyboard
 * model. Every step here is a key press: the mouse stays unplugged.
 */
test('keyboard-only: one Tab stop, arrows between Account and Customer, Tab through parts, ↩ edits, Esc steps out', async ({
	page
}) => {
	await page.goto('/design/sample');
	const canvas = canvasOf(page);
	const live = page.getByTestId('live');
	await expect(canvas).toBeFocused();

	// One application region: Svelte Flow's own wrapper role is removed, so it does not nest.
	await expect(page.getByRole('application')).toHaveCount(1);
	// The diagram is one stop in the page's Tab order.
	await page.keyboard.press('Shift+Tab');
	await expect(canvas).not.toBeFocused();
	await page.keyboard.press('Tab');
	await expect(canvas).toBeFocused();

	// Arrows rove focus between elements; the first press lands on the top-left element.
	const account = node(page, 'Account');
	const customer = node(page, 'Customer');
	await page.keyboard.press('ArrowRight');
	await expect(account).toBeFocused();
	await expect(account).toHaveClass(/selected/);
	// Board 10: the first element names the keys; the hints above it name the neighbours.
	await expect(live).toHaveText(
		'Account, abstract class. 10 attributes, 10 operations. Arrow keys move, Enter edits, L links, Tab for members, Esc steps out.'
	);
	const hints = page.getByTestId('focus-hints');
	await expect(hints).toHaveAttribute('aria-hidden', 'true');
	await expect(hints).toContainText('Focus');
	await expect(hints).toContainText('→ Customer');
	await expect(hints).not.toContainText('↑ Customer'); // one hint per neighbour, on its main axis
	await page.keyboard.press('ArrowRight');
	await expect(customer).toBeFocused();
	await expect(customer).toHaveClass(/selected/);
	await expect(account).not.toHaveClass(/selected/);
	await expect(live).toHaveText('Customer, class. 2 attributes, 2 operations.');
	await expect(hints).toContainText('← Account');
	await expect(hints).not.toContainText('→');
	await page.keyboard.press('ArrowLeft');
	await expect(account).toBeFocused();
	// The focus ring is dashed and offset; the selection outline is solid (accessibility.md).
	await expect
		.poll(() => account.evaluate((el) => getComputedStyle(el, '::after').borderTopStyle))
		.toBe('dashed');
	expect(await account.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid');

	// Tab cycles the element's parts: name, then each compartment line; ⇧Tab reverses.
	await page.keyboard.press('Tab');
	await expect(account.locator('.name')).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(lines(page, 'Account', 'attribute').nth(0)).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(lines(page, 'Account', 'attribute').nth(1)).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await page.keyboard.press('Shift+Tab');
	await expect(account.locator('.name')).toBeFocused();

	// ↩ on the name part opens the name editor; Esc steps back to the part, then the element.
	await page.keyboard.press('Enter');
	const nameBox = canvas.getByRole('textbox', { name: 'Name' });
	await expect(nameBox).toBeFocused();
	await page.keyboard.type('Wallet');
	await page.keyboard.press('Escape');
	await expect(nameBox).toHaveCount(0);
	await expect(account).toBeVisible();
	await expect(account.locator('.name')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(account).toBeFocused();
	// ↩ on a line part edits that line.
	await page.keyboard.press('Tab');
	await page.keyboard.press('Tab');
	await page.keyboard.press('Enter');
	const lineBox = canvas.getByRole('combobox', { name: 'Attribute line' });
	await expect(lineBox).toBeFocused();
	await expect(lineBox).toHaveValue(/attribute0/);
	await page.keyboard.press('Escape');
	await expect(lines(page, 'Account', 'attribute').nth(0)).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(account).toBeFocused();
	// Then Esc clears the selection, and the next Esc leaves the canvas.
	await page.keyboard.press('Escape');
	await expect(account).not.toHaveClass(/selected/);
	await expect(account).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(account).not.toBeFocused();
	expect(await canvas.evaluate((el) => el.contains(document.activeElement))).toBe(false);
	// ⇧F6 cycles back into the canvas panel; the diagram is one Tab stop again.
	await page.keyboard.press('Shift+F6');
	await expect
		.poll(() =>
			page.locator('[data-panel="canvas"]').evaluate((el) => el.contains(document.activeElement))
		)
		.toBe(true);
	await expect(canvas).toHaveAttribute('tabindex', '0');

	// accessibility.md: each panel's first focusable is a skip link back to the diagram.
	await canvas.focus();
	await page.keyboard.press('Shift+F6'); // the Outline
	const skip = page
		.locator('[data-panel="outline"]')
		.getByRole('link', { name: 'Skip to the canvas' });
	await expect(skip).toBeFocused();
	await expect(skip).toBeInViewport();
	await page.keyboard.press('Enter');
	await expect(canvas).toBeFocused();
});

test('keyboard-only: ⌘+arrows nudge, ⇧+arrows resize a note, ⌫ deletes with the undo toast, edges are parts', async ({
	page
}) => {
	await page.goto('/design/sample');
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();
	const account = node(page, 'Account');
	const customer = node(page, 'Customer');

	await page.keyboard.press('ArrowRight');
	await expect(account).toBeFocused();
	const start = await position(account);
	await page.keyboard.press('ControlOrMeta+ArrowRight');
	await page.keyboard.press('ControlOrMeta+ArrowRight');
	await page.keyboard.press('ControlOrMeta+Shift+ArrowDown');
	await expect.poll(() => position(account)).toEqual({ x: start.x + 2, y: start.y + 8 });
	await expect(account).toBeFocused();

	// L links from the focused element; arrows pick the target, ↩ opens the picker, 1 = association.
	await page.keyboard.press('l');
	await expect(customer).toHaveClass(/link-target/);
	await page.keyboard.press('Enter');
	await page.keyboard.press('1');
	const edge = page.locator('.uml-edge');
	await expect(edge).toHaveCount(1);
	// The new edge is selected, so focus follows it; an arrow from an edge starts over at the top-left node.
	await expect(edge).toBeFocused();
	await page.keyboard.press('ArrowLeft');
	await expect(account).toBeFocused();
	// ⇧Tab from the element reaches its last part: the attached edge, which selects it.
	await page.keyboard.press('Shift+Tab');
	await expect(edge).toBeFocused();
	await expect(edge).toHaveClass(/selected/);
	await page.keyboard.press('Escape');
	await expect(account).toBeFocused();
	await expect(account).toHaveClass(/selected/);

	// ⌫ removes from the diagram with an undo toast, no confirm; ⌘Z brings it back.
	await page.keyboard.press('Backspace');
	await expect(account).toHaveCount(0);
	const toast = page.getByTestId('toast');
	await expect(toast).toContainText('Account removed from this diagram');
	await expect(toast.getByRole('button', { name: /Undo/ })).toBeVisible();
	await page.keyboard.press('ControlOrMeta+z');
	await expect(account).toBeVisible();
	expect(await position(account)).toEqual({ x: start.x + 2, y: start.y + 8 });

	// ⇧+arrows resize a note by 8 px; a class ignores them.
	await page.mouse.move(700, 500);
	await page.keyboard.press('n');
	const noteText = canvas.getByRole('textbox', { name: 'Note text' });
	await expect(noteText).toBeFocused();
	await page.keyboard.type('Remember');
	await page.keyboard.press('ControlOrMeta+Enter');
	const note = page.locator('.note-node');
	await expect(note).toBeFocused();
	const sheet = note.locator('.sheet');
	await expect(sheet).toHaveCSS('min-width', '160px');
	await page.keyboard.press('Shift+ArrowRight');
	await expect(sheet).toHaveCSS('min-width', '168px');
	await page.keyboard.press('Shift+ArrowDown');
	await expect(sheet).toHaveCSS('min-height', '68px');
	await page.keyboard.press('Shift+ArrowLeft');
	await expect(sheet).toHaveCSS('min-width', '160px');
});

test('context menu: right-click or ⇧F10 on a node or edge lists its commands; focus returns to the element', async ({
	page
}) => {
	await page.goto('/design/sample');
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();
	const account = node(page, 'Account');
	const customer = node(page, 'Customer');
	const menu = page.getByRole('menu');

	// ⇧F10 on the focused element.
	await page.keyboard.press('ArrowRight');
	await expect(account).toBeFocused();
	await page.keyboard.press('Shift+F10');
	await expect(menu).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: /^Edit/ })).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: /^Link/ })).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: /^Remove from diagram/ })).toBeVisible();
	await expect(menu.getByRole('menuitem', { name: /^Delete from model/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await expect(account).toBeFocused();

	// Right-click selects and focuses the element under the pointer, then opens the same menu.
	await customer.click({ button: 'right' });
	await expect(menu).toBeVisible();
	await expect(customer).toHaveClass(/selected/);
	await menu.getByRole('menuitem', { name: /^Remove from diagram/ }).click();
	await expect(customer).toHaveCount(0);
	await expect(page.getByTestId('toast')).toContainText('Customer removed from this diagram');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(customer).toBeVisible();

	// Right-click on empty paper opens nothing.
	await page.mouse.click(900, 600, { button: 'right' });
	await expect(menu).toHaveCount(0);

	// An edge's menu carries the line styles.
	await account.click();
	await page.keyboard.press('l');
	await page.keyboard.press('Enter');
	await page.keyboard.press('1');
	const edge = page.locator('.uml-edge');
	await expect(edge).toBeFocused();
	await page.keyboard.press('Shift+F10');
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', { name: /^Rectilinear/ }).click();
	await expect(edge).toHaveAttribute('data-line-style', 'rectilinear');
	await expect(edge).toBeFocused();
});
