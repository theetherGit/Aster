import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Download, type Page } from '@playwright/test';
import { canvasOf, lines, node } from './helpers';

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
	await page.goto('/');
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
	await expect(canvasOf(page)).toBeFocused();

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
	await page.goto('/');
	await expect(canvasOf(page)).toBeFocused();
	await page.keyboard.press('Shift+/');
	const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
	await expect(sheet).toBeVisible();
	await expect(sheet).toContainText('Create and connect');
	await expect(sheet).toContainText('Repeat last create');
	await expect(sheet.locator('kbd', { hasText: /^⌘⇧V$|^Ctrl\+Shift\+V$/ })).toHaveCount(1);
	await sheet.getByLabel('Filter shortcuts').fill('zoom');
	await expect(sheet).toContainText('Zoom to selection');
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
	await page.goto('/');
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
	const zoom = page.getByRole('button', { name: 'Zoom to 100%' });
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
	await page.goto('/');
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

test('themes: ⌘⌥T cycles system → light → dark, the choice is remembered, the paper stays white', async ({
	page
}) => {
	await page.goto('/');
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
	expect(await theme()).toBe('dark');
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Alt+t');
	expect(await theme()).toBe('light'); // back to system
	expect(await page.evaluate(() => localStorage.getItem('aster:theme'))).toBeNull();
});
