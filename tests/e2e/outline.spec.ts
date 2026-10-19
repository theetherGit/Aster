import { expect, test, type Page } from '@playwright/test';
import { canvasOf, lines, node } from './helpers';

/**
 * features.md: Explorer / Outline, M2 editing: "rename, reorder, add and delete in place; this is
 * also the screen-reader editing surface; every model edit possible here". Keyboard only.
 */
const tree = (page: Page) => page.getByRole('tree', { name: 'Model tree' });
const item = (page: Page, name: RegExp) => tree(page).getByRole('treeitem', { name });
const field = (page: Page) => tree(page).getByRole('textbox');

test('outline editing: add, rename, write members, reorder, link and delete from the tree', async ({
	page
}) => {
	await page.goto('/design/new');
	await expect(canvasOf(page)).toBeFocused();
	const diagram = tree(page).locator('[role="treeitem"][aria-level="2"]').first();
	await diagram.focus();

	// ⌘⇧↩ on a diagram: a class, its name open for typing in the row.
	await page.keyboard.press('ControlOrMeta+Shift+Enter');
	await expect(field(page)).toBeFocused();
	await page.keyboard.type('Book');
	await page.keyboard.press('Enter');
	const book = item(page, /^Book/);
	await expect(book).toBeFocused();
	await expect(node(page, 'Book')).toBeVisible();

	// ⌘⇧↩ on a class: a new attribute, written as UML text in the row; ⌘↩ adds the next one.
	await page.keyboard.press('ControlOrMeta+Shift+Enter');
	await expect(field(page)).toBeFocused();
	await page.keyboard.type('- title: String');
	await page.keyboard.press('Enter');
	const title = item(page, /title: String/);
	await expect(title).toBeFocused();
	await page.keyboard.press('ControlOrMeta+Enter');
	await page.keyboard.type('- isbn: String');
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Book', 'attribute')).toHaveText(['- title: String', '- isbn: String']);

	// ⌘↑ moves the focused member up; focus stays on it.
	const isbn = item(page, /isbn: String/);
	await expect(isbn).toBeFocused();
	await page.keyboard.press('ControlOrMeta+ArrowUp');
	await expect(lines(page, 'Book', 'attribute')).toHaveText(['- isbn: String', '- title: String']);
	await expect(isbn).toBeFocused();

	// F2 edits a member line as text; F2 on the class renames it.
	await page.keyboard.press('F2');
	await expect(field(page)).toHaveValue('- isbn: String');
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('- isbn: String {readOnly}');
	await page.keyboard.press('Enter');
	await expect(lines(page, 'Book', 'attribute').first()).toContainText('isbn');
	await book.focus();
	await page.keyboard.press('F2');
	await page.keyboard.press('ControlOrMeta+a');
	await page.keyboard.type('Volume');
	await page.keyboard.press('Enter');
	await expect(node(page, 'Volume')).toBeVisible();
	const volume = item(page, /^Volume/);
	await expect(volume).toBeFocused();

	// ⌘↩ on a class: a sibling class on the same diagram.
	await page.keyboard.press('ControlOrMeta+Enter');
	await page.keyboard.type('Member');
	await page.keyboard.press('Enter');
	const member = item(page, /^Member/);
	await expect(member).toBeFocused();

	// ⇧F10: the row's menu; "Create relationship…" asks for the target in a searchable list,
	// then the kind (1 = association).
	await page.keyboard.press('Shift+F10');
	await page.getByRole('menuitem', { name: /^Create relationship/ }).click();
	const target = tree(page).getByRole('combobox', { name: 'Relationship target' });
	await expect(target).toBeFocused();
	await page.keyboard.type('Vol');
	await page.keyboard.press('ArrowDown');
	await page.keyboard.press('Enter');
	await expect(page.getByRole('menu', { name: 'Relationship kind' })).toBeVisible();
	await page.keyboard.press('1');
	await expect(page.locator('.uml-edge[data-kind="association"]')).toHaveCount(1);
	await expect(member).toBeFocused();

	// ⌫ on a member deletes it; ⌘Z brings it back. ⌘⌫ on a class deletes it from the model.
	await volume.focus();
	await page.keyboard.press('ArrowRight'); // expanded already: to its first child
	await expect(item(page, /isbn/)).toBeFocused();
	await page.keyboard.press('Backspace');
	await expect(lines(page, 'Volume', 'attribute')).toHaveCount(1);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(lines(page, 'Volume', 'attribute')).toHaveCount(2);
	await member.focus();
	await page.keyboard.press('ControlOrMeta+Backspace');
	await expect(node(page, 'Member')).toHaveCount(0);
	await expect(item(page, /^Member/)).toHaveCount(0);
	await expect(page.getByTestId('toast')).toContainText('Member deleted from the model');
	// Focus does not fall out of the tree.
	expect(await tree(page).evaluate((el) => el.contains(document.activeElement))).toBe(true);
});

/** M2.3 prompt: "reorder with Cmd/Ctrl+Up/Down and drag": the pointer path, same command. */
test('outline: dragging a member row onto another in its compartment reorders, one undo step', async ({
	page
}) => {
	await page.goto('/design/sample');
	await expect(canvasOf(page)).toBeFocused();
	const customer = item(page, /^Customer/);
	await customer.click();
	await page.keyboard.press('ArrowRight'); // expand
	const first = item(page, /attribute0: String/);
	const second = item(page, /attribute1: int/);
	await second.dragTo(first);
	await expect(lines(page, 'Customer', 'attribute')).toHaveText([
		'- attribute1: int',
		'# attribute0: String'
	]);
	await page.keyboard.press('ControlOrMeta+z');
	await expect(lines(page, 'Customer', 'attribute')).toHaveText([
		'# attribute0: String',
		'- attribute1: int'
	]);
	// Not across compartments: an attribute dropped on an operation does nothing.
	await second.dragTo(item(page, /operation0\(\)/));
	await expect(lines(page, 'Customer', 'attribute')).toHaveText([
		'# attribute0: String',
		'- attribute1: int'
	]);
});
