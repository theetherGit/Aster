import { expect, test, type Locator, type Page } from '@playwright/test';
import { canvasOf, create, lines, node } from './helpers';

/** Wait for an editor to own focus (a few frames after Enter), then type into it. */
async function typeInto(page: Page, editor: Locator, text: string) {
	await expect(editor).toBeFocused();
	await page.keyboard.type(text);
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(canvasOf(page)).toBeFocused();
	await page.mouse.move(640, 420);
});

test('inline UML text editing, keyboard only', async ({ page }) => {
	const canvas = canvasOf(page);
	const attr = canvas.getByRole('combobox', { name: 'Attribute line' });
	const op = canvas.getByRole('combobox', { name: 'Operation line' });

	await create(page, 'c', 'Book');
	await typeInto(page, attr, '- isbn: String');
	await expect(page.getByRole('status')).toHaveText('private · String');
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Book', 'attribute')).toHaveText(['- isbn: String']);
	await expect(attr).toHaveValue('');
	await expect(attr).toHaveAttribute('placeholder', 'name: Type'); // ghost text

	await typeInto(page, attr, '+ {static} count: int = 0');
	await page.keyboard.press('Enter');
	await typeInto(page, attr, '+ broken(');
	await expect(page.getByRole('status')).toHaveText('Not parsed; kept as text');
	await page.keyboard.press('Enter');
	await expect(node(page, 'Book').locator('[data-compartment="attribute"] li.raw')).toHaveText(
		'+ broken('
	);
	await expect(node(page, 'Book').locator('[data-compartment="attribute"] li.static')).toHaveText(
		'+ count: int = 0' // underline carries static on paper; the keyword stays in the edit text
	);

	// Tab: next compartment (operations), a new line since it is empty.
	await expect(attr).toBeFocused();
	await page.keyboard.press('Tab');
	await typeInto(page, op, '+ borrow(): void');
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Book', 'operation')).toHaveText(['+ borrow(): void']);
	await expect(op).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(canvas).toBeFocused();
	await expect(canvas.locator('input')).toHaveCount(0);

	// ⌘↩ from an operation line adds an attribute line; ⌘⇧↩ adds an operation line.
	await page.keyboard.press('Enter');
	await expect(canvas.getByRole('textbox', { name: 'Name' })).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(op).toBeFocused();
	await expect(op).toHaveValue('+ borrow(): void');
	await page.keyboard.press('ControlOrMeta+Enter');
	await typeInto(page, attr, '# pages: int');
	await page.keyboard.press('ControlOrMeta+Shift+Enter');
	await typeInto(page, op, '+ {abstract} describe(): String');
	await page.keyboard.press('Enter');
	await expect(op).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(lines(page, 'Book', 'attribute')).toHaveText([
		'- isbn: String',
		'+ count: int = 0',
		'+ broken(',
		'# pages: int'
	]);
	await expect(lines(page, 'Book', 'operation')).toHaveText([
		'+ borrow(): void',
		'+ describe(): String'
	]);
	await expect(node(page, 'Book').locator('[data-compartment="operation"] li.abstract')).toHaveText(
		'+ describe(): String'
	);

	// ⌘↓ reorders the open line and follows it; undo puts it back.
	await page.keyboard.press('Enter');
	await expect(canvas.getByRole('textbox', { name: 'Name' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(attr).toBeFocused();
	await expect(attr).toHaveValue('- isbn: String');
	await page.keyboard.press('ControlOrMeta+ArrowDown');
	await expect(attr).toBeFocused();
	await expect(attr).toHaveValue('- isbn: String');
	await page.keyboard.press('Escape');
	await expect(lines(page, 'Book', 'attribute').nth(1)).toHaveText('- isbn: String');
	await page.keyboard.press('ControlOrMeta+z');
	await expect(lines(page, 'Book', 'attribute').nth(0)).toHaveText('- isbn: String');

	// Emptying an existing line deletes it and the editor closes.
	await page.keyboard.press('Enter');
	await expect(canvas.getByRole('textbox', { name: 'Name' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(attr).toBeFocused();
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Enter');
	await expect(canvas).toBeFocused();
	await expect(lines(page, 'Book', 'attribute')).toHaveCount(3);
});

test('type-name completion offers project classifiers after a colon', async ({ page }) => {
	const canvas = canvasOf(page);
	await create(page, 'c', 'Shelf');
	const attr = canvas.getByRole('combobox', { name: 'Attribute line' });
	await typeInto(page, attr, '- owner: Cu');
	const list = page.getByRole('listbox', { name: 'Type names' });
	await expect(list.getByRole('option')).toHaveText(['Customer']);
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(attr).toHaveValue('- owner: Customer');
	await expect(list).toHaveCount(0);
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Shelf', 'attribute')).toHaveText(['- owner: Customer']);
	// A fully typed type name offers nothing, so Enter commits in one go.
	await typeInto(page, attr, '- tags: String');
	await expect(list).toHaveCount(0);
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Shelf', 'attribute')).toHaveText([
		'- owner: Customer',
		'- tags: String'
	]);
});

test('I, E and D create interface, enum and data type nodes with the right compartments', async ({
	page
}) => {
	const canvas = canvasOf(page);

	await create(page, 'i', 'Searchable');
	await typeInto(
		page,
		canvas.getByRole('combobox', { name: 'Operation line' }),
		'+ search(q: String): Book'
	);
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Searchable', 'operation')).toHaveText(['+ search(q: String): Book']);
	await expect(canvas.getByRole('combobox', { name: 'Operation line' })).toBeFocused();
	await page.keyboard.press('Escape');
	const iface = node(page, 'Searchable');
	await expect(iface).toHaveAttribute('data-kind', 'interface');
	await expect(iface.locator('.stereotype')).toHaveText('«interface»');
	await expect(iface.locator('[data-compartment="attribute"]')).toHaveCount(1); // 8 px strip
	await expect(iface.locator('[data-compartment="attribute"]')).toHaveClass(/empty/);

	await page.mouse.move(900, 300);
	await create(page, 'e', 'Status');
	const lit = canvas.getByRole('textbox', { name: 'Literal line' });
	await typeInto(page, lit, 'ACTIVE');
	await page.keyboard.press('Enter');
	await typeInto(page, lit, '<<default>> IDLE');
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Status', 'literal')).toHaveText(['ACTIVE', '«default» IDLE']);
	await expect(lit).toBeFocused();
	await page.keyboard.press('Escape');
	const en = node(page, 'Status');
	await expect(en.locator('.stereotype')).toHaveText('«enumeration»');
	await expect(en.locator('[data-compartment="attribute"]')).toHaveCount(0);

	await page.mouse.move(900, 600);
	await create(page, 'd', 'Money');
	await expect(canvas.getByRole('combobox', { name: 'Attribute line' })).toBeFocused();
	await page.keyboard.press('Escape');
	const dt = node(page, 'Money');
	await expect(dt.locator('.stereotype')).toHaveText('«dataType»');
	await expect(dt.locator('[data-compartment="operation"]')).toHaveClass(/empty/);

	await page.keyboard.press('ControlOrMeta+z');
	await expect(dt).toHaveCount(0);
});
