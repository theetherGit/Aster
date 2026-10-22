import { expect, test } from '@playwright/test';
import { canvasOf, node } from './helpers';

/** features.md, Classic layout: StarUML's panels where StarUML puts them; switching keeps state. */
test('⌘⇧L switches to Classic: StarUML panels, yellow classes, selection and zoom kept', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await node(page, 'Account').click();
	await expect(node(page, 'Account')).toHaveClass(/selected/);
	await page.keyboard.press('ControlOrMeta+Equal');
	await expect(page.getByTestId('zoom-level')).toHaveText('120%');

	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Shift+l');
	const menubar = page.getByRole('menubar', { name: 'Menu bar' });
	await expect(menubar).toBeVisible();
	for (const m of ['File', 'Edit', 'Format', 'Model', 'View', 'Help'])
		await expect(menubar.getByRole('menuitem', { name: m })).toBeVisible();
	await expect(page.getByRole('toolbar', { name: 'Toolbar' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Working Diagrams' })).toBeVisible();
	// A plain list of buttons marks the open diagram (no listbox: it has no option children or arrows).
	await expect(
		page.getByRole('list', { name: 'Diagrams' }).getByRole('button', { name: 'Main' })
	).toHaveAttribute('aria-current', 'true');
	const toolbox = page.getByRole('toolbar', { name: 'Toolbox' });
	for (const group of ['Annotations', 'Class diagram', 'Relationships'])
		await expect(toolbox.getByRole('group', { name: group })).toBeVisible();
	// Package is a placing tool since M3.1, like the classes beside it.
	await expect(toolbox.getByRole('radio', { name: /Package/ })).toBeVisible();
	await expect(page.getByRole('region', { name: 'Model Explorer', exact: true })).toBeVisible();
	const editors = page.getByRole('complementary', { name: 'Editors', exact: true });
	for (const tab of ['Style', 'Property', 'Documentation'])
		await expect(editors.getByRole('tab', { name: tab })).toBeVisible();
	// No Modern chrome: no top bar tabs, no floating toolbox.
	await expect(page.getByRole('tablist', { name: 'Diagrams' })).toHaveCount(0);

	// StarUML's pale yellow on the paper, the chrome's own tokens.
	const fill = await node(page, 'Account').evaluate((n) => getComputedStyle(n).backgroundColor);
	expect(fill).toBe('rgb(255, 255, 224)');
	expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe('classic');

	// Selection and zoom survived the switch; the zoom button is named by what it shows.
	await expect(node(page, 'Account')).toHaveClass(/selected/);
	await expect(
		page.getByRole('toolbar', { name: 'Toolbar' }).getByRole('button', { name: '120%' })
	).toBeVisible();

	// StarUML's panel toggles, only here: ⌘6 Editors, ⌘1 Sidebar.
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+6');
	await expect(editors).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+1');
	await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+1');
	await page.keyboard.press('ControlOrMeta+6');
	await expect(editors).toBeVisible();

	// Remembered across a reload.
	await page.reload();
	await expect(page.getByRole('menubar', { name: 'Menu bar' })).toBeVisible();

	// Back to Modern, state still intact.
	await canvasOf(page).focus();
	await node(page, 'Account').click();
	await page.keyboard.press('ControlOrMeta+Shift+l');
	await expect(page.getByRole('menubar')).toHaveCount(0);
	await expect(page.getByRole('tablist', { name: 'Diagrams' })).toBeVisible();
	await expect(node(page, 'Account')).toHaveClass(/selected/);
	expect(await page.evaluate(() => document.documentElement.dataset.layout)).toBe('modern');
});

test('the Classic menus come from the registry and run commands', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Shift+l');
	const menubar = page.getByRole('menubar', { name: 'Menu bar' });
	await menubar.getByRole('menuitem', { name: 'File' }).click();
	const file = page.getByRole('menu');
	await expect(file.getByRole('menuitem', { name: /New diagram/ })).toHaveText(/⌘N|Ctrl\+N/); // per platform
	await expect(file.getByRole('menuitem', { name: /^Save/ }).first()).toBeVisible();
	await page.keyboard.press('Escape');

	await menubar.getByRole('menuitem', { name: 'Edit' }).click();
	await expect(page.getByRole('menu').getByRole('menuitem', { name: /^Undo/ })).toHaveAttribute(
		'aria-disabled',
		'true'
	);
	await page.keyboard.press('Escape');

	// ⌘1 is the Sidebar in Classic and the fit alias in Modern.
	await menubar.getByRole('menuitem', { name: 'View' }).click();
	await page
		.getByRole('menu')
		.getByRole('menuitem', { name: 'Switch to the Modern layout' })
		.click();
	await expect(menubar).toHaveCount(0);
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+1');
	await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveCount(0);
	await expect(page.getByRole('tablist', { name: 'Diagrams' })).toBeVisible();
});

test('the Classic toolbox: a relationship tool is Link with that kind, and switching kinds keeps Link', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Shift+l');
	const rels = page.getByRole('toolbar', { name: 'Toolbox' }).getByRole('group', {
		name: 'Relationships'
	});
	const association = rels.getByRole('radio', { name: 'Association' });
	const aggregation = rels.getByRole('radio', { name: 'Aggregation' });
	await association.click();
	await expect(association).toHaveAttribute('aria-checked', 'true');
	// Another kind re-targets the Link tool; it does not drop back to Select.
	await aggregation.click();
	await expect(aggregation).toHaveAttribute('aria-checked', 'true');
	await expect(association).toHaveAttribute('aria-checked', 'false');
	// The same kind again is the toggle off.
	await aggregation.click();
	await expect(aggregation).toHaveAttribute('aria-checked', 'false');

	// Tooltips carry the label and the platform key, on focus without a delay.
	const toolbar = page.getByRole('toolbar', { name: 'Toolbar' });
	await toolbar.getByRole('button', { name: 'New diagram' }).focus();
	await expect(page.getByRole('tooltip')).toHaveText(/New diagram(⌘N|Ctrl\+N)/);
	// Undo is empty: still focusable, and it says why.
	const undo = toolbar.getByRole('button', { name: 'Undo' });
	await undo.focus();
	await expect(undo).toHaveAttribute('aria-disabled', 'true');
	// The previous tip may still be fading; the one for Undo is the newest.
	await expect(page.getByRole('tooltip').last()).toHaveText(/Nothing to undo/);
});
