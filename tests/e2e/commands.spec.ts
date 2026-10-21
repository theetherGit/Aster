import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Download, type Page } from '@playwright/test';
import { canvasOf, expectKeyboardOnCanvas, lines, node } from './helpers';

const fixture = (name: string) =>
	fileURLToPath(new URL(`../../fixtures/mdj/${name}`, import.meta.url));
async function downloadText(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks).toString('utf8');
}
async function drop(page: Page, name: string, text: string) {
	const dt = await page.evaluateHandle(
		({ name, text }) => {
			const dt = new DataTransfer();
			dt.items.add(new File([text], name, { type: 'application/json' }));
			return dt;
		},
		{ name, text }
	);
	await page.dispatchEvent('body', 'dragover', { dataTransfer: dt });
	await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
}

test('command palette (board 16): ⌘K, filter, Enter runs on the selection; ⌘⇧P is the alias', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await node(page, 'Customer').click();
	await expect(lines(page, 'Customer', 'attribute').first()).toHaveText('# attribute0: String');

	await page.keyboard.press('ControlOrMeta+k');
	const palette = page.getByRole('dialog', { name: 'Command palette' });
	await expect(palette).toBeVisible();
	await expect(palette).toContainText('Acts on Customer');
	await palette.getByRole('combobox', { name: 'Search commands' }).fill('show visib');
	await expect(palette.getByRole('option')).toHaveCount(1);
	await expect(palette.getByRole('option').first()).toContainText('Show visibility');
	await expect(palette.getByRole('option').first()).toContainText('On');
	await page.keyboard.press('Enter');
	await expect(palette).toHaveCount(0);
	// Only the selected class changed: its lines lose the visibility symbol.
	await expect(lines(page, 'Customer', 'attribute').first()).toHaveText('attribute0: String');
	await expect(lines(page, 'Account', 'attribute').nth(1)).toHaveText('- attribute1: int');
	await expectKeyboardOnCanvas(page);

	await page.keyboard.press('ControlOrMeta+Shift+p');
	await expect(palette).toBeVisible();
	await palette.getByRole('combobox', { name: 'Search commands' }).fill('zzzz');
	await expect(palette).toContainText('No matching command');
	await expect(palette.getByRole('img', { name: /no command matched/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(palette).toHaveCount(0);
});

test('shortcut sheet (board 17) opens on ?, is generated from the registry and filters', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('Shift+/');
	const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(sheet).toBeVisible();
	await expect(sheet).toContainText('Create and connect');
	await expect(sheet).toContainText('Move member to top / bottom');
	// Commands with no key in keyboard.md stay in the palette, not on the sheet.
	await expect(sheet).not.toContainText('Repeat last create');
	await expect(sheet.locator('kbd', { hasText: /^⌘⇧V$|^Ctrl\+Shift\+V$/ })).toHaveCount(1);
	await sheet.getByLabel('Filter shortcuts').fill('zoom');
	await expect(sheet).toContainText('Zoom to fit');
	await expect(sheet).not.toContainText('Zoom to selection');
	await expect(sheet).not.toContainText('Save / save as');
	await expect(sheet).not.toContainText('New class');
	await sheet.getByLabel('Filter shortcuts').fill('qqq');
	await expect(sheet).toContainText('No shortcut matches "qqq"');
	await expect(sheet.getByRole('img', { name: /no shortcut matched/ })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	await expect(canvasOf(page)).toBeFocused();
});

test('inspector rail (boards 18–19), ⌘\\, zoom keys and diagram switching', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	// Nothing selected: the 40 px rail with one button.
	const rail = page.getByRole('complementary', { name: 'Inspector, collapsed' });
	await expect(rail).toBeVisible();
	await rail.getByRole('button', { name: /Show inspector/ }).click();
	const inspector = page.getByRole('complementary', { name: 'Inspector' });
	await expect(inspector).toBeVisible();
	await expect(inspector.getByRole('tab', { name: 'Diagram' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(inspector.getByLabel('Diagram name')).toHaveValue('Main');
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+\\');
	await expect(rail).toBeVisible();
	await page.keyboard.press('ControlOrMeta+\\');
	await expect(inspector).toBeVisible();

	// Zoom keys change the zoom readout; ⌘0 brings it back.
	const zoom = page.getByTestId('zoom-level');
	await page.keyboard.press('ControlOrMeta+=');
	await expect(zoom).toHaveText('120%');
	await page.keyboard.press('ControlOrMeta+-');
	await expect(zoom).toHaveText('100%');
	await page.keyboard.press('ControlOrMeta+9');
	await expect(zoom).not.toHaveText('100%');
	await page.keyboard.press('ControlOrMeta+0');
	await expect(zoom).toHaveText('100%');

	// Next / previous diagram on a multi-diagram file.
	await drop(
		page,
		'public-business-modeling.mdj',
		readFileSync(fixture('public-business-modeling.mdj'), 'utf8')
	);
	const tabs = page.getByRole('tablist', { name: 'Diagrams' });
	await expect(tabs.getByRole('tab')).toHaveCount(5);
	const current = () => tabs.getByRole('tab', { selected: true }).textContent();
	const first = await current();
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Shift+]');
	expect(await current()).not.toBe(first);
	await page.keyboard.press('ControlOrMeta+Shift+[');
	expect(await current()).toBe(first);
});

test('display toggles: keys change the diagram defaults or the selection, and round-trip into .mdj view flags', async ({
	page
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
	});
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await drop(
		page,
		'public-staruml-library.mdj',
		readFileSync(fixture('public-staruml-library.mdj'), 'utf8')
	);
	await expect(page.getByTestId('import-notice')).toContainText(
		'Opened public-staruml-library.mdj'
	);
	const some = page.locator('.classifier-node').first();
	const name = (await some.getAttribute('data-name'))!;
	await expect(some.locator('[data-compartment="attribute"]')).toHaveCount(1);

	// No selection: ⌘⇧A hides attributes on every class (diagram default).
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Shift+a');
	await expect(page.locator('.classifier-node [data-compartment="attribute"]')).toHaveCount(0);
	await page.keyboard.press('ControlOrMeta+Shift+a');
	await expect(some.locator('[data-compartment="attribute"]')).toHaveCount(1);

	// One class selected: ⌘⇧0 hides its stereotype line only, and the view flag is written on export.
	await some.click();
	await page.keyboard.press('ControlOrMeta+Shift+a');
	await expect(some.locator('[data-compartment="attribute"]')).toHaveCount(0);
	await expect(
		page.locator('.classifier-node [data-compartment="attribute"]').first()
	).toBeVisible();

	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await sheet.getByRole('radio', { name: '.mdj' }).click();
	const download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).click();
	const json = JSON.parse(await downloadText(await download));
	// Class views that hide attributes, by class name, in a document.
	const hidden = (doc: unknown) => {
		const views: { model: { $ref: string }; suppressAttributes?: boolean }[] = [];
		const classes = new Map<string, string>();
		const walk = (o: unknown) => {
			if (Array.isArray(o)) return o.forEach(walk);
			if (!o || typeof o !== 'object') return;
			const j = o as Record<string, unknown>;
			if (j._type === 'UMLClass') classes.set(j._id as string, j.name as string);
			if (j._type === 'UMLClassView') views.push(j as never);
			for (const [k, v] of Object.entries(j)) if (k !== '_parent') walk(v);
		};
		walk(doc);
		return views.filter((v) => v.suppressAttributes === true).map((v) => classes.get(v.model.$ref));
	};
	const before = hidden(JSON.parse(readFileSync(fixture('public-staruml-library.mdj'), 'utf8')));
	const after = hidden(json);
	expect(after).toContain(name);
	expect(after.length).toBe(before.length + 1);
});

test('the top bar opens the palette; the toolbox links the one selected node', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	await page.getByRole('button', { name: 'Command palette' }).click();
	await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
	await page.keyboard.press('Escape');
	const link = page
		.getByRole('toolbar', { name: 'Toolbox' })
		.getByRole('button', { name: 'Link (L)' });
	await expect(link).toBeDisabled(); // nothing selected
	await expect(page.getByRole('radio', { name: /Package/ })).toHaveCount(0); // M2, no placeholder
	await node(page, 'Account').click();
	await expect(link).toBeEnabled();
	await link.click();
	await expect(page.locator('.link-preview')).toBeVisible(); // the keyboard link has begun
	await expectKeyboardOnCanvas(page); // so the arrows and Esc work at once
	// The pointer path: a click on another node picks it and opens the picker, as ↩ does.
	await node(page, 'Customer').click();
	const picker = page.getByRole('menu', { name: 'Relationship kind' });
	await expect(picker).toBeVisible();
	await expect(picker).toContainText('Account');
	await expect(picker).toContainText('Customer');
	await page.keyboard.press('Escape');
	await expect(picker).toHaveCount(0);
	await expect(page.locator('.link-preview')).toHaveCount(0);
	await expectKeyboardOnCanvas(page);
});

test('themes: ⌘⌥T cycles system → light → dark, the choice is remembered, the paper stays white', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const theme = () => page.evaluate(() => document.documentElement.dataset.theme);
	const paper = () =>
		page.evaluate(() =>
			getComputedStyle(document.documentElement).getPropertyValue('--paper-bg').trim()
		);
	expect(await theme()).toBe('light'); // the test browser prefers light
	await page.keyboard.press('ControlOrMeta+Alt+t');
	expect(await theme()).toBe('light'); // explicit light
	await page.keyboard.press('ControlOrMeta+Alt+t');
	expect(await theme()).toBe('dark');
	expect(['#ffffff', '#fff']).toContain(await paper()); // the minifier shortens it
	const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
	expect(bg).toBe('rgb(26, 26, 31)');
	await page.reload();
	await expect.poll(theme).toBe('dark'); // applied before first paint by app.html's script
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Alt+t');
	expect(await theme()).toBe('high-contrast');
	expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
		'rgb(0, 0, 0)'
	);
	expect(['#ffffff', '#fff']).toContain(await paper()); // paper stays white here too
	await page.keyboard.press('ControlOrMeta+Alt+t');
	expect(await theme()).toBe('light'); // back to system
	expect(await page.evaluate(() => localStorage.getItem('aster:theme'))).toBe('system');
});

test('the "+" after the tabs adds a numbered class diagram, switches to it, and undoes as one step', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const tabs = page.getByRole('tablist', { name: 'Diagrams' });
	await expect(tabs.getByRole('tab')).toHaveCount(1);
	await page.getByRole('button', { name: 'Add diagram' }).click();
	await expect(tabs.getByRole('tab')).toHaveCount(2);
	await expect(tabs.getByRole('tab', { name: 'Class diagram 2' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(canvasOf(page)).toBeFocused();
	await expect(page.locator('.classifier-node')).toHaveCount(0);
	// ⌘⇧[ goes back; undo removes the diagram again.
	await page.keyboard.press('ControlOrMeta+Shift+[');
	await expect(tabs.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(tabs.getByRole('tab')).toHaveCount(1);
	await page.keyboard.press('ControlOrMeta+Shift+z');
	await expect(tabs.getByRole('tab')).toHaveCount(2);
});

test('rename the project in place: menu item or F2, Enter commits, the title and the URL follow', async ({
	page
}) => {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	const trigger = page.getByTestId('project-menu');
	await trigger.click();
	await page.getByRole('menuitem', { name: 'Rename project…' }).click();
	const field = page.getByRole('textbox', { name: 'Project name' });
	await expect(field).toBeFocused();
	await expect(field).toHaveValue('Untitled');
	await page.keyboard.type('Billing');
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('project-name')).toHaveText('Billing');
	await expect(trigger).toBeFocused();
	await expect(page).toHaveTitle(/^Billing/);
	await expect(page).toHaveURL(/\/design\/billing$/);
	// F2 on the name opens the editor; Esc keeps the old name.
	await page.keyboard.press('F2');
	await page.keyboard.type('Nope');
	await page.keyboard.press('Escape');
	await expect(page.getByTestId('project-name')).toHaveText('Billing');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(page.getByTestId('project-name')).toHaveText('Untitled');
});

test('diagram tabs rename in place and delete from their context menu with an undo toast', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const tabs = page.getByRole('tablist', { name: 'Diagrams' });
	const main = tabs.getByRole('tab', { name: 'Main' });
	// A lone diagram cannot be deleted.
	await main.click({ button: 'right' });
	await expect(page.getByRole('menuitem', { name: 'Delete diagram' })).toHaveAttribute(
		'data-disabled',
		''
	);
	await page.keyboard.press('Escape');
	// Double-click renames; the inspector's Diagram tab and the tab agree.
	await main.dblclick();
	const field = page.getByRole('textbox', { name: 'Diagram name' });
	await expect(field).toBeFocused();
	await page.keyboard.type('Overview');
	await page.keyboard.press('Enter');
	const overview = tabs.getByRole('tab', { name: 'Overview' });
	await expect(overview).toHaveAttribute('aria-selected', 'true');
	await expect(overview).toBeFocused();
	// F2 on a focused tab opens the same editor; Esc reverts.
	await page.keyboard.press('F2');
	await page.keyboard.type('Zzz');
	await page.keyboard.press('Escape');
	await expect(tabs.getByRole('tab', { name: 'Overview' })).toBeVisible();
	// Add one; its hover × and its menu both open the confirm dialog, which needs the name typed.
	await page.getByRole('button', { name: 'Add diagram' }).click();
	const second = tabs.getByRole('tab', { name: 'Class diagram 2' });
	await second.hover();
	await page.getByRole('button', { name: 'Delete Class diagram 2' }).click();
	const dialog = page.getByRole('alertdialog', { name: 'Delete Class diagram 2?' });
	await expect(dialog).toBeVisible();
	await expect(page.getByTestId('confirm-delete')).toBeDisabled();
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(tabs.getByRole('tab')).toHaveCount(2);
	await second.click({ button: 'right' });
	await page.getByRole('menuitem', { name: 'Delete diagram' }).click();
	const confirmField = dialog.getByRole('textbox', { name: 'Type Class diagram 2 to confirm' });
	await expect(confirmField).toBeFocused();
	await page.keyboard.type('Class diagram');
	await expect(page.getByTestId('confirm-delete')).toBeDisabled();
	await page.keyboard.type(' 2');
	await page.keyboard.press('Enter');
	await expect(dialog).toHaveCount(0);
	await expect(tabs.getByRole('tab')).toHaveCount(1);
	await expect(tabs.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const toast = page.getByTestId('toast');
	await expect(toast).toContainText('Class diagram 2 deleted');
	await toast.getByRole('button', { name: /Undo/ }).click();
	await expect(tabs.getByRole('tab')).toHaveCount(2);
});

test('the Outline opens by default on a wide window, stays closed on a narrow one, and has a rail', async ({
	browser
}) => {
	const wide = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await wide.newPage();
	await page.goto('/design/sample');
	const tree = page.getByRole('tree', { name: 'Model tree' });
	await expect(tree).toBeVisible();
	await page.keyboard.press('ControlOrMeta+b');
	await expect(tree).toHaveCount(0);
	const rail = page.getByRole('complementary', { name: 'Outline, collapsed' });
	await rail.getByRole('button', { name: 'Show Outline' }).click();
	await expect(tree).toBeVisible();
	await wide.close();

	const narrow = await browser.newContext({ viewport: { width: 1100, height: 800 } });
	const page2 = await narrow.newPage();
	await page2.goto('/design/sample');
	await expect(page2.getByRole('tree', { name: 'Model tree' })).toHaveCount(0);
	await expect(page2.getByRole('button', { name: 'Show Outline' })).toBeVisible();
	await narrow.close();
});

test('the browser-only banner offers to name the project in place', async ({ page }) => {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(640, 420);
	await page.keyboard.press('c');
	await page.keyboard.type('Order');
	await page.keyboard.press('Escape');
	const banner = page.getByRole('region', { name: 'Not saved to a file' });
	await expect(banner).toBeVisible();
	await banner.getByRole('button', { name: 'Name it' }).click();
	const field = page.getByRole('textbox', { name: 'Project name' });
	await expect(field).toBeFocused();
	await page.keyboard.type('Orders');
	await page.keyboard.press('Enter');
	await expect(page.getByTestId('project-name')).toHaveText('Orders');
});

test('each panel has its own close button, and the rails bring it back', async ({ page }) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const tree = page.getByRole('tree', { name: 'Model tree' });
	await expect(tree).toBeVisible();
	await page.getByRole('button', { name: 'Hide outline' }).click();
	await expect(tree).toHaveCount(0);
	await page.getByRole('button', { name: 'Show Outline' }).click();
	await expect(tree).toBeVisible();

	await page.locator('.classifier-node[data-name="Customer"]').click();
	const inspector = page.getByRole('complementary', { name: 'Inspector', exact: true });
	await expect(inspector).toBeVisible();
	await inspector.getByRole('button', { name: 'Hide inspector' }).click();
	await expect(inspector).toHaveCount(0);
	await page.getByRole('button', { name: 'Show inspector' }).click();
	await expect(inspector).toBeVisible();
});

/** features.md M2: ⌘P finds elements and diagrams by name; quick find centres the canvas on the hit. */
test('quick find: ⌘P finds elements and diagrams, opens the hit and centres the canvas on it', async ({
	page
}) => {
	await page.goto('/design/sample');
	const canvas = canvasOf(page);
	await expect(canvas).toBeFocused();
	// Push Customer off-centre first, so centring is visible.
	await page.keyboard.press('ControlOrMeta+=');
	await page.keyboard.press('ControlOrMeta+=');

	const find = page.getByRole('dialog', { name: 'Quick find' });
	const input = find.getByRole('combobox', { name: 'Find an element or diagram' });
	const openFind = async () => {
		await page.keyboard.press('ControlOrMeta+p');
		await expect(input).toBeFocused();
	};
	await openFind();
	await page.keyboard.type('cust');
	await expect(find.getByRole('option')).toHaveCount(1);
	await page.keyboard.press('Enter');
	await expect(find).toHaveCount(0);
	const customer = node(page, 'Customer');
	await expect(customer).toBeFocused();
	await expect(customer).toHaveClass(/selected/);
	await expect
		.poll(async () => {
			const c = (await canvas.boundingBox())!;
			const n = (await customer.boundingBox())!;
			return Math.round(
				Math.hypot(
					n.x + n.width / 2 - (c.x + c.width / 2),
					n.y + n.height / 2 - (c.y + c.height / 2)
				)
			);
		})
		.toBeLessThan(4);

	// Diagrams are hits too, and an element on another diagram opens that diagram.
	await page.getByRole('button', { name: 'Add diagram' }).click();
	await expect(page.getByRole('tab', { name: 'Class diagram 2' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await openFind();
	await page.keyboard.type('Account');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'true');
	await expect(node(page, 'Account')).toBeFocused();
	await openFind();
	await page.keyboard.type('diagram 2');
	await expect(find.getByRole('option')).toHaveCount(1);
	await page.keyboard.press('Enter');
	await expect(page.getByRole('tab', { name: 'Class diagram 2' })).toHaveAttribute(
		'aria-selected',
		'true'
	);

	// Nothing found says so.
	await openFind();
	await page.keyboard.type('zzz');
	await expect(find).toContainText('Nothing by that name');
	await page.keyboard.press('Escape');
	await expect(find).toHaveCount(0);
});
