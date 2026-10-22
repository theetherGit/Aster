import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { canvasOf, fromPalette, node } from './helpers';

/**
 * Lab rehearsal (M1 exit criterion: "the lab exercise done in Aster, saved as .mdj … exported as
 * PNG"), keyboard only. Exercise 5 of the OOAD-patterns lab sheet (vivekhathwar/OOADP,
 * Manual/Questions-OOADP.pdf): notify a country's Decathlon customers of festival discounts with
 * the Observer pattern. The classes follow the sheet's reference solution (Manual/Observer).
 */
const tree = (page: Page) => page.getByRole('tree', { name: 'Model tree' });
const row = (page: Page, name: string) =>
	tree(page).getByRole('treeitem', { name: new RegExp(`^${name}\\b`) });

async function typeInto(page: Page, editor: Locator, text: string) {
	await expect(editor).toBeFocused();
	await page.keyboard.type(text);
	await page.keyboard.press('Enter');
}

/** C or I, the name, then member lines; Tab moves from attributes to operations. */
async function classifier(
	page: Page,
	key: 'c' | 'i',
	name: string,
	attrs: string[],
	ops: string[]
) {
	const canvas = canvasOf(page);
	await page.keyboard.press(key);
	const nameBox = canvas.getByRole('textbox', { name: 'Name' });
	await expect(nameBox).toBeFocused();
	await page.keyboard.type(name);
	await page.keyboard.press('Enter');
	const attr = canvas.getByRole('combobox', { name: 'Attribute line' });
	const op = canvas.getByRole('combobox', { name: 'Operation line' });
	for (const a of attrs) await typeInto(page, attr, a);
	if (key === 'c' && ops.length) {
		await expect(attr).toBeFocused();
		await page.keyboard.press('Tab');
	}
	for (const o of ops) await typeInto(page, op, o);
	await page.keyboard.press('Escape');
	await expect(node(page, name)).toBeVisible();
}

/** Arrow keys from the diagram's row down to a class's row, as a keyboard user walks the tree. */
async function walkTo(page: Page, name: string) {
	await tree(page)
		.getByRole('treeitem', { name: /^Class diagram/ })
		.focus();
	const target = row(page, name);
	for (let i = 0; i < 12 && !(await target.evaluate((el) => el === document.activeElement)); i++)
		await page.keyboard.press('ArrowDown');
	await expect(target).toBeFocused();
}

/** In an open menu, ↓ until the item is highlighted, then ↩. */
async function choose(page: Page, name: RegExp) {
	const item = page.getByRole('menuitem', { name });
	await expect(item).toBeVisible();
	for (let i = 0; i < 15 && (await item.getAttribute('data-highlighted')) === null; i++)
		await page.keyboard.press('ArrowDown');
	await expect(item).toHaveAttribute('data-highlighted');
	await page.keyboard.press('Enter');
}

/** From the Outline: the row's menu (⇧F10), "Create relationship…", the target by name, the kind's digit. */
async function relate(page: Page, from: string, to: string, kind: string) {
	await walkTo(page, from);
	await page.keyboard.press('Shift+F10');
	await choose(page, /^Create relationship/);
	const target = tree(page).getByRole('combobox', { name: 'Relationship target' });
	await expect(target).toBeFocused();
	await page.keyboard.type(to);
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menu', { name: 'Relationship kind' })).toBeVisible();
	await page.keyboard.press(kind);
	await expect(page.getByRole('menu', { name: 'Relationship kind' })).toHaveCount(0);
}

async function bytes(d: Download) {
	const chunks: Buffer[] = [];
	for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
	return Buffer.concat(chunks);
}

test('lab exercise 5 (Observer), keyboard only: model, lay out, save .mdj, export PNG', async ({
	page
}) => {
	const started = Date.now();
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();

	await classifier(page, 'i', 'Observer', [], ['+ update(discount: float): void']);
	await classifier(
		page,
		'i',
		'Subject',
		[],
		[
			'+ register(o: Observer): void',
			'+ unregister(o: Observer): void',
			'+ notifyObservers(): void'
		]
	);
	await classifier(
		page,
		'c',
		'Store',
		['- name: String', '- discount: float'],
		['+ setDiscount(festival: String, d: float): void']
	);
	await classifier(
		page,
		'c',
		'Customer',
		['- name: String', '- discount: float'],
		['+ update(discount: float): void']
	);

	// The Outline lists the diagram's classes once its row is open (→, as in any tree).
	await tree(page)
		.getByRole('treeitem', { name: /^Class diagram/ })
		.focus();
	await page.keyboard.press('ArrowRight');
	await expect(row(page, 'Store')).toBeVisible();
	await relate(page, 'Store', 'Subject', '5'); // realization
	await relate(page, 'Customer', 'Observer', '5');
	// Aggregation from the part to the whole, as StarUML draws it: the diamond lands on Store.
	await relate(page, 'Observer', 'Store', '2');
	await relate(page, 'Customer', 'Subject', '1'); // association: the customer knows its store
	await expect(page.locator('.uml-edge')).toHaveCount(4);
	await expect(page.locator('.uml-edge[data-kind="realization"]')).toHaveCount(2);

	// Tidy, then nothing overlaps.
	await canvasOf(page).focus();
	await fromPalette(page, 'Auto-layout: Orthogonal, top to bottom');
	await expect(page.getByTestId('toast')).toContainText('Laid out');
	const boxes = await page
		.locator('.classifier-node')
		.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
	for (const [i, a] of boxes.entries())
		for (const b of boxes.slice(i + 1))
			expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(
				true
			);

	// The .mdj, from the export sheet's Project tab, keyboard only: what StarUML will open.
	await canvasOf(page).focus();
	await page.keyboard.press('ControlOrMeta+Shift+e');
	const sheet = page.getByRole('dialog', { name: 'Export diagram' });
	await expect(sheet.getByRole('tab', { name: 'Image' })).toBeFocused();
	for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
	await expect(sheet.getByRole('tab', { name: 'Project' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	let download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).focus();
	await page.keyboard.press('Enter');
	const mdj = JSON.parse((await bytes(await download)).toString('utf8'));
	const all: Record<string, unknown>[] = [];
	(function walk(o: unknown) {
		if (Array.isArray(o)) return o.forEach(walk);
		if (o && typeof o === 'object') {
			all.push(o as Record<string, unknown>);
			for (const [k, v] of Object.entries(o)) if (k !== '_parent') walk(v);
		}
	})(mdj);
	const named = (type: string) => all.filter((o) => o._type === type).map((o) => o.name);
	expect(mdj._type).toBe('Project');
	expect(named('UMLInterface').sort()).toEqual(['Observer', 'Subject']);
	expect(named('UMLClass').sort()).toEqual(['Customer', 'Store']);
	expect(all.filter((o) => o._type === 'UMLInterfaceRealization')).toHaveLength(2);
	expect(all.filter((o) => o._type === 'UMLAssociation')).toHaveLength(2);
	expect(
		all.filter((o) => o._type === 'UMLClassView' || o._type === 'UMLInterfaceView')
	).toHaveLength(4);
	const store = all.find((o) => o._type === 'UMLClass' && o.name === 'Store')!;
	expect((store.operations as { name: string }[]).map((o) => o.name)).toEqual(['setDiscount']);

	// The PNG for the backup copy: cropped to the drawing, at 2×. The sheet reopens on its last tab.
	await page.keyboard.press('Escape');
	await expect(sheet).toBeHidden();
	await page.keyboard.press('ControlOrMeta+Shift+e');
	await expect(sheet.getByRole('tab', { name: 'Project' })).toBeFocused();
	for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowLeft');
	await expect(sheet.getByRole('tab', { name: 'Image' })).toHaveAttribute('aria-selected', 'true');
	download = page.waitForEvent('download');
	await sheet.getByRole('button', { name: 'Download' }).focus();
	await page.keyboard.press('Enter');
	const png = await bytes(await download);
	expect(png.subarray(1, 4).toString()).toBe('PNG');
	const [w, h] = [png.readUInt32BE(16), png.readUInt32BE(20)];
	expect(w).toBeLessThan(2400);
	expect(h).toBeLessThan(2400);
	console.log(`lab rehearsal: ${((Date.now() - started) / 1000).toFixed(1)} s, PNG ${w} × ${h}`);
});
